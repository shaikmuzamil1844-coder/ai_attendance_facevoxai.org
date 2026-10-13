-- ====================================================================
-- SUPABASE RLS POLICIES FOR PUBLIC / ANON API ACCESS
-- Run this in Supabase Dashboard -> SQL Editor if you use the `anon` API key.
-- ====================================================================

-- 1. Policies for `teachers` table
CREATE POLICY "Allow public access to teachers" ON public.teachers
FOR ALL USING (true) WITH CHECK (true);

-- 2. Policies for `students` table
CREATE POLICY "Allow public access to students" ON public.students
FOR ALL USING (true) WITH CHECK (true);

-- 3. Policies for `subjects` table
CREATE POLICY "Allow public access to subjects" ON public.subjects
FOR ALL USING (true) WITH CHECK (true);

-- 4. Policies for `subject_students` table
CREATE POLICY "Allow public access to subject_students" ON public.subject_students
FOR ALL USING (true) WITH CHECK (true);

-- 5. Policies for `attendance_logs` table
CREATE POLICY "Allow public access to attendance_logs" ON public.attendance_logs
FOR ALL USING (true) WITH CHECK (true);
