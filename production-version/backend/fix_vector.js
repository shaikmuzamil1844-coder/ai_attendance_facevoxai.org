require('dotenv').config();
const { pool } = require('./src/config/db');

async function fixVector() {
  try {
    console.log('Altering students face_embedding to vector(128)...');
    await pool.query('DROP INDEX IF EXISTS idx_students_face_hnsw');
    await pool.query('ALTER TABLE students ALTER COLUMN face_embedding TYPE vector(128)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_students_face_hnsw ON students USING hnsw (face_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION search_face_embedding(
        probe         vector(128),
        max_distance  FLOAT DEFAULT 0.5,
        top_n         INT   DEFAULT 5
      )
      RETURNS TABLE (
        student_id    UUID,
        name          TEXT,
        roll_number   TEXT,
        distance      FLOAT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          s.id,
          s.name::TEXT,
          s.roll_number::TEXT,
          (s.face_embedding <=> probe)::FLOAT AS distance
        FROM students s
        WHERE
          s.face_enrolled = true
          AND s.is_active  = true
          AND s.face_embedding IS NOT NULL
          AND (s.face_embedding <=> probe) <= max_distance
        ORDER BY distance
        LIMIT top_n;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('SUCCESS: face_embedding is now vector(128) and HNSW index is active!');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

fixVector();
