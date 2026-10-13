-- =============================================================================
-- FaceVoxAI Production — 003 ROW LEVEL SECURITY (RLS)
-- Restricts data access based on JWT role claims
--
-- RUN THIS THIRD in Supabase SQL Editor
-- NOTE: The Node.js backend uses the service_role key and BYPASSES RLS entirely.
--       RLS here is a defense-in-depth measure for direct REST API calls.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE RLS on all tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE departments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty           ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_subjects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable         ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- SERVICE ROLE BYPASS POLICY (for backend Node.js server)
-- The backend connects with service_role key → bypasses all RLS automatically
-- These policies are for direct PostgREST/anon API access protection only
-- ─────────────────────────────────────────────────────────────────────────────

-- Public read-only for lookup tables (departments, courses, semesters, classrooms)
CREATE POLICY "public_read_departments"  ON departments  FOR SELECT USING (true);
CREATE POLICY "public_read_courses"      ON courses      FOR SELECT USING (true);
CREATE POLICY "public_read_semesters"    ON semesters    FOR SELECT USING (true);
CREATE POLICY "public_read_classrooms"   ON classrooms   FOR SELECT USING (true);
CREATE POLICY "public_read_subjects"     ON subjects     FOR SELECT USING (true);

-- Block ALL direct anon write access to sensitive tables
-- (Writes happen only through backend API with JWT auth)
CREATE POLICY "deny_anon_write_students"    ON students     FOR INSERT WITH CHECK (false);
CREATE POLICY "deny_anon_write_faculty"     ON faculty      FOR INSERT WITH CHECK (false);
CREATE POLICY "deny_anon_write_users"       ON users        FOR INSERT WITH CHECK (false);
CREATE POLICY "deny_anon_write_attendance"  ON attendance   FOR INSERT WITH CHECK (false);

-- Students can read only their own record
CREATE POLICY "student_read_own"
  ON students FOR SELECT
  USING (email = current_user);

-- Users can read only their own user record
CREATE POLICY "user_read_own"
  ON users FOR SELECT
  USING (email = current_user);

-- Attendance: students can read only their own attendance
CREATE POLICY "student_read_own_attendance"
  ON attendance FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE email = current_user
    )
  );

-- Notifications: users can only read/update their own
CREATE POLICY "user_read_own_notifications"
  ON notifications FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE email = current_user)
  );

CREATE POLICY "user_update_own_notifications"
  ON notifications FOR UPDATE
  USING (
    user_id IN (SELECT id FROM users WHERE email = current_user)
  );
