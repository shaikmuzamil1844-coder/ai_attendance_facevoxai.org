// src/middleware/auth.js — JWT authentication middleware
const jwt = require('jsonwebtoken');

/**
 * Verify JWT access token from Authorization: Bearer <token> header.
 * Attaches { userId, email, role, facultyId, studentId } to req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId:    payload.sub,
      email:     payload.email,
      role:      payload.role,
      fullName:  payload.fullName,
      facultyId: payload.facultyId || null,
      studentId: payload.studentId || null,
      deptId:    payload.deptId    || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please refresh your session.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

module.exports = { requireAuth };
