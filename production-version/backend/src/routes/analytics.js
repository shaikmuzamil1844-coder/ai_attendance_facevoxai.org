// src/routes/analytics.js — Analytics and Reports routes
const express = require('express');
const { query }  = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { staffOnly, adminOrHod, anyRole } = require('../middleware/rbac');
const { asyncWrap } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/analytics/overview
 * Platform-wide summary for admin/hod dashboard.
 */
router.get('/analytics/overview', requireAuth, adminOrHod, asyncWrap(async (req, res) => {
  const params = [];
  let deptWhere = '';
  let biometricWhere = '';

  // Parameterized dept filter — avoids SQL injection risk
  if (req.user.role === 'hod' && req.user.deptId) {
    params.push(req.user.deptId);
    deptWhere     = `WHERE d.id = $${params.length}`;
    biometricWhere = `AND department_id = $${params.length}`;
  }

  const { rows: deptStats } = await query(
    `SELECT
       COUNT(DISTINCT d.id)  AS total_departments,
       COUNT(DISTINCT c.id)  AS total_courses,
       COUNT(DISTINCT f.id)  AS total_faculty,
       COUNT(DISTINCT s.id)  AS total_students,
       COUNT(DISTINCT sub.id) AS total_subjects
     FROM departments d
     LEFT JOIN courses  c ON c.department_id = d.id
     LEFT JOIN faculty  f ON f.department_id = d.id AND f.is_active = true
     LEFT JOIN students s ON s.department_id = d.id AND s.is_active = true
     LEFT JOIN subjects sub ON sub.course_id  = c.id
     ${deptWhere}`,
    params
  );

  const { rows: sessionStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'live')      AS live_sessions,
       COUNT(*) FILTER (WHERE session_date = CURRENT_DATE) AS today_sessions,
       COUNT(*) FILTER (WHERE session_date >= CURRENT_DATE - 7) AS week_sessions
     FROM class_sessions`,
    []
  );

  const { rows: attendanceStats } = await query(
    `SELECT
       ROUND(AVG(
         CASE WHEN status = 'present' THEN 100.0 ELSE 0.0 END
       ), 1) AS avg_attendance_pct,
       COUNT(*) FILTER (WHERE status = 'present') AS total_present,
       COUNT(*) AS total_records
     FROM attendance
     WHERE marked_at >= CURRENT_DATE - 30`,
    []
  );

  const { rows: biometricStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE face_enrolled = true)  AS face_enrolled,
       COUNT(*) FILTER (WHERE voice_enrolled = true) AS voice_enrolled,
       COUNT(*) FILTER (WHERE face_enrolled = true AND voice_enrolled = true) AS dual_enrolled
     FROM students
     WHERE is_active = true ${biometricWhere}`,
    params
  );

  const org        = deptStats[0]      || {};
  const sessions   = sessionStats[0]   || {};
  const attendance = attendanceStats[0] || {};
  const biometrics = biometricStats[0]  || {};

  res.json({
    departments:     parseInt(org.total_departments || 0, 10),
    courses:         parseInt(org.total_courses     || 0, 10),
    faculty:         parseInt(org.total_faculty     || 0, 10),
    students:        parseInt(org.total_students    || 0, 10),
    subjects:        parseInt(org.total_subjects    || 0, 10),
    face_enrolled:   parseInt(biometrics.face_enrolled  || 0, 10),
    voice_enrolled:  parseInt(biometrics.voice_enrolled || 0, 10),
    dual_enrolled:   parseInt(biometrics.dual_enrolled  || 0, 10),
    sessions_today:  parseInt(sessions.today_sessions   || 0, 10),
    live_sessions:   parseInt(sessions.live_sessions    || 0, 10),
    attendance_today: parseFloat(attendance.avg_attendance_pct || 0),
    org, sessions, attendance, biometrics,
  });
}));

/**
 * GET /api/analytics/subject-trend?subjectId=&days=30
 * Attendance trend over time for a subject.
 */
router.get('/analytics/subject-trend', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const { subjectId, days = 30 } = req.query;
  if (!subjectId) return res.status(400).json({ error: 'subjectId is required.' });

  const { rows } = await query(
    `SELECT
       cs.session_date,
       COUNT(a.id) AS total_students,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
       ROUND(
         SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC
         / NULLIF(COUNT(a.id), 0) * 100, 1
       ) AS pct
     FROM class_sessions cs
     JOIN attendance a ON a.session_id = cs.id
     WHERE cs.subject_id = $1
       AND cs.session_date >= CURRENT_DATE - $2::INTEGER
     GROUP BY cs.session_date
     ORDER BY cs.session_date`,
    [subjectId, parseInt(days, 10)]
  );
  res.json(rows);
}));

/**
 * GET /api/analytics/at-risk?subjectId=&threshold=75
 * Students at risk of failing attendance requirement.
 */
router.get('/analytics/at-risk', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const { subjectId, threshold = 75 } = req.query;
  if (!subjectId) return res.status(400).json({ error: 'subjectId is required.' });

  const { rows } = await query(
    `SELECT
       s.id AS student_id, s.name, s.roll_number, s.email,
       COUNT(a.id) AS total_sessions,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS attended,
       ROUND(
         SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC
         / NULLIF(COUNT(a.id), 0) * 100, 1
       ) AS attendance_pct,
       -- Classes needed to reach threshold
       GREATEST(0,
         CEIL(
           ($2::NUMERIC / 100 * COUNT(a.id) - SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END))
           / (1 - $2::NUMERIC / 100)
         )
       )::INT AS classes_needed_to_recover
     FROM student_subjects ss
     JOIN students s ON s.id = ss.student_id
     JOIN attendance a ON a.student_id = s.id AND a.subject_id = $1
     WHERE ss.subject_id = $1
     GROUP BY s.id, s.name, s.roll_number, s.email
     HAVING ROUND(
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC
       / NULLIF(COUNT(a.id), 0) * 100, 1
     ) < $2::NUMERIC
     ORDER BY attendance_pct ASC`,
    [subjectId, parseFloat(threshold)]
  );
  res.json(rows);
}));

/**
 * GET /api/analytics/department-summary?departmentId=
 * Overall stats per department.
 */
router.get('/analytics/department-summary', requireAuth, adminOrHod, asyncWrap(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.departmentId) {
    params.push(req.query.departmentId);
    where = `WHERE d.id = $1`;
  } else if (req.user.role === 'hod' && req.user.deptId) {
    params.push(req.user.deptId);
    where = `WHERE d.id = $1`;
  }

  const { rows } = await query(
    `SELECT
       d.id, d.name AS department,
       COUNT(DISTINCT s.id) AS students,
       COUNT(DISTINCT f.id) AS faculty,
       COUNT(DISTINCT sub.id) AS subjects,
       COUNT(DISTINCT cs.id) AS total_sessions,
       ROUND(AVG(
         CASE WHEN a.status = 'present' THEN 100.0 ELSE 0.0 END
       ), 1) AS avg_attendance_pct
     FROM departments d
     LEFT JOIN students s  ON s.department_id = d.id AND s.is_active = true
     LEFT JOIN faculty  f  ON f.department_id = d.id AND f.is_active = true
     LEFT JOIN courses  c  ON c.department_id = d.id
     LEFT JOIN subjects sub ON sub.course_id = c.id
     LEFT JOIN class_sessions cs ON cs.subject_id = sub.id
     LEFT JOIN attendance a ON a.session_id = cs.id
     ${where}
     GROUP BY d.id, d.name
     ORDER BY d.name`,
    params
  );
  res.json(rows);
}));

/**
 * GET /api/analytics/student-heatmap/:studentId?days=91
 * 91-day (13-week) attendance heatmap data — same as existing Streamlit calendar.
 */
router.get('/analytics/student-heatmap/:studentId', requireAuth, anyRole, asyncWrap(async (req, res) => {
  // Students can only view their own heatmap
  if (req.user.role === 'student' && req.user.studentId !== req.params.studentId) {
    throw createError(403, 'Access denied.');
  }
  const { rows } = await query(
    `SELECT
       cs.session_date AS date,
       COUNT(a.id) AS total,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS attended
     FROM attendance a
     JOIN class_sessions cs ON cs.id = a.session_id
     WHERE a.student_id = $1
       AND cs.session_date >= CURRENT_DATE - $2::INTEGER
     GROUP BY cs.session_date
     ORDER BY cs.session_date`,
    [req.params.studentId, parseInt(req.query.days || '91', 10)]
  );
  res.json(rows);
}));

/**
 * GET /api/analytics/biometric-enrollment
 * Biometric enrollment statistics per department.
 */
router.get('/analytics/biometric-enrollment', requireAuth, adminOrHod, asyncWrap(async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM v_biometric_enrollment_stats`, []);
    res.json(rows);
  } catch {
    // View may not exist yet — fall back to raw query
    const { rows } = await query(
      `SELECT
         d.id AS department_id, d.name AS department_name,
         COUNT(DISTINCT s.id) AS total_students,
         COUNT(DISTINCT s.id) FILTER (WHERE s.face_enrolled = true)  AS face_enrolled_count,
         COUNT(DISTINCT s.id) FILTER (WHERE s.voice_enrolled = true) AS voice_enrolled_count
       FROM departments d
       LEFT JOIN students s ON s.department_id = d.id AND s.is_active = true
       GROUP BY d.id, d.name ORDER BY d.name`,
      []
    );
    res.json(rows);
  }
}));

/**
 * GET /api/analytics/weekly-trend?weeks=13
 * Weekly attendance trend for dashboard charts.
 */
router.get('/analytics/weekly-trend', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const weeks = Math.min(parseInt(req.query.weeks || '13', 10), 52);
  try {
    const { rows } = await query(
      `SELECT * FROM v_weekly_attendance_trend
       WHERE week_start >= CURRENT_DATE - ($1 * 7)::INTEGER
       ORDER BY week_start DESC`,
      [weeks]
    );
    res.json(rows);
  } catch {
    const { rows } = await query(
      `SELECT
         date_trunc('week', cs.session_date)::DATE AS week_start,
         COUNT(DISTINCT cs.id)                     AS total_sessions,
         COUNT(a.id)                               AS total_records,
         SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count,
         ROUND(SUM(CASE WHEN a.status='present' THEN 1.0 ELSE 0.0 END)
           / NULLIF(COUNT(a.id),0)*100,1) AS avg_attendance_pct
       FROM class_sessions cs
       LEFT JOIN attendance a ON a.session_id = cs.id
       WHERE cs.session_date >= CURRENT_DATE - ($1 * 7)::INTEGER
       GROUP BY date_trunc('week', cs.session_date)
       ORDER BY week_start DESC`,
      [weeks]
    );
    res.json(rows);
  }
}));

/**
 * GET /api/analytics/live-sessions
 * Currently active sessions with progress.
 */
router.get('/analytics/live-sessions', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM v_live_session_progress`, []);
    res.json(rows);
  } catch {
    const { rows } = await query(
      `SELECT cs.id AS session_id, cs.status, cs.started_at,
              sub.name AS subject_name, f.name AS faculty_name,
              COUNT(a.id) AS total_enrolled,
              SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count
       FROM class_sessions cs
       JOIN subjects sub ON sub.id = cs.subject_id
       JOIN faculty f ON f.id = cs.faculty_id
       LEFT JOIN attendance a ON a.session_id = cs.id
       WHERE cs.status = 'live'
       GROUP BY cs.id, sub.name, f.name
       ORDER BY cs.started_at DESC`,
      []
    );
    res.json(rows);
  }
}));

/**
 * GET /api/analytics/at-risk
 * Phase 4: Students with attendance below threshold (< 75% by default)
 */
router.get('/analytics/at-risk', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const threshold = parseFloat(req.query.threshold || '75.0');
  const params = [threshold];
  const filters = [];

  if (req.user.role === 'faculty') {
    params.push(req.user.facultyId);
    filters.push(`fs.faculty_id = $${params.length}`);
  } else if (req.user.role === 'hod' && req.user.deptId) {
    params.push(req.user.deptId);
    filters.push(`s.department_id = $${params.length}`);
  }

  if (req.query.departmentId && req.user.role === 'admin') {
    params.push(req.query.departmentId);
    filters.push(`s.department_id = $${params.length}`);
  }
  if (req.query.subjectId) {
    params.push(req.query.subjectId);
    filters.push(`sub.id = $${params.length}`);
  }

  const extraWhere = filters.length ? 'AND ' + filters.join(' AND ') : '';

  const { rows } = await query(
    `SELECT
       s.id AS student_id, s.roll_number, s.name AS student_name, s.email, s.phone,
       s.face_enrolled, s.voice_enrolled,
       d.name AS department_name, c.name AS course_name,
       sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code,
       f.name AS faculty_name,
       COUNT(DISTINCT cs.id) AS total_sessions,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS attended,
       ROUND(
         (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(DISTINCT cs.id), 0)) * 100, 1
       ) AS attendance_pct
     FROM students s
     JOIN departments d ON d.id = s.department_id
     JOIN courses c     ON c.id = s.course_id
     JOIN student_subjects ss ON ss.student_id = s.id
     JOIN subjects sub ON sub.id = ss.subject_id
     LEFT JOIN faculty_subjects fs ON fs.subject_id = sub.id
     LEFT JOIN faculty f ON f.id = fs.faculty_id
     LEFT JOIN class_sessions cs ON cs.subject_id = sub.id
     LEFT JOIN attendance a ON a.session_id = cs.id AND a.student_id = s.id
     WHERE s.is_active = true ${extraWhere}
     GROUP BY s.id, s.roll_number, s.name, s.email, s.phone, s.face_enrolled, s.voice_enrolled,
              d.name, c.name, sub.id, sub.name, sub.code, f.name
     HAVING COUNT(DISTINCT cs.id) > 0
        AND ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(DISTINCT cs.id), 0)) * 100, 1) < $1
     ORDER BY attendance_pct ASC, s.name ASC`,
    params
  );

  res.json({
    threshold,
    count: rows.length,
    students: rows,
  });
}));

/**
 * GET /api/analytics/export
 * Phase 4: Download attendance records as CSV
 */
router.get('/analytics/export', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const { subjectId, sessionId, startDate, endDate } = req.query;
  const filters = [];
  const params  = [];

  if (req.user.role === 'faculty') {
    params.push(req.user.facultyId);
    filters.push(`cs.faculty_id = $${params.length}`);
  }
  if (subjectId) {
    params.push(subjectId);
    filters.push(`cs.subject_id = $${params.length}`);
  }
  if (sessionId) {
    params.push(sessionId);
    filters.push(`cs.id = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    filters.push(`cs.session_date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    filters.push(`cs.session_date <= $${params.length}`);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const { rows } = await query(
    `SELECT
       s.roll_number, s.name AS student_name, s.email AS student_email,
       sub.code AS subject_code, sub.name AS subject_name,
       cs.session_date, cs.start_time,
       a.status, a.method, a.confidence, a.marked_at,
       f.name AS faculty_name
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     JOIN class_sessions cs ON cs.id = a.session_id
     JOIN subjects sub ON sub.id = a.subject_id
     JOIN faculty f ON f.id = cs.faculty_id
     ${where}
     ORDER BY cs.session_date DESC, sub.code, s.roll_number`,
    params
  );

  // Return CSV format
  const headers = ['Roll Number', 'Student Name', 'Email', 'Subject Code', 'Subject Name', 'Date', 'Time', 'Status', 'Method', 'Confidence', 'Marked At', 'Faculty'];
  const csvLines = [headers.join(',')];

  rows.forEach(r => {
    const row = [
      `"${r.roll_number || ''}"`,
      `"${r.student_name || ''}"`,
      `"${r.student_email || ''}"`,
      `"${r.subject_code || ''}"`,
      `"${r.subject_name || ''}"`,
      `"${r.session_date ? new Date(r.session_date).toISOString().slice(0, 10) : ''}"`,
      `"${r.start_time || ''}"`,
      `"${r.status || ''}"`,
      `"${r.method || ''}"`,
      `"${r.confidence !== null ? r.confidence : ''}"`,
      `"${r.marked_at ? new Date(r.marked_at).toISOString() : ''}"`,
      `"${r.faculty_name || ''}"`,
    ];
    csvLines.push(row.join(','));
  });

  const csvContent = csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
  res.send(csvContent);
}));

module.exports = router;
