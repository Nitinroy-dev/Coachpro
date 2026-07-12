-- ==============================================================
-- Add is_verified Column and Sync Verification Status Trigger
-- Run this in your Supabase SQL Editor:
-- (Supabase Dashboard > SQL Editor > New Query > Run)
-- ==============================================================

-- 1. Add is_verified, temp_password, and email columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temp_password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Enable Realtime for the users table (commented out as it might already be enabled)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- 3. Modify the signup trigger function to dynamically sync verification status
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
    ) ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Staff/Student links to the first available institute, or default if none exists
    SELECT id INTO v_institute_id FROM public.institutes LIMIT 1;
    IF v_institute_id IS NULL THEN
      v_institute_id := gen_random_uuid();
      INSERT INTO public.institutes (id, name, subscription_status, plan)
      VALUES (v_institute_id, 'Default Coaching Academy', 'trial', 'starter') ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- Upsert public.users profile row to support verification updates
  INSERT INTO public.users (id, institute_id, name, email, phone, role, is_verified)
  VALUES (
    new.id, 
    v_institute_id, 
    v_name, 
    new.email, 
    v_phone, 
    v_role,
    (new.email_confirmed_at IS NOT NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    is_verified = (new.email_confirmed_at IS NOT NULL),
    name = EXCLUDED.name,
    phone = EXCLUDED.phone;

  -- For student role, create student directory record if confirmed
  IF v_role = 'student' AND new.email_confirmed_at IS NOT NULL THEN
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

-- 4. Sync existing users verification status and email addresses
UPDATE public.users u
SET 
  is_verified = (a.email_confirmed_at IS NOT NULL),
  email = a.email
FROM auth.users a
WHERE u.id = a.id;
