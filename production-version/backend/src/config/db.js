// src/config/db.js — PostgreSQL connection pool
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query.
 * @param {string} text   SQL with $1, $2 … placeholders
 * @param {any[]}  params Parameter values
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] query (${duration}ms): ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    }
    return result;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

/**
 * Get a dedicated client for transactions.
 * Always call client.release() in a finally block.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
