-- Enable Realtime for CoachPro core tables
-- Run this script in your Supabase SQL Editor to enable instant dashboard & list updates without reloading the page.

alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.batches;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.class_schedule;
alter publication supabase_realtime add table public.payments;
