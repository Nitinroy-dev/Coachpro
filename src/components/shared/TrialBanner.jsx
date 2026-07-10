import { useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { AlertTriangle, Sparkles, Lock } from 'lucide-react'

export default function TrialBanner() {
  const { user, institute } = useAuth()
  const supportPhone = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER || '919876543210'
  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'admin@coachpro.com'
  const isSuperAdmin = user?.email && user.email.toLowerCase() === superadminEmail.toLowerCase()

  const status = institute?.subscription_status
  const now = new Date()

  // Determine expiry date — trial or active plan
  let expiryDate = null
  if (status === 'trial' && institute?.trial_ends_at) {
    expiryDate = new Date(institute.trial_ends_at)
  } else if (status === 'active' && institute?.subscription_ends_at) {
    expiryDate = new Date(institute.subscription_ends_at)
  }

  const daysLeft = expiryDate ? Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))) : null
  const isUrgent = daysLeft !== null && daysLeft <= 3
  const shouldShow = !isSuperAdmin && institute && expiryDate && (status === 'trial' || status === 'active') && daysLeft !== null && daysLeft <= 7
  const instituteName = institute?.name || 'My Institute'

  // One-time WhatsApp reminder when critically close (≤3 days)
  // MUST be called unconditionally — guard inside effect body
  useEffect(() => {
    if (!shouldShow || !isUrgent || !institute?.id) return
    const reminderKey = `sub_reminder_sent_${institute.id}`
    if (sessionStorage.getItem(reminderKey)) return

    const msg = encodeURIComponent(
      `⚠️ URGENT: Your CoachPro subscription for ${instituteName} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}! Renew now to avoid losing access to all features, student data, and fee records.`
    )
    const waUrl = `https://wa.me/${supportPhone}?text=${msg}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    sessionStorage.setItem(reminderKey, '1')
  }, [shouldShow, isUrgent, institute?.id])

  // Early return AFTER all hooks
  if (!shouldShow) return null

  const upgradeMsg = encodeURIComponent(`Hi, I want to renew my CoachPro subscription for ${instituteName}`)
  const whatsappUrl = `https://wa.me/${supportPhone}?text=${upgradeMsg}`
  const label = status === 'trial' ? 'Trial' : 'Subscription'

  return (
    <div
      className={`
        w-full py-2 px-4 text-center text-sm font-medium transition-colors z-30
        flex items-center justify-center gap-2 flex-wrap shadow-sm
        ${isUrgent ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-950'}
      `}
    >
      {isUrgent
        ? <Lock size={15} className="animate-pulse flex-shrink-0" />
        : <AlertTriangle size={15} className="flex-shrink-0" />
      }
      <span>
        {isUrgent
          ? <><strong>🔴 URGENT:</strong> Your {label} expires in </>
          : <>{label} expires in </>
        }
        <strong className={`px-1.5 py-0.5 rounded ${isUrgent ? 'bg-white text-red-600' : 'bg-amber-900 text-amber-100'}`}>
          {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
        </strong>
        {' '}— {isUrgent ? 'Your account will be locked after this!' : 'Renew to keep uninterrupted access.'}
      </span>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`
          inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0
          ${isUrgent
            ? 'bg-white text-red-600 hover:bg-gray-100 shadow'
            : 'bg-amber-950 text-white hover:bg-black shadow'
          }
        `}
      >
        <Sparkles size={13} />
        Renew Now
      </a>
    </div>
  )
}
