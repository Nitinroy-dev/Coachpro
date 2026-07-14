import { useState, useEffect } from 'react'
import { Plus, Calendar, Bell, Send, Megaphone, Clock, Calendar as CalendarIcon, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
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
  const { profile } = useAuth()
  const instituteId = profile?.institute_id
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterTab, setFilterTab] = useState('upcoming') // today | upcoming | past | all
  const [showCreateModal, setShowCreateModal] = useState(false)

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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Events & Notices</h1>
          <p className="text-sm text-gray-500">Manage class cancellations, extra sessions, exams, holidays, and broadcasts</p>
        </div>
        <Button variant="accent" icon={Plus} onClick={() => setShowCreateModal(true)}>
          Create Event / Notice
        </Button>
      </div>

      {/* Top Navigation Tabs */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => navigate('/schedule')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 whitespace-nowrap">
          <Clock size={16} className="text-gray-400" /> Weekly Timetable
        </button>
        <button onClick={() => navigate('/schedule/events')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#1E3A8A] text-white shadow-md whitespace-nowrap">
          <Megaphone size={16} className="text-[#F97316]" /> Class Events & Notices
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
          {filteredEvents.map(e => (
            <Card key={e.id} className="p-5 space-y-3 border border-gray-200 hover:border-gray-300 transition-all bg-white flex flex-col justify-between shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase shadow-2xs ${typeBadgeColors[e.event_type] || 'bg-gray-800 text-white'}`}>
                    {e.event_type}
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-500">
                    {e.event_date ? new Date(e.event_date).toLocaleDateString('en-IN') : '—'}
                  </span>
                </div>

                <h3 className="font-extrabold text-gray-900 text-base leading-snug">{e.subject}</h3>
                <p className="text-xs text-gray-600">Target: <strong className="text-[#1E3A8A]">{e.batches?.name || 'All Batches'}</strong></p>

                {/* Cancelled Info */}
                {e.event_type === 'cancelled' && (
                  <p className="text-xs text-red-700 font-semibold bg-red-50 border border-red-100 rounded-lg p-2.5 leading-normal">
                    🔴 Class Cancelled: {e.notes || 'No reason specified'}
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

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-green-700 font-bold">
                <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Alert Dispatched</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ClassEventCreateModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); fetchEvents() }}
        />
      )}
    </div>
  )
}
