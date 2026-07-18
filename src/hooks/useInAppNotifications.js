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
 * Request OS notification permission from the user (once).
 * Should be called after a user gesture for best browser compatibility.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch (e) {
    console.warn('Notification permission error:', e)
    return 'error'
  }
}

/**
 * Fire a native OS / phone-panel notification.
 *
 * Strategy (most → least reliable):
 * 1. Post a SHOW_NOTIFICATION message to the active Service Worker.
 *    The SW's message handler calls showNotification() — this reliably
 *    appears in the Android system notification shade for both browser tabs
 *    and installed PWAs.
 * 2. If no SW controller, call reg.showNotification() directly.
 * 3. If no SW at all, fall back to the Notification constructor (desktop).
 */
async function fireNativeNotification(title, body, url = '/notifications') {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    if ('serviceWorker' in navigator) {
      // Wait for the service worker to be ready
      const reg = await navigator.serviceWorker.ready

      // Preferred: send a message to the SW — it fires showNotification() from inside the SW context
      // This is more reliable on Android Chrome than calling reg.showNotification() from page JS
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: title || 'Batch Desk',
          body: (body || 'You have a new notification').slice(0, 200),
          url: url || '/notifications',
        })
      } else {
        // SW is ready but not yet controlling this tab — call directly
        await reg.showNotification(title || 'Batch Desk', {
          body: (body || 'You have a new notification').slice(0, 200),
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          tag: `batchdesk-notif-${Date.now()}`,
          renotify: true,
          data: { url: url || '/notifications' },
          vibrate: [200, 100, 200],
        })
      }
    } else {
      // Desktop fallback — no service worker
      new Notification(title || 'Batch Desk', {
        body: (body || 'You have a new notification').slice(0, 200),
        icon: '/icons/icon-192.png',
      })
    }
  } catch (e) {
    console.warn('Native notification error:', e)
    // Last resort fallback
    try {
      new Notification(title || 'Batch Desk', { body: body || '' })
    } catch (_) { /* silent */ }
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

  // Request OS notification permission once on mount
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const [studentId, setStudentId] = useState(profile?.role === 'student' ? profile?.id : null)
  const [myBatchStudentIds, setMyBatchStudentIds] = useState([])
  const [parentChecked, setParentChecked] = useState(false)
  const instituteId = profile?.institute_id

  // Refs to prevent teardowns and double subscribe errors on real-time channel
  const studentIdRef = useRef(studentId)
  const myBatchStudentIdsRef = useRef(myBatchStudentIds)

  useEffect(() => {
    studentIdRef.current = studentId
  }, [studentId])

  useEffect(() => {
    myBatchStudentIdsRef.current = myBatchStudentIds
  }, [myBatchStudentIds])

  useEffect(() => {
    async function resolveRoleContext() {
      if (!profile) return
      
      if (profile.role === 'parent') {
        const { data: child } = await supabase
          .from('students')
          .select('id')
          .eq('parent_email', profile.email)
          .maybeSingle()
        if (child) {
          setStudentId(child.id)
        }
        setParentChecked(true)
      } else if (profile.role === 'staff') {
        const { data: myBatches } = await supabase
          .from('batches')
          .select('id')
          .eq('teacher_id', profile.id)
        
        const myBatchIds = (myBatches || []).map(b => b.id)
        if (myBatchIds.length > 0) {
          const { data: bStuds } = await supabase
            .from('students')
            .select('id')
            .in('batch_id', myBatchIds)
          setMyBatchStudentIds((bStuds || []).map(s => s.id))
        }
      }
    }
    resolveRoleContext()
  }, [profile])

  const fetchInitial = useCallback(async () => {
    if (!instituteId) return
    let query = supabase
      .from('notifications')
      .select('id, type, message, status, created_at, student_id')
      .eq('institute_id', instituteId)
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(30)

    if (profile?.role === 'student') {
      query = query.eq('student_id', profile.id)
    } else if (profile?.role === 'parent') {
      if (studentId) query = query.eq('student_id', studentId)
      else return
    } else if (profile?.role === 'staff') {
      query = query.is('student_id', null)
    }

    const { data } = await query
    if (data) {
      if (profile?.role === 'staff') {
        const prefix = `[Teacher:${profile.id}]`
        const filtered = data
          .filter(n => n.message && n.message.startsWith(prefix))
          .map(n => ({
            ...n,
            message: n.message.substring(prefix.length).trim()
          }))
        setInAppNotifs(filtered)
        setUnreadCount(filtered.length)
      } else {
        setInAppNotifs(data)
        setUnreadCount(data.length)
      }
    }
  }, [instituteId, studentId, myBatchStudentIds, profile])

  // Run fetchInitial when parent checks or state updates
  useEffect(() => {
    if (instituteId) {
      if (profile?.role === 'parent' && !parentChecked) return
      fetchInitial()
    }
  }, [instituteId, studentId, myBatchStudentIds, parentChecked, fetchInitial])

  useEffect(() => {
    if (!instituteId) return

    // Set up a single channel instance for this institute with a unique random identifier to prevent React strict mode cache collision
    const channelId = `inapp-notifs-${instituteId}-${Math.random().toString(36).substring(2, 10)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `institute_id=eq.${instituteId}` },
        (payload) => {
          const n = payload.new
          if (n.status !== 'pending' && n.status !== 'sent') return

          // Permission checks using Refs to avoid tearing down hook
          if (profile?.role === 'student' && n.student_id !== profile.id) return
          if (profile?.role === 'parent' && n.student_id !== studentIdRef.current) return
          
          if (profile?.role === 'staff') {
            if (n.student_id !== null) return
            const prefix = `[Teacher:${profile.id}]`
            if (!n.message || !n.message.startsWith(prefix)) return
            
            const cleanMessage = n.message.substring(prefix.length).trim()
            const cleanNotif = { ...n, message: cleanMessage }
            setInAppNotifs((prev) => [cleanNotif, ...prev])
            setUnreadCount((prev) => prev + 1)
            playNotificationSound()
            fireNativeNotification('Batch Desk', cleanMessage.slice(0, 120), '/notifications')
            return
          }

          setInAppNotifs((prev) => [n, ...prev])
          setUnreadCount((prev) => prev + 1)
          playNotificationSound()
          fireNativeNotification('Batch Desk', (n.message || 'New notification').slice(0, 120), '/notifications')
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [instituteId, profile?.role])

  const markAllRead = useCallback(async () => {
    if (!instituteId || inAppNotifs.length === 0) return
    const ids = inAppNotifs.map((n) => n.id)
    await supabase.from('notifications').update({ status: 'delivered' }).in('id', ids)
    setInAppNotifs([])
    setUnreadCount(0)
  }, [instituteId, inAppNotifs])

  return { inAppNotifs, unreadCount, markAllRead }
}
