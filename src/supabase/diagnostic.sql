-- Run this in your Supabase SQL Editor to diagnose the issue

-- 1. Check all users in the users table
SELECT u.id, u.name, u.role, u.institute_id, u.created_at,
       i.name as institute_name
FROM users u
LEFT JOIN institutes i ON i.id = u.institute_id;

-- 2. Check all institutes
SELECT id, name, subscription_status, created_at FROM institutes;

-- 3. Check auth.users (actual Supabase auth records)
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at DESC;
