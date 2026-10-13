const jwt = require('jsonwebtoken');
const { query } = require('../db');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Login required' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this action' });
    }
    return next();
  };
}

async function loadUser(req, res, next) {
  try {
    const result = await query(
      `SELECT id, email, role, full_name, is_active, department_id, faculty_id, student_id
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }
    req.account = result.rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { authRequired, requireRoles, loadUser };
