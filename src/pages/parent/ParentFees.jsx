import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import { TableRowSkeleton } from '../../components/ui/Skeleton'
import { CreditCard, AlertTriangle, User } from 'lucide-react'

export default function ParentFees() {
  const { profile, institute } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [studentRecord, setStudentRecord] = useState(null)
  const [installments, setInstallments] = useState([])

  useEffect(() => {
    fetchChildFees()
  }, [])

  const fetchChildFees = async () => {
    setLoading(true)
    try {
      if (!profile?.linked_student_id) {
        setLoading(false)
        return
      }

      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('*, batches(name, courses(name))')
        .eq('id', profile.linked_student_id)
        .maybeSingle()

      if (sErr) throw sErr
      if (!sData) {
        setLoading(false)
        return
      }

      setStudentRecord(sData)

      const { data: instData, error: instErr } = await supabase
        .from('fee_installments')
        .select('*')
        .eq('student_id', sData.id)
        .order('due_date', { ascending: true })

      if (instErr) throw instErr
      setInstallments(instData || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load fee information.')
    } finally {
      setLoading(false)
    }
  }

  const totalDues = installments
    .filter(i => i.status !== 'paid' && i.status !== 'waived')
    .reduce((sum, i) => sum + (Number(i.amount) - Number(i.paid_amount || 0)), 0)

  const totalPaid = installments
    .filter(i => i.status === 'paid' || i.status === 'partial')
    .reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0)

  const overdueCount = installments.filter(i => i.status === 'overdue').length

  const badgeColors = {
    paid: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    overdue: 'bg-red-100 text-red-700 border-red-200',
    waived: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    partial: 'bg-orange-100 text-orange-700 border-orange-200',
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 bg-gray-100/60 rounded-2xl animate-pulse" />
        <TableRowSkeleton rows={4} />
      </div>
    )
  }

  if (!studentRecord) {
    return (
      <Card className="p-8 text-center text-gray-400">
        <AlertTriangle className="mx-auto mb-2 text-amber-500" size={32} />
        <p className="font-bold">No linked student record found.</p>
        <p className="text-xs mt-1">Please ask the administrator to link your account to your child's profile.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Child info banner */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="w-10 h-10 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center">
          <User size={20} />
        </div>
        <div>
          <p className="font-bold text-gray-900">{studentRecord.name}'s Fee Details</p>
          <p className="text-xs text-gray-500">
            {studentRecord.batches?.courses?.name && <span>{studentRecord.batches.courses.name} • </span>}
            {studentRecord.batches?.name && <span>Batch: {studentRecord.batches.name}</span>}
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Child's Fees & Payments</h1>
        <p className="text-sm text-gray-500">View your child's fee schedule, payment status, and outstanding dues</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100/30 border border-red-200">
          <p className="text-[10px] uppercase font-bold text-red-700">Total Pending Dues</p>
          <p className="text-2xl font-extrabold text-red-700 mt-0.5">₹{totalDues.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100/30 border border-green-200">
          <p className="text-[10px] uppercase font-bold text-green-700">Total Fees Cleared</p>
          <p className="text-2xl font-extrabold text-green-700 mt-0.5">₹{totalPaid.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-4 bg-white border">
          <p className="text-[10px] uppercase font-bold text-gray-400">Overdue Installments</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-0.5">{overdueCount} Alerts</p>
        </Card>
        <Card className="p-4 bg-white border">
          <p className="text-[10px] uppercase font-bold text-gray-400">Total Installments</p>
          <p className="text-2xl font-extrabold text-gray-800 mt-0.5">{installments.length}</p>
        </Card>
      </div>

      {/* Installments table */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4 border-b border-gray-100 flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard size={18} className="text-[#1E3A8A]" /> Installment Schedule
          </CardTitle>
        </CardHeader>

        <div className="overflow-x-auto pt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-100">
                <th className="p-3">Installment #</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {installments.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No fee installments found for your child.</td></tr>
              ) : (
                installments.map(inst => {
                  const balance = Math.max(0, Number(inst.amount) - Number(inst.paid_amount || 0))
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-bold text-gray-900">Installment #{inst.installment_number}</td>
                      <td className="p-3 text-gray-600 font-semibold">{inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="p-3 font-bold text-gray-900">₹{Number(inst.amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-green-600 font-bold">₹{Number(inst.paid_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 font-bold text-red-600">₹{balance.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${badgeColors[inst.status] || 'bg-gray-100'}`}>
                          {inst.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
