const express = require('express');
const { query } = require('../db');
const { requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/departments', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/departments', requireRoles('admin'), async (req, res, next) => {
  try {
    const { code, name } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
    const result = await query(
      'INSERT INTO departments (code, name) VALUES ($1, $2) RETURNING *',
      [code.trim().toUpperCase(), name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/courses', async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    const result = departmentId
      ? await query(
          `SELECT c.*, d.name AS department_name
           FROM courses c JOIN departments d ON d.id = c.department_id
           WHERE c.department_id = $1 ORDER BY c.name`,
          [departmentId]
        )
      : await query(
          `SELECT c.*, d.name AS department_name
           FROM courses c JOIN departments d ON d.id = c.department_id
           ORDER BY d.name, c.name`
        );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/courses', requireRoles('admin'), async (req, res, next) => {
  try {
    const { departmentId, code, name, durationYears } = req.body || {};
    if (!departmentId || !code || !name) {
      return res.status(400).json({ error: 'departmentId, code and name are required' });
    }
    const result = await query(
      `INSERT INTO courses (department_id, code, name, duration_years)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [departmentId, code.trim().toUpperCase(), name.trim(), durationYears || 4]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/semesters', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM semesters ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/semesters', requireRoles('admin'), async (req, res, next) => {
  try {
    const { name, startDate, endDate, isActive } = req.body || {};
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'name, startDate and endDate are required' });
    }
    if (isActive) {
      await query('UPDATE semesters SET is_active = false');
    }
    const result = await query(
      `INSERT INTO semesters (name, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), startDate, endDate, Boolean(isActive)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/classrooms', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM classrooms ORDER BY code');
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/classrooms', requireRoles('admin'), async (req, res, next) => {
  try {
    const { code, name, location, capacity } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
    const result = await query(
      `INSERT INTO classrooms (code, name, location, capacity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code.trim(), name.trim(), location || null, capacity || 40]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/subjects', async (req, res, next) => {
  try {
    const { courseId } = req.query;
    const sql = `
      SELECT s.*, c.name AS course_name, d.name AS department_name
      FROM subjects s
      JOIN courses c ON c.id = s.course_id
      JOIN departments d ON d.id = c.department_id
      ${courseId ? 'WHERE s.course_id = $1' : ''}
      ORDER BY s.code`;
    const result = courseId ? await query(sql, [courseId]) : await query(sql);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/subjects', requireRoles('admin', 'hod'), async (req, res, next) => {
  try {
    const { courseId, code, name, credits } = req.body || {};
    if (!courseId || !code || !name) {
      return res.status(400).json({ error: 'courseId, code and name are required' });
    }
    const result = await query(
      `INSERT INTO subjects (course_id, code, name, credits)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [courseId, code.trim().toUpperCase(), name.trim(), credits || 3]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
