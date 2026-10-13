const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { query } = require('../db');
const { requireRoles } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/faculty', async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    const sql = `
      SELECT f.*, d.name AS department_name
      FROM faculty f
      JOIN departments d ON d.id = f.department_id
      ${departmentId ? 'WHERE f.department_id = $1' : ''}
      ORDER BY f.name`;
    const result = departmentId ? await query(sql, [departmentId]) : await query(sql);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/faculty', requireRoles('admin'), async (req, res, next) => {
  try {
    const { departmentId, employeeCode, name, email, phone, password } = req.body || {};
    if (!departmentId || !employeeCode || !name || !email || !password) {
      return res.status(400).json({ error: 'departmentId, employeeCode, name, email and password are required' });
    }

    const faculty = await query(
      `INSERT INTO faculty (department_id, employee_code, name, email, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [departmentId, employeeCode.trim(), name.trim(), email.trim().toLowerCase(), phone || null]
    );
    const hash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (email, password_hash, role, full_name, department_id, faculty_id)
       VALUES ($1, $2, 'faculty', $3, $4, $5)`,
      [email.trim().toLowerCase(), hash, name.trim(), departmentId, faculty.rows[0].id]
    );
    res.status(201).json(faculty.rows[0]);
  } catch (err) { next(err); }
});

router.get('/students', async (req, res, next) => {
  try {
    const { departmentId, courseId } = req.query;
    const filters = [];
    const params = [];
    if (departmentId) {
      params.push(departmentId);
      filters.push(`st.department_id = $${params.length}`);
    }
    if (courseId) {
      params.push(courseId);
      filters.push(`st.course_id = $${params.length}`);
    }
    if (req.account.role === 'hod' && req.account.department_id) {
      params.push(req.account.department_id);
      filters.push(`st.department_id = $${params.length}`);
    }
    if (req.account.role === 'student' && req.account.student_id) {
      params.push(req.account.student_id);
      filters.push(`st.id = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await query(
      `SELECT st.*, d.name AS department_name, c.name AS course_name, sm.name AS semester_name
       FROM students st
       JOIN departments d ON d.id = st.department_id
       JOIN courses c ON c.id = st.course_id
       LEFT JOIN semesters sm ON sm.id = st.semester_id
       ${where}
       ORDER BY st.roll_number`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/students', requireRoles('admin', 'hod', 'faculty'), async (req, res, next) => {
  try {
    const {
      departmentId, courseId, semesterId, rollNumber, name, email, phone, password,
    } = req.body || {};
    if (!departmentId || !courseId || !rollNumber || !name || !email || !password) {
      return res.status(400).json({
        error: 'departmentId, courseId, rollNumber, name, email and password are required',
      });
    }

    const student = await query(
      `INSERT INTO students (department_id, course_id, semester_id, roll_number, name, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        departmentId,
        courseId,
        semesterId || null,
        rollNumber.trim(),
        name.trim(),
        email.trim().toLowerCase(),
        phone || null,
      ]
    );
    const hash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (email, password_hash, role, full_name, department_id, student_id)
       VALUES ($1, $2, 'student', $3, $4, $5)`,
      [email.trim().toLowerCase(), hash, name.trim(), departmentId, student.rows[0].id]
    );
    res.status(201).json(student.rows[0]);
  } catch (err) { next(err); }
});

router.post('/students/:id/face', requireRoles('admin', 'hod', 'faculty', 'student'), upload.single('photo'), async (req, res, next) => {
  try {
    const studentId = req.params.id;
    if (req.account.role === 'student' && req.account.student_id !== studentId) {
      return res.status(403).json({ error: 'You can only register your own face' });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Photo file is required' });

    const storagePath = `/uploads/${file.filename}`;
    await query(
      `INSERT INTO student_faces (student_id, storage_path, is_primary)
       VALUES ($1, $2, true)`,
      [studentId, storagePath]
    );
    await query(
      `UPDATE students SET photo_url = $1, face_enrolled = true WHERE id = $2`,
      [storagePath, studentId]
    );
    res.status(201).json({ studentId, storagePath, faceEnrolled: true });
  } catch (err) { next(err); }
});

module.exports = router;
