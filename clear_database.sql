-- ==========================================================
-- COACHPRO DATABASE PURGE SCRIPT
-- Copy and run this script in your Supabase SQL Editor
-- (Supabase Dashboard > SQL Editor > New Query > Run)
-- ==========================================================

-- 1. Disable triggers to prevent foreign key constraint violations
SET session_replication_role = 'replica';

-- 2. Clear all rows from public transactional tables
TRUNCATE TABLE
  payments,
  coupons,
  student_preferences,
  notifications,
  attendance,
  fees,
  fee_installments,
  fee_structures,
  class_events,
  class_schedule,
  students,
  batches,
  courses,
  users,
  institutes
CASCADE;

-- 3. Clear all registered auth accounts
DELETE FROM auth.users CASCADE;

-- 4. Re-enable database triggers
SET session_replication_role = 'origin';

-- 5. Print confirmation
SELECT 'Database successfully cleared! All tables and auth accounts are now empty.' as status;
