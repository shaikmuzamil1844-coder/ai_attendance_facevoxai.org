-- =============================================================================
-- FaceVoxAI Production — 001 CORE SCHEMA
-- Intelligent Real-Time Attendance & Academic Analytics Platform
--
-- RUN THIS FIRST in Supabase: SQL Editor → New query → Paste → Run
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- text similarity / fuzzy search

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'hod', 'faculty', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_method AS ENUM ('manual', 'face', 'voice', 'dual', 'offline_sync');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE day_of_week AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20)  NOT NULL UNIQUE,   -- e.g. "CSE", "ECE"
  name        VARCHAR(160) NOT NULL,
  hod_name    VARCHAR(160),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- COURSES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  code            VARCHAR(20)  NOT NULL,          -- e.g. "B.Tech", "M.Tech"
  name            VARCHAR(160) NOT NULL,
  duration_years  SMALLINT NOT NULL DEFAULT 4 CHECK (duration_years > 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, code)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEMESTERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semesters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) NOT NULL,    -- e.g. "Semester 3 (2024-25 Odd)"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLASSROOMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classrooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(40)  NOT NULL UNIQUE,   -- e.g. "CS-101", "LAB-A2"
  name        VARCHAR(160) NOT NULL,
  location    VARCHAR(160),
  capacity    INTEGER NOT NULL DEFAULT 60 CHECK (capacity > 0),
  has_camera  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FACULTY
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faculty (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  employee_code   VARCHAR(40)  NOT NULL UNIQUE,
  name            VARCHAR(160) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  phone           VARCHAR(20),
  designation     VARCHAR(80),    -- e.g. "Assistant Professor"
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STUDENTS
-- (face_embedding and voice_embedding added in migration 002 via pgvector)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID NOT NULL REFERENCES departments(id)  ON DELETE RESTRICT,
  course_id       UUID NOT NULL REFERENCES courses(id)      ON DELETE RESTRICT,
  semester_id     UUID          REFERENCES semesters(id)    ON DELETE SET NULL,
  roll_number     VARCHAR(40)  NOT NULL UNIQUE,
  name            VARCHAR(160) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  phone           VARCHAR(20),
  photo_url       TEXT,                             -- S3/Supabase Storage path
  face_enrolled   BOOLEAN NOT NULL DEFAULT false,
  voice_enrolled  BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS  (login accounts — links to faculty or student by role)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(160) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL,
  full_name       VARCHAR(160) NOT NULL,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  faculty_id      UUID REFERENCES faculty(id)     ON DELETE SET NULL,
  student_id      UUID REFERENCES students(id)    ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SUBJECTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id)     ON DELETE RESTRICT,
  semester_id   UUID          REFERENCES semesters(id)   ON DELETE SET NULL,
  code          VARCHAR(20)  NOT NULL,
  name          VARCHAR(160) NOT NULL,
  credits       SMALLINT NOT NULL DEFAULT 3 CHECK (credits > 0),
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, code)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FACULTY ↔ SUBJECTS  (many-to-many: who can teach which subject)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faculty_subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id    UUID NOT NULL REFERENCES faculty(id)   ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
  section       VARCHAR(10)  NOT NULL DEFAULT '',   -- e.g. "A", "B"
  academic_year VARCHAR(9)   NOT NULL DEFAULT '',   -- e.g. "2024-25"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, subject_id, section, academic_year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STUDENT ↔ SUBJECTS  (enrollment)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_subjects (
  student_id    UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, subject_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIMETABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID NOT NULL REFERENCES subjects(id)    ON DELETE RESTRICT,
  faculty_id    UUID NOT NULL REFERENCES faculty(id)     ON DELETE RESTRICT,
  classroom_id  UUID          REFERENCES classrooms(id)  ON DELETE SET NULL,
  semester_id   UUID          REFERENCES semesters(id)   ON DELETE SET NULL,
  day           day_of_week NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLASS SESSIONS  (each actual class that happened or is scheduled)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id    UUID REFERENCES timetable(id)    ON DELETE SET NULL,
  subject_id      UUID NOT NULL REFERENCES subjects(id)   ON DELETE RESTRICT,
  faculty_id      UUID NOT NULL REFERENCES faculty(id)    ON DELETE RESTRICT,
  classroom_id    UUID          REFERENCES classrooms(id) ON DELETE SET NULL,
  session_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME,
  status          session_status NOT NULL DEFAULT 'scheduled',
  topic_covered   TEXT,
  notes           TEXT,
  started_at      TIMESTAMPTZ,    -- when faculty clicked "Start Attendance"
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (COALESCE(end_time, start_time) >= start_time)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ATTENDANCE  (one row per student per session)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id)       ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES subjects(id)       ON DELETE RESTRICT,
  faculty_id    UUID          REFERENCES faculty(id)        ON DELETE SET NULL,
  status        attendance_status NOT NULL DEFAULT 'absent',
  method        attendance_method NOT NULL DEFAULT 'manual',
  confidence    NUMERIC(5,4),                   -- 0.0000 – 1.0000
  face_distance NUMERIC(7,6),                   -- Euclidean distance from stored embedding
  voice_score   NUMERIC(5,4),                   -- Cosine similarity
  is_live       BOOLEAN,                        -- liveness check result
  device_id     VARCHAR(80),                    -- which device/camera submitted this
  marked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  marked_by     UUID REFERENCES users(id)       ON DELETE SET NULL,
  override_reason TEXT,                         -- reason if manually overridden
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- OFFLINE SYNC QUEUE  (for offline-first support)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       VARCHAR(80) NOT NULL,
  payload         JSONB NOT NULL,               -- raw attendance batch
  session_date    DATE NOT NULL,
  subject_id      UUID REFERENCES subjects(id) ON DELETE SET NULL,
  faculty_id      UUID REFERENCES faculty(id)  ON DELETE SET NULL,
  synced          BOOLEAN NOT NULL DEFAULT false,
  synced_at       TIMESTAMPTZ,
  sync_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FACE PHOTO REGISTRY  (separate from embedding — stores raw photo metadata)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_face_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,                -- S3/Supabase Storage key
  is_primary      BOOLEAN NOT NULL DEFAULT true,
  quality_score   NUMERIC(4,3),                 -- 0.000 – 1.000
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_by     UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  body            TEXT NOT NULL,
  type            VARCHAR(40) NOT NULL DEFAULT 'info',  -- 'info','warning','alert','success'
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(80)  NOT NULL,    -- e.g. 'MARK_ATTENDANCE', 'UPDATE_STUDENT'
  entity      VARCHAR(40)  NOT NULL,    -- e.g. 'attendance', 'student'
  entity_id   UUID,
  detail      JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_dept       ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_subjects_course    ON subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_subjects_semester  ON subjects(semester_id);
CREATE INDEX IF NOT EXISTS idx_faculty_dept       ON faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_students_dept      ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_course    ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_semester  ON students(semester_id);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_faculty      ON users(faculty_id);
CREATE INDEX IF NOT EXISTS idx_users_student      ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date      ON class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_subject   ON class_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_faculty   ON class_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON attendance(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_marked  ON attendance(marked_at);
CREATE INDEX IF NOT EXISTS idx_notif_user         ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_user         ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_offline_device     ON offline_sync_queue(device_id, synced);
CREATE INDEX IF NOT EXISTS idx_timetable_day      ON timetable(faculty_id, day);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS — auto updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $do$ DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'departments','courses','semesters','classrooms',
    'faculty','students','users','subjects',
    'timetable','class_sessions','attendance'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    ', tbl, tbl);
  END LOOP;
END $do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER — Denormalize subject_id / faculty_id into attendance from session
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION attendance_denorm()
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
  FOR EACH ROW EXECUTE FUNCTION attendance_denorm();

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS — useful pre-built queries
-- ─────────────────────────────────────────────────────────────────────────────

-- Attendance summary per student per subject
CREATE OR REPLACE VIEW v_student_attendance_summary AS
SELECT
  a.student_id,
  s.name        AS student_name,
  sub.id        AS subject_id,
  sub.name      AS subject_name,
  sub.code      AS subject_code,
  COUNT(*)                                                   AS total_sessions,
  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)    AS attended,
  ROUND(
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 2
  )                                                          AS attendance_pct
FROM attendance a
JOIN students    s   ON s.id  = a.student_id
JOIN subjects    sub ON sub.id = a.subject_id
GROUP BY a.student_id, s.name, sub.id, sub.name, sub.code;

-- Daily session overview for faculty
CREATE OR REPLACE VIEW v_session_overview AS
SELECT
  cs.id           AS session_id,
  cs.session_date,
  cs.status,
  cs.started_at,
  cs.ended_at,
  sub.id          AS subject_id,
  sub.name        AS subject_name,
  sub.code        AS subject_code,
  f.id            AS faculty_id,
  f.name          AS faculty_name,
  cl.name         AS classroom_name,
  COUNT(a.id)     AS total_marked,
  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count
FROM class_sessions cs
JOIN subjects    sub ON sub.id = cs.subject_id
JOIN faculty     f   ON f.id   = cs.faculty_id
LEFT JOIN classrooms cl ON cl.id = cs.classroom_id
LEFT JOIN attendance a  ON a.session_id = cs.id
GROUP BY cs.id, sub.id, sub.name, sub.code, f.id, f.name, cl.name;
