-- ==========================================================
-- ADD EMAIL COLUMN TO USERS TABLE
-- Copy and run this script in your Supabase SQL Editor
-- (Supabase Dashboard > SQL Editor > New Query > Run)
-- ==========================================================

-- Add email column to users table if it does not already exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- Refresh schema cache confirmation
SELECT 'Successfully added email column to the users table!' as status;
