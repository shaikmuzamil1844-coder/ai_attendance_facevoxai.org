// src/middleware/validate.js — Zod request validation middleware
const { ZodError } = require('zod');

/**
 * Validate req.body against a Zod schema.
 * On failure, responds 400 with a list of field errors.
 * On success, replaces req.body with the parsed (coerced + defaults applied) value.
 *
 * @param {import('zod').ZodSchema} schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issueList = err.issues || err.errors || [];
        const errors = issueList.map((e) => ({
          field:   (e.path && e.path.join('.')) || '',
          message: e.message,
        }));
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }
      next(err);
    }
  };
}

/**
 * Validate req.query against a Zod schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issueList = err.issues || err.errors || [];
        const errors = issueList.map((e) => ({
          field:   (e.path && e.path.join('.')) || '',
          message: e.message,
        }));
        return res.status(400).json({ error: 'Query validation failed', details: errors });
      }
      next(err);
    }
  };
}

module.exports = { validateBody, validateQuery };
