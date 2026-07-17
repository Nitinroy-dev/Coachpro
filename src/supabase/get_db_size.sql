-- ============================================
-- CoachPro - DB Size RPC Helper
-- Run this in Supabase SQL Editor if needed
-- ============================================

CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_database_size(current_database());
END;
$$;
