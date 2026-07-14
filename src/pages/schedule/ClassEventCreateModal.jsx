import { useState, useEffect } from 'react'
import {
  AlertCircle, Calendar, Clock, BookOpen, User, Send, Check, Sparkles, AlertTriangle,
  Megaphone, PartyPopper, RefreshCw, X, ChevronRight, MessageSquare
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sendWhatsAppMessage } from '../../lib/wati'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'

export default function ClassEventCreateModal({ onClose, onSaved }) {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id
  const instName = profile?.institutes?.name || 'CoachPro'

  const [step, setStep] = useState(1) // 1: Type & Details | 2: WhatsApp Notification Preview
  const [eventType, setEventType] = useState('cancelled') // cancelled | extra | exam | rescheduled | holiday | announcement

  const [batches, setBatches] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedBatches, setSelectedBatches] = useState([])

  // Form states
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    subject: '',
    original_time: '09:00 AM',
    reason_preset: 'Teacher unavailable',
    custom_reason: '',
    auto_holiday: true,
    start_time: '10:00 AM',
    end_time: '12:00 PM',
    teacher_id: '',
    syllabus: '',
    total_marks: '100',
    instructions: 'Please bring your hall ticket and geometry box.',
    auto_reminder: true,
    original_date: new Date().toISOString().split('T')[0],
    new_date: new Date().toISOString().split('T')[0],
    new_time: '04:00 PM',
    all_batches: true,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    holiday_name: 'Festival Holiday',
    resume_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    title: 'Important Notice',
    message: '',
  })

  // WhatsApp Message Preview State
  const [waMessage, setWaMessage] = useState('')
  const [sendWhatsApp, setSendWhatsApp] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (instituteId) fetchOptions()
  }, [instituteId])

  const fetchOptions = async () => {
    const [bRes, uRes] = await Promise.all([
      supabase.from('batches').select('id, name').eq('institute_id', instituteId).order('name'),
      supabase.from('profiles').select('id, full_name').eq('institute_id', instituteId)
    ])
    const bList = bRes.data || []
    setBatches(bList)
    if (bList.length > 0) setSelectedBatches([bList[0].id])
    setTeachers(uRes.data || [])
  }

  const toggleBatchSelect = (bId) => {
    if (selectedBatches.includes(bId)) {
      if (selectedBatches.length > 1) setSelectedBatches(selectedBatches.filter(id => id !== bId))
    } else {
      setSelectedBatches([...selectedBatches, bId])
    }
  }

  // Build template message for Step 2
  const buildTemplateMessage = () => {
    const targetBatchNames = form.all_batches ? 'All Batches' : batches.filter(b => selectedBatches.includes(b.id)).map(b => b.name).join(', ')
    
    let reasonText = form.custom_reason || ''
    if (!reasonText) {
      if (eventType === 'cancelled') reasonText = form.reason_preset
      else if (eventType === 'holiday') reasonText = form.holiday_name
      else if (eventType === 'extra') reasonText = 'General revision'
      else if (eventType === 'exam') reasonText = 'Scheduled exam'
      else if (eventType === 'rescheduled') reasonText = 'Schedule adjustment'
      else if (eventType === 'announcement') reasonText = form.title || form.subject || 'Important Notice'
    }

    if (eventType === 'cancelled') {
      return `🔴 Class Cancelled\nDear Parent,\n${targetBatchNames} ki ${form.subject || 'Class'} class ${form.date} ko ${form.original_time} pe cancel ho gayi.\nReason: ${reasonText}\n— ${instName}`
    } else if (eventType === 'extra') {
      return `🟢 Extra Class\nDear Parent,\nExtra class schedule ki gayi hai:\nBatch: ${targetBatchNames}\nDate: ${form.date}\nTime: ${form.start_time} - ${form.end_time}\nSubject: ${form.subject || 'Special Session'}\nTopic: ${reasonText}\nPlease attend 🙏\n— ${instName}`
    } else if (eventType === 'exam') {
      return `📝 Exam Notice\nDear Parent,\nStudent ka exam hai:\nBatch: ${targetBatchNames}\nDate: ${form.date}\nTime: ${form.start_time} - ${form.end_time}\nSubject: ${form.subject || 'Monthly Test'}\nSyllabus: ${form.syllabus || 'Full Unit'}\nTotal Marks: ${form.total_marks}\n${form.instructions}\nBest of luck! 🍀\n— ${instName}`
    } else if (eventType === 'rescheduled') {
      return `🔄 Class Rescheduled\nDear Parent,\n${targetBatchNames} ki ${form.subject || 'Class'} class ${form.original_date} se shift hui hai.\nNew Date: ${form.new_date}\nNew Time: ${form.new_time}\n— ${instName}`
    } else if (eventType === 'holiday') {
      return `🎉 Holiday Notice\n${form.holiday_name} ki chutti:\nFrom: ${form.start_date}\nTo: ${form.end_date}\nClasses resume: ${form.resume_date}\n— ${instName}`
    } else {
      return `📢 Announcement: ${form.title}\nDear Parent/Student,\n${form.message || 'Please check app for details.'}\n— ${instName}`
    }
  }

  const handleProceedToNotification = (e) => {
    e.preventDefault()
    setWaMessage(buildTemplateMessage())
    setStep(2)
  }

  const handleFinalSubmit = async () => {
    setLoading(true)
    try {
      const isHolidayOrAnnouncement = eventType === 'holiday' || eventType === 'announcement'
      const targetBatchId = isHolidayOrAnnouncement && form.all_batches 
        ? null 
        : (selectedBatches[0] || null)

      let reasonText = form.custom_reason || ''
      if (!reasonText) {
        if (eventType === 'cancelled') reasonText = form.reason_preset
        else if (eventType === 'holiday') reasonText = form.holiday_name
        else if (eventType === 'extra') reasonText = 'General revision'
        else if (eventType === 'exam') reasonText = 'Scheduled exam'
        else if (eventType === 'rescheduled') reasonText = 'Schedule adjustment'
        else if (eventType === 'announcement') reasonText = form.title || form.subject || 'Important Notice'
      }

      // Insert Event into class_events table
      const { data: newEvt, error: evtErr } = await supabase
        .from('class_events')
        .insert({
          institute_id: instituteId,
          batch_id: targetBatchId,
          event_type: eventType,
          event_date: eventType === 'holiday' ? form.start_date : form.date,
          subject: form.subject || form.title || form.holiday_name,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: reasonText,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (evtErr) throw evtErr

      // 1. Fetch target students to alert in-app
      let targetStudents = []
      if (targetBatchId) {
        const { data: bStuds } = await supabase
          .from('students')
          .select('id, name')
          .eq('batch_id', targetBatchId)
          .eq('status', 'active')
        targetStudents = bStuds || []
      } else {
        const { data: allStuds } = await supabase
          .from('students')
          .select('id, name')
          .eq('institute_id', instituteId)
          .eq('status', 'active')
        targetStudents = allStuds || []
      }

      // 2. Build descriptive notification message
      let notificationMsg = ''
      if (eventType === 'cancelled') {
        notificationMsg = `Class Cancelled: The scheduled class for ${form.subject || 'your course'} on ${form.date} has been cancelled. Reason: ${reasonText}`
      } else if (eventType === 'extra') {
        notificationMsg = `Extra Class: An extra class for ${form.subject || 'your course'} has been scheduled on ${form.date} from ${form.start_time || ''} to ${form.end_time || ''}. Topic: ${reasonText || 'General revision'}`
      } else if (eventType === 'rescheduled') {
        notificationMsg = `Class Rescheduled: The class for ${form.subject || 'your course'} originally scheduled on ${form.original_date || ''} has been rescheduled to ${form.new_date || ''} at ${form.new_time || ''}.`
      } else if (eventType === 'holiday') {
        notificationMsg = `Holiday Declared: ${form.holiday_name || 'Holiday'} from ${form.start_date || ''} to ${form.end_date || ''}. Resume classes on: ${form.resume_date || ''}.`
      } else if (eventType === 'exam') {
        notificationMsg = `Exam Scheduled: ${form.subject || 'your course'} test has been scheduled on ${form.date} from ${form.start_time || ''} to ${form.end_time || ''}. Syllabus: ${form.syllabus || ''}. Total Marks: ${form.total_marks || ''}.`
      } else {
        notificationMsg = `Announcement: ${form.subject || 'Notice'}. Details: ${reasonText || ''}`
      }

      // 3. Map event type to notification type
      const typeMapping = {
        cancelled: 'class_cancelled',
        extra: 'extra_class',
        rescheduled: 'rescheduled',
        holiday: 'holiday',
        exam: 'exam',
        announcement: 'announcement'
      }

      // 4. Create in-app notification records
      if (targetStudents.length > 0) {
        const notifRows = targetStudents.map(s => ({
          institute_id: instituteId,
          student_id: s.id,
          type: typeMapping[eventType] || 'announcement',
          message: notificationMsg,
          status: 'sent',
          sent_at: new Date().toISOString()
        }))
        await supabase.from('notifications').insert(notifRows)
      }

      // Auto mark holiday in attendance if cancelled class event
      if (eventType === 'cancelled' && form.auto_holiday && targetBatchId) {
        const { data: studList } = await supabase.from('students').select('id').eq('batch_id', targetBatchId).eq('status', 'active')
        if (studList && studList.length > 0) {
          const attRows = studList.map(s => ({
            institute_id: instituteId,
            student_id: s.id,
            date: form.date,
            status: 'holiday'
          }))
          await supabase.from('attendance').upsert(attRows, { onConflict: 'student_id,date' })
        }
      }

      // Dispatch WhatsApp message if enabled
      if (sendWhatsApp && waMessage) {
        const { data: studList } = await supabase.from('students').select('phone, parent_phone').eq('institute_id', instituteId).eq('status', 'active')
        let sentCount = 0
        for (const s of (studList || []).slice(0, 15)) { // Broadcast to active roster
          const phone = s.parent_phone || s.phone
          if (phone) {
            await sendWhatsAppMessage(phone, waMessage)
            sentCount++
          }
        }
      }

      alert('Class Event created and notifications dispatched successfully!')
      onSaved?.()
    } catch (err) {
      alert(`Failed to create event: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={step === 1 ? 'Create Class Event & Notice' : 'Step 2: Review & Broadcast WhatsApp Notice'}
      size="md"
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleProceedToNotification} icon={ChevronRight}>Next: Preview Notice</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>Back</Button>
            <Button variant="accent" loading={loading} icon={Send} onClick={handleFinalSubmit}>
              Publish & Broadcast Notice
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <form onSubmit={handleProceedToNotification} className="space-y-4">
          {/* Type Selector Grid */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">Select Event Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { type: 'cancelled', label: '🔴 Cancelled', bg: 'bg-red-50 text-red-700 border-red-200' },
                { type: 'extra', label: '🟢 Extra Class', bg: 'bg-green-50 text-green-700 border-green-200' },
                { type: 'exam', label: '🔵 Exam / Test', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
                { type: 'rescheduled', label: '🟡 Rescheduled', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                { type: 'holiday', label: '🎉 Holiday', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
                { type: 'announcement', label: '📢 Announcement', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              ].map(t => (
                <button
                  type="button"
                  key={t.type}
                  onClick={() => setEventType(t.type)}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-center transition-all ${eventType === t.type ? `${t.bg} ring-2 ring-offset-1 ring-current shadow-xs` : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Batch Multi-Select */}
          {eventType !== 'holiday' && eventType !== 'announcement' ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Target Batches *</label>
              <div className="flex flex-wrap gap-1.5">
                {batches.map(b => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => toggleBatchSelect(b.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${selectedBatches.includes(b.id) ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
              <label className="font-bold text-gray-700">Applies to All Batches?</label>
              <input type="checkbox" checked={form.all_batches} onChange={(e) => setForm({ ...form, all_batches: e.target.checked })} className="w-4 h-4 text-[#1E3A8A] rounded" />
            </div>
          )}

          {/* TYPE 1: CLASS CANCELLED */}
          {eventType === 'cancelled' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                <Input label="Subject Name *" placeholder="e.g. Physics" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              </div>
              <Select
                label="Reason Dropdown *"
                value={form.reason_preset}
                onChange={(e) => setForm({ ...form, reason_preset: e.target.value })}
                options={[
                  { value: 'Teacher unavailable', label: 'Teacher unavailable' },
                  { value: 'Festival / Local Holiday', label: 'Festival / Local Holiday' },
                  { value: 'Power Cut / Rain', label: 'Power Cut / Rain' },
                  { value: 'Low attendance expected', label: 'Low attendance expected' },
                  { value: 'Exam Preparation', label: 'Exam Preparation' },
                ]}
              />
              <Input label="Custom Reason / Remarks" placeholder="Additional details for parents..." value={form.custom_reason} onChange={(e) => setForm({ ...form, custom_reason: e.target.value })} />
              <div className="flex items-center gap-2 bg-red-50 p-3 rounded-xl border border-red-100 text-xs font-bold text-red-900">
                <input type="checkbox" checked={form.auto_holiday} onChange={(e) => setForm({ ...form, auto_holiday: e.target.checked })} className="w-4 h-4 text-red-600 rounded" />
                <span>Auto-mark all batch students as Holiday for this date? ✅</span>
              </div>
            </div>
          )}

          {/* TYPE 2: EXTRA CLASS */}
          {eventType === 'extra' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <Input label="Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                <Input label="Start Time *" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
                <Input label="End Time *" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
              </div>
              <Input label="Subject *" placeholder="e.g. Organic Chemistry" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              <Input label="Topic / Reason" placeholder="e.g. Backlog Revision Chapter 5" value={form.custom_reason} onChange={(e) => setForm({ ...form, custom_reason: e.target.value })} />
            </div>
          )}

          {/* TYPE 3: EXAM / TEST */}
          {eventType === 'exam' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <Input label="Exam Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                <Input label="Start Time *" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
                <Input label="End Time *" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Subject *" placeholder="e.g. Mathematics" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
                <Input label="Total Marks *" type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} required />
              </div>
              <Input label="Syllabus Covered *" placeholder="e.g. Calculus Chapter 1-4" value={form.syllabus} onChange={(e) => setForm({ ...form, syllabus: e.target.value })} required />
              <Input label="Special Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            </div>
          )}

          {/* TYPE 4: RESCHEDULED */}
          {eventType === 'rescheduled' && (
            <div className="space-y-3 pt-2">
              <Input label="Subject *" placeholder="e.g. Physics" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Original Date *" type="date" value={form.original_date} onChange={(e) => setForm({ ...form, original_date: e.target.value })} required />
                <Input label="New Date *" type="date" value={form.new_date} onChange={(e) => setForm({ ...form, new_date: e.target.value })} required />
              </div>
              <Input label="New Timing *" value={form.new_time} onChange={(e) => setForm({ ...form, new_time: e.target.value })} required />
            </div>
          )}

          {/* TYPE 5: HOLIDAY */}
          {eventType === 'holiday' && (
            <div className="space-y-3 pt-2">
              <Input label="Holiday Name *" placeholder="e.g. Diwali Vacation" value={form.holiday_name} onChange={(e) => setForm({ ...form, holiday_name: e.target.value })} required />
              <div className="grid grid-cols-3 gap-2">
                <Input label="Start Date *" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
                <Input label="End Date *" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
                <Input label="Resume Date *" type="date" value={form.resume_date} onChange={(e) => setForm({ ...form, resume_date: e.target.value })} required />
              </div>
            </div>
          )}

          {/* TYPE 6: ANNOUNCEMENT */}
          {eventType === 'announcement' && (
            <div className="space-y-3 pt-2">
              <Input label="Notice Title *" placeholder="e.g. Annual Sports Meet 2026" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Announcement Message (up to 500 chars) *</label>
                <textarea rows={4} maxLength={500} placeholder="Type announcement details here..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#1E3A8A] outline-none" />
              </div>
            </div>
          )}
        </form>
      ) : (
        /* STEP 2: NOTIFICATION PREVIEW STEP */
        <div className="space-y-4">
          <div className="bg-[#1E3A8A] text-white p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-blue-200 flex items-center gap-1.5">
                <MessageSquare size={14} /> Automated WhatsApp Template Preview
              </span>
              <Badge variant="success">Formatted</Badge>
            </div>
            <p className="text-xs text-blue-100">Review and edit the exact message string that will be dispatched to parent WhatsApp numbers:</p>
          </div>

          <textarea
            rows={6}
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 font-mono text-xs bg-gray-50 focus:ring-2 focus:ring-[#1E3A8A] outline-none"
          />

          <div className="flex items-center gap-3 bg-green-50 p-3.5 rounded-xl border border-green-200 text-xs text-green-900 font-bold">
            <input type="checkbox" checked={sendWhatsApp} onChange={(e) => setSendWhatsApp(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
            <span>Dispatch instant WhatsApp broadcast to parent numbers via Wati API? 📱</span>
          </div>
        </div>
      )}
    </Modal>
  )
}
