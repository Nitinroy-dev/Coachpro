-- ============================================
-- CoachPro - Robust RLS Policies Update
-- Run this in Supabase SQL Editor if needed
-- ============================================

-- Drop restrictive policies
DROP POLICY IF EXISTS "courses_all" ON courses;
DROP POLICY IF EXISTS "batches_all" ON batches;
DROP POLICY IF EXISTS "students_all" ON students;
DROP POLICY IF EXISTS "fee_structures_all" ON fee_structures;
DROP POLICY IF EXISTS "fee_installments_all" ON fee_installments;
DROP POLICY IF EXISTS "fees_all" ON fees;
DROP POLICY IF EXISTS "attendance_all" ON attendance;
DROP POLICY IF EXISTS "class_schedule_all" ON class_schedule;
DROP POLICY IF EXISTS "class_events_all" ON class_events;
DROP POLICY IF EXISTS "notifications_all" ON notifications;
DROP POLICY IF EXISTS "student_preferences_all" ON student_preferences;
DROP POLICY IF EXISTS "institutes_select" ON institutes;
DROP POLICY IF EXISTS "institutes_insert" ON institutes;
DROP POLICY IF EXISTS "institutes_update" ON institutes;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

-- Create clean policies for authenticated users
CREATE POLICY "institutes_authenticated" ON institutes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "users_authenticated" ON users FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "courses_authenticated" ON courses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "batches_authenticated" ON batches FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "students_authenticated" ON students FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fee_structures_authenticated" ON fee_structures FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fee_installments_authenticated" ON fee_installments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fees_authenticated" ON fees FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "attendance_authenticated" ON attendance FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "class_schedule_authenticated" ON class_schedule FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "class_events_authenticated" ON class_events FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notifications_authenticated" ON notifications FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "student_preferences_authenticated" ON student_preferences FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
