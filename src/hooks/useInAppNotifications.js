import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Plays a short 3-tone ascending chime using the Web Audio API.
 * No external file needed — works offline and in PWA.
 */
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.12)
    osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.24)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  } catch (e) {
    console.warn('Audio unavailable:', e)
  }
}

/**
 * Hook: subscribes to Supabase Realtime for new in-app notifications.
 * Plays a chime on new inserts and tracks unread count.
 */
export function useInAppNotifications() {
  const { profile } = useAuth()
  const [inAppNotifs, setInAppNotifs] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const channelRef = useRef(null)

  const studentId = profile?.role === 'student' ? profile?.id : null
  const instituteId = profile?.institute_id

  const fetchInitial = useCallback(async () => {
    if (!instituteId) return
    let query = supabase
      .from('notifications')
      .select('id, type, message, status, created_at, student_id')
      .eq('institute_id', instituteId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(30)
    if (studentId) query = query.eq('student_id', studentId)
    const { data } = await query
    if (data) {
      setInAppNotifs(data)
      setUnreadCount(data.length)
    }
  }, [instituteId, studentId])

  useEffect(() => {
    if (!instituteId) return
    fetchInitial()

    // Subscribe to new notification inserts via Supabase Realtime
    const channel = supabase
      .channel(`inapp-notifs-${instituteId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `institute_id=eq.${instituteId}` },
        (payload) => {
          const n = payload.new
          // Students only receive their own notifications
          if (studentId && n.student_id !== studentId) return
          setInAppNotifs((prev) => [n, ...prev])
          setUnreadCount((prev) => prev + 1)
          playNotificationSound()
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [instituteId, studentId])

  const markAllRead = useCallback(async () => {
    if (!instituteId || inAppNotifs.length === 0) return
    const ids = inAppNotifs.map((n) => n.id)
    await supabase.from('notifications').update({ status: 'delivered' }).in('id', ids)
    setInAppNotifs([])
    setUnreadCount(0)
  }, [instituteId, inAppNotifs])

  return { inAppNotifs, unreadCount, markAllRead }
}
