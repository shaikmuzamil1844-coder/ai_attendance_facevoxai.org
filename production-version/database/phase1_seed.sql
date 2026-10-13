-- =============================================================================
-- Phase 1 seed data — run AFTER phase1_schema.sql
-- All demo logins use password: Demo@123
-- =============================================================================

-- Department / course / semester / room
INSERT INTO departments (id, code, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'CSE', 'Computer Science and Engineering')
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (id, department_id, code, name, duration_years)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'BTECH-CSE',
  'B.Tech Computer Science',
  4
)
ON CONFLICT (department_id, code) DO NOTHING;

INSERT INTO semesters (id, name, start_date, end_date, is_active)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '2026 Odd Semester',
  '2026-07-01',
  '2026-12-15',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO classrooms (id, code, name, location, capacity)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'LH-101',
  'Lecture Hall 101',
  'Block A, Ground Floor',
  60
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO subjects (id, course_id, code, name, credits)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  'CS301',
  'Database Management Systems',
  4
)
ON CONFLICT (course_id, code) DO NOTHING;

-- Faculty + student people records
INSERT INTO faculty (id, department_id, employee_code, name, email, phone)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  'FAC-1001',
  'Dr. Anita Sharma',
  'anita.sharma@college.edu',
  '9876500001'
)
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO faculty (id, department_id, employee_code, name, email, phone)
VALUES (
  '66666666-6666-6666-6666-666666666667',
  '11111111-1111-1111-1111-111111111111',
  'HOD-1001',
  'Prof. Rajesh Kumar',
  'rajesh.kumar@college.edu',
  '9876500002'
)
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO students (
  id, department_id, course_id, semester_id, roll_number, name, email, phone
)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'CSE2024001',
  'Aarav Patel',
  'aarav.patel@student.edu',
  '9876500011'
)
ON CONFLICT (roll_number) DO NOTHING;

INSERT INTO faculty_subjects (faculty_id, subject_id)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555'
)
ON CONFLICT DO NOTHING;

-- Password for every seeded user: Demo@123
INSERT INTO users (id, email, password_hash, role, full_name, is_active, department_id, faculty_id, student_id)
VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'admin@college.edu',
  '$2b$12$oOOglUnx2xYkxhtUbw.d6uCUhWqCmK9fsHuOMqc4zIvHNmP6Ut056',
  'admin',
  'System Admin',
  true,
  NULL,
  NULL,
  NULL
),
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'rajesh.kumar@college.edu',
  '$2b$12$oOOglUnx2xYkxhtUbw.d6uCUhWqCmK9fsHuOMqc4zIvHNmP6Ut056',
  'hod',
  'Prof. Rajesh Kumar',
  true,
  '11111111-1111-1111-1111-111111111111',
  '66666666-6666-6666-6666-666666666667',
  NULL
),
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'anita.sharma@college.edu',
  '$2b$12$oOOglUnx2xYkxhtUbw.d6uCUhWqCmK9fsHuOMqc4zIvHNmP6Ut056',
  'faculty',
  'Dr. Anita Sharma',
  true,
  '11111111-1111-1111-1111-111111111111',
  '66666666-6666-6666-6666-666666666666',
  NULL
),
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
  'aarav.patel@student.edu',
  '$2b$12$oOOglUnx2xYkxhtUbw.d6uCUhWqCmK9fsHuOMqc4zIvHNmP6Ut056',
  'student',
  'Aarav Patel',
  true,
  '11111111-1111-1111-1111-111111111111',
  NULL,
  '77777777-7777-7777-7777-777777777777'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO class_sessions (
  id, subject_id, faculty_id, classroom_id, session_date, start_time, end_time, status, notes
)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  CURRENT_DATE,
  '09:00',
  '10:00',
  'scheduled',
  'Phase 1 demo session'
)
ON CONFLICT (id) DO NOTHING;
