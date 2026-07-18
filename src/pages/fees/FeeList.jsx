import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard, Plus, Search, Upload, MessageSquare, Send, Calendar, Filter, Download,
  TrendingUp, AlertCircle, Clock, CheckCircle2, DollarSign, BarChart3, FileSpreadsheet
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { sendWhatsAppMessage, buildMessage } from '../../lib/wati'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import { StatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { TableRowSkeleton } from '../../components/ui/Skeleton'
import FeeCollect from './FeeCollect'
import FeeReceipt from './FeeReceipt'

export default function FeeList() {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const instituteId = profile?.institute_id
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  const [activeTab, setActiveTab] = useState('transactions') // transactions | pending | partial | reports
  const [loading, setLoading] = useState(false)

  // Raw datasets
  const [installments, setInstallments] = useState([])
  const [fees, setFees] = useState([])
  const [students, setStudents] = useState([])

  // Modals
  const [showCollect, setShowCollect] = useState(false)
  const [showReceipt, setShowReceipt] = useState(null)
  const [selectedInstallment, setSelectedInstallment] = useState(null)

  // Tab 2 Filters
  const [pendingFilter, setPendingFilter] = useState('all') // all | overdue | week | month
  const [pendingSearch, setPendingSearch] = useState('')

  // Tab 4 Report Filters
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (instituteId) fetchMasterFeeData()
  }, [instituteId])

  const fetchMasterFeeData = async () => {
    setLoading(true)
    try {
      const [instRes, feeRes, studRes] = await Promise.all([
        supabase.from('fee_installments').select('*, students(*, batches(name, courses(name)))').eq('institute_id', instituteId).order('due_date', { ascending: true }),
        supabase.from('fees').select('*, students(*, batches(name))').eq('institute_id', instituteId).order('paid_date', { ascending: false }),
        supabase.from('students').select('*, batches(name, courses(name))').eq('institute_id', instituteId).eq('status', 'active')
      ])

      setInstallments(instRes.data || [])
      setFees(feeRes.data || [])
      setStudents(studRes.data || [])
    } catch (err) {
      console.error('Fetch master fee data error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculated Metrics
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const todayStr = now.toISOString().split('T')[0]

  const monthCollected = feeHistorySum(fees, startOfMonth)
  const totalPending = installments.filter(i => i.status !== 'paid' && i.status !== 'waived').reduce((s, i) => s + ((Number(i.amount) || 0) - (Number(i.paid_amount) || 0)), 0)
  const overdueTotal = installments.filter(i => i.status === 'overdue' || (i.status !== 'paid' && i.status !== 'waived' && i.due_date && i.due_date < todayStr)).reduce((s, i) => s + ((Number(i.amount) || 0) - (Number(i.paid_amount) || 0)), 0)
  const dueThisWeek = installments.filter(i => i.status !== 'paid' && i.status !== 'waived' && i.due_date >= todayStr && i.due_date <= weekFromNow).reduce((s, i) => s + ((Number(i.amount) || 0) - (Number(i.paid_amount) || 0)), 0)
  const partialCount = installments.filter(i => i.status === 'partial').length
  const monthWaived = installments.filter(i => i.status === 'waived').reduce((s, i) => s + (Number(i.amount) || 0), 0)

  function feeHistorySum(list, fromDate) {
    return list.filter(f => f.paid_date >= fromDate).reduce((s, f) => s + (Number(f.amount) || 0), 0)
  }

  // Reminders
  const handleSendSingleReminder = async (inst) => {
    const phone = inst.students?.phone || inst.students?.parent_phone
    if (!phone) { toast.warning('Phone number missing!'); return }
    const rem = (inst.amount || 0) - (inst.paid_amount || 0)
    const dueDateStr = inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN') : 'soon'
    const msgText = buildMessage.feeDue(inst.students?.name || 'Student', rem.toLocaleString('en-IN'), dueDateStr, profile?.institutes?.name || 'CoachPro')
    const config = profile?.institutes?.settings || null
    await sendWhatsAppMessage(phone, msgText, config)
    toast.success(`WhatsApp reminder sent to ${inst.students?.name}!`)
  }

  const handleBulkReminders = async () => {
    const overdueList = installments.filter(i => i.status === 'overdue' || (i.status !== 'paid' && i.status !== 'waived' && i.due_date && i.due_date < todayStr))
    if (overdueList.length === 0) { toast.warning('No overdue installments to send reminders to.'); return }
    if (!window.confirm(`Send automated WhatsApp reminders to all ${overdueList.length} overdue students?`)) return

    let count = 0
    const config = profile?.institutes?.settings || null
    for (const inst of overdueList) {
      const phone = inst.students?.phone || inst.students?.parent_phone
      if (phone) {
        const rem = (inst.amount || 0) - (inst.paid_amount || 0)
        const dueDateStr = inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN') : 'soon'
        const msgText = buildMessage.feeDue(inst.students?.name || 'Student', rem.toLocaleString('en-IN'), dueDateStr, profile?.institutes?.name || 'CoachPro')
        await sendWhatsAppMessage(phone, msgText, config)
        count++
      }
    }
    toast.success(`Successfully dispatched ${count} WhatsApp fee reminders!`)
  }

  // CSV Exporters
  const exportRecentTransactionsCSV = () => {
    const headers = ['Receipt No', 'Student Name', 'Batch', 'Amount Paid (INR)', 'Payment Date', 'Mode']
    const rows = fees.map(f => [
      f.receipt_number || 'N/A',
      `"${f.students?.name || ''}"`,
      `"${f.students?.batches?.name || ''}"`,
      f.amount || 0,
      f.paid_date ? `="${new Date(f.paid_date).toLocaleDateString('en-IN')}"` : '""',
      (f.mode || 'cash').toUpperCase()
    ])
    downloadCSV(headers, rows, `Recent_Fee_Transactions_${todayStr}.csv`)
  }

  const exportCollectionReportCSV = () => {
    const filteredFees = fees.filter(f => f.paid_date >= startDate && f.paid_date <= endDate)
    const headers = ['Receipt No', 'Student Name', 'Installment #', 'Amount Paid (INR)', 'Payment Date', 'Mode']
    const rows = filteredFees.map(f => [
      f.receipt_number || 'N/A',
      `"${f.students?.name || ''}"`,
      f.installment_id ? 'Linked' : 'Manual',
      f.amount || 0,
      f.paid_date ? `="${new Date(f.paid_date).toLocaleDateString('en-IN')}"` : '""',
      (f.mode || 'cash').toUpperCase()
    ])
    downloadCSV(headers, rows, `Fee_Collection_Report_${startDate}_to_${endDate}.csv`)
  }

  const exportOutstandingReportCSV = () => {
    const rows = students.map(s => {
      const sInsts = installments.filter(i => i.student_id === s.id && i.status !== 'waived')
      const netPayable = sInsts.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
      const paid = sInsts.reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0)
      const outstanding = Math.max(0, netPayable - paid)
      return { s, netPayable, paid, outstanding }
    }).filter(r => r.outstanding > 0)

    const headers = ['Student Code', 'Student Name', 'Batch', 'Net Payable (INR)', 'Total Paid (INR)', 'Outstanding Due (INR)']
    const csvRows = rows.map(r => [
      r.s.student_code || 'N/A',
      `"${r.s.name}"`,
      `"${r.s.batches?.name || 'Unassigned'}"`,
      r.netPayable,
      r.paid,
      r.outstanding
    ])
    downloadCSV(headers, csvRows, `Outstanding_Fees_Report_${todayStr}.csv`)
  }

  function downloadCSV(headers, rows, fileName) {
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered Tab 2 Pending list
  const filteredPendingList = installments.filter(i => {
    if (i.status === 'paid' || i.status === 'waived') return false
    const q = pendingSearch.toLowerCase()
    const matchQ = !q || i.students?.name?.toLowerCase().includes(q) || i.students?.phone?.includes(q)

    if (pendingFilter === 'overdue') return matchQ && (i.status === 'overdue' || (i.due_date && i.due_date < todayStr))
    if (pendingFilter === 'week') return matchQ && (i.due_date >= todayStr && i.due_date <= weekFromNow)
    if (pendingFilter === 'month') return matchQ && (i.due_date >= startOfMonth)
    return matchQ
  }).sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))

  // Recharts Monthly Collection Data (Last 12 months)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const collection12mMap = {}
  fees.forEach(f => {
    if (!f.paid_date) return
    const d = new Date(f.paid_date)
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    collection12mMap[key] = (collection12mMap[key] || 0) + (Number(f.amount) || 0)
  })
  const chartData12m = Object.entries(collection12mMap).map(([month, amount]) => ({ month, amount })).slice(-12)

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fees & Financial Management</h1>
          <p className="text-sm text-gray-500">Track collections, manage pending dues, and view automated financial reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={FileSpreadsheet} onClick={() => navigate('/fees/structures')} className="bg-white">
            Fee Structures
          </Button>
          <Button variant="accent" icon={Plus} onClick={() => { setSelectedInstallment(null); setShowCollect(true) }} className="shadow-md">
            Record Payment
          </Button>
        </div>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 bg-gradient-to-br from-green-50 to-emerald-50/40 border border-green-100">
          <p className="text-[10px] uppercase font-bold text-green-700">Collected This Month</p>
          <p className="text-lg font-extrabold text-green-700 mt-0.5">₹{monthCollected.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-3.5 bg-gradient-to-br from-red-50 to-rose-50/40 border border-red-100">
          <p className="text-[10px] uppercase font-bold text-red-600">Total Pending</p>
          <p className="text-lg font-extrabold text-red-600 mt-0.5">₹{totalPending.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-3.5 bg-gradient-to-br from-red-100/60 to-red-50 border border-red-200">
          <p className="text-[10px] uppercase font-bold text-red-900">Overdue Dues</p>
          <p className="text-lg font-extrabold text-red-900 mt-0.5">₹{overdueTotal.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-3.5 bg-gradient-to-br from-orange-50 to-amber-50/40 border border-orange-100">
          <p className="text-[10px] uppercase font-bold text-[#F97316]">Due This Week</p>
          <p className="text-lg font-extrabold text-[#F97316] mt-0.5">₹{dueThisWeek.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-3.5 bg-gradient-to-br from-yellow-50 to-amber-50/30 border border-yellow-100">
          <p className="text-[10px] uppercase font-bold text-yellow-700">Partial Payments</p>
          <p className="text-lg font-extrabold text-yellow-700 mt-0.5">{partialCount} Students</p>
        </Card>
        <Card className="p-3.5 bg-gradient-to-br from-purple-50 to-fuchsia-50/30 border border-purple-100">
          <p className="text-[10px] uppercase font-bold text-purple-700">Waived This Month</p>
          <p className="text-lg font-extrabold text-purple-700 mt-0.5">₹{monthWaived.toLocaleString('en-IN')}</p>
        </Card>
      </div>

      {/* 4 Main Tabs */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'transactions', label: `Recent Transactions (${fees.length})`, icon: CreditCard },
          { id: 'pending', label: `Pending & Overdue (${filteredPendingList.length})`, icon: Clock },
          { id: 'partial', label: `Partial Payments (${partialCount})`, icon: AlertCircle },
          { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'bg-[#1E3A8A] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              <Icon size={16} className={isActive ? 'text-[#F97316]' : 'text-gray-400'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <TableRowSkeleton rows={5} />
      ) : (
        <>
          {/* TAB 1: RECENT TRANSACTIONS */}
          {activeTab === 'transactions' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Recent Payment Transactions</CardTitle>
            {isAdmin && <Button size="xs" variant="outline" icon={Upload} onClick={exportRecentTransactionsCSV} className="bg-white">Export CSV</Button>}
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                  <th className="p-3.5">Receipt #</th>
                  <th className="p-3.5">Student</th>
                  <th className="p-3.5">Batch</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Mode</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fees.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No payment transactions recorded yet.</td></tr>
                ) : fees.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-[#1E3A8A] text-xs">{f.receipt_number || '—'}</td>
                    <td className="p-3.5 font-bold text-gray-900">{f.students?.name || '—'}</td>
                    <td className="p-3.5 text-xs text-gray-600">{f.students?.batches?.name || '—'}</td>
                    <td className="p-3.5 font-extrabold text-green-600">₹{(f.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-xs text-gray-500">{f.paid_date ? new Date(f.paid_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="p-3.5"><span className="uppercase text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded-md text-gray-700">{f.mode || 'cash'}</span></td>
                    <td className="p-3.5 text-right">
                      <Button size="xs" variant="ghost" onClick={() => setShowReceipt({ ...f, paid_amount: f.amount })}>Receipt</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: PENDING & OVERDUE */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Pending' },
                { id: 'overdue', label: '🔴 Overdue Only' },
                { id: 'week', label: '🍊 Due This Week' },
                { id: 'month', label: '📅 Due This Month' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setPendingFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${pendingFilter === f.id ? 'bg-[#1E3A8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="success" icon={MessageSquare} onClick={handleBulkReminders}>
                Bulk Send Reminders (Overdue)
              </Button>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Batch</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Amount Due</th>
                    <th className="p-3.5">Days Overdue</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPendingList.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">No matching pending installments.</td></tr>
                  ) : filteredPendingList.map(i => {
                    const rem = (i.amount || 0) - (i.paid_amount || 0)
                    const dueDateObj = i.due_date ? new Date(i.due_date) : null
                    const daysOverdue = dueDateObj && dueDateObj < now ? Math.floor((now - dueDateObj) / (1000 * 60 * 60 * 24)) : 0

                    return (
                      <tr key={i.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-gray-900">{i.students?.name || '—'}</td>
                        <td className="p-3.5 text-xs text-gray-600">{i.students?.batches?.name || '—'}</td>
                        <td className="p-3.5 text-xs font-medium">{i.due_date ? new Date(i.due_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="p-3.5 font-extrabold text-red-600">₹{rem.toLocaleString('en-IN')}</td>
                        <td className="p-3.5">
                          {daysOverdue > 0 ? <span className="font-bold text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-md">{daysOverdue} Days</span> : <span className="text-xs text-gray-400">Upcoming</span>}
                        </td>
                        <td className="p-3.5"><StatusBadge status={daysOverdue > 0 ? 'overdue' : i.status} /></td>
                        <td className="p-3.5 text-right space-x-1.5">
                          <Button size="xs" variant="success" onClick={() => { setSelectedInstallment(i); setShowCollect(true) }}>Collect</Button>
                          <Button size="xs" variant="ghost" icon={Send} onClick={() => handleSendSingleReminder(i)} title="Send Reminder" />
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

      {/* TAB 3: PARTIAL PAYMENTS */}
      {activeTab === 'partial' && (
        <Card>
          <CardHeader><CardTitle>Partially Paid Installments</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                  <th className="p-3.5">Student</th>
                  <th className="p-3.5">Installment</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Amount Paid</th>
                  <th className="p-3.5">Remaining Due</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {installments.filter(i => i.status === 'partial').length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No partial payments active.</td></tr>
                ) : installments.filter(i => i.status === 'partial').map(i => {
                  const rem = (i.amount || 0) - (i.paid_amount || 0)
                  return (
                    <tr key={i.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-gray-900">{i.students?.name}</td>
                      <td className="p-3.5 text-xs text-gray-600">Installment #{i.installment_number}</td>
                      <td className="p-3.5 font-semibold text-gray-900">₹{(i.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 font-semibold text-green-600">₹{(i.paid_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 font-extrabold text-orange-600">₹{rem.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-right">
                        <Button size="xs" variant="success" onClick={() => { setSelectedInstallment(i); setShowCollect(true) }}>Collect Remaining</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: REPORTS & ANALYTICS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Report 1: Collection Report */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Collection Report</h3>
                <p className="text-xs text-gray-500">Filter collected fees by custom date range</p>
              </div>
              <div className="flex items-center gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs" />
                <span className="text-xs text-gray-400">to</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs" />
                {isAdmin && <Button size="sm" variant="outline" icon={Upload} onClick={exportCollectionReportCSV} className="bg-white">Export CSV</Button>}
              </div>
            </div>
            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs font-bold text-[#1E3A8A] flex items-center justify-between">
              <span>Total Fee Collected in Period:</span>
              <span className="text-base text-green-700 font-extrabold">₹{fees.filter(f => f.paid_date >= startDate && f.paid_date <= endDate).reduce((sum, f) => sum + (Number(f.amount) || 0), 0).toLocaleString('en-IN')}</span>
            </div>
          </Card>

          {/* Report 2: Outstanding Report */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Outstanding Dues Report</h3>
                <p className="text-xs text-gray-500">List of all active students with pending balance</p>
              </div>
              {isAdmin && <Button size="sm" variant="outline" icon={Upload} onClick={exportOutstandingReportCSV} className="bg-white">Export CSV</Button>}
            </div>
          </Card>

          {/* Report 3: 12-Month Collection Chart */}
          <Card className="p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">12-Month Fee Collection Trend</h3>
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData12m}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Collected']} />
                  <Bar dataKey="amount" fill="#22C55E" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
      </>
    )}

      {/* Collect Modal */}
      {showCollect && (
        <FeeCollect
          installment={selectedInstallment}
          onClose={() => setShowCollect(false)}
          onSaved={() => { setShowCollect(false); fetchMasterFeeData() }}
        />
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <FeeReceipt
          installment={showReceipt}
          onClose={() => setShowReceipt(null)}
        />
      )}
    </div>
  )
}
