require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/db');

async function checkAndSync() {
  try {
    const fRes = await pool.query('SELECT * FROM faculty WHERE is_active = true');
    console.log('Active Faculty in DB:', fRes.rows);

    for (const fac of fRes.rows) {
      const uRes = await pool.query('SELECT * FROM users WHERE email = $1', [fac.email.toLowerCase()]);
      if (uRes.rows.length === 0) {
        console.log(`Creating user login for faculty: ${fac.name} (${fac.email})...`);
        const hash = await bcrypt.hash('FacultyPassword123!', 12);
        await pool.query(
          `INSERT INTO users (email, password_hash, role, full_name, department_id, faculty_id)
           VALUES ($1, $2, 'faculty', $3, $4, $5)`,
          [fac.email.toLowerCase(), hash, fac.name, fac.department_id, fac.id]
        );
        console.log(`Created user account for ${fac.email}`);
      } else {
        console.log(`User already exists for ${fac.email}`);
      }
    }

    const f = await pool.query('SELECT id FROM faculty LIMIT 1');
    const s = await pool.query('SELECT id FROM subjects LIMIT 1');
    const stu = await pool.query('SELECT id FROM students LIMIT 1');
    if (f.rows[0] && s.rows[0]) {
      await pool.query('INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [f.rows[0].id, s.rows[0].id]);
      console.log('Assigned faculty to subject!');
    }
    if (stu.rows[0] && s.rows[0]) {
      await pool.query('INSERT INTO student_subjects (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [stu.rows[0].id, s.rows[0].id]);
      console.log('Enrolled student into subject!');
    }

    const allUsers = await pool.query('SELECT id, email, role, full_name, faculty_id FROM users');
    console.log('All Users:', allUsers.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAndSync();
