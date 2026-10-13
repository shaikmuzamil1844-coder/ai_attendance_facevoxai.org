-- ====================================================================
-- RESET ALL DATABASE TABLES AND START AUTO-INCREMENT IDs FROM #1
-- Run this script in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ====================================================================

-- Step 1: Wipe all records from tables
TRUNCATE TABLE public.attendance_logs, public.subject_students, public.subjects, public.students, public.teachers RESTART IDENTITY CASCADE;

-- Step 2: Reset ID sequences explicitly to start next insert at 1
SELECT setval(pg_get_serial_sequence('public.students', 'student_id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.teachers', 'teacher_id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.subjects', 'subject_id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.attendance_logs', 'id'), 1, false);
