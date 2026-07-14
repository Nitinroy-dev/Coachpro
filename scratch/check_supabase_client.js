import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lkgszgodtnfboprjfvak.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZ3N6Z29kdG5mYm9wcmpmdmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDE0NDMsImV4cCI6MjA5ODExNzQ0M30.fVG9Fo2x7IyjdUEbbNbVmj9ip-6Ebdc4JZjyQJ6hXuk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  console.log('=== Checking superadmin user via Supabase Client ===')
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@coachpro.com')
      .maybeSingle()

    if (error) {
      console.error('Error fetching:', error.message)
    } else if (data) {
      console.log('🎉 Superadmin exists in public.users table:')
      console.log(data)
    } else {
      console.log('❌ Superadmin not found in public.users table.')
    }
  } catch (err) {
    console.error('Crash:', err.message)
  }
}

main()
