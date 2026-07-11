import { useState, useEffect } from 'react'
import { CalendarCheck, Check, X, Clock, Save, AlertTriangle, CheckCircle2, User, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { sendWhatsAppMessage, buildMessage } from '../../lib/wati'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { GridCardSkeleton } from '../../components/ui/Skeleton'

export default function AttendanceMark() {
  const { profile } = useAuth()
  const toast = useToast()
  const instituteId = profile?.institute_id

  const [batches, setBatches] = useState([])
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [classEvent, setClassEvent] = useState(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState('')
  const [isExisting, setIsExisting] = useState(false)

  useEffect(() => {
    if (instituteId) fetchBatches()
  }, [instituteId])

  useEffect(() => {
    if (selectedBatch && selectedDate && instituteId) {
      fetchStudentsAttendanceAndEvents()
    }
  }, [selectedBatch, selectedDate, instituteId])

  const fetchBatches = async () => {
    const isStaff = profile?.role === 'staff'
    const query = supabase.from('batches').select('id, name, courses(name)').eq('institute_id', instituteId)
    if (isStaff) {
      query.eq('teacher_id', profile.id)
    }
    const { data } = await query.order('name')
    setBatches(data || [])
    if (data && data.length > 0 && !selectedBatch) {
      setSelectedBatch(data[0].id)
    }
  }

  const fetchStudentsAttendanceAndEvents = async () => {
    setLoading(true)
    setSavedSuccessMsg('')
    try {
      const [studRes, attRes, eventRes] = await Promise.all([
        supabase.from('students').select('id, name, student_code, phone, parent_name, parent_phone, photo_url').eq('batch_id', selectedBatch).eq('status', 'active').order('name'),
        supabase.from('attendance').select('student_id, status').eq('institute_id', instituteId).eq('date', selectedDate),
        supabase.from('class_events').select('*').eq('batch_id', selectedBatch).eq('event_date', selectedDate)
      ])

      const studList = studRes.data || []
      setStudents(studList)

      const existingAtts = attRes.data || []
      const evts = eventRes.data || []
      const cancelled = evts.find(e => e.event_type === 'cancelled')
      const extra = evts.find(e => e.event_type === 'extra')

      if (cancelled) setClassEvent(cancelled)
      else if (extra) setClassEvent(extra)
      else setClassEvent(null)

      const initialMap = {}
      if (existingAtts.length > 0) {
        setIsExisting(true)
        existingAtts.forEach(a => {
          initialMap[a.student_id] = a.status
        })
      } else {
        setIsExisting(false)
        // Default present unless cancelled class event
        studList.forEach(s => {
          initialMap[s.id] = cancelled ? 'holiday' : 'present'
        })
      }
      setAttendance(initialMap)
    } catch (err) {
      console.error('Fetch attendance details error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }))
  }

  const handleMarkAll = (status) => {
    const updated = {}
    students.forEach(s => { updated[s.id] = status })
    setAttendance(updated)
  }

  const handleSave = async () => {
    if (!selectedBatch || !selectedDate) return
    setSaving(true)
    setSavedSuccessMsg('')

    try {
      const payload = students.map(s => ({
        institute_id: instituteId,
        student_id: s.id,
        batch_id: selectedBatch,
        date: selectedDate,
        status: attendance[s.id] || 'present',
        marked_by: profile.id
      }))

      const { error: upsertErr } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'student_id,date' })

      if (upsertErr) throw upsertErr

      // Auto WhatsApp alerts to parents of absent students
      const absentStudents = students.filter(s => attendance[s.id] === 'absent')
      let whatsappCount = 0

      for (const s of absentStudents) {
        const recipient = s.parent_phone || s.phone
        if (recipient) {
          const formattedDate = new Date(selectedDate).toLocaleDateString('en-IN')
          const batchName = batches.find(b => b.id === selectedBatch)?.name || 'Batch'
          const instName = profile?.institutes?.name || 'CoachPro'
          const msg = `🔴 Absent Alert\nDear ${s.parent_name || s.name}, ${s.name} was marked ABSENT today (${formattedDate}) in ${batchName}.\nPlease inform us of the reason.\n— ${instName}`
          await sendWhatsAppMessage(recipient, msg)
          whatsappCount++
        }
      }

      setSavedSuccessMsg(`Attendance saved for ${students.length} students! ${whatsappCount > 0 ? `(${whatsappCount} WhatsApp absent alerts sent)` : ''}`)
      setIsExisting(true)
    } catch (err) {
      toast.error(`Failed to save attendance: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const activeBatchObj = batches.find(b => b.id === selectedBatch)

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mark Class Attendance</h1>
        <p className="text-sm text-gray-500">Record daily student attendance and dispatch automated absentee alerts</p>
      </div>

      {/* Step 1 & Step 2 Selection Card */}
      <Card className="p-5 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Step 1: Select Batch *"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            options={batches.map(b => ({ value: b.id, label: `${b.name} (${b.courses?.name || 'Course'})` }))}
          />
          <Input
            label="Step 2: Select Date *"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Class Event Detector Warnings */}
        {classEvent && (
          <div className={`mt-4 p-4 rounded-2xl border flex items-center justify-between text-xs sm:text-sm ${classEvent.event_type === 'cancelled' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-purple-50 border-purple-200 text-purple-900'}`}>
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className={classEvent.event_type === 'cancelled' ? 'text-red-600' : 'text-purple-600'} />
              <span>
                <strong>{classEvent.event_type === 'cancelled' ? '⚠️ Class Cancelled Today:' : '📚 Extra Class Scheduled Today:'}</strong>{' '}
                {classEvent.notes || classEvent.subject || 'Event recorded'}
              </span>
            </div>
            {classEvent.event_type === 'cancelled' && (
              <Button size="xs" variant="warning" onClick={() => handleMarkAll('holiday')}>
                Mark All Holiday
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Step 3: Student Roster */}
      {loading ? (
        <GridCardSkeleton count={3} />
      ) : !selectedBatch ? (
        <Card className="text-center py-12 text-gray-400">Select a batch above to load student roster.</Card>
      ) : students.length === 0 ? (
        <Card className="text-center py-12 text-gray-400">No active students enrolled in this batch.</Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              Step 3: Student Roster ({students.length})
              {isExisting && <Badge variant="success" className="text-xs">Saved Data Loaded</Badge>}
            </h3>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="outline" onClick={() => handleMarkAll('present')} className="bg-white">
                ✅ Mark All Present
              </Button>
            </div>
          </div>

          {savedSuccessMsg && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-600" />
              <span>{savedSuccessMsg}</span>
            </div>
          )}

          {/* Mobile Friendly Roster List */}
          <div className="space-y-3">
            {students.map(s => {
              const currentStatus = attendance[s.id] || 'present'
              return (
                <Card key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-200 hover:border-gray-300 transition-all bg-white">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 text-[#1E3A8A] font-bold text-base flex items-center justify-center overflow-hidden border border-blue-200 flex-shrink-0">
                      {s.photo_url ? <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" /> : s.name[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base leading-tight">{s.name}</h4>
                      <p className="text-xs font-mono text-gray-400 mt-0.5">{s.student_code} · 📞 {s.phone || '—'}</p>
                    </div>
                  </div>

                  {/* Large Toggle Buttons */}
                  <div className="grid grid-cols-3 sm:flex items-center gap-2">
                    <button
                      onClick={() => handleStatusChange(s.id, 'present')}
                      className={`px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 min-h-[48px] ${currentStatus === 'present' ? 'bg-green-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <span>🟢</span> Present
                    </button>
                    <button
                      onClick={() => handleStatusChange(s.id, 'absent')}
                      className={`px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 min-h-[48px] ${currentStatus === 'absent' ? 'bg-red-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <span>🔴</span> Absent
                    </button>
                    <button
                      onClick={() => handleStatusChange(s.id, 'late')}
                      className={`px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 min-h-[48px] ${currentStatus === 'late' ? 'bg-yellow-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <span>🟡</span> Late
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Desktop & Sticky Mobile Save Bar */}
          <div className="fixed bottom-0 left-0 right-0 sm:static bg-white/90 backdrop-blur-md sm:bg-transparent p-4 sm:p-0 border-t sm:border-t-0 border-gray-200 z-30 flex justify-end">
            <Button variant="accent" size="lg" loading={saving} icon={Save} onClick={handleSave} className="w-full sm:w-auto shadow-xl">
              {isExisting ? 'Update Attendance' : 'Save Attendance'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
