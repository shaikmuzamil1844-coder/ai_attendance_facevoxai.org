// src/middleware/rbac.js — Role-Based Access Control middleware
/**
 * Factory: require one or more roles.
 * Usage: router.get('/admin-only', requireAuth, requireRole('admin'), handler)
 *        router.get('/staff',      requireAuth, requireRole('admin','hod','faculty'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}.`,
      });
    }
    next();
  };
}

/**
 * Convenience role guards — import and use directly in routes.
 */
const adminOnly      = requireRole('admin');
const adminOrHod     = requireRole('admin', 'hod');
const staffOnly      = requireRole('admin', 'hod', 'faculty');
const studentOnly    = requireRole('student');
const anyRole        = requireRole('admin', 'hod', 'faculty', 'student');

module.exports = { requireRole, adminOnly, adminOrHod, staffOnly, studentOnly, anyRole };
