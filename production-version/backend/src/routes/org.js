// src/routes/org.js — Organization routes
// Departments, Courses, Semesters, Classrooms, Subjects
const express = require('express');
const { z }   = require('zod');

const { query }              = require('../config/db');
const { requireAuth }        = require('../middleware/auth');
const { adminOnly, adminOrHod, staffOnly } = require('../middleware/rbac');
const { validateBody }       = require('../middleware/validate');
const { asyncWrap, createError } = require('../middleware/errorHandler');

const router = express.Router();

// ════════════════════════════════════════════════════════════
// DEPARTMENTS
// ════════════════════════════════════════════════════════════

// GET /api/departments — all roles can list departments
router.get('/departments', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.code, d.name, d.hod_name, d.is_active, d.created_at,
            COUNT(DISTINCT c.id) AS course_count,
            COUNT(DISTINCT f.id) AS faculty_count,
            COUNT(DISTINCT s.id) AS student_count
     FROM departments d
     LEFT JOIN courses  c ON c.department_id = d.id AND c.is_active = true
     LEFT JOIN faculty  f ON f.department_id = d.id AND f.is_active = true
     LEFT JOIN students s ON s.department_id = d.id AND s.is_active = true
     WHERE d.is_active = true
     GROUP BY d.id
     ORDER BY d.name`,
    []
  );
  res.json(rows);
}));

// GET /api/departments/:id
router.get('/departments/:id', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(`SELECT * FROM departments WHERE id = $1`, [req.params.id]);
  if (!rows[0]) throw createError(404, 'Department not found.');
  res.json(rows[0]);
}));

// POST /api/departments — admin only
router.post('/departments', requireAuth, adminOnly,
  validateBody(z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(160),
    hodName: z.string().max(160).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { code, name, hodName } = req.body;
    const { rows } = await query(
      `INSERT INTO departments (code, name, hod_name) VALUES ($1, $2, $3)
       RETURNING *`,
      [code.toUpperCase(), name, hodName || null]
    );
    res.status(201).json(rows[0]);
  })
);

// PUT /api/departments/:id — admin only
router.put('/departments/:id', requireAuth, adminOnly,
  asyncWrap(async (req, res) => {
    const { name, hodName, isActive } = req.body;
    const { rows } = await query(
      `UPDATE departments SET
         name = COALESCE($1, name),
         hod_name = COALESCE($2, hod_name),
         is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [name, hodName, isActive, req.params.id]
    );
    if (!rows[0]) throw createError(404, 'Department not found.');
    res.json(rows[0]);
  })
);

// ════════════════════════════════════════════════════════════
// COURSES
// ════════════════════════════════════════════════════════════

router.get('/courses', requireAuth, asyncWrap(async (req, res) => {
  const deptFilter = req.query.departmentId ? 'AND c.department_id = $1' : '';
  const params = req.query.departmentId ? [req.query.departmentId] : [];
  const { rows } = await query(
    `SELECT c.*, d.name AS dept_name
     FROM courses c
     JOIN departments d ON d.id = c.department_id
     WHERE c.is_active = true ${deptFilter}
     ORDER BY d.name, c.name`,
    params
  );
  res.json(rows);
}));

router.get('/courses/:id', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, d.name AS dept_name FROM courses c
     JOIN departments d ON d.id = c.department_id
     WHERE c.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw createError(404, 'Course not found.');
  res.json(rows[0]);
}));

router.post('/courses', requireAuth, adminOnly,
  validateBody(z.object({
    departmentId:   z.string().uuid(),
    code:           z.string().min(1).max(20),
    name:           z.string().min(1).max(160),
    durationYears:  z.number().int().min(1).max(10).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { departmentId, code, name, durationYears } = req.body;
    const { rows } = await query(
      `INSERT INTO courses (department_id, code, name, duration_years)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [departmentId, code.toUpperCase(), name, durationYears || 4]
    );
    res.status(201).json(rows[0]);
  })
);

// ════════════════════════════════════════════════════════════
// SEMESTERS
// ════════════════════════════════════════════════════════════

router.get('/semesters', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM semesters ORDER BY start_date DESC`, []
  );
  res.json(rows);
}));

router.get('/semesters/active', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM semesters WHERE is_active = true ORDER BY start_date DESC`, []
  );
  res.json(rows);
}));

router.post('/semesters', requireAuth, adminOnly,
  validateBody(z.object({
    name:      z.string().min(1).max(80),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isActive:  z.boolean().optional(),
  })),
  asyncWrap(async (req, res) => {
    const { name, startDate, endDate, isActive } = req.body;
    const { rows } = await query(
      `INSERT INTO semesters (name, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, startDate, endDate, isActive ?? false]
    );
    res.status(201).json(rows[0]);
  })
);

// ════════════════════════════════════════════════════════════
// CLASSROOMS
// ════════════════════════════════════════════════════════════

router.get('/classrooms', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM classrooms WHERE is_active = true ORDER BY code`, []
  );
  res.json(rows);
}));

router.post('/classrooms', requireAuth, adminOnly,
  validateBody(z.object({
    code:     z.string().min(1).max(40),
    name:     z.string().min(1).max(160),
    location: z.string().max(160).optional(),
    capacity: z.number().int().min(1).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { code, name, location, capacity } = req.body;
    const { rows } = await query(
      `INSERT INTO classrooms (code, name, location, capacity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code.toUpperCase(), name, location || null, capacity || 60]
    );
    res.status(201).json(rows[0]);
  })
);

// ════════════════════════════════════════════════════════════
// SUBJECTS
// ════════════════════════════════════════════════════════════

router.get('/subjects', requireAuth, asyncWrap(async (req, res) => {
  const filters = [];
  const params  = [];

  if (req.user.role === 'faculty') {
    params.push(req.user.facultyId);
    filters.push(`fs.faculty_id = $${params.length}`);
  } else if (req.user.role === 'student') {
    params.push(req.user.studentId);
    filters.push(`ss.student_id = $${params.length}`);
  } else if (req.query.facultyId) {
    params.push(req.query.facultyId);
    filters.push(`fs.faculty_id = $${params.length}`);
  }

  if (req.query.courseId) {
    params.push(req.query.courseId);
    filters.push(`sub.course_id = $${params.length}`);
  }
  if (req.query.semesterId) {
    params.push(req.query.semesterId);
    filters.push(`sub.semester_id = $${params.length}`);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const { rows } = await query(
    `SELECT DISTINCT sub.id, sub.code, sub.name, sub.credits, sub.is_active,
            c.name AS course_name, sem.name AS semester_name,
            COUNT(DISTINCT ss.student_id) AS student_count
     FROM subjects sub
     JOIN courses   c   ON c.id   = sub.course_id
     LEFT JOIN semesters sem ON sem.id = sub.semester_id
     LEFT JOIN faculty_subjects fs ON fs.subject_id = sub.id
     LEFT JOIN student_subjects ss ON ss.subject_id = sub.id
     ${where}
     GROUP BY sub.id, c.name, sem.name
     ORDER BY sub.name`,
    params
  );
  res.json(rows);
}));

router.get('/subjects/:id', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT sub.*, c.name AS course_name, sem.name AS semester_name
     FROM subjects sub
     JOIN courses c ON c.id = sub.course_id
     LEFT JOIN semesters sem ON sem.id = sub.semester_id
     WHERE sub.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw createError(404, 'Subject not found.');
  res.json(rows[0]);
}));

router.post('/subjects', requireAuth, adminOrHod,
  validateBody(z.object({
    courseId:   z.string().uuid(),
    semesterId: z.string().uuid().optional(),
    code:       z.string().min(1).max(20),
    name:       z.string().min(1).max(160),
    credits:    z.number().int().min(1).max(10).optional(),
  })),
  asyncWrap(async (req, res) => {
    const { courseId, semesterId, code, name, credits } = req.body;
    const { rows } = await query(
      `INSERT INTO subjects (course_id, semester_id, code, name, credits)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [courseId, semesterId || null, code.toUpperCase(), name, credits || 3]
    );
    res.status(201).json(rows[0]);
  })
);

// Assign faculty to a subject (Admin/HOD, or Faculty assigning themselves)
router.post('/subjects/:id/assign-faculty', requireAuth,
  asyncWrap(async (req, res) => {
    let facultyId = req.body.facultyId;
    if (req.user.role === 'faculty') {
      facultyId = req.user.facultyId;
    } else if (req.user.role !== 'admin' && req.user.role !== 'hod') {
      throw createError(403, 'Permission denied.');
    }
    if (!facultyId) throw createError(400, 'facultyId is required.');
    await query(
      `INSERT INTO faculty_subjects (faculty_id, subject_id, section, academic_year)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [facultyId, req.params.id, req.body.section || null, req.body.academicYear || null]
    );
    res.json({ message: 'Faculty assigned to subject successfully.' });
  })
);

// Get faculty assigned to a subject
router.get('/subjects/:id/faculty', requireAuth, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT f.id, f.name, f.email, f.designation, fs.section, fs.academic_year
     FROM faculty_subjects fs
     JOIN faculty f ON f.id = fs.faculty_id
     WHERE fs.subject_id = $1`,
    [req.params.id]
  );
  res.json(rows);
}));

// Get students enrolled in a subject
router.get('/subjects/:id/students', requireAuth, staffOnly, asyncWrap(async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.roll_number, s.name, s.email, s.face_enrolled, s.voice_enrolled
     FROM student_subjects ss
     JOIN students s ON s.id = ss.student_id
     WHERE ss.subject_id = $1
     ORDER BY s.name`,
    [req.params.id]
  );
  res.json(rows);
}));

// ════════════════════════════════════════════════════════════
// TIMETABLE
// ════════════════════════════════════════════════════════════

// GET /api/timetable — role-aware schedule view
router.get('/timetable', requireAuth, asyncWrap(async (req, res) => {
  const filters = ['t.is_active = true'];
  const params  = [];

  if (req.user.role === 'student') {
    params.push(req.user.studentId);
    filters.push(`t.subject_id IN (SELECT subject_id FROM student_subjects WHERE student_id = $${params.length})`);
  } else if (req.user.role === 'faculty' && !req.query.all) {
    params.push(req.user.facultyId);
    filters.push(`t.faculty_id = $${params.length}`);
  } else {
    if (req.query.facultyId) {
      params.push(req.query.facultyId);
      filters.push(`t.faculty_id = $${params.length}`);
    }
    if (req.query.subjectId) {
      params.push(req.query.subjectId);
      filters.push(`t.subject_id = $${params.length}`);
    }
    if (req.query.classroomId) {
      params.push(req.query.classroomId);
      filters.push(`t.classroom_id = $${params.length}`);
    }
    if (req.query.semesterId) {
      params.push(req.query.semesterId);
      filters.push(`t.semester_id = $${params.length}`);
    }
  }

  if (req.query.day) {
    params.push(req.query.day.toLowerCase());
    filters.push(`t.day = $${params.length}`);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const { rows } = await query(
    `SELECT t.id, t.day, t.start_time, t.end_time, t.is_active,
            sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name, sub.credits,
            f.id AS faculty_id, f.name AS faculty_name, f.email AS faculty_email,
            cl.id AS classroom_id, cl.code AS classroom_code, cl.name AS classroom_name, cl.location AS classroom_location,
            sem.id AS semester_id, sem.name AS semester_name
     FROM timetable t
     JOIN subjects   sub ON sub.id = t.subject_id
     JOIN faculty    f   ON f.id   = t.faculty_id
     LEFT JOIN classrooms cl  ON cl.id  = t.classroom_id
     LEFT JOIN semesters  sem ON sem.id = t.semester_id
     ${where}
     ORDER BY 
       CASE t.day 
         WHEN 'monday' THEN 1 
         WHEN 'tuesday' THEN 2 
         WHEN 'wednesday' THEN 3 
         WHEN 'thursday' THEN 4 
         WHEN 'friday' THEN 5 
         WHEN 'saturday' THEN 6 
         WHEN 'sunday' THEN 7 
         ELSE 8 
       END,
       t.start_time ASC`,
    params
  );
  res.json(rows);
}));

// POST /api/timetable — admin/hod only
router.post('/timetable', requireAuth, adminOrHod,
  validateBody(z.object({
    subjectId:   z.string().uuid(),
    facultyId:   z.string().uuid(),
    classroomId: z.string().uuid().optional().nullable(),
    semesterId:  z.string().uuid().optional().nullable(),
    day:         z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    startTime:   z.string().min(4),
    endTime:     z.string().min(4),
  })),
  asyncWrap(async (req, res) => {
    const { subjectId, facultyId, classroomId, semesterId, day, startTime, endTime } = req.body;
    const { rows } = await query(
      `INSERT INTO timetable (subject_id, faculty_id, classroom_id, semester_id, day, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [subjectId, facultyId, classroomId || null, semesterId || null, day.toLowerCase(), startTime, endTime]
    );
    res.status(201).json(rows[0]);
  })
);

// PUT /api/timetable/:id — admin/hod only
router.put('/timetable/:id', requireAuth, adminOrHod, asyncWrap(async (req, res) => {
  const { subjectId, facultyId, classroomId, semesterId, day, startTime, endTime, isActive } = req.body;
  const { rows } = await query(
    `UPDATE timetable SET
       subject_id   = COALESCE($1, subject_id),
       faculty_id   = COALESCE($2, faculty_id),
       classroom_id = COALESCE($3, classroom_id),
       semester_id  = COALESCE($4, semester_id),
       day          = COALESCE($5, day),
       start_time   = COALESCE($6, start_time),
       end_time     = COALESCE($7, end_time),
       is_active    = COALESCE($8, is_active),
       updated_at   = now()
     WHERE id = $9 RETURNING *`,
    [subjectId, facultyId, classroomId, semesterId, day ? day.toLowerCase() : null, startTime, endTime, isActive, req.params.id]
  );
  if (!rows[0]) throw createError(404, 'Timetable entry not found.');
  res.json(rows[0]);
}));

// DELETE /api/timetable/:id — admin/hod only
router.delete('/timetable/:id', requireAuth, adminOrHod, asyncWrap(async (req, res) => {
  await query(`DELETE FROM timetable WHERE id = $1`, [req.params.id]);
  res.json({ message: 'Timetable entry deleted successfully.' });
}));

module.exports = router;
