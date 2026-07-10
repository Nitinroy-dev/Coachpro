import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export const InstituteContext = createContext(null)

export function InstituteProvider({ children }) {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalRevenue: 0,
    pendingFees: 0,
    totalBatches: 0,
    todayAttendance: 0,
  })
  const [loading, setLoading] = useState(false)

  const instituteId = profile?.institute_id

  const fetchStats = useCallback(async () => {
    if (!instituteId) return
    setLoading(true)
    try {
      const [studentsRes, feesRes, batchesRes, pendingRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, status')
          .eq('institute_id', instituteId),
        supabase
          .from('fee_installments')
          .select('paid_amount')
          .eq('institute_id', instituteId)
          .not('paid_date', 'is', null),
        supabase
          .from('batches')
          .select('id')
          .eq('institute_id', instituteId),
        supabase
          .from('fee_installments')
          .select('amount, paid_amount')
          .eq('institute_id', instituteId)
          .in('status', ['pending', 'overdue', 'partial']),
      ])

      const students = studentsRes.data || []
      const fees = feesRes.data || []
      const batches = batchesRes.data || []
      const pending = pendingRes.data || []

      setStats({
        totalStudents: students.length,
        activeStudents: students.filter(s => s.status === 'active').length,
        totalRevenue: fees.reduce((sum, f) => sum + (Number(f.paid_amount) || 0), 0),
        pendingFees: pending.reduce((sum, f) => sum + ((f.amount || 0) - (f.paid_amount || 0)), 0),
        totalBatches: batches.length,
      })
    } catch (err) {
      console.error('Error fetching institute stats:', err)
    } finally {
      setLoading(false)
    }
  }, [instituteId])

  useEffect(() => {
    if (instituteId) {
      fetchStats()
    }
  }, [instituteId, fetchStats])

  const value = {
    instituteId,
    stats,
    loading,
    refreshStats: fetchStats,
  }

  return (
    <InstituteContext.Provider value={value}>
      {children}
    </InstituteContext.Provider>
  )
}
