-- ============================================
-- CoachPro - Lifetime Trial History Table
-- Run this in Supabase SQL Editor if needed
-- ============================================

CREATE TABLE IF NOT EXISTS public.trial_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trial_history ENABLE ROW LEVEL SECURITY;

-- Enable public read/write so anyone can check and register trials during signup
DROP POLICY IF EXISTS "Allow anonymous read/write" ON public.trial_history;
CREATE POLICY "Allow anonymous read/write" ON public.trial_history FOR ALL USING (true) WITH CHECK (true);
