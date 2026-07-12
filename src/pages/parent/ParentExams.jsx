import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import { TableRowSkeleton } from '../../components/ui/Skeleton'
import { BookOpen, AlertTriangle, User, Clock } from 'lucide-react'

export default function ParentExams() {
  const { profile } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [studentRecord, setStudentRecord] = useState(null)
  const [events, setEvents] = useState([])
  const [timetable, setTimetable] = useState([])

  useEffect(() => {
    fetchChildSchedule()
  }, [])

  const fetchChildSchedule = async () => {
    setLoading(true)
    try {
      if (!profile?.linked_student_id) {
        setLoading(false)
        return
      }

      // Load the linked student record
      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('*, batches(id, name, courses(name))')
        .eq('id', profile.linked_student_id)
        .maybeSingle()

      if (sErr) throw sErr
      if (!sData) {
        setLoading(false)
        return
      }

      setStudentRecord(sData)

      // Fetch events for the student's batch
      if (sData.batch_id) {
        const { data: eventData } = await supabase
          .from('class_events')
          .select('*')
          .eq('batch_id', sData.batch_id)
          .order('event_date', { ascending: true })

        setEvents(eventData || [])

        // Fetch timetable for the student's batch
        const { data: ttData } = await supabase
          .from('timetable')
          .select('*')
          .eq('batch_id', sData.batch_id)
          .order('day_of_week', { ascending: true })

        setTimetable(ttData || [])
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load schedule information.')
    } finally {
      setLoading(false)
    }
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const eventTypeColors = {
    exam: 'bg-red-100 text-red-700 border-red-200',
    test: 'bg-orange-100 text-orange-700 border-orange-200',
    quiz: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    class: 'bg-blue-100 text-blue-700 border-blue-200',
    holiday: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    event: 'bg-purple-100 text-purple-700 border-purple-200',
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

  // Separate upcoming vs past events
  const now = new Date().toISOString().split('T')[0]
  const upcomingEvents = events.filter(e => e.event_date >= now)
  const pastEvents = events.filter(e => e.event_date < now)

  return (
    <div className="space-y-6">
      {/* Child info banner */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="w-10 h-10 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center">
          <User size={20} />
        </div>
        <div>
          <p className="font-bold text-gray-900">{studentRecord.name}'s Schedule</p>
          <p className="text-xs text-gray-500">
            {studentRecord.batches?.courses?.name && <span>{studentRecord.batches.courses.name} • </span>}
            {studentRecord.batches?.name && <span>Batch: {studentRecord.batches.name}</span>}
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timetable & Exams</h1>
        <p className="text-sm text-gray-500">View your child's class timetable, upcoming exams, and events</p>
      </div>

      {/* Weekly Timetable */}
      {timetable.length > 0 && (
        <Card className="p-5">
          <CardHeader className="p-0 pb-4 border-b border-gray-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock size={18} className="text-[#1E3A8A]" /> Weekly Timetable
            </CardTitle>
          </CardHeader>

          <div className="overflow-x-auto pt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-100">
                  <th className="p-3">Day</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">Teacher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {timetable.map((slot, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-bold text-gray-900">{dayNames[slot.day_of_week] || slot.day_of_week}</td>
                    <td className="p-3 text-gray-700 font-semibold">{slot.subject || '—'}</td>
                    <td className="p-3 text-gray-600">{slot.start_time || '—'} - {slot.end_time || '—'}</td>
                    <td className="p-3 text-gray-600">{slot.teacher_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Upcoming Events & Exams */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4 border-b border-gray-100">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen size={18} className="text-[#F97316]" /> Upcoming Events & Exams ({upcomingEvents.length})
          </CardTitle>
        </CardHeader>

        <div className="space-y-3 pt-4">
          {upcomingEvents.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No upcoming events or exams scheduled.</p>
          ) : (
            upcomingEvents.map(event => (
              <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white transition-colors">
                <div className="w-12 h-12 rounded-xl bg-[#1E3A8A] text-white flex flex-col items-center justify-center text-[10px] font-bold flex-shrink-0">
                  <span>{new Date(event.event_date).toLocaleDateString('en-IN', { day: '2-digit' })}</span>
                  <span>{new Date(event.event_date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{event.title}</p>
                  {event.description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{event.description}</p>}
                  <div className="flex gap-2 mt-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${eventTypeColors[event.event_type] || 'bg-gray-100 text-gray-600'}`}>
                      {event.event_type || 'event'}
                    </span>
                    {event.start_time && (
                      <span className="text-[10px] text-gray-400 font-semibold">
                        {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <Card className="p-5">
          <CardHeader className="p-0 pb-4 border-b border-gray-100">
            <CardTitle className="text-base flex items-center gap-2 text-gray-400">
              Past Events ({pastEvents.length})
            </CardTitle>
          </CardHeader>

          <div className="space-y-2 pt-4">
            {pastEvents.slice(0, 10).map(event => (
              <div key={event.id} className="flex items-center gap-3 p-2.5 bg-gray-50/30 rounded-xl border border-gray-100 opacity-60">
                <div className="w-10 h-10 rounded-lg bg-gray-200 text-gray-500 flex flex-col items-center justify-center text-[9px] font-bold flex-shrink-0">
                  <span>{new Date(event.event_date).toLocaleDateString('en-IN', { day: '2-digit' })}</span>
                  <span>{new Date(event.event_date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-600 text-xs">{event.title}</p>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${eventTypeColors[event.event_type] || 'bg-gray-100 text-gray-500'}`}>
                    {event.event_type || 'event'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
