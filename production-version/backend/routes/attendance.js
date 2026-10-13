const express = require('express');
const { query } = require('../db');
const { requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/sessions', async (req, res, next) => {
  try {
    const params = [];
    const filters = [];
    if (req.query.date) {
      params.push(req.query.date);
      filters.push(`cs.session_date = $${params.length}`);
    }
    if (req.account.role === 'faculty' && req.account.faculty_id) {
      params.push(req.account.faculty_id);
      filters.push(`cs.faculty_id = $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await query(
      `SELECT cs.*, s.code AS subject_code, s.name AS subject_name,
              f.name AS faculty_name, cr.code AS classroom_code
       FROM class_sessions cs
       JOIN subjects s ON s.id = cs.subject_id
       JOIN faculty f ON f.id = cs.faculty_id
       LEFT JOIN classrooms cr ON cr.id = cs.classroom_id
       ${where}
       ORDER BY cs.session_date DESC, cs.start_time`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/sessions', requireRoles('admin', 'hod', 'faculty'), async (req, res, next) => {
  try {
    const { subjectId, facultyId, classroomId, sessionDate, startTime, endTime, notes } = req.body || {};
    const resolvedFacultyId = req.account.role === 'faculty' ? req.account.faculty_id : facultyId;
    if (!subjectId || !resolvedFacultyId || !sessionDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'subjectId, faculty, date and times are required' });
    }
    const result = await query(
      `INSERT INTO class_sessions
        (subject_id, faculty_id, classroom_id, session_date, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [subjectId, resolvedFacultyId, classroomId || null, sessionDate, startTime, endTime, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/sessions/:id/roster', async (req, res, next) => {
  try {
    const session = await query(
      `SELECT cs.*, s.course_id FROM class_sessions cs
       JOIN subjects s ON s.id = cs.subject_id WHERE cs.id = $1`,
      [req.params.id]
    );
    if (!session.rows[0]) return res.status(404).json({ error: 'Session not found' });

    const result = await query(
      `SELECT st.id, st.roll_number, st.name, st.email, st.face_enrolled,
              a.id AS attendance_id, a.status, a.method, a.confidence, a.marked_at
       FROM students st
       LEFT JOIN attendance a
         ON a.student_id = st.id AND a.session_id = $1
       WHERE st.course_id = $2
       ORDER BY st.roll_number`,
      [req.params.id, session.rows[0].course_id]
    );
    res.json({ session: session.rows[0], roster: result.rows });
  } catch (err) { next(err); }
});

router.post('/sessions/:id/attendance', requireRoles('admin', 'hod', 'faculty'), async (req, res, next) => {
  try {
    const { marks } = req.body || {};
    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ error: 'marks array is required' });
    }

    const session = await query('SELECT * FROM class_sessions WHERE id = $1', [req.params.id]);
    if (!session.rows[0]) return res.status(404).json({ error: 'Session not found' });
    if (req.account.role === 'faculty' && session.rows[0].faculty_id !== req.account.faculty_id) {
      return res.status(403).json({ error: 'You can only mark your own class' });
    }

    const saved = [];
    for (const mark of marks) {
      if (!mark.studentId || !mark.status) continue;
      const row = await query(
        `INSERT INTO attendance (session_id, student_id, faculty_id, subject_id, status, method, marked_by)
         VALUES ($1, $2, $3, $4, $5, 'manual', $6)
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, method = EXCLUDED.method, marked_at = now(), marked_by = EXCLUDED.marked_by
         RETURNING *`,
        [
          req.params.id,
          mark.studentId,
          session.rows[0].faculty_id,
          session.rows[0].subject_id,
          mark.status,
          req.account.id,
        ]
      );
      saved.push(row.rows[0]);
    }
    res.json({ saved: saved.length, records: saved });
  } catch (err) { next(err); }
});

router.get('/attendance/me', requireRoles('student'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*, s.code AS subject_code, s.name AS subject_name,
              cs.session_date, cs.start_time, cs.end_time, f.name AS faculty_name
       FROM attendance a
       JOIN class_sessions cs ON cs.id = a.session_id
       JOIN subjects s ON s.id = a.subject_id
       LEFT JOIN faculty f ON f.id = a.faculty_id
       WHERE a.student_id = $1
       ORDER BY cs.session_date DESC, cs.start_time DESC`,
      [req.account.student_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/dashboard/summary', async (req, res, next) => {
  try {
    const role = req.account.role;
    if (role === 'admin') {
      const [d, f, s, a] = await Promise.all([
        query('SELECT count(*)::int AS count FROM departments'),
        query('SELECT count(*)::int AS count FROM faculty'),
        query('SELECT count(*)::int AS count FROM students'),
        query('SELECT count(*)::int AS count FROM attendance'),
      ]);
      return res.json({
        departments: d.rows[0].count,
        faculty: f.rows[0].count,
        students: s.rows[0].count,
        attendanceRecords: a.rows[0].count,
      });
    }

    if (role === 'hod') {
      const dept = req.account.department_id;
      const [f, s, present] = await Promise.all([
        query('SELECT count(*)::int AS count FROM faculty WHERE department_id = $1', [dept]),
        query('SELECT count(*)::int AS count FROM students WHERE department_id = $1', [dept]),
        query(
          `SELECT
             count(*) FILTER (WHERE a.status = 'present')::int AS present,
             count(*)::int AS total
           FROM attendance a
           JOIN students st ON st.id = a.student_id
           WHERE st.department_id = $1`,
          [dept]
        ),
      ]);
      const total = present.rows[0].total || 0;
      const p = present.rows[0].present || 0;
      return res.json({
        faculty: f.rows[0].count,
        students: s.rows[0].count,
        attendanceRate: total ? Math.round((p / total) * 100) : 0,
      });
    }

    if (role === 'faculty') {
      const result = await query(
        `SELECT count(*)::int AS sessions,
                count(*) FILTER (WHERE status = 'live')::int AS live_sessions
         FROM class_sessions WHERE faculty_id = $1`,
        [req.account.faculty_id]
      );
      return res.json(result.rows[0]);
    }

    const stats = await query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status = 'present')::int AS present,
         count(*) FILTER (WHERE status = 'absent')::int AS absent
       FROM attendance WHERE student_id = $1`,
      [req.account.student_id]
    );
    const row = stats.rows[0];
    return res.json({
      ...row,
      rate: row.total ? Math.round((row.present / row.total) * 100) : 0,
    });
  } catch (err) { next(err); }
});

module.exports = router;
