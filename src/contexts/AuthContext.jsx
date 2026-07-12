import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Prevent double-fetch during registration (profile row doesn't exist yet)
  const registering = useRef(false)
  // Prevent concurrent fetchProfile calls from racing each other
  const fetchingProfile = useRef(false)

  // PWA Install prompt states
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          if (!registering.current) {
            // Normal login: fetch profile immediately
            await fetchProfile(session.user.id)
          } else {
            // During registration: profile row not yet created — just unblock loading
            setLoading(false)
          }
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBtn(true)
    }

    const handleAppInstalled = () => {
      setShowInstallBtn(false)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handleAutoSendCredentials(profileData) {
    const resendApiKey = profileData.institutes?.settings?.resend_api_key?.trim()
    const resendSender = profileData.institutes?.settings?.resend_sender_email?.trim()
    const tempPassword = profileData.temp_password
    
    if (resendApiKey && resendSender && tempPassword) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: resendApiKey,
            from: resendSender,
            to: profileData.email,
            subject: 'Batch Desk - Staff Login Credentials',
            html: `
              <div style="font-family: sans-serif; padding: 25px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h2 style="color: #1e3a8a; margin: 0;">Batch Desk</h2>
                  <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Coaching Institute Management System</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p>Hello <strong>${profileData.name || 'Team Member'}</strong>,</p>
                <p>Your email has been verified! Here are your permanent login credentials for Batch Desk:</p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px 20px; border-radius: 8px; font-family: monospace; font-size: 14px; margin: 20px 0; line-height: 1.6;">
                  <strong style="color: #475569;">Email:</strong> ${profileData.email}<br/>
                  <strong style="color: #475569;">Password:</strong> ${tempPassword}
                </div>
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${window.location.origin}/login" style="background-color: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Log In to Portal</a>
                </div>
                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">This is a security confirmation containing your login details. Please update your password after logging in for security.</p>
              </div>
            `
          })
        })
      } catch (err) {
        console.error('Failed to send credentials mail upon verification:', err)
      }
    }
    
    // Clear temp password and mark as verified in public.users database
    try {
      await supabase
        .from('users')
        .update({
          temp_password: null,
          is_verified: true
        })
        .eq('id', profileData.id)
    } catch (dbErr) {
      console.error('Failed to clear temp password:', dbErr)
    }
  }

  async function fetchProfile(userId) {
    // Prevent concurrent fetches for the same user
    if (fetchingProfile.current) return
    fetchingProfile.current = true
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, institutes(*)')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setProfile(data)
        localStorage.setItem('batchdesk_last_sync', new Date().toLocaleString('en-IN'))
        if (data.temp_password) {
          await handleAutoSendCredentials(data)
        }
      } else {
        // Self-healing: user exists in auth.users but not in public.users
        console.warn('Profile missing for logged in user. Provisioning default institute and admin profile...')
        const authUser = (await supabase.auth.getUser()).data?.user
        const instituteId = generateUUID()

        // Use upsert to avoid duplicate key on race conditions
        const { error: instErr } = await supabase
          .from('institutes')
          .upsert({
            id: instituteId,
            name: 'My Coaching Institute',
            subscription_status: 'trial',
            plan: 'starter',
          }, { onConflict: 'id' })
        if (instErr) throw instErr

        const { error: userErr } = await supabase
          .from('users')
          .upsert({
            id: userId,
            institute_id: instituteId,
            name: authUser?.email ? authUser.email.split('@')[0] : 'Admin',
            email: authUser?.email || null,
            role: 'admin',
          }, { onConflict: 'id' })
        if (userErr) throw userErr

        // Refetch created profile
        const { data: newProfile } = await supabase
          .from('users')
          .select('*, institutes(*)')
          .eq('id', userId)
          .maybeSingle()
        if (newProfile) setProfile(newProfile)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      fetchingProfile.current = false
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  async function signUp(email, password, metadata = {}) {
    // Mark as registering so onAuthStateChange doesn't try to fetch non-existent profile
    registering.current = true
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    if (error) {
      registering.current = false
      throw error
    }
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  async function refreshProfile() {
    registering.current = false
    // Get the current user directly from Supabase (reliable even during state transitions)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      await fetchProfile(currentUser.id)
    } else {
      setLoading(false)
    }
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBtn(false)
      setInstallPrompt(null)
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
    showInstallBtn,
    handleInstall,
    institute: profile?.institutes,
    isAdmin: profile?.role === 'admin',
    isStaff: profile?.role === 'staff',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
