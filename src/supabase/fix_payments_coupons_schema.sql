-- Complete CoachPro migration: payments, coupons + institutes column additions
-- Run this in: Supabase Dashboard > SQL Editor > New Query

-- ========================================
-- STEP 1: Add missing columns to institutes
-- ========================================
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Set trial_ends_at for existing institutes
UPDATE institutes 
SET trial_ends_at = created_at + INTERVAL '30 days' 
WHERE trial_ends_at IS NULL;

-- ========================================
-- STEP 2: Create payments table
-- ========================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly','annual')),
  amount NUMERIC NOT NULL,
  gst_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  method TEXT CHECK (method IN ('razorpay','upi_manual','bank_transfer')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','success','failed','refunded')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  utr_number TEXT,
  screenshot_url TEXT,
  invoice_number TEXT UNIQUE,
  coupon_code TEXT,
  discount_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id)
);

-- ========================================
-- STEP 3: Create coupons table
-- ========================================
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  applicable_plans TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- STEP 4: Enable RLS
-- ========================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: Create RLS policies (drop first if they exist)
-- ========================================
DROP POLICY IF EXISTS "Users can view own institute payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own institute payments" ON payments;
DROP POLICY IF EXISTS "Superadmin full access payments" ON payments;
DROP POLICY IF EXISTS "Everyone can read coupons" ON coupons;
DROP POLICY IF EXISTS "Superadmin full access coupons" ON coupons;

CREATE POLICY "Users can view own institute payments" ON payments
  FOR SELECT USING (
    institute_id IN (SELECT institute_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own institute payments" ON payments
  FOR INSERT WITH CHECK (
    institute_id IN (SELECT institute_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Superadmin full access payments" ON payments
  FOR ALL USING (true);

CREATE POLICY "Everyone can read coupons" ON coupons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Superadmin full access coupons" ON coupons
  FOR ALL USING (true);

-- ========================================
-- STEP 6: Seed sample coupon
-- ========================================
INSERT INTO coupons (code, discount_type, discount_value, max_uses, is_active)
VALUES ('WELCOME20', 'percentage', 20, 100, true)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- VERIFY
-- ========================================
SELECT 'payments table' as table_name, count(*) as rows FROM payments
UNION ALL
SELECT 'coupons table', count(*) FROM coupons
UNION ALL
SELECT 'institutes with plan column', count(*) FROM institutes WHERE plan IS NOT NULL;
