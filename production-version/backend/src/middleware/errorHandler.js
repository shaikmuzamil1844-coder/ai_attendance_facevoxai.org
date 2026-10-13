// src/middleware/errorHandler.js — Global Express error handler
/**
 * Central error handler — must be registered LAST in Express (after all routes).
 * Catches all errors thrown with next(err) or thrown inside async route handlers.
 */
function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err.stack || err.message);

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }

  // PostgreSQL not-null constraint
  if (err.code === '23502') {
    return res.status(400).json({ error: `Missing required field: ${err.column}` });
  }

  // Known application errors with a status code already set
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Default: 500 Internal Server Error
  return res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message,
  });
}

/**
 * Wrap async route handlers to forward errors to errorHandler automatically.
 * Usage: router.get('/path', asyncWrap(async (req, res) => { ... }))
 */
function asyncWrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create an application error with a specific HTTP status code.
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, asyncWrap, createError };
