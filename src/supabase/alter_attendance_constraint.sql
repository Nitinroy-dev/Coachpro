-- Drop the old status check constraint
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Add updated constraint including 'cancelled'
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('present','absent','late','holiday','cancelled'));
