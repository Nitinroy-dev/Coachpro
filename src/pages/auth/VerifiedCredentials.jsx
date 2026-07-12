import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { CheckCircle2, Lock, Mail, Clipboard, ArrowRight, Loader } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import Button from '../../components/ui/Button'

export default function VerifiedCredentials() {
  const [loading, setLoading] = useState(true)
  const [credentials, setCredentials] = useState(null)
  const [alreadyProcessed, setAlreadyProcessed] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    let active = true

    async function processVerification() {
      // Allow 500ms for Supabase client to parse URL hash tokens and settle the new session
      await new Promise(resolve => setTimeout(resolve, 500))

      // First, check if we already have it in localStorage to prevent React StrictMode dual-mount wipes
      const cachedEmail = localStorage.getItem('temp_view_email')
      const cachedPass = localStorage.getItem('temp_view_pass')
      const cachedName = localStorage.getItem('temp_view_name')
      
      if (cachedEmail && cachedPass) {
        if (active) {
          setCredentials({
            name: cachedName || 'Team Member',
            email: cachedEmail,
            password: cachedPass
          })
          setLoading(false)
        }
        return
      }

      // Get current logged-in user session established by the redirect
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (active) {
          setLoading(false)
        }
        return
      }

      try {
        // Fetch profile
        const { data: profile, error: fetchErr } = await supabase
          .from('users')
          .select('*, institutes(*)')
          .eq('id', user.id)
          .maybeSingle()

        if (fetchErr) throw fetchErr

        if (profile) {
          if (profile.temp_password) {
            // Save in localStorage for persistence during this display cycle
            localStorage.setItem('temp_view_email', profile.email)
            localStorage.setItem('temp_view_pass', profile.temp_password)
            localStorage.setItem('temp_view_name', profile.name || '')

            if (active) {
              setCredentials({
                name: profile.name,
                email: profile.email,
                password: profile.temp_password
              })
            }

            // Send email confirmation in background if SMTP is configured
            const resendApiKey = profile.institutes?.settings?.resend_api_key?.trim()
            const resendSender = profile.institutes?.settings?.resend_sender_email?.trim()

            if (resendApiKey && resendSender) {
              try {
                await fetch('/api/send-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    apiKey: resendApiKey,
                    from: resendSender,
                    to: profile.email,
                    subject: 'Batch Desk - Account Verified successfully',
                    html: `
                      <div style="font-family: sans-serif; padding: 25px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
                        <div style="text-align: center; margin-bottom: 20px;">
                          <h2 style="color: #1e3a8a; margin: 0;">Batch Desk</h2>
                          <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Coaching Institute Management System</p>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                        <p>Hello <strong>${profile.name || 'Team Member'}</strong>,</p>
                        <p>Your email verification is successful! Here are your temporary login details. Please keep them safe:</p>
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px 20px; border-radius: 8px; font-family: monospace; font-size: 14px; margin: 20px 0; line-height: 1.6;">
                          <strong style="color: #475569;">Email:</strong> ${profile.email}<br/>
                          <strong style="color: #475569;">Password:</strong> ${profile.temp_password}
                        </div>
                        <p>Please update your password after logging in to secure your account.</p>
                      </div>
                    `
                  })
                })
              } catch (mailErr) {
                console.error('Failed to send credentials mail on verified redirect:', mailErr)
              }
            }

            // Immediately clear temp_password from database for security
            await supabase
              .from('users')
              .update({
                temp_password: null,
                is_verified: true
              })
              .eq('id', user.id)

          } else {
            // Already verified and password cleared
            if (active) {
              setAlreadyProcessed(true)
            }
          }
        }
      } catch (err) {
        console.error('Verification error:', err)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    processVerification()

    return () => {
      active = false
    }
  }, [])

  const handleCopy = () => {
    if (!credentials) return
    navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`)
    toast.success('Credentials copied to clipboard.')
  }

  const handleProceed = async () => {
    // Clear localStorage values
    localStorage.removeItem('temp_view_email')
    localStorage.removeItem('temp_view_pass')
    localStorage.removeItem('temp_view_name')

    // Clear user session so they have to type their credentials to log in
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader className="animate-spin text-[#1E3A8A] mb-4" size={40} />
        <p className="text-gray-600 font-bold text-sm">Processing verification link...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A8A] via-[#1e4db5] to-[#1E3A8A] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#F97316]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
        {/* Logo */}
        <img src="/logo.png?v=2" alt="Batch Desk Logo" className="h-14 mx-auto mb-6 object-contain" />

        {alreadyProcessed ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Account Already Verified</h1>
            <p className="text-gray-500 text-xs leading-relaxed px-2">
              Your email address is already verified. If you need assistance with your credentials or password, please contact your coaching institute administrator.
            </p>
            <Button onClick={() => navigate('/login')} fullWidth className="mt-4">
              Go to Login Page
            </Button>
          </div>
        ) : credentials ? (
          <div className="space-y-5">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-green-100 animate-pulse">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-900">Email Verified Successfully!</h1>
              <p className="text-xs text-green-700 font-semibold bg-green-50 px-3 py-1.5 rounded-xl border border-green-100 inline-block">
                Welcome to the team, ${credentials.name || 'Staff'}!
              </p>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-left space-y-2">
              <h4 className="font-bold text-orange-950 text-xs flex items-center gap-1.5">
                ⚠️ IMPORTANT INFORMATION:
              </h4>
              <p className="text-[10px] text-orange-900 leading-normal">
                These credentials will **not be displayed again** for security reasons. Please copy them now and keep them in a safe place.
              </p>
            </div>

            {/* Display Credentials */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3 text-left text-xs font-mono">
              <div className="flex flex-col gap-1 border-b border-gray-200 pb-2">
                <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><Mail size={12} /> Login Email</span>
                <span className="text-blue-900 font-bold select-all text-sm">{credentials.email}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><Lock size={12} /> Temp Password</span>
                <span className="text-orange-600 font-bold select-all text-sm">{credentials.password}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <Button onClick={handleCopy} variant="outline" fullWidth icon={Clipboard}>
                Copy Credentials to Clipboard
              </Button>
              <Button onClick={handleProceed} fullWidth icon={ArrowRight}>
                Proceed to Log In
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-gray-900">Invalid Session</h1>
            <p className="text-gray-500 text-xs px-4">
              We couldn't verify your account session. Please verify if you clicked the link correctly, or log in if you already have your credentials.
            </p>
            <Button onClick={() => navigate('/login')} fullWidth className="mt-4">
              Go to Login Page
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
