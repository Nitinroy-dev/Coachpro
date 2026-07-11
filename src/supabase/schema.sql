-- ============================================
-- CoachPro - Full Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- TABLES
-- ============================================

-- Institutes
CREATE TABLE IF NOT EXISTS institutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  gst_number TEXT,
  academic_year TEXT,
  subscription_status TEXT DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','expired','suspended')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_ends_at TIMESTAMPTZ,
  plan TEXT DEFAULT 'starter'
    CHECK (plan IN ('starter','growth','pro','enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('admin','staff','student')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration TEXT,
  total_fee NUMERIC,
  fee_type TEXT DEFAULT 'one_time' CHECK (fee_type IN ('one_time','monthly','yearly','installments')),
  installments_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batches
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  timing TEXT,
  start_date DATE,
  end_date DATE,
  capacity INTEGER,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  email TEXT,
  dob DATE,
  address TEXT,
  photo_url TEXT,
  student_code TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  enrolled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Structures
CREATE TABLE IF NOT EXISTS fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  frequency TEXT CHECK (frequency IN (
    'full','monthly','quarterly','halfyearly','yearly','custom'
  )),
  installment_count INTEGER,
  installment_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Installments
CREATE TABLE IF NOT EXISTS fee_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE SET NULL,
  installment_number INTEGER,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','paid','overdue','partial','waived'
  )),
  paid_amount NUMERIC DEFAULT 0,
  paid_date DATE,
  receipt_number TEXT,
  payment_mode TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fees (individual payments)
CREATE TABLE IF NOT EXISTS fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES fee_installments(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  paid_date DATE,
  due_date DATE,
  mode TEXT CHECK (mode IN ('cash','upi','bank_transfer','cheque','razorpay')),
  receipt_number TEXT UNIQUE,
  razorpay_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present','absent','late','holiday')),
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- Class Schedule (weekly timetable)
CREATE TABLE IF NOT EXISTS class_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class Events
CREATE TABLE IF NOT EXISTS class_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN (
    'cancelled','extra','rescheduled','holiday','exam','announcement'
  )),
  event_date DATE NOT NULL,
  original_time TEXT,
  new_time TEXT,
  new_date DATE,
  subject TEXT,
  syllabus TEXT,
  total_marks INTEGER,
  reason TEXT,
  description TEXT,
  notify_students BOOLEAN DEFAULT true,
  notification_sent BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN (
    'fee_due','fee_paid','absent','extra_class',
    'class_cancelled','exam','holiday','announcement','rescheduled'
  )),
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student preferences
CREATE TABLE IF NOT EXISTS student_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  whatsapp_alerts BOOLEAN DEFAULT true,
  class_cancelled_alert BOOLEAN DEFAULT true,
  extra_class_alert BOOLEAN DEFAULT true,
  exam_alert BOOLEAN DEFAULT true,
  fee_alert BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: get current user's institute_id
-- ============================================
CREATE OR REPLACE FUNCTION get_my_institute_id()
RETURNS UUID AS $$
  SELECT institute_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- RLS POLICIES
-- ============================================

CREATE POLICY "institutes_all" ON institutes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "users_all" ON users FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "courses_all" ON courses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "batches_all" ON batches FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "students_all" ON students FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fee_structures_all" ON fee_structures FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fee_installments_all" ON fee_installments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fees_all" ON fees FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "attendance_all" ON attendance FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "class_schedule_all" ON class_schedule FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "class_events_all" ON class_events FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "student_preferences_all" ON student_preferences FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_institute ON users(institute_id);
CREATE INDEX IF NOT EXISTS idx_students_institute ON students(institute_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_institute ON batches(institute_id);
CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_institute ON fees(institute_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_batch ON attendance(batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_notifications_institute ON notifications(institute_id);
