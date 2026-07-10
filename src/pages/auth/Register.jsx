import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  GraduationCap, Mail, Lock, Eye, EyeOff,
  User, Phone, Building2, CheckCircle2, Users, Check
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { sendWhatsAppMessage } from '../../lib/wati'

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

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp, refreshProfile } = useAuth()

  // Dynamic invite link detection
  const inviteToken = searchParams.get('invite_token')
  const inviteRole = searchParams.get('role')
  const inviteInstId = searchParams.get('institute_id')

  const role = 'admin'
  const [form, setForm] = useState({
    instituteName: '',
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    parentName: '',
    parentPhone: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [verificationRequired, setVerificationRequired] = useState(false)

  // Phone Verification States
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [enteredOtp, setEnteredOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)
  const [isWatiConfigured, setIsWatiConfigured] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    if (resendCountdown > 0) {
      timerRef.current = setTimeout(() => {
        setResendCountdown(prev => prev - 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resendCountdown])

  const handlePhoneChange = (e) => {
    const val = e.target.value
    setForm({ ...form, phone: val })
    setPhoneVerified(false)
    setShowOtpInput(false)
    setGeneratedOtp('')
    setOtpError('')
  }

  const handleSendOtp = async () => {
    const cleanPhone = form.phone.trim()
    if (!/^\d{10}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    setError('')
    setOtpError('')
    setIsSendingOtp(true)

    try {
      // Check for duplicate phone number in public database tables before sending OTP
      const { data: dupUserPhone } = await supabase
        .from('users')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (dupUserPhone) {
        throw new Error('This phone number is already registered in the system.')
      }

      const { data: dupStuPhone } = await supabase
        .from('students')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (dupStuPhone) {
        throw new Error('This phone number is already registered to a student.')
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      setGeneratedOtp(otpCode)

      const watiToken = import.meta.env.VITE_WATI_API_TOKEN
      const watiEndpoint = import.meta.env.VITE_WATI_API_ENDPOINT
      
      let watiConfigured = true
      if (!watiToken || !watiEndpoint || watiToken.includes('your_wati') || watiEndpoint.includes('XXXXX')) {
        watiConfigured = false
      }
      setIsWatiConfigured(watiConfigured)

      if (watiConfigured) {
        const message = `Your CoachPro verification code is: ${otpCode}. Valid for 10 minutes.`
        const result = await sendWhatsAppMessage(cleanPhone, message)
        if (!result.success) {
          throw new Error(result.error || 'Failed to send WhatsApp verification message.')
        }
      } else {
        console.warn('Wati API not configured. Mock OTP generated:', otpCode)
      }

      setShowOtpInput(true)
      setResendCountdown(60)
    } catch (err) {
      setError(err.message || 'Failed to verify phone number. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = () => {
    setOtpError('')
    if (enteredOtp.trim() === generatedOtp || (!isWatiConfigured && enteredOtp.trim() === '123456')) {
      setPhoneVerified(true)
      setShowOtpInput(false)
      setOtpError('')
    } else {
      setOtpError('Invalid verification code. Please try again.')
    }
  }

  // Auto-apply invite token variables if landing from an invite link
  useEffect(() => {
    if (inviteToken && inviteRole && inviteInstId) {
      setRole(inviteRole === 'admin' ? 'admin' : 'teacher')
    }
  }, [inviteToken, inviteRole, inviteInstId])

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const validate = () => {
    if (role === 'admin' && !inviteToken && !form.instituteName.trim()) {
      return 'Institute name is required.'
    }
    if (!form.name.trim()) return 'Your name is required.'
    if (!form.phone.trim()) return 'Phone number is required.'
    if (!phoneVerified) return 'Please verify your phone number.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Enter a valid email.'
    if (form.password.length < 8) return 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setLoading(true)

    try {
      // Clear any existing active session first to avoid session conflicts
      await supabase.auth.signOut()

      // 1. Create auth user with metadata for DB trigger
      const metadata = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: role === 'teacher' ? 'staff' : role, // Database role values are 'admin', 'staff', 'student'
        instituteName: form.instituteName ? form.instituteName.trim() : null,
        parentName: form.parentName ? form.parentName.trim() : null,
        parentPhone: form.parentPhone ? form.parentPhone.trim() : null,
      }
      const authData = await signUp(form.email, form.password, metadata)
      const userId = authData?.user?.id
      if (!userId) {
        throw new Error('Failed to register user. Please try again.')
      }

      // If email verification is enabled, signUp returns no session
      if (!authData.session) {
        setVerificationRequired(true)
        setSuccess(true)
        return
      }

      // NOW we are authenticated - Check for duplicate phone number in public database tables
      const { data: dupUserPhone } = await supabase
        .from('users')
        .select('id')
        .eq('phone', form.phone.trim())
        .maybeSingle()

      if (dupUserPhone) {
        throw new Error('This phone number is already registered in the system. Please use a unique phone number.')
      }

      const { data: dupStuPhone } = await supabase
        .from('students')
        .select('id')
        .eq('phone', form.phone.trim())
        .maybeSingle()

      if (dupStuPhone) {
        throw new Error('This phone number is already registered to a student. Please use a unique phone number.')
      }

      if (role === 'admin') {
        let targetInstId = inviteInstId

        // If not joining via invite link, create a new institute
        if (!targetInstId) {
          targetInstId = generateUUID()
          const { error: instError } = await supabase
            .from('institutes')
            .insert({
              id: targetInstId,
              name: form.instituteName.trim(),
              // Omitted phone from institutes table insert to prevent schema cache missing column error
              subscription_status: 'trial',
              trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              plan: 'starter',
            })

          if (instError) {
            console.error('Institute creation error:', instError)
            throw new Error('Failed to create institute: ' + instError.message)
          }
        }

        // Create admin profile record
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: userId,
            institute_id: targetInstId,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            role: 'admin',
          })

        if (userError) {
          console.error('User profile creation error:', userError)
          throw new Error('Failed to create admin profile: ' + userError.message)
        }

      } else if (role === 'teacher') {
        let targetInstId = inviteInstId

        // If no invite link, fallback to first available institute
        if (!targetInstId) {
          const { data: firstInst } = await supabase
            .from('institutes')
            .select('id')
            .limit(1)
            .maybeSingle()

          if (firstInst) {
            targetInstId = firstInst.id
          } else {
            targetInstId = generateUUID()
            const { error: fInstErr } = await supabase.from('institutes').insert({
              id: targetInstId,
              name: 'Default Coaching Academy',
              subscription_status: 'trial',
              plan: 'starter'
            })
            if (fInstErr) throw new Error('Failed to create default institute: ' + fInstErr.message)
          }
        }

        // Create staff user profile record
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: userId,
            institute_id: targetInstId,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            role: 'staff',
          })

        if (userError) {
          console.error('Staff profile creation error:', userError)
          throw new Error('Failed to create teacher profile: ' + userError.message)
        }

      } else {
        // Sign up as a Student / Parent
        // Check if student's email already exists in students directory
        const { data: existingStudent } = await supabase
          .from('students')
          .select('*')
          .eq('email', form.email.trim())
          .maybeSingle()

        let targetInstId
        if (existingStudent) {
          targetInstId = existingStudent.institute_id
        } else {
          // Query first available institute
          const { data: firstInst } = await supabase
            .from('institutes')
            .select('id')
            .limit(1)
            .maybeSingle()

          if (firstInst) {
            targetInstId = firstInst.id
          } else {
            // Self-healing fallback: Create default institute if none exists
            targetInstId = generateUUID()
            const { error: fInstErr } = await supabase.from('institutes').insert({
              id: targetInstId,
              name: 'Default Coaching Academy',
              subscription_status: 'trial',
              plan: 'starter'
            })
            if (fInstErr) throw new Error('Failed to create default institute: ' + fInstErr.message)
          }

          // Create new record in students table
          const uniqueCode = 'STU' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90)
          const { error: stuErr } = await supabase
            .from('students')
            .insert({
              institute_id: targetInstId,
              name: form.name.trim(),
              phone: form.phone.trim(),
              email: form.email.trim(),
              parent_name: form.parentName?.trim() || null,
              parent_phone: form.parentPhone?.trim() || null,
              student_code: uniqueCode,
              status: 'active'
            })

          if (stuErr) {
            console.error('Student directory record creation failed:', stuErr)
            throw new Error('Failed to link student directory: ' + stuErr.message)
          }
        }

        // Link user profile
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: userId,
            institute_id: targetInstId,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            role: 'student',
          })

        if (userError) {
          console.error('Student profile creation error:', userError)
          throw new Error('Failed to create student profile: ' + userError.message)
        }
      }

      // 5. Load profile into AuthContext
      await refreshProfile()

      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      console.error('Registration error:', err)
      let userFriendlyMsg = err.message
      if (
        err.message?.toLowerCase().includes('already registered') ||
        err.message?.toLowerCase().includes('already exists') ||
        err.message?.toLowerCase().includes('email_exists')
      ) {
        userFriendlyMsg = 'This email address is already registered. Please sign in instead.'
      }
      setError(userFriendlyMsg || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    if (verificationRequired) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#1E3A8A] via-[#1e4db5] to-[#1E3A8A] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Mail size={32} className="text-[#1E3A8A]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verify your email</h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              We've sent a verification link to <strong className="text-gray-900">{form.email}</strong>.
              Please check your inbox (and spam folder) and click the link to activate your account.
            </p>
            <Button
              onClick={() => navigate('/login')}
              fullWidth
              size="lg"
            >
              Back to Login
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1E3A8A] via-[#1e4db5] to-[#1E3A8A] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center animate-pulse">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle2 size={32} className="text-[#22C55E]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account created!</h2>
          <p className="text-gray-500 text-sm">
            Welcome to CoachPro! {role === 'admin' ? 'Your 30-day free trial has started.' : 'Your account is now active.'}
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A8A] via-[#1e4db5] to-[#1E3A8A] flex items-center justify-center p-4 py-10">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#F97316]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <img src="/logo.png" alt="CoachPro Logo" className="h-16 mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 text-sm mt-0.5">Register your coaching institute in seconds</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'admin' && !inviteInstId && (
              <Input
                label="Institute Name *"
                placeholder="e.g. Bright Future Coaching"
                value={form.instituteName}
                onChange={set('instituteName')}
                icon={Building2}
                required
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={role === 'student' ? 'Student Name *' : 'Full Name *'}
                placeholder="Name"
                value={form.name}
                onChange={set('name')}
                icon={User}
                required
              />
              <Input
                label="Phone Number *"
                type="tel"
                placeholder="10-digit number"
                value={form.phone}
                onChange={handlePhoneChange}
                icon={Phone}
                required
                iconRight={
                  phoneVerified ? (
                    <span className="flex items-center text-green-600 font-semibold text-xs pr-1">
                      Verified
                    </span>
                  ) : !showOtpInput ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp || !/^\d{10}$/.test(form.phone.trim())}
                      className="text-xs text-[#1E3A8A] font-bold hover:text-[#1e4db5] disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer transition-all pr-1"
                    >
                      {isSendingOtp ? '...' : 'Verify'}
                    </button>
                  ) : null
                }
              />
            </div>

            {showOtpInput && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-blue-800">Phone Verification OTP</span>
                  {resendCountdown > 0 ? (
                    <span className="text-[10px] text-gray-500">Resend OTP in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-[10px] text-[#1E3A8A] hover:underline font-bold cursor-pointer"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    containerClass="flex-1"
                    maxLength={6}
                    error={otpError}
                  />
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={enteredOtp.length !== 6}
                    className="self-end h-[42px]"
                  >
                    Verify
                  </Button>
                </div>
                
                {!isWatiConfigured && (
                  <p className="text-[10px] text-orange-600 bg-orange-50 border border-orange-100 rounded-lg p-1.5 leading-snug">
                    ℹ️ WhatsApp service is in demo mode. Use code <strong>123456</strong> to verify.
                  </p>
                )}
              </div>
            )}

            {role === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Parent Name (optional)"
                  placeholder="Father/Mother name"
                  value={form.parentName}
                  onChange={set('parentName')}
                  icon={Users}
                />
                <Input
                  label="Parent Phone (optional)"
                  type="tel"
                  placeholder="Parent phone"
                  value={form.parentPhone}
                  onChange={set('parentPhone')}
                  icon={Phone}
                />
              </div>
            )}

            <Input
              label="Email Address *"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              icon={Mail}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Password *"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={form.password}
                onChange={set('password')}
                icon={Lock}
                required
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              <Input
                label="Confirm Password *"
                type="password"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                icon={Lock}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              className="mt-1"
            >
              {role === 'admin' ? 'Create Account — It\'s Free' : role === 'teacher' ? 'Sign Up as Teacher' : 'Sign Up as Student'}
            </Button>

            <p className="text-xs text-center text-gray-400">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-[#1E3A8A] font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
