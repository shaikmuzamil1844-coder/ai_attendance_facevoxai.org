// src/scripts/initDb.js
// Initial setup script to seed default Super Admin & Core Organization data
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');

async function initDb() {
  console.log('⚡ Initializing Database with Super Admin & Base Structure...');

  try {
    // 1. Create Default Department
    const deptRes = await query(`
      INSERT INTO departments (code, name, hod_name)
      VALUES ('CSE', 'Computer Science & Engineering', 'Head of Department')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const deptId = deptRes.rows[0].id;
    console.log('✅ Department created/verified: CSE');

    // 2. Create Default Course
    const courseRes = await query(`
      INSERT INTO courses (department_id, code, name, duration_years)
      VALUES ($1, 'B.TECH', 'Bachelor of Technology', 4)
      ON CONFLICT (department_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [deptId]);
    const courseId = courseRes.rows[0].id;
    console.log('✅ Course created/verified: B.TECH');

    // 3. Create Default Semester
    const semRes = await query(`
      INSERT INTO semesters (name, start_date, end_date, is_active)
      VALUES ('Semester 1 (2025-26)', '2025-08-01', '2025-12-31', true)
      RETURNING id;
    `).catch(async () => {
      return await query(`SELECT id FROM semesters LIMIT 1`);
    });
    const semesterId = semRes.rows[0].id;
    console.log('✅ Semester created/verified');

    // 4. Create Default Classroom
    await query(`
      INSERT INTO classrooms (code, name, location, capacity, has_camera)
      VALUES ('CR-101', 'Classroom 101', 'Block A, 1st Floor', 60, true)
      ON CONFLICT (code) DO NOTHING;
    `);
    console.log('✅ Classroom created/verified: CR-101');

    // 5. Create Default Super Admin User
    const adminEmail = 'admin@facevoxai.com';
    const rawPassword = 'AdminPassword123!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    await query(`
      INSERT INTO users (email, password_hash, role, full_name, department_id, is_active)
      VALUES ($1, $2, 'admin', 'System Administrator', $3, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_active = true;
    `, [adminEmail, passwordHash, deptId]);

    console.log('\n======================================================');
    console.log('🎉 Database Initialized Successfully!');
    console.log('------------------------------------------------------');
    console.log('🔑 Super Admin Credentials:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${rawPassword}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Error initializing database:', err);
  } finally {
    await pool.end();
  }
}

initDb();
