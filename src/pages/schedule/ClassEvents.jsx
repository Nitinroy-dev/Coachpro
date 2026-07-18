import { useState, useEffect } from 'react'
import { Plus, Calendar, Bell, Send, Megaphone, Clock, Calendar as CalendarIcon, CheckCircle2, AlertCircle, XCircle, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { sendWhatsAppMessage } from '../../lib/wati'
import Button from '../../components/ui/Button'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import ClassEventCreateModal from './ClassEventCreateModal'
import { GridCardSkeleton } from '../../components/ui/Skeleton'

const typeBadgeColors = {
  cancelled: 'bg-red-500 text-white',
  extra: 'bg-green-500 text-white',
  exam: 'bg-blue-500 text-white',
  rescheduled: 'bg-yellow-500 text-white',
  holiday: 'bg-purple-500 text-white',
  announcement: 'bg-indigo-500 text-white',
}

export default function ClassEvents() {
  const { profile, isAdmin } = useAuth()
  const instituteId = profile?.institute_id
  const instName = profile?.institutes?.name || 'CoachPro'
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterTab, setFilterTab] = useState('upcoming') // today | upcoming | past | all
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Cancel event state
  const [cancelTarget, setCancelTarget] = useState(null) // the event object to cancel
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [sendCancelWA, setSendCancelWA] = useState(true)

  useEffect(() => {
    if (instituteId) fetchEvents()
  }, [instituteId])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('class_events')
        .select('*, batches(name)')
        .eq('institute_id', instituteId)
        .order('event_date', { ascending: false })
      setEvents(data || [])
    } catch (err) {
      console.error('Fetch events error:', err)
    } finally {
      setLoading(false)
    }
  }

  const todayStr = new Date().toISOString().split('T')[0]

  const filteredEvents = events.filter(e => {
    const d = e.event_date
    if (filterTab === 'today') return d === todayStr
    if (filterTab === 'upcoming') return d >= todayStr
    if (filterTab === 'past') return d < todayStr
    return true
  })

  // ─── Cancel Event Logic ─────────────────────────────────────────────────────
  const handleCancelEvent = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    try {
      const evt = cancelTarget
      const reason = cancelReason.trim() || 'Event cancelled by admin'

      // 1. Mark the event as cancelled in DB (update event_type to 'cancelled' and store cancel reason in notes)
      const { error: updateErr } = await supabase
        .from('class_events')
        .update({
          event_type: 'cancelled',
          notes: `[CANCELLED] ${reason}`,
        })
        .eq('id', evt.id)

      if (updateErr) throw updateErr

      // 2. Fetch all students who belong to this event's batch (or all batches if batch_id is null)
      let targetStudents = []
      if (evt.batch_id) {
        const { data: bStuds } = await supabase
          .from('students')
          .select('id, name, phone, parent_phone')
          .eq('batch_id', evt.batch_id)
          .eq('status', 'active')
        targetStudents = bStuds || []
      } else {
        const { data: allStuds } = await supabase
          .from('students')
          .select('id, name, phone, parent_phone')
          .eq('institute_id', instituteId)
          .eq('status', 'active')
        targetStudents = allStuds || []
      }

      // 3. Build cancellation notification message
      const batchLabel = evt.batches?.name || 'All Batches'
      const eventDateLabel = evt.event_date ? new Date(evt.event_date).toLocaleDateString('en-IN') : 'the scheduled date'
      const cancellationMsg = `🚫 Event Cancelled: "${evt.subject || 'Event'}" for ${batchLabel} on ${eventDateLabel} has been CANCELLED by the institute. Reason: ${reason}`

      // 4. Insert in-app cancellation notifications for all target students
      if (targetStudents.length > 0) {
        const notifRows = targetStudents.map(s => ({
          institute_id: instituteId,
          student_id: s.id,
          type: 'class_cancelled',
          message: cancellationMsg,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }))
        await supabase.from('notifications').insert(notifRows)
      }

      // 5. Also notify the teacher of this batch if available
      if (evt.batch_id) {
        const { data: batchData } = await supabase
          .from('batches')
          .select('teacher_id, name')
          .eq('id', evt.batch_id)
          .single()

        if (batchData?.teacher_id) {
          const teacherMsg = `[Teacher] Dear Teacher, the event "${evt.subject || 'Event'}" for your batch (${batchData.name}) on ${eventDateLabel} has been CANCELLED by admin. Reason: ${reason}`
          await supabase.from('notifications').insert([{
            institute_id: instituteId,
            student_id: null,
            type: 'class_cancelled',
            message: `[Teacher:${batchData.teacher_id}] ${teacherMsg}`,
            status: 'sent',
            sent_at: new Date().toISOString(),
          }])
        }
      }

      // 6. Send WhatsApp broadcast if enabled
      if (sendCancelWA && targetStudents.length > 0) {
        const waMsg = `❌ *${instName}*\n\n🚫 *Event Cancelled*\n\nDear Parent,\n\nThe event *"${evt.subject || 'Event'}"* for *${batchLabel}* scheduled on *${eventDateLabel}* has been *CANCELLED*.\n\nReason: ${reason}\n\nWe apologise for the inconvenience.\n\n_${instName} - Batch Desk_`
        for (const s of targetStudents.slice(0, 15)) {
          const phone = s.parent_phone || s.phone
          if (phone) await sendWhatsAppMessage(phone, waMsg)
        }
      }

      // 7. Refresh events list
      await fetchEvents()
      setCancelTarget(null)
      setCancelReason('')
      alert(`Event cancelled successfully. ${targetStudents.length} student(s) have been notified.`)
    } catch (err) {
      alert(`Failed to cancel event: ${err.message}`)
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Events &amp; Notices</h1>
          <p className="text-sm text-gray-500">Manage class cancellations, extra sessions, exams, holidays, and broadcasts</p>
        </div>
        {isAdmin && (
          <Button variant="accent" icon={Plus} onClick={() => setShowCreateModal(true)}>
            Create Event / Notice
          </Button>
        )}
      </div>

      {/* Top Navigation Tabs */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => navigate('/schedule')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 whitespace-nowrap">
          <Clock size={16} className="text-gray-400" /> Weekly Timetable
        </button>
        <button onClick={() => navigate('/schedule/events')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#1E3A8A] text-white shadow-md whitespace-nowrap">
          <Megaphone size={16} className="text-[#F97316]" /> Class Events &amp; Notices
        </button>
        <button onClick={() => navigate('/schedule/calendar')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 whitespace-nowrap">
          <CalendarIcon size={16} className="text-gray-400" /> Institute Calendar
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl max-w-md">
        {[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'today', label: 'Today' },
          { id: 'past', label: 'Past' },
          { id: 'all', label: 'All Events' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilterTab(t.id)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center ${filterTab === t.id ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Events Roster Grid */}
      {loading ? (
        <GridCardSkeleton count={3} />
      ) : filteredEvents.length === 0 ? (
        <Card className="text-center py-12 text-gray-400">No events found in this filter.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map(e => {
            const isCancelled = e.event_type === 'cancelled'
            const cancelledByAdmin = isCancelled && e.notes?.startsWith('[CANCELLED]')
            return (
              <Card
                key={e.id}
                className={`p-5 space-y-3 border transition-all flex flex-col justify-between shadow-2xs ${
                  cancelledByAdmin
                    ? 'border-red-200 bg-red-50/40 opacity-80'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase shadow-2xs ${typeBadgeColors[e.event_type] || 'bg-gray-800 text-white'}`}>
                      {cancelledByAdmin ? '🚫 Cancelled' : e.event_type}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      {e.event_date ? new Date(e.event_date).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-gray-900 text-base leading-snug">{e.subject}</h3>
                  <p className="text-xs text-gray-600">Target: <strong className="text-[#1E3A8A]">{e.batches?.name || 'All Batches'}</strong></p>

                  {/* Cancelled Info */}
                  {isCancelled && (
                    <p className="text-xs text-red-700 font-semibold bg-red-50 border border-red-100 rounded-lg p-2.5 leading-normal">
                      🔴 {cancelledByAdmin ? 'Cancelled by Admin' : 'Class Cancelled'}: {e.notes?.replace('[CANCELLED] ', '') || 'No reason specified'}
                    </p>
                  )}

                  {/* Extra Class Timings & Topics */}
                  {e.event_type === 'extra' && (
                    <div className="text-xs bg-green-50 border border-green-100 text-green-800 rounded-lg p-2.5 space-y-1 font-medium leading-normal">
                      <p>⏰ Time: <strong>{e.start_time ? e.start_time.slice(0, 5) : '—'} - {e.end_time ? e.end_time.slice(0, 5) : '—'}</strong></p>
                      {e.notes && <p>Topic: <strong>{e.notes}</strong></p>}
                    </div>
                  )}

                  {/* Exam syllabus & details */}
                  {e.event_type === 'exam' && (
                    <div className="text-xs bg-blue-50 border border-blue-100 text-blue-800 rounded-lg p-2.5 space-y-1.5 font-medium leading-normal">
                      <p>⏰ Time: <strong>{e.start_time ? e.start_time.slice(0, 5) : '—'} - {e.end_time ? e.end_time.slice(0, 5) : '—'}</strong></p>
                      {e.total_marks && <p>🏆 Total Marks: <strong>{e.total_marks} Marks</strong></p>}
                      {e.syllabus && <p className="text-gray-750">📖 Syllabus: {e.syllabus}</p>}
                      {e.notes && <p className="text-gray-750 opacity-90">Note: {e.notes}</p>}
                    </div>
                  )}

                  {/* Rescheduled info */}
                  {e.event_type === 'rescheduled' && (
                    <div className="text-xs bg-yellow-50 border border-yellow-100 text-yellow-850 rounded-lg p-2.5 space-y-1 font-medium leading-normal">
                      {e.new_date && <p>📅 Rescheduled Date: <strong>{new Date(e.new_date).toLocaleDateString('en-IN')}</strong></p>}
                      {e.new_time && <p>⏰ New Timing: <strong>{e.new_time}</strong></p>}
                      {e.notes && <p className="text-gray-750">Reason: {e.notes}</p>}
                    </div>
                  )}

                  {/* Holiday info */}
                  {e.event_type === 'holiday' && (
                    <div className="text-xs bg-purple-50 border border-purple-100 text-purple-800 rounded-lg p-2.5 space-y-1 font-medium leading-normal">
                      <p>🎉 Holiday: <strong>{e.subject}</strong></p>
                      {e.notes && <p className="text-gray-750">{e.notes}</p>}
                    </div>
                  )}

                  {/* Announcement notice */}
                  {e.event_type === 'announcement' && e.notes && (
                    <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100 font-medium leading-normal">
                      {e.notes}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  {cancelledByAdmin ? (
                    <span className="flex items-center gap-1 text-red-600 font-bold">
                      <XCircle size={14} /> Event Cancelled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-green-700 font-bold">
                      <CheckCircle2 size={14} /> Alert Dispatched
                    </span>
                  )}

                  {/* Admin Cancel Button — only shown for non-cancelled events */}
                  {isAdmin && !cancelledByAdmin && (
                    <button
                      onClick={() => { setCancelTarget(e); setCancelReason('') }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-[11px] font-bold transition-all"
                    >
                      <XCircle size={13} />
                      Cancel Event
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ClassEventCreateModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); fetchEvents() }}
        />
      )}

      {/* ─── Cancel Confirmation Modal ─────────────────────────────────────── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <XCircle size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-extrabold text-base">Cancel Event</h2>
                    <p className="text-red-100 text-xs">This will notify all students &amp; parents</p>
                  </div>
                </div>
                <button onClick={() => setCancelTarget(null)} className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Event Info Preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Event Being Cancelled</p>
                <p className="font-extrabold text-gray-900">{cancelTarget.subject || 'Untitled Event'}</p>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className={`px-2.5 py-0.5 rounded-lg font-bold uppercase text-[10px] ${typeBadgeColors[cancelTarget.event_type] || 'bg-gray-800 text-white'}`}>
                    {cancelTarget.event_type}
                  </span>
                  <span>📅 {cancelTarget.event_date ? new Date(cancelTarget.event_date).toLocaleDateString('en-IN') : '—'}</span>
                  <span>👥 {cancelTarget.batches?.name || 'All Batches'}</span>
                </div>
              </div>

              {/* Warning Banner */}
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-xs text-red-800 font-medium space-y-1">
                <p className="font-extrabold text-red-700 flex items-center gap-1.5">
                  <AlertCircle size={14} /> What will happen:
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-1 opacity-90">
                  <li>Event marked as <strong>CANCELLED</strong> in the system</li>
                  <li>All students of this batch get a <strong>cancellation notification</strong> in-app</li>
                  <li>Teacher gets a <strong>custom notification</strong> about the cancellation</li>
                  {sendCancelWA && <li>WhatsApp broadcast sent to all parent numbers</li>}
                </ul>
              </div>

              {/* Reason Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">Cancellation Reason <span className="text-gray-400">(optional)</span></label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Teacher is unwell, venue unavailable, sudden holiday..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              {/* WhatsApp Toggle */}
              <div className="flex items-center gap-3 bg-green-50 p-3.5 rounded-xl border border-green-200 text-xs text-green-900 font-bold">
                <input
                  type="checkbox"
                  id="send-cancel-wa"
                  checked={sendCancelWA}
                  onChange={e => setSendCancelWA(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <label htmlFor="send-cancel-wa">Also send WhatsApp broadcast to all parents? 📱</label>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-colors"
              >
                Keep Event
              </button>
              <button
                onClick={handleCancelEvent}
                disabled={cancelLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {cancelLoading ? (
                  <><Spinner size="xs" /><span>Cancelling...</span></>
                ) : (
                  <><XCircle size={16} /><span>Yes, Cancel Event</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
