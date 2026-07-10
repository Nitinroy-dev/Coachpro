import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  User, Phone, Calendar, Clock, CreditCard, Award, QrCode, Download,
  CheckCircle, AlertCircle, RefreshCw, Edit2, ArrowLeft, Send, MessageSquare,
  Sparkles, Shield, Ban, Check, X, Bell, Tag, Link2, Percent
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { sendWhatsAppMessage, buildMessage } from '../../lib/wati'
import Button from '../../components/ui/Button'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import FeeCollect from '../fees/FeeCollect'
import FeeReceipt from '../fees/FeeReceipt'
import PaymentLinkModal from '../fees/PaymentLinkModal'

export default function StudentDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const instituteId = profile?.institute_id
  const isStaff = profile?.role === 'staff'
  const qrCanvasRef = useRef(null)

  const [student, setStudent] = useState(null)
  const [installments, setInstallments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [timetable, setTimetable] = useState([])
  const [events, setEvents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')

  // Modals
  const [showQRModal, setShowQRModal] = useState(false)
  const [showCollectModal, setShowCollectModal] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(null)
  const [showWaiveModal, setShowWaiveModal] = useState(null)
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)

  // Discount Form State
  const [discountForm, setDiscountForm] = useState({
    type: 'amount', // amount | percent
    value: '',
    reason: '',
    target: 'all' // all | installment_id
  })

  const [waiveReason, setWaiveReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id && instituteId) {
      fetchStudentHubData()
    }
  }, [id, instituteId])

  const fetchStudentHubData = async () => {
    setLoading(true)
    try {
      const [studRes, instRes, attRes, notifRes] = await Promise.all([
        supabase.from('students').select('*, batches(*, courses(*))').eq('id', id).single(),
        supabase.from('fee_installments').select('*').eq('student_id', id).order('due_date', { ascending: true }),
        supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false }),
        supabase.from('notifications').select('*').eq('student_id', id).order('created_at', { ascending: false })
      ])

      const st = studRes.data
      setStudent(st)
      setInstallments(instRes.data || [])
      setAttendance(attRes.data || [])
      setNotifications(notifRes.data || [])

      if (st?.batch_id) {
        const [timeRes, eventRes] = await Promise.all([
          supabase.from('class_schedule').select('*').eq('batch_id', st.batch_id).eq('is_active', true),
          supabase.from('class_events').select('*').eq('batch_id', st.batch_id).order('event_date', { ascending: true })
        ])
        setTimetable(timeRes.data || [])
        setEvents(eventRes.data || [])
      }
    } catch (err) {
      console.error('Fetch student hub data error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    const newStatus = student.status === 'active' ? 'inactive' : 'active'
    if (!window.confirm(`Are you sure you want to set this student as ${newStatus}?`)) return
    const { error } = await supabase.from('students').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast.error(`Failed to update student status: ${error.message}`)
      return
    }
    fetchStudentHubData()
  }

  // Waive installment
  const handleWaiveSubmit = async () => {
    if (!showWaiveModal) return
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('fee_installments')
        .update({
          status: 'waived',
          notes: waiveReason ? `Waived: ${waiveReason}` : 'Waived by admin'
        })
        .eq('id', showWaiveModal.id)
      if (error) throw error
      setShowWaiveModal(null)
      setWaiveReason('')
      fetchStudentHubData()
    } catch (err) {
      toast.error(`Failed to waive fee: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Apply Discount Engine
  const handleApplyDiscountSubmit = async (e) => {
    e.preventDefault()
    if (!discountForm.value || Number(discountForm.value) <= 0) return
    setActionLoading(true)
    try {
      const pendingInsts = installments.filter(i => i.status !== 'paid' && i.status !== 'waived')
      if (pendingInsts.length === 0) {
        toast.warning('No pending installments available for discount.')
        return
      }

      if (discountForm.target === 'all') {
        const totalPendingAmount = pendingInsts.reduce((sum, i) => sum + (Number(i.amount) - Number(i.paid_amount || 0)), 0)
        let totalDiscount = Number(discountForm.type === 'percent' ? (totalPendingAmount * Number(discountForm.value)) / 100 : Number(discountForm.value))

        for (const inst of pendingInsts) {
          const rem = Number(inst.amount) - Number(inst.paid_amount || 0)
          const discForThis = Math.min(rem, totalDiscount / pendingInsts.length)
          const newAmount = Math.max(Number(inst.paid_amount || 0), Number(inst.amount) - discForThis)

          const { error } = await supabase.from('fee_installments').update({
            amount: newAmount,
            notes: discountForm.reason ? `Discount applied (${discountForm.reason})` : 'Discount applied'
          }).eq('id', inst.id)
          if (error) throw error
        }
      } else {
        const inst = pendingInsts.find(i => i.id === discountForm.target)
        if (inst) {
          const discVal = discountForm.type === 'percent' ? (Number(inst.amount) * Number(discountForm.value)) / 100 : Number(discountForm.value)
          const newAmount = Math.max(Number(inst.paid_amount || 0), Number(inst.amount) - discVal)
          const { error } = await supabase.from('fee_installments').update({
            amount: newAmount,
            notes: discountForm.reason ? `Discount applied (${discountForm.reason})` : 'Discount applied'
          }).eq('id', inst.id)
          if (error) throw error
        }
      }

      setShowDiscountModal(false)
      setDiscountForm({ type: 'amount', value: '', reason: '', target: 'all' })
      fetchStudentHubData()
    } catch (err) {
      toast.error(`Failed to apply discount: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Send WhatsApp Reminder
  const handleSendReminder = async (inst) => {
    if (!student?.phone) {
      toast.warning('Student phone number is missing!')
      return
    }
    try {
      const dueDateStr = inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN') : 'soon'
      const remAmt = (inst.amount || 0) - (inst.paid_amount || 0)
      const msgText = buildMessage.feeDue(student.name, remAmt.toLocaleString('en-IN'), dueDateStr, profile?.institutes?.name || 'CoachPro')
      
      await sendWhatsAppMessage(student.phone, msgText)

      await supabase.from('notifications').insert({
        institute_id: instituteId,
        student_id: student.id,
        type: 'fee_reminder',
        channel: 'whatsapp',
        recipient: student.phone,
        message: `Fee reminder sent for Rs. ${remAmt.toLocaleString('en-IN')} due on ${dueDateStr}`,
        status: 'sent'
      })

      toast.success(`WhatsApp fee reminder sent to ${student.name}!`)
      fetchStudentHubData()
    } catch (err) {
      toast.error(`Reminder status logged: ${err.message}`)
    }
  }

  // Download QR PNG
  const downloadQRPNG = () => {
    const canvas = document.getElementById('student-qr-canvas')
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = pngUrl
      downloadLink.download = `ID_Card_QR_${student.student_code}.png`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
    }
  }

  if (loading || !student) {
    return <div className="p-12 text-center text-gray-400">Loading student profile...</div>
  }

  // Fee Calculations (Excludes waived from outstanding)
  const totalFee = installments.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)
  const totalPaid = installments.reduce((acc, i) => acc + (Number(i.paid_amount) || 0), 0)
  const activePendingInstallments = installments.filter(i => i.status !== 'waived')
  const activeTotalFee = activePendingInstallments.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)
  const outstanding = Math.max(0, activeTotalFee - totalPaid)
  const paidPct = activeTotalFee > 0 ? Math.min(100, Math.round((totalPaid / activeTotalFee) * 100)) : 0

  // Attendance Calculations
  const totalAttDays = attendance.length
  const presentDays = attendance.filter(a => a.status === 'present').length
  const absentDays = attendance.filter(a => a.status === 'absent').length
  const lateDays = attendance.filter(a => a.status === 'late').length
  const attPct = totalAttDays > 0 ? Math.round(((presentDays + lateDays) / totalAttDays) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Top Navigation Back */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/students')}>
          Back to Directory
        </Button>
        <div className="flex items-center gap-2">
          {!isStaff && (
            <Button variant="outline" size="sm" icon={Link2} onClick={() => setShowPaymentLinkModal(true)} className="bg-white">
              Payment Link
            </Button>
          )}
          <Button variant="outline" size="sm" icon={QrCode} onClick={() => setShowQRModal(true)} className="bg-white">
            QR ID Card
          </Button>
          {!isStaff && (
            <Button variant={student.status === 'active' ? 'danger' : 'success'} size="sm" onClick={handleToggleStatus}>
              {student.status === 'active' ? 'Deactivate Student' : 'Activate Student'}
            </Button>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <Card className="p-6 bg-gradient-to-br from-white to-slate-50 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-[#1E3A8A] text-white font-bold text-3xl flex items-center justify-center overflow-hidden border-2 border-white shadow-md flex-shrink-0">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                (student.name || 'S')[0].toUpperCase()
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold text-gray-900">{student.name}</h1>
                <span className="font-mono font-bold text-xs bg-blue-100 text-[#1E3A8A] px-2.5 py-1 rounded-lg">
                  {student.student_code}
                </span>
                <StatusBadge status={student.status || 'active'} />
              </div>
              <p className="text-sm font-semibold text-[#F97316]">
                {student.batches?.courses?.name || 'Course'} · <span className="text-gray-700">{student.batches?.name || 'Unassigned Batch'}</span>
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap pt-1">
                <span>📞 Phone: <strong className="text-gray-800">{student.phone}</strong></span>
                <span>👨‍👩‍👦 Parent: <strong className="text-gray-800">{student.parent_name}</strong> ({student.parent_phone})</span>
                <span>📅 Enrolled: <strong className="text-gray-800">{new Date(student.enrolled_at).toLocaleDateString('en-IN')}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'details', label: 'Overview & Details', icon: User },
          ...(!isStaff ? [{ id: 'fees', label: `Fee Schedule (${installments.length})`, icon: CreditCard }] : []),
          { id: 'attendance', label: `Attendance (${attPct}%)`, icon: Calendar },
          { id: 'schedule', label: 'Schedule & Events', icon: Clock },
          { id: 'notifications', label: `WhatsApp Logs (${notifications.length})`, icon: MessageSquare },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap
                ${isActive
                  ? 'bg-[#1E3A8A] text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }
              `}
            >
              <Icon size={16} className={isActive ? 'text-[#F97316]' : 'text-gray-400'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: DETAILS */}
      {activeTab === 'details' && (
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
              <User size={18} className="text-[#1E3A8A]" /> Student Personal File
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100 text-sm">
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Full Name</span> <span className="font-semibold text-gray-900">{student.name}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Student Code</span> <span className="font-mono font-semibold text-[#1E3A8A]">{student.student_code}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Student Phone</span> <span className="font-semibold text-gray-900">{student.phone}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Email Address</span> <span className="font-semibold text-gray-900">{student.email || '—'}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Parent / Guardian</span> <span className="font-semibold text-gray-900">{student.parent_name}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Parent Phone</span> <span className="font-semibold text-gray-900">{student.parent_phone}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Date of Birth</span> <span className="font-semibold text-gray-900">{student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : '—'}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Address</span> <span className="font-semibold text-gray-900">{student.address || '—'}</span></div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
              <Award size={18} className="text-[#F97316]" /> Enrollment Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100 text-sm">
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Assigned Course</span> <span className="font-bold text-[#1E3A8A]">{student.batches?.courses?.name || '—'}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Assigned Batch</span> <span className="font-bold text-[#F97316]">{student.batches?.name || '—'}</span></div>
              <div><span className="text-gray-400 block text-xs uppercase font-bold">Enrollment Date</span> <span className="font-semibold text-gray-900">{new Date(student.enrolled_at).toLocaleDateString('en-IN')}</span></div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 2: FEE SCHEDULE */}
      {activeTab === 'fees' && (
        <div className="space-y-6">
          {/* Header Summary & Progress */}
          <Card className="p-6 bg-gradient-to-br from-white to-blue-50/40 border border-blue-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div><p className="text-xs font-bold uppercase text-gray-400">Total Net Fee</p><p className="text-xl font-bold text-gray-900">₹{activeTotalFee.toLocaleString('en-IN')}</p></div>
              <div><p className="text-xs font-bold uppercase text-gray-400">Total Paid</p><p className="text-xl font-bold text-[#22C55E]">₹{totalPaid.toLocaleString('en-IN')}</p></div>
              <div><p className="text-xs font-bold uppercase text-gray-400">Outstanding Due</p><p className="text-xl font-bold text-[#EF4444]">₹{outstanding.toLocaleString('en-IN')}</p></div>
              <div><p className="text-xs font-bold uppercase text-gray-400">Payment Status</p><p className="text-xl font-bold text-[#1E3A8A]">{paidPct}% Paid</p></div>
            </div>

            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden shadow-inner">
              <div className="bg-[#22C55E] h-full transition-all duration-500" style={{ width: `${paidPct}%` }} />
            </div>
          </Card>

          {/* Installments Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Installment Schedule</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="xs" variant="outline" icon={Tag} onClick={() => setShowDiscountModal(true)} className="bg-white">
                  Add Discount
                </Button>
                <Button size="xs" variant="outline" icon={Link2} onClick={() => setShowPaymentLinkModal(true)} className="bg-white">
                  Payment Link
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Paid</th>
                    <th className="p-3.5">Balance</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {installments.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">No fee installments configured.</td></tr>
                  ) : installments.map(i => {
                    const rem = Math.max(0, (i.amount || 0) - (i.paid_amount || 0))
                    return (
                      <tr key={i.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-gray-800">#{i.installment_number}</td>
                        <td className="p-3.5 text-xs text-gray-600">{i.due_date ? new Date(i.due_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="p-3.5 font-semibold text-gray-900">₹{(i.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3.5 font-semibold text-green-600">₹{(i.paid_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3.5 font-bold text-red-600">
                          {i.status === 'waived' ? <span className="text-purple-600">Waived</span> : `₹${rem.toLocaleString('en-IN')}`}
                        </td>
                        <td className="p-3.5"><StatusBadge status={i.status} /></td>
                        <td className="p-3.5 text-right space-x-1.5">
                          {i.status === 'paid' || i.status === 'partial' ? (
                            <Button size="xs" variant="outline" onClick={() => setShowReceiptModal(i)} className="bg-white">
                              Receipt
                            </Button>
                          ) : null}

                          {i.status !== 'paid' && i.status !== 'waived' ? (
                            <>
                              <Button size="xs" variant="success" onClick={() => setShowCollectModal(i)}>
                                Collect Now
                              </Button>
                              <Button size="xs" variant="warning" onClick={() => setShowWaiveModal(i)}>
                                Waive
                              </Button>
                              <Button size="xs" variant="ghost" icon={Send} onClick={() => handleSendReminder(i)} title="Send WhatsApp Reminder" />
                            </>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-white to-orange-50/40 border border-orange-100">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-gray-400">Total Marked</p><p className="text-xl font-bold text-gray-900">{totalAttDays}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-green-600">Present 🟢</p><p className="text-xl font-bold text-green-600">{presentDays}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-red-600">Absent 🔴</p><p className="text-xl font-bold text-red-600">{absentDays}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-yellow-600">Late 🟡</p><p className="text-xl font-bold text-yellow-600">{lateDays}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-[#F97316]">Rate %</p><p className="text-xl font-extrabold text-[#F97316]">{attPct}%</p></div>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Attendance Log History</CardTitle></CardHeader>
            {attendance.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No attendance marked yet for this student.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 p-4">
                {attendance.map(a => (
                  <div key={a.id} className={`p-3 rounded-2xl border text-center space-y-1 ${a.status === 'present' ? 'bg-green-50 border-green-200 text-green-800' : a.status === 'absent' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                    <p className="text-xs font-bold">{new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white shadow-2xs">{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: SCHEDULE & EVENTS */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Weekly Timetable ({student.batches?.name})</CardTitle></CardHeader>
            {timetable.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No timetable active for this batch.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                {timetable.map(t => (
                  <div key={t.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{t.subject}</p>
                      <p className="text-xs text-gray-500">Day {t.day_of_week}</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-xl border">{t.start_time?.slice(0, 5)} - {t.end_time?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>Upcoming Batch Events & Exams</CardTitle></CardHeader>
            {events.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No upcoming batch events or exams scheduled.</div>
            ) : (
              <div className="space-y-2 p-4">
                {events.map(e => (
                  <div key={e.id} className={`p-3.5 rounded-2xl border flex items-center justify-between text-sm ${e.event_type === 'exam' ? 'bg-blue-50 border-blue-200 text-blue-900' : e.event_type === 'cancelled' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
                    <div>
                      <p className="font-bold">{e.subject || e.event_type.toUpperCase()}</p>
                      <p className="text-xs opacity-80">Date: {new Date(e.event_date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <Badge variant="primary" className="uppercase">{e.event_type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader><CardTitle>WhatsApp Communication Logs</CardTitle></CardHeader>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No WhatsApp messages logged for this student yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map(n => (
                <div key={n.id} className="p-4 flex items-start justify-between gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="primary" className="uppercase text-[10px]">{n.type || 'WhatsApp'}</Badge>
                      <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-gray-800 font-medium">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Recipient: {n.recipient}</p>
                  </div>
                  <Badge variant="success" className="capitalize">{n.status || 'sent'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* QR Code ID Card Modal */}
      {showQRModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowQRModal(false)}
          title={`Student ID QR Card: ${student.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowQRModal(false)}>Close</Button>
              <Button icon={Download} onClick={downloadQRPNG}>Download PNG for Printing</Button>
            </>
          }
        >
          <div className="text-center p-4 space-y-4">
            <div className="inline-block bg-white p-6 rounded-3xl shadow-xl border border-gray-200">
              <QRCodeCanvas
                id="student-qr-canvas"
                value={`COACHPRO_STUDENT_${student.id}_${student.student_code}`}
                size={200}
                level="H"
                includeMargin={true}
              />
              <p className="font-mono font-bold text-[#1E3A8A] text-lg mt-3">{student.student_code}</p>
              <p className="font-bold text-gray-900 text-sm">{student.name}</p>
              <p className="text-xs text-gray-500">{student.batches?.name}</p>
            </div>
            <p className="text-xs text-gray-400">Scan this QR code using the CoachPro Mobile Scanner for instant attendance marking.</p>
          </div>
        </Modal>
      )}

      {/* Collect Fee Modal */}
      {showCollectModal && (
        <FeeCollect
          installment={showCollectModal}
          onClose={() => setShowCollectModal(null)}
          onSaved={() => { setShowCollectModal(null); fetchStudentHubData() }}
        />
      )}

      {/* Fee Receipt Modal */}
      {showReceiptModal && (
        <FeeReceipt
          installment={showReceiptModal}
          onClose={() => setShowReceiptModal(null)}
        />
      )}

      {/* Payment Link Modal */}
      {showPaymentLinkModal && (
        <PaymentLinkModal
          student={student}
          defaultAmount={outstanding || 5000}
          onClose={() => setShowPaymentLinkModal(false)}
          instituteName={profile?.institutes?.name}
        />
      )}

      {/* Add Discount Modal */}
      {showDiscountModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDiscountModal(false)}
          title={`Apply Fee Discount: ${student.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowDiscountModal(false)} disabled={actionLoading}>Cancel</Button>
              <Button loading={actionLoading} onClick={handleApplyDiscountSubmit}>Apply Discount</Button>
            </>
          }
        >
          <form onSubmit={handleApplyDiscountSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Discount Type"
                value={discountForm.type}
                onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value })}
                options={[
                  { value: 'amount', label: 'Fixed Amount (₹)' },
                  { value: 'percent', label: 'Percentage (%)' }
                ]}
              />
              <Input
                label={discountForm.type === 'amount' ? 'Discount Value (₹) *' : 'Discount Percentage (%) *'}
                type="number"
                placeholder={discountForm.type === 'amount' ? '2000' : '10'}
                value={discountForm.value}
                onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                required
              />
            </div>

            <Select
              label="Applies To"
              value={discountForm.target}
              onChange={(e) => setDiscountForm({ ...discountForm, target: e.target.value })}
              options={[
                { value: 'all', label: 'Distribute Across All Pending Installments' },
                ...installments.filter(i => i.status !== 'paid' && i.status !== 'waived').map(i => ({
                  value: i.id,
                  label: `Installment #${i.installment_number} (₹${((i.amount || 0) - (i.paid_amount || 0)).toLocaleString('en-IN')})`
                }))
              ]}
            />

            <Input
              label="Reason for Discount *"
              placeholder="e.g. Sibling discount / Early bird special..."
              value={discountForm.reason}
              onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
              required
            />
          </form>
        </Modal>
      )}

      {/* Waive Modal */}
      {showWaiveModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowWaiveModal(null)}
          title={`Waive Fee Installment #${showWaiveModal.installment_number}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowWaiveModal(null)}>Cancel</Button>
              <Button variant="warning" loading={actionLoading} onClick={handleWaiveSubmit}>Confirm Waive</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to waive installment #{showWaiveModal.installment_number} of <strong className="text-gray-900">₹{(showWaiveModal.amount || 0).toLocaleString('en-IN')}</strong>?
            </p>
            <Input
              label="Reason for Waiving *"
              placeholder="e.g. Special management exemption..."
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              required
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
