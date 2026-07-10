-- Fix missing columns on institutes table
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS gst_number TEXT;
