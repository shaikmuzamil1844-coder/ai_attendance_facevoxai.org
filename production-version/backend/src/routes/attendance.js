// src/routes/attendance.js — Attendance session and marking routes (v2.0)
// Improvements:
//   ✅ Voice attendance fixed: uses pgvector search_voice_embedding_v2()
//   ✅ Socket.IO real-time events on every attendance mark
//   ✅ Audit log writes for every biometric action
//   ✅ Subject-scoped face/voice search (search_face_embedding_v2)
//   ✅ End session emits socket event with final report
//   ✅ Improved AI service error handling with timeouts
const express = require('express');
const { z }   = require('zod');
const axios   = require('axios');

const { query, getClient }  = require('../config/db');
const { requireAuth }       = require('../middleware/auth');
const { staffOnly, adminOrHod, anyRole } = require('../middleware/rbac');
const { validateBody }      = require('../middleware/validate');
const { asyncWrap, createError } = require('../middleware/errorHandler');

const router = express.Router();

const AI_URL = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Helper: get Socket.IO instance from Express app
const getIo = (req) => req.app.get('io');

// Helper: write to attendance_audit_log
async function writeAuditLog(data) {
  try {
    await query(
      `INSERT INTO attendance_audit_log
         (session_id, student_id, action, performed_by, confidence, distance, similarity, is_live, spoof_reasons, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        data.sessionId, data.studentId, data.action, data.performedBy,
        data.confidence ?? null, data.distance ?? null, data.similarity ?? null,
        data.isLive ?? null,
        data.spoofReasons ? JSON.stringify(data.spoofReasons) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
  } catch (err) {
    // Non-fatal — don't block attendance
    console.error('[AuditLog] Failed to write audit entry:', err.message);
  }
}

// ════════════════════════════════════════════════════════════
// SESSIONS
// ════════════════════════════════════════════════════════════

/**
 * POST /api/attendance/sessions/start
 * Faculty starts a new attendance session.
 * Returns: { sessionId, subject, startedAt }
 */
router.post('/attendance/sessions/start', requireAuth, staffOnly,
  validateBody(z.object({
    subjectId:   z.string().uuid(),
    classroomId: z.string().uuid().optional(),
    topic:       z.string().max(200).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { subjectId, classroomId, topic } = req.body;
    let facultyId = req.user.facultyId;
    if (req.user.role === 'faculty') {
      if (!facultyId) throw createError(403, 'No faculty profile linked to this user account.');
      // Verify faculty is assigned to teach this subject
      const assignCheck = await query(
        `SELECT 1 FROM faculty_subjects WHERE faculty_id = $1 AND subject_id = $2`,
        [facultyId, subjectId]
      );
      if (!assignCheck.rows[0]) {
        throw createError(403, 'You are not assigned to teach this subject. Teachers can only conduct attendance for their assigned classes.');
      }
    } else if (req.user.role === 'admin' || req.user.role === 'hod') {
      if (!facultyId) {
        const fRes = await query(`SELECT faculty_id FROM faculty_subjects WHERE subject_id = $1 LIMIT 1`, [subjectId]);
        facultyId = fRes.rows[0]?.faculty_id;
        if (!facultyId) {
          const anyF = await query(`SELECT id FROM faculty WHERE is_active = true LIMIT 1`, []);
          facultyId = anyF.rows[0]?.id || null;
        }
      }
    }
    if (!facultyId) throw createError(400, 'No faculty member found to assign this session to.');

    // Create session
    const { rows } = await query(
      `INSERT INTO class_sessions
         (subject_id, faculty_id, classroom_id, session_date, start_time,
          status, topic_covered, started_at)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_TIME, 'live', $4, now())
       RETURNING id, session_date, start_time, status, started_at`,
      [subjectId, facultyId, classroomId || null, topic || null]
    );
    const session = rows[0];

    // Pre-populate attendance rows for all enrolled students (status = absent by default)
    await query(
      `INSERT INTO attendance (session_id, student_id, subject_id, faculty_id, status, method)
       SELECT $1, ss.student_id, $2, $3, 'absent', 'manual'
       FROM student_subjects ss
       WHERE ss.subject_id = $2
       ON CONFLICT (session_id, student_id) DO NOTHING`,
      [session.id, subjectId, facultyId]
    );

    res.status(201).json({
      sessionId: session.id,
      startedAt: session.started_at,
      status:    session.status,
    });
  })
);

/**
 * POST /api/attendance/sessions/:sessionId/end
 * Faculty ends a live session.
 */
router.post('/attendance/sessions/:sessionId/end', requireAuth, staffOnly,
  asyncWrap(async (req, res) => {
    const { rows } = await query(
      `UPDATE class_sessions
       SET status = 'completed', ended_at = now(), end_time = CURRENT_TIME
       WHERE id = $1 AND (faculty_id = $2 OR $3 = 'admin' OR $3 = 'hod')
       RETURNING id, status, ended_at`,
      [req.params.sessionId, req.user.facultyId, req.user.role]
    );
    if (!rows[0]) throw createError(404, 'Session not found or unauthorized.');

    // Fetch final summary for socket broadcast
    const { rows: summary } = await query(
      `SELECT COUNT(id) AS total,
              SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent
       FROM attendance WHERE session_id = $1`,
      [req.params.sessionId]
    );

    // Emit session:ended event to all faculty watching this session
    const io = getIo(req);
    if (io) {
      io.to(`session:${req.params.sessionId}`).emit('session:ended', {
        sessionId: req.params.sessionId,
        endedAt: rows[0].ended_at,
        summary: summary[0],
      });
    }

    res.json({ ...rows[0], summary: summary[0] });
  })
);

/**
 * GET /api/attendance/sessions — list sessions for current faculty or all (admin/hod)
 */
router.get('/attendance/sessions', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const params  = [];
  const filters = [];

  if (req.user.role === 'faculty') {
    params.push(req.user.facultyId);
    filters.push(`cs.faculty_id = $${params.length}`);
  }
  if (req.query.subjectId) {
    params.push(req.query.subjectId);
    filters.push(`cs.subject_id = $${params.length}`);
  }
  if (req.query.date) {
    params.push(req.query.date);
    filters.push(`cs.session_date = $${params.length}`);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const { rows } = await query(
    `SELECT cs.id, cs.session_date, cs.start_time, cs.end_time, cs.status,
            cs.topic_covered, cs.started_at, cs.ended_at,
            sub.name AS subject_name, sub.code AS subject_code,
            f.name AS faculty_name,
            cl.name AS classroom_name,
            COUNT(a.id) AS total_students,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count
     FROM class_sessions cs
     JOIN subjects sub ON sub.id = cs.subject_id
     JOIN faculty  f   ON f.id   = cs.faculty_id
     LEFT JOIN classrooms cl ON cl.id = cs.classroom_id
     LEFT JOIN attendance a ON a.session_id = cs.id
     ${where}
     GROUP BY cs.id, sub.name, sub.code, f.name, cl.name
     ORDER BY cs.session_date DESC, cs.start_time DESC
     LIMIT 100`,
    params
  );
  res.json(rows);
}));

// ════════════════════════════════════════════════════════════
// FACE ATTENDANCE
// ════════════════════════════════════════════════════════════

/**
 * POST /api/attendance/face
 * Body: { sessionId, imageBase64 }
 * 1. Send image to AI service → get face embeddings
 * 2. Search pgvector for matching students
 * 3. Update attendance table
 * 4. Return results
 */
router.post('/attendance/face', requireAuth, staffOnly,
  validateBody(z.object({
    sessionId:   z.string().uuid(),
    imageBase64: z.string().min(100, 'Image data required'),
  })),
  asyncWrap(async (req, res) => {
    const { sessionId, imageBase64 } = req.body;

    // 1. Verify session exists and is live
    const sessionRes = await query(
      `SELECT cs.id, cs.subject_id, cs.faculty_id
       FROM class_sessions cs
       WHERE cs.id = $1 AND cs.status = 'live'`,
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session) throw createError(404, 'Session not found or not active.');

    // 2. Call Python AI service to extract face embeddings
    let aiResult;
    try {
      const aiResponse = await axios.post(
        `${AI_URL()}/api/v1/face/extract`,
        {
          image_b64: imageBase64,
          check_liveness: true,
          enforce_quality: false,
        },
        {
          headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET },
          timeout: 30000,
        }
      );
      aiResult = aiResponse.data;
    } catch (err) {
      const status = err.code === 'ECONNREFUSED' ? 503 : (err.response?.status || 503);
      throw createError(status, 'AI service unavailable. Please try again.');
    }

    const faces = aiResult.faces || [];
    if (faces.length === 0) {
      return res.json({ matched: [], unmatched: 0, message: 'No faces detected in image.' });
    }

    const io = getIo(req);
    const results = [];

    // 3. For each detected face, use subject-scoped pgvector search
    for (const face of faces) {
      const liveness = face.liveness || {};
      const isLive   = liveness.is_live !== false;

      if (!isLive) {
        // Log spoofing attempt
        await writeAuditLog({
          sessionId, studentId: null, action: 'spoof_detected',
          performedBy: req.user.userId,
          isLive: false, spoofReasons: liveness.spoof_reasons || [],
        });
        results.push({ status: 'spoof', reasons: liveness.spoof_reasons || [] });
        continue;
      }

      const embedding = face.embedding;
      const vectorLiteral = `[${embedding.join(',')}]`;

      // Use subject-scoped search (only match students enrolled in this subject)
      let matchRes;
      try {
        matchRes = await query(
          `SELECT * FROM search_face_embedding_v2($1::vector, $2::uuid, 0.5, 3)`,
          [vectorLiteral, session.subject_id]
        );
      } catch {
        // Fall back to global search if function not yet deployed
        matchRes = await query(
          `SELECT * FROM search_face_embedding($1::vector, 0.5, 3)`,
          [vectorLiteral]
        );
      }

      if (matchRes.rows.length > 0) {
        const best = matchRes.rows[0];
        const confidence = Math.round((1 - best.distance) * 100);

        // Upsert attendance row
        await query(
          `INSERT INTO attendance
             (session_id, student_id, subject_id, faculty_id, status, method,
              confidence, face_distance, is_live, marked_at, marked_by)
           VALUES ($1,$2,$3,$4,'present','face',$5,$6,true,now(),$7)
           ON CONFLICT (session_id, student_id)
           DO UPDATE SET
             status='present', method='face', confidence=$5,
             face_distance=$6, is_live=true, marked_at=now(), marked_by=$7`,
          [sessionId, best.student_id, session.subject_id,
           session.faculty_id, confidence / 100, best.distance, req.user.userId]
        );

        // Write audit log
        await writeAuditLog({
          sessionId, studentId: best.student_id, action: 'face_match',
          performedBy: req.user.userId,
          confidence: confidence / 100, distance: best.distance,
          isLive: true, spoofReasons: [],
          metadata: { face_quality: face.quality },
        });

        const matchResult = {
          studentId: best.student_id, name: best.name,
          rollNumber: best.roll_number, confidence, distance: best.distance,
          status: 'present', method: 'face',
        };
        results.push(matchResult);

        // Emit real-time event to session room
        if (io) {
          io.to(`session:${sessionId}`).emit('attendance:marked', {
            ...matchResult, sessionId, timestamp: new Date().toISOString(),
          });
        }
      } else {
        results.push({ status: 'unknown', confidence: 0 });
      }
    }

    const presentCount = results.filter((r) => r.status === 'present').length;
    res.json({
      facesDetected: faces.length,
      matched:  results.filter((r) => r.status === 'present'),
      unknown:  results.filter((r) => r.status === 'unknown').length,
      spoofed:  results.filter((r) => r.status === 'spoof').length,
      message:  `${presentCount} student(s) marked present by face recognition.`,
    });
  })
);

// ════════════════════════════════════════════════════════════
// VOICE ATTENDANCE
// ════════════════════════════════════════════════════════════

/**
 * POST /api/attendance/voice
 * Body: { sessionId, audioBase64 }
 */
router.post('/attendance/voice', requireAuth, staffOnly,
  validateBody(z.object({
    sessionId:   z.string().uuid(),
    audioBase64: z.string().min(100, 'Audio data required'),
  })),
  asyncWrap(async (req, res) => {
    const { sessionId, audioBase64 } = req.body;

    const sessionRes = await query(
      `SELECT cs.id, cs.subject_id, cs.faculty_id
       FROM class_sessions cs WHERE cs.id = $1 AND cs.status = 'live'`,
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session) throw createError(404, 'Session not found or not active.');

    // FIXED: Extract voice embedding from audio using AI service,
    // then use pgvector search_voice_embedding_v2 for fast DB-side matching.
    // (Old approach incorrectly called /voice/verify with a 'candidates' payload
    //  that the API does not support — it only does 1:1 verify.)
    let voiceEmbedding;
    let voiceQuality;
    try {
      const aiResponse = await axios.post(
        `${AI_URL()}/api/v1/voice/extract`,
        { audio_b64: audioBase64 },
        {
          headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET },
          timeout: 45000,
        }
      );
      voiceEmbedding = aiResponse.data.embedding;
      voiceQuality   = aiResponse.data.quality;
    } catch (err) {
      const status = err.code === 'ECONNREFUSED' ? 503 : (err.response?.status || 503);
      const detail = err.response?.data?.detail || 'AI service unavailable.';
      throw createError(status, detail);
    }

    if (!voiceEmbedding || voiceEmbedding.length === 0) {
      return res.json({ matched: [], message: 'Could not extract voice embedding from audio.' });
    }

    // Use pgvector HNSW index to find matching students enrolled in this subject
    const voiceThreshold = parseFloat(process.env.VOICE_SIMILARITY_THRESHOLD || '0.68');
    const vectorLiteral  = `[${voiceEmbedding.join(',')}]`;

    let matchRes;
    try {
      matchRes = await query(
        `SELECT * FROM search_voice_embedding_v2($1::vector, $2::uuid, $3, 5)`,
        [vectorLiteral, session.subject_id, voiceThreshold]
      );
    } catch {
      // Fall back to global voice search if scoped function not yet deployed
      matchRes = await query(
        `SELECT * FROM search_voice_embedding($1::vector, $2, 5)`,
        [vectorLiteral, voiceThreshold]
      );
    }

    const io = getIo(req);
    const matched = [];

    for (const best of matchRes.rows) {
      const simScore = parseFloat(best.similarity);

      // Upsert attendance
      await query(
        `INSERT INTO attendance
           (session_id, student_id, subject_id, faculty_id, status, method,
            voice_score, marked_at, marked_by)
         VALUES ($1,$2,$3,$4,'present','voice',$5,now(),$6)
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET
           status='present', method='voice', voice_score=$5,
           marked_at=now(), marked_by=$6`,
        [sessionId, best.student_id, session.subject_id,
         session.faculty_id, simScore, req.user.userId]
      );

      await writeAuditLog({
        sessionId, studentId: best.student_id, action: 'voice_match',
        performedBy: req.user.userId,
        similarity: simScore, isLive: null,
        metadata: { voice_quality: voiceQuality },
      });

      const matchResult = {
        studentId: best.student_id, name: best.name,
        rollNumber: best.roll_number, similarity: simScore,
        status: 'present', method: 'voice',
      };
      matched.push(matchResult);

      // Emit real-time event
      if (io) {
        io.to(`session:${sessionId}`).emit('attendance:marked', {
          ...matchResult, sessionId, timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      matched,
      message: `${matched.length} student(s) matched by voice recognition.`,
      voiceQuality,
    });
  })
);

// ════════════════════════════════════════════════════════════
// DUAL BIOMETRIC ATTENDANCE (FACE + VOICE)
// ════════════════════════════════════════════════════════════

/**
 * POST /api/attendance/dual
 * Body: { sessionId, imageBase64, audioBase64 }
 * High-security biometric fusion: requires both face and voice verification
 */
router.post('/attendance/dual', requireAuth, staffOnly,
  validateBody(z.object({
    sessionId:   z.string().uuid(),
    imageBase64: z.string().min(100, 'Image data required'),
    audioBase64: z.string().min(100, 'Audio data required'),
  })),
  asyncWrap(async (req, res) => {
    const { sessionId, imageBase64, audioBase64 } = req.body;

    const sessionRes = await query(
      `SELECT cs.id, cs.subject_id, cs.faculty_id
       FROM class_sessions cs WHERE cs.id = $1 AND cs.status = 'live'`,
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session) throw createError(404, 'Session not found or not active.');

    // 1. Parallel biometric extraction via AI service
    let faceRes, voiceRes;
    try {
      [faceRes, voiceRes] = await Promise.all([
        axios.post(
          `${AI_URL()}/api/v1/face/extract`,
          { image_b64: imageBase64, check_liveness: true, enforce_quality: false },
          { headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET }, timeout: 30000 }
        ),
        axios.post(
          `${AI_URL()}/api/v1/voice/extract`,
          { audio_b64: audioBase64 },
          { headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET }, timeout: 45000 }
        ),
      ]);
    } catch (err) {
      const status = err.code === 'ECONNREFUSED' ? 503 : (err.response?.status || 503);
      const detail = err.response?.data?.detail || 'AI biometric microservice unavailable.';
      throw createError(status, detail);
    }

    const faces = faceRes.data?.faces || [];
    const voiceEmbedding = voiceRes.data?.embedding || [];
    const voiceQuality   = voiceRes.data?.quality;

    if (faces.length === 0) {
      return res.status(400).json({ verified: false, message: 'No face detected in camera frame.' });
    }
    if (voiceEmbedding.length === 0) {
      return res.status(400).json({ verified: false, message: 'No clear voice utterance detected in audio.' });
    }

    // Check liveness on face
    const primaryFace = faces[0];
    const isLive = primaryFace.liveness?.is_live !== false;
    if (!isLive) {
      await writeAuditLog({
        sessionId, studentId: null, action: 'spoof_detected_dual',
        performedBy: req.user.userId,
        isLive: false, spoofReasons: primaryFace.liveness?.spoof_reasons || [],
      });
      return res.status(403).json({
        verified: false, spoofed: true,
        reasons: primaryFace.liveness?.spoof_reasons || ['Possible print or digital replay spoofing'],
        message: 'Anti-spoofing alert: Screen or photo presentation detected during dual check.'
      });
    }

    // 2. Query matches in parallel
    const faceVectorLiteral  = `[${primaryFace.embedding.join(',')}]`;
    const voiceVectorLiteral = `[${voiceEmbedding.join(',')}]`;
    const voiceThreshold = parseFloat(process.env.VOICE_SIMILARITY_THRESHOLD || '0.68');

    let faceMatchRes, voiceMatchRes;
    try {
      [faceMatchRes, voiceMatchRes] = await Promise.all([
        query(`SELECT * FROM search_face_embedding_v2($1::vector, $2::uuid, 0.55, 3)`, [faceVectorLiteral, session.subject_id])
          .catch(() => query(`SELECT * FROM search_face_embedding($1::vector, 0.55, 3)`, [faceVectorLiteral])),
        query(`SELECT * FROM search_voice_embedding_v2($1::vector, $2::uuid, $3, 3)`, [voiceVectorLiteral, session.subject_id, voiceThreshold])
          .catch(() => query(`SELECT * FROM search_voice_embedding($1::vector, $2, 3)`, [voiceVectorLiteral, voiceThreshold])),
      ]);
    } catch (err) {
      throw createError(500, 'Database vector search failed: ' + err.message);
    }

    const bestFace  = faceMatchRes.rows[0];
    const bestVoice = voiceMatchRes.rows[0];

    // Case 1: Both matched the SAME student -> FULL DUAL VERIFICATION PASS
    if (bestFace && bestVoice && bestFace.student_id === bestVoice.student_id) {
      const faceConf = Math.round((1 - bestFace.distance) * 100);
      const voiceConf = Math.round(parseFloat(bestVoice.similarity) * 100);
      const combinedConf = Math.round((faceConf + voiceConf) / 2);

      await query(
        `INSERT INTO attendance
           (session_id, student_id, subject_id, faculty_id, status, method,
            confidence, face_distance, voice_score, is_live, marked_at, marked_by)
         VALUES ($1,$2,$3,$4,'present','dual',$5,$6,$7,true,now(),$8)
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET
           status='present', method='dual', confidence=$5,
           face_distance=$6, voice_score=$7, is_live=true, marked_at=now(), marked_by=$8`,
        [sessionId, bestFace.student_id, session.subject_id, session.faculty_id,
         combinedConf / 100, bestFace.distance, parseFloat(bestVoice.similarity), req.user.userId]
      );

      await writeAuditLog({
        sessionId, studentId: bestFace.student_id, action: 'dual_match',
        performedBy: req.user.userId,
        confidence: combinedConf / 100, distance: bestFace.distance,
        similarity: parseFloat(bestVoice.similarity), isLive: true,
        metadata: { face_quality: primaryFace.quality, voice_quality: voiceQuality },
      });

      const matchResult = {
        studentId: bestFace.student_id, name: bestFace.name,
        rollNumber: bestFace.roll_number, confidence: combinedConf,
        faceConfidence: faceConf, voiceConfidence: voiceConf,
        status: 'present', method: 'dual',
      };

      const io = getIo(req);
      if (io) {
        io.to(`session:${sessionId}`).emit('attendance:marked', {
          ...matchResult, sessionId, timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        verified: true,
        matched: [matchResult],
        message: `Dual Biometric Verification Passed: ${bestFace.name} (Face ${faceConf}%, Voice ${voiceConf}%)`,
      });
    }

    // Case 2: Cross-identity mismatch (Face matches Student A, Voice matches Student B) -> PROXY ATTEMPT
    if (bestFace && bestVoice && bestFace.student_id !== bestVoice.student_id) {
      await writeAuditLog({
        sessionId, studentId: bestFace.student_id, action: 'biometric_conflict',
        performedBy: req.user.userId,
        metadata: { faceStudent: bestFace.name, voiceStudent: bestVoice.name },
      });

      return res.status(409).json({
        verified: false, conflict: true,
        message: `⚠️ Identity Conflict: Face identified as ${bestFace.name}, but voice matched ${bestVoice.name}! Proxy attempt logged.`,
      });
    }

    // Case 3: Only face matched
    if (bestFace && !bestVoice) {
      return res.status(422).json({
        verified: false, partial: 'face_only',
        candidate: bestFace.name,
        message: `Face matched ${bestFace.name}, but voice could not be verified against the profile.`,
      });
    }

    // Case 4: Only voice matched
    if (!bestFace && bestVoice) {
      return res.status(422).json({
        verified: false, partial: 'voice_only',
        candidate: bestVoice.name,
        message: `Voice matched ${bestVoice.name}, but face was not recognized.`,
      });
    }

    // Case 5: Neither matched
    return res.status(404).json({
      verified: false,
      message: 'Neither face nor voice matched any enrolled student in this class.',
    });
  })
);

// ════════════════════════════════════════════════════════════
// MANUAL ATTENDANCE
// ════════════════════════════════════════════════════════════

/**
 * PUT /api/attendance/manual
 * Faculty manually overrides a student's attendance.
 * Body: { sessionId, studentId, status, reason }
 */
router.put('/attendance/manual', requireAuth, staffOnly,
  validateBody(z.object({
    sessionId: z.string().uuid(),
    studentId: z.string().uuid(),
    status:    z.enum(['present', 'absent', 'late', 'excused']),
    reason:    z.string().max(200).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { sessionId, studentId, status, reason } = req.body;

    if (req.user.role === 'faculty') {
      const sess = await query(`SELECT faculty_id FROM class_sessions WHERE id = $1`, [sessionId]);
      if (!sess.rows[0] || sess.rows[0].faculty_id !== req.user.facultyId) {
        throw createError(403, 'You can only modify attendance records for your own assigned sessions.');
      }
    }

    const { rows } = await query(
      `UPDATE attendance
       SET status = $1, method = 'manual', override_reason = $2,
           marked_at = now(), marked_by = $3
       WHERE session_id = $4 AND student_id = $5
       RETURNING *`,
      [status, reason || null, req.user.userId, sessionId, studentId]
    );
    if (!rows[0]) throw createError(404, 'Attendance record not found.');
    res.json(rows[0]);
  })
);

// ════════════════════════════════════════════════════════════
// HISTORY & REPORTS
// ════════════════════════════════════════════════════════════

/**
 * GET /api/attendance/history
 * Query params: sessionId? subjectId? studentId? startDate? endDate?
 */
router.get('/attendance/history', requireAuth, anyRole, asyncWrap(async (req, res) => {
  const filters = [];
  const params  = [];

  // Students can only see their own records
  if (req.user.role === 'student') {
    params.push(req.user.studentId);
    filters.push(`a.student_id = $${params.length}`);
  } else if (req.user.role === 'faculty') {
    params.push(req.user.facultyId);
    filters.push(`a.faculty_id = $${params.length}`);
    if (req.query.studentId) {
      params.push(req.query.studentId);
      filters.push(`a.student_id = $${params.length}`);
    }
  } else if (req.query.studentId) {
    params.push(req.query.studentId);
    filters.push(`a.student_id = $${params.length}`);
  }

  if (req.query.subjectId) {
    params.push(req.query.subjectId);
    filters.push(`a.subject_id = $${params.length}`);
  }
  if (req.query.sessionId) {
    params.push(req.query.sessionId);
    filters.push(`a.session_id = $${params.length}`);
  }
  if (req.query.startDate) {
    params.push(req.query.startDate);
    filters.push(`cs.session_date >= $${params.length}`);
  }
  if (req.query.endDate) {
    params.push(req.query.endDate);
    filters.push(`cs.session_date <= $${params.length}`);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const { rows } = await query(
    `SELECT a.id, a.status, a.method, a.confidence, a.voice_score,
            a.face_distance, a.is_live, a.marked_at, a.override_reason,
            s.name AS student_name, s.roll_number,
            sub.name AS subject_name, sub.code AS subject_code,
            cs.session_date, cs.start_time,
            f.name AS faculty_name
     FROM attendance a
     JOIN students s      ON s.id   = a.student_id
     JOIN subjects sub    ON sub.id = a.subject_id
     JOIN class_sessions cs ON cs.id = a.session_id
     JOIN faculty f       ON f.id   = a.faculty_id
     ${where}
     ORDER BY cs.session_date DESC, cs.start_time DESC
     LIMIT 500`,
    params
  );
  res.json(rows);
}));

/**
 * GET /api/attendance/summary/:studentId
 * Per-subject attendance summary for a student.
 */
router.get('/attendance/summary/:studentId', requireAuth, anyRole, asyncWrap(async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.studentId) {
    throw createError(403, 'Access denied.');
  }
  const { rows } = await query(
    `SELECT * FROM v_student_attendance_summary WHERE student_id = $1`,
    [req.params.studentId]
  );
  res.json(rows);
}));

/**
 * GET /api/attendance/session/:sessionId/report
 * Full attendance report for a session.
 */
router.get('/attendance/session/:sessionId/report', requireAuth, staffOnly,
  asyncWrap(async (req, res) => {
    const { rows } = await query(
      `SELECT a.student_id, s.roll_number, s.name AS student_name,
              a.status, a.method, a.confidence, a.marked_at
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.session_id = $1
       ORDER BY s.name`,
      [req.params.sessionId]
    );
    res.json(rows);
  })
);

module.exports = router;
