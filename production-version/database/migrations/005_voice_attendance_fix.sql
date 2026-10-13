-- =============================================================================
-- FaceVoxAI Production — 005 Voice Attendance Fix & Enhancements
-- Fixes voice_embedding storage, adds audit log, security improvements
-- Run AFTER 002_pgvector.sql
-- =============================================================================

-- ─── Ensure voice_embedding stored correctly ───────────────────────────────
-- Make sure voice_score column exists in attendance
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS voice_score FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS liveness_score FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS biometric_method VARCHAR(20) DEFAULT NULL;

-- ─── Audit Log Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id     UUID REFERENCES students(id) ON DELETE CASCADE,
  action         VARCHAR(50) NOT NULL,  -- 'face_match', 'voice_match', 'dual_match', 'spoof_detected', 'manual_override'
  performed_by   UUID REFERENCES users(id),
  confidence     FLOAT,
  distance       FLOAT,
  similarity     FLOAT,
  is_live        BOOLEAN,
  spoof_reasons  TEXT[],
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_session ON attendance_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_student ON attendance_audit_log(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON attendance_audit_log(created_at DESC);

-- ─── Real-time session view ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_live_session_progress AS
SELECT
  cs.id AS session_id,
  cs.status,
  cs.started_at,
  sub.name AS subject_name,
  sub.code AS subject_code,
  f.name  AS faculty_name,
  cl.name AS classroom_name,
  COUNT(a.id)                                               AS total_enrolled,
  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)   AS present_count,
  SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END)   AS absent_count,
  ROUND(
    SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END)
    / NULLIF(COUNT(a.id), 0) * 100, 1
  )                                                         AS attendance_pct,
  SUM(CASE WHEN a.method = 'face'  THEN 1 ELSE 0 END)     AS face_marked,
  SUM(CASE WHEN a.method = 'voice' THEN 1 ELSE 0 END)     AS voice_marked,
  SUM(CASE WHEN a.method = 'manual' THEN 1 ELSE 0 END)    AS manual_marked
FROM class_sessions cs
JOIN subjects sub     ON sub.id = cs.subject_id
JOIN faculty f        ON f.id   = cs.faculty_id
LEFT JOIN classrooms cl ON cl.id = cs.classroom_id
LEFT JOIN attendance a ON a.session_id = cs.id
WHERE cs.status = 'live'
GROUP BY cs.id, sub.name, sub.code, f.name, cl.name;

-- ─── Performance: index on attendance status ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_status_method ON attendance(status, method);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_at     ON attendance(marked_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status    ON class_sessions(status, session_date DESC);

-- ─── Voice search function using pgvector ─────────────────────────────
-- Returns top-N matching students for voice attendance using HNSW index
CREATE OR REPLACE FUNCTION search_voice_embedding_v2(
  probe          vector(256),
  subject_id_in  UUID,
  min_similarity FLOAT DEFAULT 0.68,
  top_n          INT   DEFAULT 5
)
RETURNS TABLE (
  student_id     UUID,
  name           TEXT,
  roll_number    TEXT,
  similarity     FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name::TEXT,
    s.roll_number::TEXT,
    (1 - (s.voice_embedding <=> probe))::FLOAT AS similarity
  FROM students s
  JOIN student_subjects ss ON ss.student_id = s.id AND ss.subject_id = subject_id_in
  WHERE
    s.voice_enrolled  = true
    AND s.is_active   = true
    AND s.voice_embedding IS NOT NULL
    AND (1 - (s.voice_embedding <=> probe)) >= min_similarity
  ORDER BY similarity DESC
  LIMIT top_n;
END;
$$ LANGUAGE plpgsql;

-- ─── Face search scoped to a subject's enrolled students ──────────────
CREATE OR REPLACE FUNCTION search_face_embedding_v2(
  probe          vector(128),
  subject_id_in  UUID,
  max_distance   FLOAT DEFAULT 0.5,
  top_n          INT   DEFAULT 5
)
RETURNS TABLE (
  student_id   UUID,
  name         TEXT,
  roll_number  TEXT,
  distance     FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name::TEXT,
    s.roll_number::TEXT,
    (s.face_embedding <=> probe)::FLOAT AS distance
  FROM students s
  JOIN student_subjects ss ON ss.student_id = s.id AND ss.subject_id = subject_id_in
  WHERE
    s.face_enrolled = true
    AND s.is_active = true
    AND s.face_embedding IS NOT NULL
    AND (s.face_embedding <=> probe) <= max_distance
  ORDER BY distance
  LIMIT top_n;
END;
$$ LANGUAGE plpgsql;
