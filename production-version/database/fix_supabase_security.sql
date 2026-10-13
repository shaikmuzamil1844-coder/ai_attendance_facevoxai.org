-- ====================================================================
-- SUPABASE SECURITY HARDENING & RLS ENABLEMENT SCRIPT
-- Project: zubabixuonxlflbvqulk
-- Target Tables: teachers, students, subjects, subject_students, attendance_logs
-- ====================================================================

-- Step 1: Enable Row Level Security (RLS) on all public tables
-- This immediately satisfies Supabase's `rls_disabled_in_public` & `sensitive_columns_exposed` checks
-- and blocks all unauthenticated anonymous API access via PostgREST.

ALTER TABLE IF EXISTS public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subject_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Step 2: (Optional / Defensive) Explicitly drop any legacy insecure policies if present
DROP POLICY IF EXISTS "Public Anon Access Teachers" ON public.teachers;
DROP POLICY IF EXISTS "Public Anon Access Students" ON public.students;
DROP POLICY IF EXISTS "Public Anon Access Subjects" ON public.subjects;
DROP POLICY IF EXISTS "Public Anon Access Subject Students" ON public.subject_students;
DROP POLICY IF EXISTS "Public Anon Access Attendance Logs" ON public.attendance_logs;

-- NOTE FOR STREAMLIT APP USAGE:
-- 1. Run this SQL in your Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- 2. In your Streamlit app `.streamlit/secrets.toml`, replace `SUPABASE_KEY` with your project's `service_role` secret key.
--    The `service_role` key allows your Python backend to bypass RLS securely on the server side,
--    while completely blocking unauthorized public REST API access from external users on the internet.
