-- ============================================
-- CoachPro - Complete Database Purge Script
-- Run this in your Supabase SQL Editor
-- WARNING: This will permanently delete all records!
-- ============================================

-- Disable triggers temporarily to avoid foreign key / trigger check failures
SET session_replication_role = 'replica';

-- Truncate all public tables to remove all records
TRUNCATE TABLE public.student_preferences CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.class_events CASCADE;
TRUNCATE TABLE public.class_schedule CASCADE;
TRUNCATE TABLE public.attendance CASCADE;
TRUNCATE TABLE public.fees CASCADE;
TRUNCATE TABLE public.fee_installments CASCADE;
TRUNCATE TABLE public.fee_structures CASCADE;
TRUNCATE TABLE public.students CASCADE;
TRUNCATE TABLE public.batches CASCADE;
TRUNCATE TABLE public.courses CASCADE;
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE public.institutes CASCADE;

-- Delete all users from Supabase Auth schema
DELETE FROM auth.users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';
