require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./src/config/db');

async function run() {
  try {
    const studentRes = await query("SELECT * FROM students WHERE roll_number = '111233445'");
    const student = studentRes.rows[0];
    if (!student) {
      console.log('Student not found');
      process.exit(1);
    }
    console.log('Found student:', student.id, student.name, student.email);

    const existingUser = (await query('SELECT * FROM users WHERE student_id = $1 OR email = $2', [student.id, student.email])).rows[0];
    if (existingUser) {
      console.log('User already exists for student:', existingUser.email, existingUser.id);
    } else {
      const passwordHash = await bcrypt.hash('StudentPassword123!', 12);
      const newUser = (await query(
        `INSERT INTO users (email, password_hash, role, full_name, department_id, student_id)
         VALUES ($1, $2, 'student', $3, $4, $5)
         RETURNING id, email, role, full_name, student_id`,
        [student.email, passwordHash, student.name, student.department_id, student.id]
      )).rows[0];
      console.log('Successfully created student user:', newUser);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
run();
