-- =============================================================================
-- FaceVoxAI Production — 006 Additional Indexes & System Health Views
-- Optimizes query performance, adds health monitoring views
-- =============================================================================

-- ─── Biometric enrollment stats view ──────────────────────────────────
CREATE OR REPLACE VIEW v_biometric_enrollment_stats AS
SELECT
  d.id   AS department_id,
  d.name AS department_name,
  COUNT(DISTINCT s.id)                                            AS total_students,
  COUNT(DISTINCT s.id) FILTER (WHERE s.face_enrolled = true)     AS face_enrolled_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.voice_enrolled = true)    AS voice_enrolled_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.face_enrolled = true AND s.voice_enrolled = true) AS dual_enrolled_count,
  ROUND(
    COUNT(DISTINCT s.id) FILTER (WHERE s.face_enrolled = true)::NUMERIC
    / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1
  ) AS face_enrollment_pct,
  ROUND(
    COUNT(DISTINCT s.id) FILTER (WHERE s.voice_enrolled = true)::NUMERIC
    / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1
  ) AS voice_enrollment_pct
FROM departments d
LEFT JOIN students s ON s.department_id = d.id AND s.is_active = true
GROUP BY d.id, d.name
ORDER BY d.name;

-- ─── Weekly attendance trend view ─────────────────────────────────────
CREATE OR REPLACE VIEW v_weekly_attendance_trend AS
SELECT
  date_trunc('week', cs.session_date)::DATE           AS week_start,
  COUNT(DISTINCT cs.id)                               AS total_sessions,
  COUNT(a.id)                                         AS total_records,
  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
  ROUND(
    SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END)
    / NULLIF(COUNT(a.id), 0) * 100, 1
  )                                                   AS avg_attendance_pct,
  SUM(CASE WHEN a.method = 'face'    THEN 1 ELSE 0 END) AS face_marked,
  SUM(CASE WHEN a.method = 'voice'   THEN 1 ELSE 0 END) AS voice_marked,
  SUM(CASE WHEN a.method = 'manual'  THEN 1 ELSE 0 END) AS manual_marked
FROM class_sessions cs
LEFT JOIN attendance a ON a.session_id = cs.id
WHERE cs.session_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY date_trunc('week', cs.session_date)
ORDER BY week_start DESC;

-- ─── At-risk student view (below 75% attendance) ─────────────────────
CREATE OR REPLACE VIEW v_at_risk_students AS
SELECT
  s.id            AS student_id,
  s.name          AS student_name,
  s.roll_number,
  s.email,
  d.name          AS department_name,
  sub.id          AS subject_id,
  sub.name        AS subject_name,
  sub.code        AS subject_code,
  COUNT(a.id)     AS total_classes,
  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS attended,
  ROUND(
    SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END)
    / NULLIF(COUNT(a.id), 0) * 100, 1
  ) AS attendance_pct,
  GREATEST(0, CEIL(
    (0.75 * COUNT(a.id) - SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END))
    / (1 - 0.75)
  ))::INT AS classes_to_recover
FROM student_subjects ss
JOIN students  s   ON s.id   = ss.student_id   AND s.is_active = true
JOIN subjects  sub ON sub.id = ss.subject_id
JOIN departments d ON d.id   = s.department_id
JOIN attendance a  ON a.student_id = s.id AND a.subject_id = sub.id
GROUP BY s.id, s.name, s.roll_number, s.email, d.name, sub.id, sub.name, sub.code
HAVING ROUND(
  SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END)
  / NULLIF(COUNT(a.id), 0) * 100, 1
) < 75
ORDER BY attendance_pct ASC;
