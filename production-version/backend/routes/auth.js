const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      `SELECT id, email, password_hash, role, full_name, is_active, department_id, faculty_id, student_id
       FROM users WHERE lower(email) = lower($1)`,
      [email.trim()]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        departmentId: user.department_id,
        facultyId: user.faculty_id,
        studentId: user.student_id,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Login required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      `SELECT id, email, role, full_name, department_id, faculty_id, student_id
       FROM users WHERE id = $1`,
      [payload.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      departmentId: user.department_id,
      facultyId: user.faculty_id,
      studentId: user.student_id,
    });
  } catch {
    return res.status(401).json({ error: 'Login required' });
  }
});

module.exports = router;
