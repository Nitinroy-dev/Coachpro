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
      if (myBatchStudentIds.length > 0) {
        query = query.in('student_id', myBatchStudentIds)
      } else {
        setInAppNotifs([])
        setUnreadCount(0)
        return
      }
    }

    const { data } = await query
    if (data) {
      setInAppNotifs(data)
      setUnreadCount(data.length)
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
          if (profile?.role === 'staff' && !myBatchStudentIdsRef.current.includes(n.student_id)) return

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
