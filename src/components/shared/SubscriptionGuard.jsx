import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageLoader } from '../ui/Spinner'

export default function SubscriptionGuard({ children }) {
  const { user, profile, institute } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [redirectExpired, setRedirectExpired] = useState(false)

  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'admin@batchdesk.com'
  const isSuperAdmin = user?.email && user.email.toLowerCase() === superadminEmail.toLowerCase()

  useEffect(() => {
    async function checkSubscription() {
      // Superadmin or non-institute users bypass subscription checks
      if (isSuperAdmin || location.pathname === '/superadmin') {
        setChecking(false)
        return
      }

      if (!profile?.institute_id) {
        setChecking(false)
        return
      }

      try {
        const { data: inst, error } = await supabase
          .from('institutes')
          .select('id, subscription_status, trial_ends_at, subscription_ends_at')
          .eq('id', profile.institute_id)
          .single()

        if (error || !inst) {
          setChecking(false)
          return
        }

        const now = new Date()
        let currentStatus = inst.subscription_status || 'trial'
        let needsUpdate = false

        if (currentStatus === 'trial' && inst.trial_ends_at) {
          if (new Date(inst.trial_ends_at) < now) {
            currentStatus = 'expired'
            needsUpdate = true
          }
        } else if (currentStatus === 'active' && inst.subscription_ends_at) {
          if (new Date(inst.subscription_ends_at) < now) {
            currentStatus = 'expired'
            needsUpdate = true
          }
        }

        if (needsUpdate) {
          await supabase
            .from('institutes')
            .update({ subscription_status: 'expired' })
            .eq('id', inst.id)
        }

        if (currentStatus === 'expired' || currentStatus === 'suspended') {
          setRedirectExpired(true)
        }
      } catch (err) {
        console.error('Subscription check error:', err)
      } finally {
        setChecking(false)
      }
    }

    checkSubscription()
  }, [profile?.institute_id, location.pathname, isSuperAdmin])

  if (checking) return <PageLoader />

  if (redirectExpired && location.pathname !== '/expired' && !isSuperAdmin) {
    return <Navigate to="/expired" replace />
  }

  return children
}
