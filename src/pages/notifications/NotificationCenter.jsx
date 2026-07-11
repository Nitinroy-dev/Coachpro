import { useState, useEffect, useRef } from 'react'
import { Bell, Send, Filter, Search, User, Layers, Info, Calendar, Download, Trash2, ShieldAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { sendWhatsAppMessage } from '../../lib/wati'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'

export default function NotificationCenter() {
  const { profile, institute } = useAuth()
  const toast = useToast()
  const instituteId = profile?.institute_id

  // Data states
  const [notifications, setNotifications] = useState([])
  const [students, setStudents] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Send message form states
  const [target, setTarget] = useState('individual') // individual | batch | all
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [messageType, setMessageType] = useState('announcement')
  const [messageText, setMessageText] = useState('')

  // Search state for student selection
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)

  // Filter logs states
  const [typeFilter, setTypeFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [activeTab, setActiveTab] = useState('logs') // logs | automation

  // Reference for clicking outside dropdown
  const dropdownRef = useRef(null)

  // Default Template Definitions
  const templates = {
    fee_due: "🎓 *[Institute Name]*\n\nDear [Student Name],\n\nThis is a reminder that your fee payment is due soon. Please clear outstanding balance of ₹[Amount] as soon as possible.\n\n_CoachPro - Management_",
    absent: "⚠️ *[Institute Name]*\n\nDear [Parent Name],\n\nYour ward [Student Name] was marked absent from batch [Batch Name] today ([Date]). Please contact us to share the reason.\n\n_CoachPro - Management_",
    class_cancelled: "❌ *[Institute Name]*\n\nDear [Student Name],\n\nThis is to inform you that class for batch [Batch Name] scheduled on [Date] has been cancelled due to unforeseen circumstances.\n\n_CoachPro - Management_",
    extra_class: "📚 *[Institute Name]*\n\nDear [Student Name],\n\nAn extra class has been scheduled for your batch [Batch Name] on [Date] at [Time]. Please be present on time.\n\n_CoachPro - Management_",
    exam: "📝 *[Institute Name]*\n\nDear [Student Name],\n\nAn exam on [Subject] is scheduled for batch [Batch Name] on [Date]. Total Marks: [Marks]. Study hard! 🍀\n\n_CoachPro - Management_",
    announcement: "📢 *[Institute Name]*\n\nDear students,\n\nWe have an announcement: [Type announcement details here].\n\n_CoachPro - Management_",
    custom: "Dear [Student Name],\n\n[Write your custom message here]\n\n_CoachPro - Management_"
  }

  useEffect(() => {
    if (instituteId) {
      fetchNotifications()
      fetchDropdownData()
    }
  }, [instituteId])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowStudentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, students(name, phone, student_code)')
        .eq('institute_id', instituteId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Fetch notifications error:', err)
      toast.error('Failed to load notification history.')
    } finally {
      setLoading(false)
    }
  }

  const fetchDropdownData = async () => {
    try {
      const [studRes, batchRes] = await Promise.all([
        supabase.from('students').select('id, name, phone, parent_name, parent_phone, student_code, batch_id, batches(name)').eq('institute_id', instituteId).eq('status', 'active'),
        supabase.from('batches').select('id, name').eq('institute_id', instituteId).order('name')
      ])
      setStudents(studRes.data || [])
      setBatches(batchRes.data || [])
    } catch (err) {
      console.error('Fetch dropdown data error:', err)
    }
  }

  // Pre-fill templates with smart replacements
  const handleSelectTemplate = (type) => {
    setMessageType(type)
    const instName = institute?.name || 'CoachPro'
    let rawTemplate = templates[type] || templates.announcement

    // Replace basic placeholders
    rawTemplate = rawTemplate.replace(/\[Institute Name\]/g, instName)
    rawTemplate = rawTemplate.replace(/\[Date\]/g, new Date().toLocaleDateString('en-IN'))

    if (target === 'individual' && selectedStudentId) {
      const sObj = students.find(s => s.id === selectedStudentId)
      if (sObj) {
        rawTemplate = rawTemplate.replace(/\[Student Name\]/g, sObj.name)
        rawTemplate = rawTemplate.replace(/\[Parent Name\]/g, sObj.parent_name || 'Parent')
        rawTemplate = rawTemplate.replace(/\[Batch Name\]/g, sObj.batches?.name || 'Your Batch')
      }
    }

    setMessageText(rawTemplate)
  }

  const handleStudentSelect = (stud) => {
    setSelectedStudentId(stud.id)
    setStudentSearchInput(stud.name)
    setShowStudentDropdown(false)

    // Re-fill active template with this student's variables
    let rawTemplate = templates[messageType] || templates.announcement
    rawTemplate = rawTemplate.replace(/\[Institute Name\]/g, institute?.name || 'CoachPro')
    rawTemplate = rawTemplate.replace(/\[Date\]/g, new Date().toLocaleDateString('en-IN'))
    rawTemplate = rawTemplate.replace(/\[Student Name\]/g, stud.name)
    rawTemplate = rawTemplate.replace(/\[Parent Name\]/g, stud.parent_name || 'Parent')
    rawTemplate = rawTemplate.replace(/\[Batch Name\]/g, stud.batches?.name || 'Your Batch')
    setMessageText(rawTemplate)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!messageText.trim()) {
      toast.error('Please enter a message.')
      return
    }

    let targetStudents = []

    if (target === 'individual') {
      const sObj = students.find(s => s.id === selectedStudentId)
      if (!sObj) {
        toast.error('Please select a student.')
        return
      }
      targetStudents = [sObj]
    } else if (target === 'batch') {
      if (!selectedBatchId) {
        toast.error('Please select a batch.')
        return
      }
      targetStudents = students.filter(s => s.batch_id === selectedBatchId)
      if (targetStudents.length === 0) {
        toast.warning('No students in this batch.')
        return
      }
    } else {
      targetStudents = students
      if (targetStudents.length === 0) {
        toast.warning('No students registered in directory.')
        return
      }
    }

    setActionLoading(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const s of targetStudents) {
        const phone = s.phone || s.parent_phone
        if (!phone) {
          failCount++
          continue
        }

        // Custom replacements per recipient if not target=individual (where replacements were done inline)
        let formattedMsg = messageText
        if (target !== 'individual') {
          formattedMsg = formattedMsg.replace(/\[Student Name\]/g, s.name)
          formattedMsg = formattedMsg.replace(/\[Parent Name\]/g, s.parent_name || 'Parent')
          formattedMsg = formattedMsg.replace(/\[Batch Name\]/g, s.batches?.name || 'Your Batch')
        }

        // Try to send WhatsApp if configured
        const phone = s.phone || s.parent_phone
        let waStatus = 'pending' // default: in-app only
        if (phone) {
          const response = await sendWhatsAppMessage(phone, formattedMsg)
          if (response.success) {
            waStatus = 'delivered'
            successCount++
          } else if (response.error !== 'Wati API not configured') {
            // Real failure (configured but failed)
            failCount++
          }
          // If Wati not configured → waStatus stays 'pending' (in-app)
        }

        // Always log to notifications table — students receive in-app via Realtime
        await supabase.from('notifications').insert({
          institute_id: instituteId,
          student_id: s.id,
          type: messageType === 'custom' ? 'announcement' : messageType,
          message: formattedMsg,
          status: waStatus,
          sent_at: new Date().toISOString()
        })
      }

      const totalSent = targetStudents.length
      if (successCount > 0) {
        toast.success(`✅ ${successCount} WhatsApp alerts sent. ${totalSent - successCount > 0 ? `${totalSent - successCount} saved as in-app notifications.` : ''}`)
      } else {
        toast.success(`🔔 Notification dispatched to ${totalSent} student${totalSent > 1 ? 's' : ''} via in-app (WhatsApp not configured).`)
      }
      if (failCount > 0) {
        toast.error(`Failed to dispatch ${failCount} WhatsApp alerts.`)
      }

      // Reset send states
      setSelectedStudentId('')
      setStudentSearchInput('')
      setSelectedBatchId('')
      setMessageText('')
      
      // Refresh log
      fetchNotifications()
    } catch (err) {
      console.error('Send notifications error:', err)
      toast.error('An error occurred while dispatching alerts.')
    } finally {
      setActionLoading(false)
    }
  }

  // Filters & CSV Export
  const filteredNotifications = notifications.filter(n => {
    const matchType = !typeFilter || n.type === typeFilter
    const createdDate = n.created_at ? n.created_at.split('T')[0] : ''
    const matchStart = !startDateFilter || createdDate >= startDateFilter
    const matchEnd = !endDateFilter || createdDate <= endDateFilter
    
    // Automation tab filters out non-auto messages, Log tab shows standard logs
    const isAuto = n.message?.includes('[Auto-Reminder]') || n.message?.startsWith('🚨') || n.message?.startsWith('⚠️')
    if (activeTab === 'automation') return matchType && matchStart && matchEnd && isAuto
    return matchType && matchStart && matchEnd
  })

  const exportCSV = () => {
    const headers = ['Recipient Code', 'Recipient Name', 'Phone', 'Alert Type', 'Message Preview', 'Status', 'Dispatched At']
    const rows = filteredNotifications.map(n => [
      n.students?.student_code || 'N/A',
      `"${n.students?.name || 'All Students'}"`,
      n.students?.phone || '—',
      (n.type || 'announcement').toUpperCase(),
      `"${(n.message || '').replace(/"/g, '""').substring(0, 100)}..."`,
      (n.status || 'pending').toUpperCase(),
      n.sent_at ? `="${new Date(n.sent_at).toLocaleString('en-IN')}"` : '""'
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Notification_Logs_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Dispatched logs CSV downloaded.')
  }

  // Filter students for search bar dropdown
  const filteredSearchStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) ||
    s.student_code.toLowerCase().includes(studentSearchInput.toLowerCase())
  )

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to permanently clear the notifications dispatch logs?')) return
    try {
      const { error } = await supabase.from('notifications').delete().eq('institute_id', instituteId)
      if (error) throw error
      toast.success('Successfully cleared history.')
      fetchNotifications()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
          <p className="text-sm text-gray-500">Dispatch broadcast messages, WhatsApp alerts, and check live delivery status logs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Send Message */}
        <Card className="lg:col-span-2 p-5 h-fit">
          <CardHeader className="p-0 pb-4 border-b border-gray-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Send size={18} className="text-[#1E3A8A]" /> Broadcast New Alert
            </CardTitle>
            <Badge variant="primary">WhatsApp Enabled</Badge>
          </CardHeader>

          <form onSubmit={handleSend} className="space-y-4 pt-4">
            {/* Target Select */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Target Audience *"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value)
                  setSelectedStudentId('')
                  setStudentSearchInput('')
                  setSelectedBatchId('')
                }}
                options={[
                  { value: 'individual', label: 'Single Student' },
                  { value: 'batch', label: 'Specific Batch' },
                  { value: 'all', label: 'All Students' },
                ]}
              />

              {/* Conditional targets */}
              {target === 'individual' && (
                <div className="relative sm:col-span-2" ref={dropdownRef}>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Search Recipient *</label>
                  <div className="relative">
                    <Input
                      placeholder="Type student name or ID..."
                      value={studentSearchInput}
                      onChange={(e) => {
                        setStudentSearchInput(e.target.value)
                        setShowStudentDropdown(true)
                      }}
                      onFocus={() => setShowStudentDropdown(true)}
                      icon={Search}
                      className="text-sm"
                    />
                  </div>

                  {showStudentDropdown && studentSearchInput.trim() && (
                    <div className="absolute left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 z-50 shadow-lg">
                      {filteredSearchStudents.length === 0 ? (
                        <p className="p-3 text-xs text-gray-400 text-center">No students found</p>
                      ) : (
                        filteredSearchStudents.map(s => (
                          <div
                            key={s.id}
                            onClick={() => handleStudentSelect(s)}
                            className="p-3 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-all text-xs"
                          >
                            <div>
                              <p className="font-bold text-gray-900">{s.name}</p>
                              <p className="text-[10px] text-gray-400">{s.batches?.name || 'Unassigned'} · {s.student_code}</p>
                            </div>
                            <span className="text-[10px] text-gray-500">{s.phone}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {target === 'batch' && (
                <div className="sm:col-span-2">
                  <Select
                    label="Select Target Batch *"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    options={[
                      { value: '', label: 'Select Batch...' },
                      ...batches.map(b => ({ value: b.id, label: b.name }))
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Template Selector Quick buttons */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700">Quick Template Select</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'fee_due', label: '💸 Fee Reminder' },
                  { id: 'absent', label: '🚨 Absent Alert' },
                  { id: 'class_cancelled', label: '❌ Class Cancel' },
                  { id: 'extra_class', label: '📚 Extra Class' },
                  { id: 'exam', label: '📝 Exam Notice' },
                  { id: 'announcement', label: '📢 Notice Board' },
                  { id: 'custom', label: '✏️ Custom message' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTemplate(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${messageType === t.id ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">Message Text *</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full h-44 p-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent text-sm leading-relaxed"
                placeholder="Type your message here. For broadcast target, placeholder variables like [Student Name] will be auto-replaced for each recipient."
              />
              <p className="text-[10px] text-gray-400">Variables available: `[Student Name]`, `[Parent Name]`, `[Batch Name]`, `[Date]`</p>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={actionLoading} icon={Send} disabled={actionLoading} className="shadow-md">
                Dispatch Alerts
              </Button>
            </div>
          </form>
        </Card>

        {/* Right Info: Alert Automation Info */}
        <Card className="p-5 h-fit bg-gradient-to-br from-indigo-900 to-[#1E3A8A] text-white border-0 shadow-xl">
          <CardHeader className="p-0 pb-4 border-b border-white/10 flex items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Calendar size={18} className="text-[#F97316]" /> Automated Reminders
            </CardTitle>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">Active</span>
          </CardHeader>

          <div className="pt-4 space-y-4 text-xs font-medium text-blue-100/90 leading-relaxed">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
              <p className="font-bold text-white text-sm">📅 Daily Scheduler Log</p>
              <p>Daily auto-alerts run at 9:00 AM IST. Next run scheduled tomorrow morning.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-lg bg-[#F97316]/20 text-[#F97316] font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <div>
                  <p className="font-bold text-white">Fee Due Alerts (3 days before)</p>
                  <p className="text-[11px] opacity-80">Reminds students with open installments coming due in exactly 3 days.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-lg bg-red-500/20 text-red-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">0</span>
                <div>
                  <p className="font-bold text-white">Due Date Notice (On the day)</p>
                  <p className="text-[11px] opacity-80">Sends payment prompt on the exact day fee installment is due.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-lg bg-red-700/20 text-red-200 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3+</span>
                <div>
                  <p className="font-bold text-white">Overdue Escalation (3 days after)</p>
                  <p className="text-[11px] opacity-80">Flags unpaid installments 3 days past due and prompts late fee.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-lg bg-[#22C55E]/20 text-green-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">Ex</span>
                <div>
                  <p className="font-bold text-white">Exam Alerts (1 day before)</p>
                  <p className="text-[11px] opacity-80">Auto broadcasts notice to entire batch one day before scheduled exams.</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Lower Section: Tabs, Filters, and Table Log */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-3 px-2 text-sm font-extrabold transition-all border-b-2 ${activeTab === 'logs' ? 'border-[#1E3A8A] text-[#1E3A8A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Broadcast Logs ({filteredNotifications.length})
            </button>
            <button
              onClick={() => setActiveTab('automation')}
              className={`pb-3 px-2 text-sm font-extrabold transition-all border-b-2 ${activeTab === 'automation' ? 'border-[#1E3A8A] text-[#1E3A8A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Automation Logs
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" icon={Trash2} onClick={clearLogs} className="text-red-600 hover:text-red-700 bg-white">Clear History</Button>
            <Button size="xs" variant="outline" icon={Download} onClick={exportCSV} className="bg-white" disabled={filteredNotifications.length === 0}>Export CSV</Button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4 border-b border-gray-50 text-xs">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: '', label: 'All Alert Types' },
              { value: 'fee_due', label: 'Fee Due' },
              { value: 'fee_paid', label: 'Fee Payment Received' },
              { value: 'absent', label: 'Absent Alerts' },
              { value: 'extra_class', label: 'Extra Class Alerts' },
              { value: 'class_cancelled', label: 'Cancelled Class Notice' },
              { value: 'exam', label: 'Exams/Notice' },
              { value: 'holiday', label: 'Holiday Announcements' },
              { value: 'announcement', label: 'General Announcement' },
            ]}
          />
          <Input
            type="date"
            label="Start Date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
          />
          <Input
            type="date"
            label="End Date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
          />
        </div>

        {/* Log table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-100">
                <th className="p-3">Recipient</th>
                <th className="p-3">Type</th>
                <th className="p-3">Message Text</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col gap-2 items-center justify-center text-gray-400">
                      <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
                      Loading logs...
                    </div>
                  </td>
                </tr>
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">
                    <Bell size={24} className="mx-auto mb-2 text-gray-300" />
                    No communication history matching selected criteria.
                  </td>
                </tr>
              ) : (
                filteredNotifications.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50/50 transition-all">
                    <td className="p-3">
                      <p className="font-bold text-gray-900">{n.students?.name || 'All Students'}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{n.students?.student_code || 'Broadcast'}</p>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={n.type || 'announcement'} />
                    </td>
                    <td className="p-3 max-w-sm">
                      <p className="font-medium text-gray-700 leading-normal line-clamp-2" title={n.message}>{n.message}</p>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={n.status === 'delivered' || n.status === 'sent' ? 'success' : n.status === 'failed' ? 'error' : 'warning'}
                        dot
                      >
                        {n.status === 'delivered' ? 'Delivered' : n.status === 'failed' ? 'Failed' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-500 font-semibold">
                      {n.sent_at ? new Date(n.sent_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
