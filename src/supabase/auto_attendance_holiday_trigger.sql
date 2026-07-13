-- Automatically log class cancellations/holidays in the attendance table as holidays
CREATE OR REPLACE FUNCTION public.handle_class_event_attendance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- If the event is deleted, remove the holiday attendance logs
    IF OLD.event_type IN ('cancelled', 'holiday') THEN
      IF OLD.batch_id IS NOT NULL THEN
        DELETE FROM public.attendance
        WHERE batch_id = OLD.batch_id AND date = OLD.event_date AND status = 'holiday';
      ELSE
        DELETE FROM public.attendance
        WHERE institute_id = OLD.institute_id AND date = OLD.event_date AND status = 'holiday';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- Insert/update on holiday or cancellation
  IF NEW.event_type IN ('cancelled', 'holiday') THEN
    IF NEW.batch_id IS NOT NULL THEN
      -- Mark holiday for all active students in this batch
      INSERT INTO public.attendance (student_id, batch_id, institute_id, date, status)
      SELECT s.id, s.batch_id, s.institute_id, NEW.event_date, 'holiday'
      FROM public.students s
      WHERE s.batch_id = NEW.batch_id AND s.status = 'active'
      ON CONFLICT (student_id, date) 
      DO UPDATE SET status = 'holiday';
    ELSE
      -- Mark holiday for all active students in the institute
      INSERT INTO public.attendance (student_id, batch_id, institute_id, date, status)
      SELECT s.id, s.batch_id, s.institute_id, NEW.event_date, 'holiday'
      FROM public.students s
      WHERE s.institute_id = NEW.institute_id AND s.status = 'active'
      ON CONFLICT (student_id, date) 
      DO UPDATE SET status = 'holiday';
    END IF;
  ELSE
    -- If an event was changed from 'cancelled'/'holiday' to something else, remove the auto-marked holidays
    IF TG_OP = 'UPDATE' AND OLD.event_type IN ('cancelled', 'holiday') THEN
      IF OLD.batch_id IS NOT NULL THEN
        DELETE FROM public.attendance
        WHERE batch_id = OLD.batch_id AND date = OLD.event_date AND status = 'holiday';
      ELSE
        DELETE FROM public.attendance
        WHERE institute_id = OLD.institute_id AND date = OLD.event_date AND status = 'holiday';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_class_event_created ON public.class_events;
CREATE TRIGGER on_class_event_created
  AFTER INSERT OR UPDATE OR DELETE ON public.class_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_class_event_attendance();
