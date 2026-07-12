-- ==============================================================
-- Add Parent Verification & Role Support Migration
-- Run this in your Supabase SQL Editor:
-- (Supabase Dashboard > SQL Editor > New Query > Run)
-- ==============================================================

-- 1. Add parent_email and verification tracking columns to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_email_verified BOOLEAN DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_email_verified BOOLEAN DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- 2. Update users role constraint to allow 'parent' role
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','staff','student','parent'));

-- 3. Add linked_student_id to users table so parent accounts link to their child
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linked_student_id UUID;
