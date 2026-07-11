import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function Login() {
  const [role, setRole] = useState('admin') // admin | teacher | student
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await signIn(email, password)
      
      // Verification of role matching
      const { data: profileData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileData) {
        const expectedRole = role === 'student' ? 'student' : role === 'teacher' ? 'staff' : 'admin'
        if (profileData.role !== expectedRole) {
          // Sign out immediately to clear cookies/session
          await supabase.auth.signOut()
          setError(`Access denied. This login portal is restricted to ${role === 'admin' ? 'Admins' : role === 'teacher' ? 'Teachers' : 'Students/Parents'}.`)
          setLoading(false)
          return
        }
      }

      await refreshProfile()
      const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'admin@coachpro.com'
      if (email.trim().toLowerCase() === superadminEmail.toLowerCase()) {
        navigate('/superadmin')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A8A] via-[#1e4db5] to-[#1E3A8A] flex items-center justify-center p-4">
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
            <img src="/logo.png" alt="Batch Desk Logo" className="h-16 mx-auto mb-4 object-contain" />
            <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
            <p className="text-gray-500 text-sm mt-0.5">Sign in to your Batch Desk account</p>
          </div>

          {/* Role Toggle Selector */}
          <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${role === 'admin' ? 'bg-[#1E3A8A] text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setRole('teacher')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${role === 'teacher' ? 'bg-[#1E3A8A] text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Teacher
            </button>
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${role === 'student' ? 'bg-[#1E3A8A] text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Student / Parent
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              required
              autoComplete="email"
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={Lock}
                required
                autoComplete="current-password"
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
              <div className="flex justify-end mt-1.5">
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#1E3A8A] hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
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
              className="mt-2"
            >
              Sign in as {role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Admin'}
              <ArrowRight size={16} />
            </Button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            New to CoachPro?{' '}
            <Link
              to="/register"
              className="text-[#1E3A8A] font-semibold hover:underline"
            >
              Create free account
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-200 text-xs mt-6">
          © {new Date().getFullYear()} CoachPro. All rights reserved.
        </p>
      </div>
    </div>
  )
}
