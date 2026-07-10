import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured = supabaseUrl && supabaseUrl.startsWith('http') && supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key'

if (!isConfigured) {
  console.warn('⚠️  CoachPro: Supabase is not configured yet.\n  Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local')
}

// Use a valid placeholder URL so createClient doesn't throw.
// API calls will fail gracefully until real credentials are provided.
export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDE0NDMsImV4cCI6MjA5ODExNzQ0M30.placeholder-key-not-real',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

export { isConfigured as isSupabaseConfigured }
