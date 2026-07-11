import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Try again.')
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
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src="/logo.png?v=2" alt="Batch Desk Logo" className="h-16 mx-auto mb-4 object-contain" />
            {sent ? (
              <>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} className="text-[#22C55E]" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Check your inbox</h1>
                <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                  We've sent a password reset link to <strong>{email}</strong>.
                  Check your email and follow the instructions.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900">Forgot password?</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
              </>
            )}
          </div>

          {!sent && (
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
                icon={Send}
              >
                Send Reset Link
              </Button>
            </form>
          )}

          <div className="text-center mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-[#1E3A8A] hover:underline font-medium"
            >
              <ArrowLeft size={14} />
              Back to Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
