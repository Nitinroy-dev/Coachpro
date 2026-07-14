-- Fix class_events schema by adding missing start_time and end_time columns
ALTER TABLE public.class_events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.class_events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.class_events ADD COLUMN IF NOT EXISTS notes TEXT;
