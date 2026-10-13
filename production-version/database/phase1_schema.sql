-- =============================================================================
-- FaceVoxAI Production — Phase 1 Foundation schema
-- Run this FIRST in Supabase: SQL Editor → New query → Run
-- Does not modify the Streamlit prototype tables (teachers/students).
-- Phase 2 will add pgvector embeddings. Phase 3 will expand timetable live flow.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optional: uncomment in Phase 2 when vector search is enabled
-- CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'hod', 'faculty', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE attendance_method AS ENUM ('manual', 'face', 'voice', 'offline_sync');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Organization
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  code            VARCHAR(20) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  duration_years  SMALLINT NOT NULL DEFAULT 4,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, code)
);

CREATE TABLE IF NOT EXISTS semesters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS classrooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(40) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  location    VARCHAR(160),
  capacity    INTEGER NOT NULL DEFAULT 40 CHECK (capacity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(160) NOT NULL,
  credits     SMALLINT NOT NULL DEFAULT 3,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, code)
);

-- -----------------------------------------------------------------------------
-- People
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculty (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  employee_code   VARCHAR(40) NOT NULL UNIQUE,
  name            VARCHAR(160) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  phone           VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  semester_id     UUID REFERENCES semesters(id) ON DELETE SET NULL,
  roll_number     VARCHAR(40) NOT NULL UNIQUE,
  name            VARCHAR(160) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  phone           VARCHAR(20),
  photo_url       TEXT,
  face_enrolled   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App users (JWT). Links to faculty or student when role matches.
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(160) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL,
  full_name       VARCHAR(160) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  faculty_id      UUID REFERENCES faculty(id) ON DELETE SET NULL,
  student_id      UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);

-- Phase 1 face registration: store photo metadata only (no embeddings yet)
CREATE TABLE IF NOT EXISTS student_faces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Faculty teaching map (who can take which subject)
CREATE TABLE IF NOT EXISTS faculty_subjects (
  faculty_id  UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (faculty_id, subject_id)
);

-- Lightweight sessions for Phase 1 (full timetable in Phase 3)
CREATE TABLE IF NOT EXISTS class_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  faculty_id    UUID NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
  classroom_id  UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  session_date  DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  status        session_status NOT NULL DEFAULT 'scheduled',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  faculty_id    UUID REFERENCES faculty(id) ON DELETE SET NULL,
  subject_id    UUID REFERENCES subjects(id) ON DELETE SET NULL,
  status        attendance_status NOT NULL DEFAULT 'present',
  confidence    NUMERIC(5,4),
  method        attendance_method NOT NULL DEFAULT 'manual',
  device_id     VARCHAR(80),
  marked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  marked_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_subjects_course ON subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_faculty ON class_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_at ON attendance(marked_at);

CREATE OR REPLACE FUNCTION set_attendance_denorm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subject_id IS NULL OR NEW.faculty_id IS NULL THEN
    SELECT s.subject_id, s.faculty_id
      INTO NEW.subject_id, NEW.faculty_id
    FROM class_sessions s
    WHERE s.id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_denorm ON attendance;
CREATE TRIGGER trg_attendance_denorm
BEFORE INSERT ON attendance
FOR EACH ROW EXECUTE FUNCTION set_attendance_denorm();
