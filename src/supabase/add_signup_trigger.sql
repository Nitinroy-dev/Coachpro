-- ==========================================================
-- CoachPro - Email Verification Signup Trigger (Delayed Profile Provisioning)
-- Run this in your Supabase SQL Editor
-- (Supabase Dashboard > SQL Editor > New Query > Run)
-- ==========================================================

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_name text;
  v_phone text;
  v_institute_id uuid;
  v_institute_name text;
  v_parent_name text;
  v_parent_phone text;
  v_student_code text;
BEGIN
  -- Only execute if the email is confirmed (either on insert or on subsequent confirmation update)
  IF new.email_confirmed_at IS NULL THEN
    RETURN new;
  END IF;

  -- Ensure we do not create duplicate profiles if the trigger runs multiple times
  IF EXISTS (SELECT 1 FROM public.users WHERE id = new.id) THEN
    RETURN new;
  END IF;

  -- Extract metadata fields from the signup options
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_phone := new.raw_user_meta_data->>'phone';
  v_institute_name := new.raw_user_meta_data->>'instituteName';
  v_parent_name := new.raw_user_meta_data->>'parentName';
  v_parent_phone := new.raw_user_meta_data->>'parentPhone';

  -- Handle institute provisioning
  IF v_role = 'admin' THEN
    -- Admin creates a new institute
    v_institute_id := gen_random_uuid();
    INSERT INTO public.institutes (id, name, subscription_status, trial_ends_at, plan)
    VALUES (
      v_institute_id,
      coalesce(v_institute_name, 'My Coaching Institute'),
      'trial',
      now() + interval '30 days',
      'starter'
    );
  ELSE
    -- Staff/Student links to the first available institute, or default if none exists
    SELECT id INTO v_institute_id FROM public.institutes LIMIT 1;
    IF v_institute_id IS NULL THEN
      v_institute_id := gen_random_uuid();
      INSERT INTO public.institutes (id, name, subscription_status, plan)
      VALUES (v_institute_id, 'Default Coaching Academy', 'trial', 'starter');
    END IF;
  END IF;

  -- Create public.users profile row
  INSERT INTO public.users (id, institute_id, name, email, phone, role)
  VALUES (new.id, v_institute_id, v_name, new.email, v_phone, v_role);

  -- For student role, create student directory record
  IF v_role = 'student' THEN
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE email = new.email) THEN
      v_student_code := 'STU' || substring(extract(epoch from now())::text from 5 for 6) || floor(10 + random() * 90)::text;
      INSERT INTO public.students (institute_id, name, phone, email, parent_name, parent_phone, student_code, status)
      VALUES (
        v_institute_id,
        v_name,
        v_phone,
        new.email,
        v_parent_name,
        v_parent_phone,
        v_student_code,
        'active'
      );
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the function to the trigger for both INSERT and UPDATE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
