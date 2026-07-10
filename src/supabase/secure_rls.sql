-- ==============================================================
-- CoachPro - Watertight Multi-Tenant Isolation & RLS Schema
-- ==============================================================

-- 1. Enable Row Level Security on all critical tables
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing wide-open policies
DROP POLICY IF EXISTS "institutes_authenticated" ON institutes;
DROP POLICY IF EXISTS "users_authenticated" ON users;
DROP POLICY IF EXISTS "courses_authenticated" ON courses;
DROP POLICY IF EXISTS "batches_authenticated" ON batches;
DROP POLICY IF EXISTS "students_authenticated" ON students;
DROP POLICY IF EXISTS "fee_structures_authenticated" ON fee_structures;
DROP POLICY IF EXISTS "fee_installments_authenticated" ON fee_installments;
DROP POLICY IF EXISTS "fees_authenticated" ON fees;
DROP POLICY IF EXISTS "attendance_authenticated" ON attendance;
DROP POLICY IF EXISTS "class_schedule_authenticated" ON class_schedule;
DROP POLICY IF EXISTS "class_events_authenticated" ON class_events;
DROP POLICY IF EXISTS "notifications_authenticated" ON notifications;
DROP POLICY IF EXISTS "student_preferences_authenticated" ON student_preferences;
DROP POLICY IF EXISTS "payments_authenticated" ON payments;

-- 3. Create helper function to securely retrieve current user's institute_id from JWT/session cache
CREATE OR REPLACE FUNCTION public.get_auth_institute_id()
RETURNS UUID AS $$
  SELECT institute_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Secure Institutes policies
-- Users can only view or edit their own institute
CREATE POLICY "institutes_isolation" ON public.institutes
  FOR ALL
  USING (id = public.get_auth_institute_id())
  WITH CHECK (id = public.get_auth_institute_id());

-- 5. Secure Users profile policies
-- Users can only view/edit accounts within their own institute, and superadmin bypasses
CREATE POLICY "users_isolation" ON public.users
  FOR ALL
  USING (
    institute_id = public.get_auth_institute_id() 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@coachpro.com'
  )
  WITH CHECK (
    institute_id = public.get_auth_institute_id()
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@coachpro.com'
  );

-- 6. Secure Courses policies
CREATE POLICY "courses_isolation" ON public.courses
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 7. Secure Batches policies
CREATE POLICY "batches_isolation" ON public.batches
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 8. Secure Students policies
CREATE POLICY "students_isolation" ON public.students
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 9. Secure Fee Structures policies
CREATE POLICY "fee_structures_isolation" ON public.fee_structures
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 10. Secure Fee Installments policies
CREATE POLICY "fee_installments_isolation" ON public.fee_installments
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 11. Secure Fees policies
CREATE POLICY "fees_isolation" ON public.fees
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 12. Secure Attendance policies
CREATE POLICY "attendance_isolation" ON public.attendance
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 13. Secure Class Schedule policies
CREATE POLICY "class_schedule_isolation" ON public.class_schedule
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 14. Secure Class Events policies
CREATE POLICY "class_events_isolation" ON public.class_events
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 15. Secure Notifications policies
CREATE POLICY "notifications_isolation" ON public.notifications
  FOR ALL
  USING (institute_id = public.get_auth_institute_id())
  WITH CHECK (institute_id = public.get_auth_institute_id());

-- 16. Secure Payments transactions policies
-- Institutes can only view their own payment histories. Superadmin can view all.
CREATE POLICY "payments_isolation" ON public.payments
  FOR ALL
  USING (
    institute_id = public.get_auth_institute_id()
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@coachpro.com'
  )
  WITH CHECK (
    institute_id = public.get_auth_institute_id()
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@coachpro.com'
  );
