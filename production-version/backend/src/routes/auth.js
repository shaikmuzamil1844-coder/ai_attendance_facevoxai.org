// src/routes/auth.js — Authentication routes
// POST /api/auth/login
// POST /api/auth/register
// POST /api/auth/refresh
// DELETE /api/auth/logout
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { z }    = require('zod');

const { query }      = require('../config/db');
const { requireAuth }   = require('../middleware/auth');
const { validateBody }  = require('../middleware/validate');
const { asyncWrap, createError } = require('../middleware/errorHandler');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    {
      sub:       user.id,
      email:     user.email,
      role:      user.role,
      fullName:  user.full_name,
      facultyId: user.faculty_id,
      studentId: user.student_id,
      deptId:    user.department_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const loginSchema = z.object({
  email:      z.string().optional(),
  identifier: z.string().optional(),
  password:   z.string().min(4, 'Password must be at least 4 characters'),
}).refine(data => data.email || data.identifier, {
  message: 'Email or Register / Roll Number is required',
});

const registerSchema = z.object({
  email:      z.string().email(),
  password:   z.string().min(6, 'Password must be at least 6 characters'),
  fullName:   z.string().min(2).max(160),
  role:       z.enum(['admin', 'hod', 'faculty', 'student']),
  deptId:     z.string().uuid().optional(),
  facultyId:  z.string().uuid().optional(),
  studentId:  z.string().uuid().optional(),
});

const studentRegisterSchema = z.object({
  rollNumber:   z.string().min(1).max(50),
  name:         z.string().min(2).max(160),
  email:        z.string().email(),
  password:     z.string().min(6, 'Password must be at least 6 characters'),
  departmentId: z.string().uuid(),
  courseId:     z.string().uuid(),
  semesterId:   z.string().uuid().optional(),
  phone:        z.string().max(20).optional(),
});

const facultyRegisterSchema = z.object({
  employeeCode: z.string().max(40).optional(),
  name:         z.string().min(2, 'Name must be at least 2 characters').max(160),
  email:        z.string().email('Please enter a valid email address'),
  password:     z.string().min(6, 'Password must be at least 6 characters'),
  departmentId: z.string().uuid('Please select a valid department'),
  phone:        z.string().max(20).optional(),
  designation:  z.string().max(80).optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/meta
 * Returns active departments, courses, and semesters for registration
 */
router.get('/meta', asyncWrap(async (req, res) => {
  const depts = await query(`SELECT id, code, name FROM departments WHERE is_active = true ORDER BY name`);
  const courses = await query(`SELECT id, department_id, code, name FROM courses WHERE is_active = true ORDER BY name`);
  const semesters = await query(`SELECT id, name FROM semesters WHERE is_active = true ORDER BY name`);
  res.json({
    departments: depts.rows,
    courses:     courses.rows,
    semesters:   semesters.rows,
  });
}));

/**
 * POST /api/auth/register-student
 * Self-registration for students with roll number & basic details
 */
router.post('/register-student', validateBody(studentRegisterSchema), asyncWrap(async (req, res) => {
  const { rollNumber, name, email, password, departmentId, courseId, semesterId, phone } = req.body;

  // Check duplicate email in users or students
  const existingEmail = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (existingEmail.rows.length > 0) {
    throw createError(409, 'An account with this email already exists.');
  }

  const existingRoll = await query(`SELECT id FROM students WHERE roll_number = $1`, [rollNumber.trim()]);
  if (existingRoll.rows.length > 0) {
    throw createError(409, `Student with Register / Roll Number "${rollNumber}" already exists.`);
  }

  // 1. Insert into students table
  const studentRes = await query(
    `INSERT INTO students (department_id, course_id, semester_id, roll_number, name, email, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [departmentId, courseId, semesterId || null, rollNumber.trim(), name.trim(), email.toLowerCase(), phone || null]
  );
  const newStudent = studentRes.rows[0];

  // Auto-enroll student into active subjects of this course/semester
  if (courseId) {
    const subjectsRes = await query(
      `SELECT id FROM subjects WHERE course_id = $1 AND is_active = true`,
      [courseId]
    );
    for (const sub of subjectsRes.rows) {
      await query(
        `INSERT INTO student_subjects (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [newStudent.id, sub.id]
      );
    }
  }

  // 2. Insert into users table
  const passwordHash = await bcrypt.hash(password, 12);
  const userRes = await query(
    `INSERT INTO users (email, password_hash, role, full_name, department_id, student_id)
     VALUES ($1, $2, 'student', $3, $4, $5)
     RETURNING id, email, role, full_name, faculty_id, student_id, department_id`,
    [email.toLowerCase(), passwordHash, name.trim(), departmentId, newStudent.id]
  );
  const newUser = userRes.rows[0];

  const accessToken  = signAccessToken(newUser);
  const refreshToken = signRefreshToken(newUser.id);

  res.status(201).json({
    message: 'Student registered successfully!',
    accessToken,
    refreshToken,
    user: {
      id:         newUser.id,
      email:      newUser.email,
      role:       newUser.role,
      fullName:   newUser.full_name,
      facultyId:  newUser.faculty_id,
      studentId:  newUser.student_id,
      deptId:     newUser.department_id,
    },
    student: newStudent,
  });
}));

/**
 * POST /api/auth/register-faculty
 * Self-registration for faculty / teaching staff
 */
router.post('/register-faculty', validateBody(facultyRegisterSchema), asyncWrap(async (req, res) => {
  const { employeeCode, name, email, password, departmentId, phone, designation } = req.body;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Check duplicate email in users or faculty
  const existingUser = await query(`SELECT id FROM users WHERE email = $1`, [cleanEmail]);
  if (existingUser.rows.length > 0) {
    throw createError(409, 'An account with this email already exists.');
  }

  const existingFaculty = await query(`SELECT id FROM faculty WHERE email = $1`, [cleanEmail]);
  if (existingFaculty.rows.length > 0) {
    throw createError(409, 'A faculty profile with this email already exists.');
  }

  // 2. Resolve employee_code
  let code = (employeeCode || '').trim().toUpperCase();
  if (!code) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    code = `FAC-${rand}`;
  }

  // Verify employee_code uniqueness
  const existingCode = await query(`SELECT id FROM faculty WHERE employee_code = $1`, [code]);
  if (existingCode.rows.length > 0) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    code = `${code}-${rand}`;
  }

  // 3. Insert into faculty table
  const facultyRes = await query(
    `INSERT INTO faculty (department_id, employee_code, name, email, phone, designation)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [departmentId, code, name.trim(), cleanEmail, phone || null, designation || 'Assistant Professor']
  );
  const newFaculty = facultyRes.rows[0];

  // 4. Insert into users table
  const passwordHash = await bcrypt.hash(password, 12);
  const userRes = await query(
    `INSERT INTO users (email, password_hash, role, full_name, department_id, faculty_id)
     VALUES ($1, $2, 'faculty', $3, $4, $5)
     RETURNING id, email, role, full_name, faculty_id, student_id, department_id`,
    [cleanEmail, passwordHash, name.trim(), departmentId, newFaculty.id]
  );
  const newUser = userRes.rows[0];

  const accessToken  = signAccessToken(newUser);
  const refreshToken = signRefreshToken(newUser.id);

  res.status(201).json({
    message: 'Faculty registered successfully!',
    accessToken,
    refreshToken,
    user: {
      id:           newUser.id,
      email:        newUser.email,
      role:         newUser.role,
      fullName:     newUser.full_name,
      facultyId:    newUser.faculty_id,
      studentId:    null,
      deptId:       newUser.department_id,
      employeeCode: newFaculty.employee_code,
    },
    faculty: newFaculty,
  });
}));

/**
 * POST /api/auth/login
 * Body: { email/identifier, password }
 * Supports email, student roll number, or faculty employee code
 * Response: { accessToken, refreshToken, user }
 */
router.post('/login', validateBody(loginSchema), asyncWrap(async (req, res) => {
  const rawId = (req.body.identifier || req.body.email || '').trim();
  const password = req.body.password;

  let user = null;

  if (rawId.includes('@')) {
    // Search by email in users table
    const result = await query(
      `SELECT id, email, password_hash, role, full_name,
              faculty_id, student_id, department_id, is_active
       FROM users WHERE email = $1`,
      [rawId.toLowerCase()]
    );
    user = result.rows[0];
  } else {
    // 1. Search by roll_number in students table
    const studRes = await query(
      `SELECT s.id, s.roll_number, s.name, s.email, u.id AS user_id,
              u.password_hash, u.role, u.full_name, u.faculty_id,
              u.student_id, u.department_id, u.is_active
       FROM students s
       LEFT JOIN users u ON u.student_id = s.id OR (u.email = s.email AND u.role = 'student')
       WHERE s.roll_number = $1`,
      [rawId]
    );

    if (studRes.rows.length > 0 && studRes.rows[0].user_id) {
      const r = studRes.rows[0];
      user = {
        id:            r.user_id,
        email:         r.email,
        password_hash: r.password_hash,
        role:          r.role,
        full_name:     r.full_name || r.name,
        faculty_id:    r.faculty_id,
        student_id:    r.student_id || r.id,
        department_id: r.department_id,
        is_active:     r.is_active,
      };
    } else if (studRes.rows.length > 0 && !studRes.rows[0].user_id) {
      // Auto-create user if student exists without user account
      const s = studRes.rows[0];
      const defaultHash = await bcrypt.hash(password, 12);
      const newU = await query(
        `INSERT INTO users (email, password_hash, role, full_name, student_id)
         VALUES ($1, $2, 'student', $3, $4)
         RETURNING id, email, password_hash, role, full_name, faculty_id, student_id, department_id, is_active`,
        [s.email, defaultHash, s.name, s.id]
      );
      user = newU.rows[0];
    } else {
      // 2. Search by employee_code in faculty table
      const facRes = await query(
        `SELECT f.id, f.employee_code, f.name, f.email, f.department_id, u.id AS user_id,
                u.password_hash, u.role, u.full_name, u.faculty_id,
                u.student_id, u.department_id AS user_dept_id, u.is_active
         FROM faculty f
         LEFT JOIN users u ON u.faculty_id = f.id OR (u.email = f.email AND u.role = 'faculty')
         WHERE f.employee_code ILIKE $1`,
        [rawId]
      );

      if (facRes.rows.length > 0 && facRes.rows[0].user_id) {
        const f = facRes.rows[0];
        user = {
          id:            f.user_id,
          email:         f.email,
          password_hash: f.password_hash,
          role:          f.role || 'faculty',
          full_name:     f.full_name || f.name,
          faculty_id:    f.faculty_id || f.id,
          student_id:    null,
          department_id: f.department_id || f.user_dept_id,
          is_active:     f.is_active !== false,
        };
      } else if (facRes.rows.length > 0 && !facRes.rows[0].user_id) {
        // Auto-create user if faculty exists without user record
        const f = facRes.rows[0];
        const defaultHash = await bcrypt.hash(password, 12);
        const newU = await query(
          `INSERT INTO users (email, password_hash, role, full_name, faculty_id, department_id)
           VALUES ($1, $2, 'faculty', $3, $4, $5)
           RETURNING id, email, password_hash, role, full_name, faculty_id, student_id, department_id, is_active`,
          [f.email, defaultHash, f.name, f.id, f.department_id]
        );
        user = newU.rows[0];
      }
    }
  }

  if (!user) {
    throw createError(401, 'Invalid credentials. User not found.');
  }

  if (!user.is_active) {
    throw createError(403, 'Your account has been deactivated. Contact admin.');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw createError(401, 'Invalid password. Please check your credentials.');
  }

  // Update last_login_at
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id:         user.id,
      email:      user.email,
      role:       user.role,
      fullName:   user.full_name,
      facultyId:  user.faculty_id,
      studentId:  user.student_id,
      deptId:     user.department_id,
    },
  });
}));

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Response: { accessToken }
 */
router.post('/refresh', asyncWrap(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw createError(400, 'Refresh token is required.');
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw createError(401, 'Invalid or expired refresh token. Please log in again.');
  }

  const result = await query(
    `SELECT id, email, role, full_name, faculty_id, student_id, department_id, is_active
     FROM users WHERE id = $1`,
    [payload.sub]
  );
  const user = result.rows[0];

  if (!user || !user.is_active) {
    throw createError(401, 'User not found or deactivated.');
  }

  const newAccessToken = signAccessToken(user);
  res.json({ accessToken: newAccessToken });
}));

/**
 * POST /api/auth/register
 * Protected: admin only
 * Body: { email, password, fullName, role, deptId?, facultyId?, studentId? }
 */
router.post('/register',
  requireAuth,
  validateBody(registerSchema),
  asyncWrap(async (req, res) => {
    // Only admin can create accounts
    if (req.user.role !== 'admin') {
      throw createError(403, 'Only admins can create user accounts.');
    }

    const { email, password, fullName, role, deptId, facultyId, studentId } = req.body;

    // Check duplicate
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw createError(409, 'A user with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (email, password_hash, role, full_name, department_id, faculty_id, student_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, role, full_name, department_id, faculty_id, student_id`,
      [email.toLowerCase(), passwordHash, role, fullName, deptId || null, facultyId || null, studentId || null]
    );

    const newUser = result.rows[0];
    res.status(201).json({
      message: 'User created successfully.',
      user: {
        id:        newUser.id,
        email:     newUser.email,
        role:      newUser.role,
        fullName:  newUser.full_name,
      },
    });
  })
);

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', requireAuth, asyncWrap(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.full_name, u.department_id, u.faculty_id,
            u.student_id, u.is_active, u.last_login_at,
            d.name AS dept_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1`,
    [req.user.userId]
  );
  const user = result.rows[0];
  if (!user) throw createError(404, 'User not found.');
  res.json(user);
}));

/**
 * PUT /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
router.put('/change-password', requireAuth, asyncWrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw createError(400, 'currentPassword and newPassword are required.');
  }
  if (newPassword.length < 8) {
    throw createError(400, 'New password must be at least 8 characters.');
  }

  const result = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.userId]);
  const user = result.rows[0];

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) throw createError(401, 'Current password is incorrect.');

  const newHash = await bcrypt.hash(newPassword, 12);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, req.user.userId]);

  res.json({ message: 'Password changed successfully.' });
}));

module.exports = router;
