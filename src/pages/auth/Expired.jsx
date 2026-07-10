import { useAuth } from '../../contexts/AuthContext'
import { AlertTriangle, Lock, CheckCircle2, MessageSquare, PhoneCall, LogOut, ShieldOff } from 'lucide-react'
import Button from '../../components/ui/Button'

export default function Expired() {
  const { institute, signOut } = useAuth()
  const supportPhone = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER || '919876543210'

  const instituteName = institute?.name || 'My Institute'
  const isSuspended = institute?.subscription_status === 'suspended'

  const lastActive = institute?.subscription_ends_at || institute?.trial_ends_at || new Date().toISOString()
  const formattedLastActive = new Date(lastActive).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  const whatsappMessage = isSuspended
    ? encodeURIComponent(`Hi, my CoachPro account for ${instituteName} has been suspended. I'd like to understand why and resolve the issue.`)
    : encodeURIComponent(`Hi, I want to renew my CoachPro subscription for ${instituteName}`)
  const whatsappUrl = `https://wa.me/${supportPhone}?text=${whatsappMessage}`

  const features = [
    'Complete Student & Admission Management',
    'Automated Fee Collection & PDF Receipts',
    'Attendance Tracking & WhatsApp Notifications',
    'Class Timetable & Exam Announcements',
    'Detailed Financial & Growth Analytics',
  ]

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-red-100 p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <ShieldOff size={32} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
            Account Suspended
          </h1>

          <p className="text-gray-500 text-sm mb-6">
            Access for <strong className="text-gray-800">{instituteName}</strong> has been suspended by the CoachPro platform administrator. Please contact support to understand and resolve this issue.
          </p>

          <div className="bg-red-50 rounded-2xl p-5 mb-8 text-left border border-red-100">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">What this means:</p>
            <ul className="space-y-2 text-sm text-red-800">
              <li>• Your data is safely preserved and has not been deleted</li>
              <li>• Access has been restricted by the platform team</li>
              <li>• Contact support to resolve compliance or billing issues</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mb-6">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="accent" size="lg" fullWidth icon={MessageSquare}>
                Contact Support via WhatsApp
              </Button>
            </a>
            <a href={`tel:+${supportPhone}`} className="w-full sm:w-auto">
              <Button variant="outline" size="lg" fullWidth icon={PhoneCall}>
                Call Support
              </Button>
            </a>
          </div>

          <button onClick={signOut} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <LogOut size={16} />
            Sign out of account
          </button>
        </div>
      </div>
    )
  }

  // Default: subscription expired
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#EF4444] flex items-center justify-center mx-auto mb-5 shadow-inner">
          <Lock size={32} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
          Your Account is Locked
        </h1>

        <p className="text-gray-500 text-sm mb-6">
          The subscription for <strong className="text-gray-800">{instituteName}</strong> expired on{' '}
          <span className="font-medium text-gray-700">{formattedLastActive}</span>.{' '}
          All your student and fee data is safely preserved — renew to restore full access instantly!
        </p>

        <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Renew to unlock your workspace:
          </p>
          <ul className="space-y-2.5">
            {features.map((feat, idx) => (
              <li key={idx} className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle2 size={18} className="text-[#22C55E] flex-shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mb-6">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button variant="accent" size="lg" fullWidth icon={MessageSquare}>
              Renew Now via WhatsApp
            </Button>
          </a>
          <a href={`tel:+${supportPhone}`} className="w-full sm:w-auto">
            <Button variant="outline" size="lg" fullWidth icon={PhoneCall}>
              Contact Support
            </Button>
          </a>
        </div>

        <button onClick={signOut} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <LogOut size={16} />
          Sign out of account
        </button>
      </div>
    </div>
  )
}
