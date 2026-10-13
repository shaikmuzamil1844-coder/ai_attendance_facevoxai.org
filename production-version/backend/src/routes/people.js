const express = require('express');
const { z }   = require('zod');
const axios   = require('axios');

const { query }             = require('../config/db');
const { requireAuth }       = require('../middleware/auth');
const { adminOnly, adminOrHod, staffOnly, studentOnly, anyRole } = require('../middleware/rbac');
const { validateBody }      = require('../middleware/validate');
const { asyncWrap, createError } = require('../middleware/errorHandler');

const router = express.Router();
const AI_URL = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ════════════════════════════════════════════════════════════
// FACULTY
// ════════════════════════════════════════════════════════════

// GET /api/faculty — admin, hod, faculty can list
router.get('/faculty', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const { departmentId } = req.query;
  const params = [];
  let where = 'WHERE f.is_active = true';

  // HOD can only see their department
  const effectiveDeptId = req.user.role === 'hod' ? req.user.deptId : departmentId;
  if (effectiveDeptId) {
    params.push(effectiveDeptId);
    where += ` AND f.department_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT f.id, f.employee_code, f.name, f.email, f.phone, f.designation,
            f.is_active, f.created_at,
            d.name AS dept_name,
            COUNT(DISTINCT fs.subject_id) AS subject_count
     FROM faculty f
     JOIN departments d ON d.id = f.department_id
     LEFT JOIN faculty_subjects fs ON fs.faculty_id = f.id
     ${where}
     GROUP BY f.id, d.name
     ORDER BY f.name`,
    params
  );
  res.json(rows);
}));

// GET /api/faculty/:id
router.get('/faculty/:id', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT f.*, d.name AS dept_name
     FROM faculty f
     JOIN departments d ON d.id = f.department_id
     WHERE f.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw createError(404, 'Faculty member not found.');
  res.json(rows[0]);
}));

// GET /api/faculty/:id/subjects — subjects assigned to a faculty member
router.get('/faculty/:id/subjects', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT sub.id, sub.code, sub.name, sub.credits,
            fs.section, fs.academic_year,
            c.name AS course_name,
            sem.name AS semester_name,
            COUNT(ss.student_id) AS student_count
     FROM faculty_subjects fs
     JOIN subjects sub ON sub.id = fs.subject_id
     JOIN courses c    ON c.id   = sub.course_id
     LEFT JOIN semesters sem ON sem.id = sub.semester_id
     LEFT JOIN student_subjects ss ON ss.subject_id = sub.id
     WHERE fs.faculty_id = $1 AND sub.is_active = true
     GROUP BY sub.id, c.name, sem.name, fs.section, fs.academic_year
     ORDER BY sub.name`,
    [req.params.id]
  );
  res.json(rows);
}));

// POST /api/faculty — admin only
router.post('/faculty', requireAuth, adminOnly,
  validateBody(z.object({
    departmentId:  z.string().uuid(),
    employeeCode:  z.string().min(1).max(40),
    name:          z.string().min(2).max(160),
    email:         z.string().email(),
    phone:         z.string().max(20).optional(),
    designation:   z.string().max(80).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { departmentId, employeeCode, name, email, phone, designation } = req.body;
    const { rows } = await query(
      `INSERT INTO faculty (department_id, employee_code, name, email, phone, designation)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [departmentId, employeeCode, name, email.toLowerCase(), phone || null, designation || null]
    );
    res.status(201).json(rows[0]);
  })
);

// PUT /api/faculty/:id
router.put('/faculty/:id', requireAuth, adminOnly, asyncWrap(async (req, res) => {
  const { name, email, phone, designation, isActive } = req.body;
  const { rows } = await query(
    `UPDATE faculty SET
       name        = COALESCE($1, name),
       email       = COALESCE($2, email),
       phone       = COALESCE($3, phone),
       designation = COALESCE($4, designation),
       is_active   = COALESCE($5, is_active)
     WHERE id = $6 RETURNING *`,
    [name, email, phone, designation, isActive, req.params.id]
  );
  if (!rows[0]) throw createError(404, 'Faculty member not found.');
  res.json(rows[0]);
}));

// DELETE /api/faculty/:id — soft delete
router.delete('/faculty/:id', requireAuth, adminOnly, asyncWrap(async (req, res) => {
  await query(`UPDATE faculty SET is_active = false WHERE id = $1`, [req.params.id]);
  res.json({ message: 'Faculty member deactivated.' });
}));

// ════════════════════════════════════════════════════════════
// STUDENTS
// ════════════════════════════════════════════════════════════

// GET /api/students — admin, hod, faculty
router.get('/students', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const filters = [];
  const params  = [];

  if (req.user.role === 'faculty') {
    params.push(req.user.facultyId);
    filters.push(`s.id IN (
      SELECT ss.student_id 
      FROM student_subjects ss 
      JOIN faculty_subjects fs ON fs.subject_id = ss.subject_id 
      WHERE fs.faculty_id = $${params.length}
    )`);
  }

  if (req.query.subjectId) {
    params.push(req.query.subjectId);
    filters.push(`s.id IN (SELECT student_id FROM student_subjects WHERE subject_id = $${params.length})`);
  }

  if (req.query.departmentId) {
    params.push(req.query.departmentId);
    filters.push(`s.department_id = $${params.length}`);
  }
  if (req.query.courseId) {
    params.push(req.query.courseId);
    filters.push(`s.course_id = $${params.length}`);
  }
  if (req.query.semesterId) {
    params.push(req.query.semesterId);
    filters.push(`s.semester_id = $${params.length}`);
  }
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    filters.push(`(s.name ILIKE $${params.length} OR s.roll_number ILIKE $${params.length} OR s.email ILIKE $${params.length})`);
  }

  const where = filters.length
    ? 'WHERE s.is_active = true AND ' + filters.join(' AND ')
    : 'WHERE s.is_active = true';

  const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const offset = (page - 1) * limit;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT s.id, s.roll_number, s.name, s.email, s.phone,
            s.face_enrolled, s.voice_enrolled, s.is_active, s.created_at,
            d.name AS dept_name, c.name AS course_name, sem.name AS sem_name
     FROM students s
     JOIN departments d ON d.id = s.department_id
     JOIN courses     c ON c.id = s.course_id
     LEFT JOIN semesters sem ON sem.id = s.semester_id
     ${where}
     ORDER BY s.name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(rows);
}));

// GET /api/students/:id
router.get('/students/:id', requireAuth, anyRole, asyncWrap(async (req, res) => {
  // Students can only view their own record
  if (req.user.role === 'student' && req.user.studentId !== req.params.id) {
    throw createError(403, 'You can only view your own profile.');
  }
  const { rows } = await query(
    `SELECT s.id, s.roll_number, s.name, s.email, s.phone, s.photo_url,
            s.face_enrolled, s.voice_enrolled, s.is_active, s.created_at,
            d.name AS dept_name, c.name AS course_name, sem.name AS sem_name
     FROM students s
     JOIN departments d ON d.id = s.department_id
     JOIN courses     c ON c.id = s.course_id
     LEFT JOIN semesters sem ON sem.id = s.semester_id
     WHERE s.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw createError(404, 'Student not found.');
  res.json(rows[0]);
}));

// GET /api/students/:id/subjects — enrolled subjects with attendance summary
router.get('/students/:id/subjects', requireAuth, anyRole, asyncWrap(async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.id) {
    throw createError(403, 'Access denied.');
  }
  const { rows } = await query(
    `SELECT sub.id, sub.code, sub.name, sub.credits,
            c.name AS course_name, sem.name AS semester_name,
            f.name AS faculty_name,
            COUNT(a.id) AS total_sessions,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS attended,
            ROUND(
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC
              / NULLIF(COUNT(a.id), 0) * 100, 1
            ) AS attendance_pct
     FROM student_subjects ss
     JOIN subjects sub ON sub.id = ss.subject_id
     JOIN courses c    ON c.id   = sub.course_id
     LEFT JOIN semesters sem ON sem.id = sub.semester_id
     LEFT JOIN faculty_subjects fs ON fs.subject_id = sub.id
     LEFT JOIN faculty f ON f.id = fs.faculty_id
     LEFT JOIN attendance a ON a.subject_id = sub.id AND a.student_id = $1
     WHERE ss.student_id = $1
     GROUP BY sub.id, c.name, sem.name, f.name
     ORDER BY sub.name`,
    [req.params.id]
  );
  res.json(rows);
}));

// POST /api/students — admin, hod
router.post('/students', requireAuth, adminOrHod,
  validateBody(z.object({
    departmentId: z.string().uuid(),
    courseId:     z.string().uuid(),
    semesterId:   z.string().uuid().optional(),
    rollNumber:   z.string().min(1).max(40),
    name:         z.string().min(2).max(160),
    email:        z.string().email(),
    phone:        z.string().max(20).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { departmentId, courseId, semesterId, rollNumber, name, email, phone } = req.body;
    const { rows } = await query(
      `INSERT INTO students (department_id, course_id, semester_id, roll_number, name, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [departmentId, courseId, semesterId || null, rollNumber, name, email.toLowerCase(), phone || null]
    );
    res.status(201).json(rows[0]);
  })
);

// PUT /api/students/:id
router.put('/students/:id', requireAuth, adminOrHod, asyncWrap(async (req, res) => {
  const { name, email, phone, semesterId, isActive } = req.body;
  const { rows } = await query(
    `UPDATE students SET
       name        = COALESCE($1, name),
       email       = COALESCE($2, email),
       phone       = COALESCE($3, phone),
       semester_id = COALESCE($4, semester_id),
       is_active   = COALESCE($5, is_active)
     WHERE id = $6 RETURNING *`,
    [name, email, phone, semesterId, isActive, req.params.id]
  );
  if (!rows[0]) throw createError(404, 'Student not found.');
  res.json(rows[0]);
}));

// DELETE /api/students/:id — soft delete
router.delete('/students/:id', requireAuth, adminOnly, asyncWrap(async (req, res) => {
  await query(`UPDATE students SET is_active = false WHERE id = $1`, [req.params.id]);
  res.json({ message: 'Student deactivated.' });
}));

// POST /api/students/:id/enroll — enroll student in a subject
router.post('/students/:id/enroll', requireAuth, adminOrHod,
  asyncWrap(async (req, res) => {
    const { subjectId } = req.body;
    if (!subjectId) throw createError(400, 'subjectId is required.');
    await query(
      `INSERT INTO student_subjects (student_id, subject_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, subjectId]
    );
    res.json({ message: 'Student enrolled in subject.' });
  })
);

// DELETE /api/students/:id/enroll — unenroll
router.delete('/students/:id/enroll', requireAuth, adminOrHod, asyncWrap(async (req, res) => {
  const { subjectId } = req.body;
  if (!subjectId) throw createError(400, 'subjectId is required.');
  await query(
    `DELETE FROM student_subjects WHERE student_id = $1 AND subject_id = $2`,
    [req.params.id, subjectId]
  );
  res.json({ message: 'Student unenrolled from subject.' });
}));

// GET /api/students/:id/attendance-summary — summary for student portal
router.get('/students/:id/attendance-summary', requireAuth, anyRole, asyncWrap(async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.id) {
    throw createError(403, 'Access denied.');
  }

  // Get subjects with attendance count for this student
  const { rows } = await query(
    `SELECT sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name,
            sub.credits, f.name AS faculty_name,
            COUNT(DISTINCT cs.id) AS total_sessions,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS attended,
            ROUND(
              CASE WHEN COUNT(DISTINCT cs.id) > 0 
                   THEN (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC / COUNT(DISTINCT cs.id)::NUMERIC) * 100 
                   ELSE 0 END, 1
            ) AS attendance_pct
     FROM student_subjects ss
     JOIN subjects sub ON sub.id = ss.subject_id
     LEFT JOIN faculty_subjects fs ON fs.subject_id = sub.id
     LEFT JOIN faculty f ON f.id = fs.faculty_id
     LEFT JOIN class_sessions cs ON cs.subject_id = sub.id
     LEFT JOIN attendance a ON a.session_id = cs.id AND a.student_id = $1
     WHERE ss.student_id = $1
     GROUP BY sub.id, sub.code, sub.name, sub.credits, f.name
     ORDER BY sub.name`,
    [req.params.id]
  );

  res.json({ summary: rows });
}));

// GET /api/students/:id/faculty — faculty teaching student's subjects
router.get('/students/:id/faculty', requireAuth, anyRole, asyncWrap(async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.id) {
    throw createError(403, 'Access denied.');
  }
  const { rows } = await query(
    `SELECT DISTINCT f.id, f.name, f.email, f.phone, f.designation,
            d.name AS dept_name, sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name
     FROM student_subjects ss
     JOIN faculty_subjects fs ON fs.subject_id = ss.subject_id
     JOIN faculty f ON f.id = fs.faculty_id
     JOIN departments d ON d.id = f.department_id
     JOIN subjects sub ON sub.id = ss.subject_id
     WHERE ss.student_id = $1 AND f.is_active = true
     ORDER BY sub.name, f.name`,
    [req.params.id]
  );
  res.json(rows);
}));

// POST /api/students/:id/face-embedding — store face embedding (called by AI service pipeline)
router.post('/students/:id/face-embedding', requireAuth, asyncWrap(async (req, res) => {
  const { embedding } = req.body;  // array of 128 floats
  if (!embedding || !Array.isArray(embedding)) {
    throw createError(400, 'embedding array is required.');
  }
  const vectorLiteral = `[${embedding.join(',')}]`;
  await query(
    `UPDATE students SET face_embedding = $1::vector, face_enrolled = true WHERE id = $2`,
    [vectorLiteral, req.params.id]
  );
  res.json({ message: 'Face embedding stored successfully.' });
}));

// POST /api/students/:id/enroll-face — captures image base64, calls AI service to extract ArcFace 128-D embedding and updates DB
router.post('/students/:id/enroll-face', requireAuth, asyncWrap(async (req, res) => {
  const canEnroll = req.user.role === 'admin' || req.user.role === 'hod' || (req.user.role === 'student' && req.user.studentId === req.params.id);
  if (!canEnroll) {
    throw createError(403, 'You do not have permission to enroll face biometric for this student.');
  }

  const { imageBase64 } = req.body;
  if (!imageBase64) throw createError(400, 'imageBase64 is required.');

  let aiRes;
  try {
    const response = await axios.post(
      `${AI_URL()}/api/v1/face/extract`,
      {
        image_b64: imageBase64,
        check_liveness: true,
        enforce_quality: false,
      },
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET || 'facevoxai_internal_ai_service_secret_key_2025',
        },
        timeout: 30000,
      }
    );
    aiRes = response.data;
  } catch (err) {
    const msg = err.response?.data?.detail || 'AI microservice face extraction failed.';
    throw createError(422, msg);
  }

  const faces = aiRes.faces || [];
  if (faces.length === 0) throw createError(422, 'No face detected in photo. Please ensure face is clearly visible.');

  const embedding = faces[0].embedding;
  const vectorLiteral = `[${embedding.join(',')}]`;

  await query(
    `UPDATE students SET face_embedding = $1::vector, face_enrolled = true WHERE id = $2`,
    [vectorLiteral, req.params.id]
  );

  res.json({
    message: 'Face enrolled successfully!',
    quality: faces[0].quality,
    liveness: faces[0].liveness,
  });
}));

// POST /api/students/:id/enroll-voice — captures audio base64, calls AI service to extract 256-D voice embedding and updates DB
router.post('/students/:id/enroll-voice', requireAuth, asyncWrap(async (req, res) => {
  const canEnroll = req.user.role === 'admin' || req.user.role === 'hod' || (req.user.role === 'student' && req.user.studentId === req.params.id);
  if (!canEnroll) {
    throw createError(403, 'You do not have permission to enroll voice biometric for this student.');
  }

  const { audioBase64 } = req.body;
  if (!audioBase64) throw createError(400, 'audioBase64 is required.');

  let aiRes;
  try {
    const response = await axios.post(
      `${AI_URL()}/api/v1/voice/extract`,
      {
        audio_b64: audioBase64,
      },
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET || 'facevoxai_internal_ai_service_secret_key_2025',
        },
        timeout: 30000,
      }
    );
    aiRes = response.data;
  } catch (err) {
    const msg = err.response?.data?.detail || 'AI microservice voice extraction failed.';
    throw createError(422, msg);
  }

  const embedding = aiRes.embedding;
  const vectorLiteral = `[${embedding.join(',')}]`;

  await query(
    `UPDATE students SET voice_embedding = $1::vector, voice_enrolled = true WHERE id = $2`,
    [vectorLiteral, req.params.id]
  );

  res.json({
    message: 'Voice print enrolled successfully!',
    quality: aiRes.quality,
  });
}));

module.exports = router;

