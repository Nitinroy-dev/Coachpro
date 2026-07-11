-- ==========================================================
-- Add Fee Schedule fields to Courses Table
-- Run this in your Supabase SQL Editor
-- (Supabase Dashboard > SQL Editor > New Query > Run)
-- ==========================================================

ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'one_time' CHECK (fee_type IN ('one_time', 'monthly', 'yearly', 'installments')),
ADD COLUMN IF NOT EXISTS installments_count INTEGER DEFAULT 1;

-- Refresh schema cache: Supabase automatically re-caches, but you can force-load it.
