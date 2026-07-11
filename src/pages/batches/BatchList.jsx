import { useState, useEffect } from 'react'
import { Plus, Layers, Edit2, Trash2, Users, Calendar, Clock, UserCheck, CheckCircle2, XCircle, AlertCircle, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { GridCardSkeleton } from '../../components/ui/Skeleton'

export default function BatchList() {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id

  const [batches, setBatches] = useState([])
  const [courses, setCourses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)

  // Form Modal state
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '', course_id: '', timing: '', start_date: '', end_date: '', capacity: '', teacher_id: '', weekdays: []
  })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')

  // Batch Detail Drawer/Modal state
  const [selectedBatchModal, setSelectedBatchModal] = useState(null)
  const [batchStudents, setBatchStudents] = useState([])
  const [batchAttStats, setBatchAttStats] = useState({ total: 0, pct: 0 })
  const [todayStatus, setTodayStatus] = useState('scheduled') // scheduled | cancelled | extra
  const [modalLoading, setModalLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingClass, setCancellingClass] = useState(false)

  useEffect(() => {
    if (instituteId) fetchAll()
  }, [instituteId])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const isStaff = profile?.role === 'staff'
      const batchQuery = supabase.from('batches').select('*, courses(name), users(name)').eq('institute_id', instituteId).order('created_at', { ascending: false })
      if (isStaff) {
        batchQuery.eq('teacher_id', profile.id)
      }

      const [batchRes, courseRes, teacherRes, studRes] = await Promise.all([
        batchQuery,
        supabase.from('courses').select('id, name').eq('institute_id', instituteId).order('name'),
        supabase.from('users').select('id, name').eq('institute_id', instituteId),
        supabase.from('students').select('id, batch_id').eq('institute_id', instituteId).eq('status', 'active')
      ])

      const rawBatches = batchRes.data || []
      const activeStudents = studRes.data || []

      const studCountMap = {}
      activeStudents.forEach(s => {
        studCountMap[s.batch_id] = (studCountMap[s.batch_id] || 0) + 1
      })

      const nowStr = new Date().toISOString().split('T')[0]

      const formatted = rawBatches.map(b => {
        let status = 'active'
        if (b.start_date && b.start_date > nowStr) status = 'upcoming'
        else if (b.end_date && b.end_date < nowStr) status = 'ended'

        return {
          ...b,
          studentCount: studCountMap[b.id] || 0,
          computedStatus: status
        }
      })

      setBatches(formatted)
      setCourses(courseRes.data || [])
      setTeachers(teacherRes.data || [])
    } catch (err) {
      console.error('Fetch batches error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenForm = async (batch = null) => {
    if (batch) {
      setEditing(batch)
      // Fetch associated weekdays for this batch
      let existingDays = []
      try {
        const { data: scheduleData } = await supabase
          .from('class_schedule')
          .select('day_of_week')
          .eq('batch_id', batch.id)
        if (scheduleData) {
          existingDays = scheduleData.map(s => s.day_of_week)
        }
      } catch (err) {
        console.warn('Failed to load batch schedule days:', err)
      }

      setForm({
        name: batch.name || '',
        course_id: batch.course_id || '',
        timing: batch.timing || '',
        start_date: batch.start_date || '',
        end_date: batch.end_date || '',
        capacity: batch.capacity || '',
        teacher_id: batch.teacher_id || '',
        weekdays: existingDays
      })
    } else {
      setEditing(null)
      setForm({
        name: '', course_id: courses[0]?.id || '', timing: '', start_date: new Date().toISOString().split('T')[0], end_date: '', capacity: '30', teacher_id: '', weekdays: []
      })
    }
    setError('')
    setShowForm(true)
  }

  const handleDelete = async (batch, e) => {
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete batch "${batch.name}"?`)) return
    try {
      await supabase.from('batches').delete().eq('id', batch.id)
      fetchAll()
    } catch (err) {
      alert(`Failed to delete batch: ${err.message}`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.course_id || !form.timing.trim() || !form.start_date) {
      setError('Please fill in all required fields.')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      const payload = {
        institute_id: instituteId,
        name: form.name.trim(),
        course_id: form.course_id,
        timing: form.timing.trim(),
        start_date: form.start_date,
        end_date: form.end_date || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        teacher_id: form.teacher_id || null,
      }

      let savedBatchId = editing?.id

      if (editing) {
        const { error: err } = await supabase.from('batches').update(payload).eq('id', editing.id)
        if (err) throw err

        // Remove old class schedule days for this batch before rewriting
        await supabase.from('class_schedule').delete().eq('batch_id', editing.id)
      } else {
        const { data: newBatch, error: err } = await supabase.from('batches').insert(payload).select('id').single()
        if (err) throw err
        savedBatchId = newBatch.id
      }

      // Automatically generate/reflect in class_schedule if weekdays are selected
      if (form.weekdays && form.weekdays.length > 0 && savedBatchId) {
        // Parse start and end times from timing string (e.g. '7:00 AM - 9:00 AM' or '14:00 - 16:00')
        let startTime = '10:00:00'
        let endTime = '11:30:00'
        
        try {
          const parts = form.timing.split('-')
          if (parts.length === 2) {
            const formatTime = (timeStr) => {
              const cleaned = timeStr.trim().toUpperCase()
              const isPM = cleaned.includes('PM')
              const isAM = cleaned.includes('AM')
              let [hoursStr, minutesStr] = cleaned.replace(/[AM|PM]/g, '').trim().split(':')
              let hours = parseInt(hoursStr, 10)
              let minutes = minutesStr ? parseInt(minutesStr, 10) : 0
              if (isPM && hours < 12) hours += 12
              if (isAM && hours === 12) hours = 0
              return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
            }
            startTime = formatTime(parts[0])
            endTime = formatTime(parts[1])
          }
        } catch (parseErr) {
          console.warn('Could not parse class timing string, using fallback times:', parseErr)
        }

        const schedulePayload = form.weekdays.map(day => ({
          institute_id: instituteId,
          batch_id: savedBatchId,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          teacher_id: form.teacher_id || null,
          subject: 'Batch Class',
          is_active: true
        }))

        const { error: schedErr } = await supabase.from('class_schedule').insert(schedulePayload)
        if (schedErr) throw schedErr
      }

      setShowForm(false)
      fetchAll()
    } catch (err) {
      setError(err.message || 'Failed to save batch.')
    } finally {
      setFormLoading(false)
    }
  }

  // Handle batch card click -> Open Detail Modal
  const handleCardClick = async (batch) => {
    setSelectedBatchModal(batch)
    setModalLoading(true)
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const [studRes, attRes, eventRes] = await Promise.all([
        supabase.from('students').select('id, name, phone, photo_url, status').eq('batch_id', batch.id),
        supabase.from('attendance').select('status').eq('institute_id', instituteId).eq('date', todayStr),
        supabase.from('class_events').select('*').eq('batch_id', batch.id).eq('event_date', todayStr)
      ])

      setBatchStudents(studRes.data || [])
      
      const atts = attRes.data || []
      const present = atts.filter(a => a.status === 'present' || a.status === 'late').length
      const pct = atts.length > 0 ? Math.round((present / atts.length) * 100) : 0
      setBatchAttStats({ total: atts.length, pct })

      const todayEvts = eventRes.data || []
      const cancelled = todayEvts.find(e => e.event_type === 'cancelled')
      const extra = todayEvts.find(e => e.event_type === 'extra')

      if (cancelled) setTodayStatus('cancelled')
      else if (extra) setTodayStatus('extra')
      else setTodayStatus('scheduled')

    } catch (err) {
      console.error('Fetch batch details error:', err)
    } finally {
      setModalLoading(false)
    }
  }

  // Handle class cancellation execution
  const handleCancelClassSubmit = async (e) => {
    e.preventDefault()
    if (!cancelReason.trim()) {
      alert('Please enter a cancellation reason.')
      return
    }

    setCancellingClass(true)
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const { error: insertErr } = await supabase.from('class_events').insert({
        institute_id: instituteId,
        batch_id: selectedBatchModal.id,
        event_date: todayStr,
        event_type: 'cancelled',
        notes: cancelReason.trim(),
        title: 'Class Cancelled'
      })

      if (insertErr) throw insertErr

      setTodayStatus('cancelled')
      setShowCancelModal(false)
      setCancelReason('')
      alert('Class has been successfully cancelled and logged!')
    } catch (err) {
      alert(`Failed to cancel class: ${err.message}`)
    } finally {
      setCancellingClass(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        <Link
          to="/courses"
          className="pb-3 px-5 text-sm font-bold border-b-2 border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200 transition-all"
        >
          Courses
        </Link>
        <Link
          to="/batches"
          className="pb-3 px-5 text-sm font-bold border-b-2 border-[#1E3A8A] text-[#1E3A8A]"
        >
          Batches
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batches Management</h1>
          <p className="text-sm text-gray-500">Organize class schedules, assigned faculty, and capacity limits</p>
        </div>
        {profile?.role !== 'staff' && (
          <Button variant="accent" icon={Plus} onClick={() => handleOpenForm()} className="shadow-md">
            Add Batch
          </Button>
        )}
      </div>

      {loading ? (
        <GridCardSkeleton count={3} />
      ) : batches.length === 0 ? (
        <Card className="text-center py-12">
          <Layers size={48} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">No batches configured</h3>
          <p className="text-sm text-gray-500 mb-4">Create a batch under your courses to start scheduling classes.</p>
          <Button variant="accent" icon={Plus} onClick={() => handleOpenForm()}>
            Add Batch Now →
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {batches.map((b) => {
            const statusColor = b.computedStatus === 'active' 
              ? 'bg-green-100 text-green-700 border-green-200' 
              : b.computedStatus === 'upcoming' 
              ? 'bg-blue-100 text-blue-700 border-blue-200' 
              : 'bg-gray-100 text-gray-600 border-gray-200'

            return (
              <Card
                key={b.id}
                onClick={() => handleCardClick(b)}
                className="p-5 flex flex-col justify-between hover:shadow-xl transition-all cursor-pointer border border-gray-200 bg-white group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border mb-1.5 ${statusColor}`}>
                        {b.computedStatus}
                      </span>
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#1E3A8A] transition-colors">{b.name}</h3>
                      <p className="text-xs font-semibold text-[#F97316]">{b.courses?.name || 'Course'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center flex-shrink-0 border border-orange-100">
                      <Layers size={18} />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3.5 space-y-2 text-xs border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><Clock size={14} className="text-[#1E3A8A]" /> Timing</span>
                      <span className="font-bold text-gray-900">{b.timing}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><Calendar size={14} className="text-gray-400" /> Start-End</span>
                      <span className="font-medium text-gray-700">
                        {b.start_date ? new Date(b.start_date).toLocaleDateString('en-IN') : '—'} 
                        {b.end_date ? ` to ${new Date(b.end_date).toLocaleDateString('en-IN')}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><UserCheck size={14} className="text-purple-600" /> Teacher</span>
                      <span className="font-semibold text-gray-800">{b.users?.name || 'Unassigned'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-gray-500 font-medium">Students Enrolled</span>
                    <span className="font-extrabold text-sm text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-lg">
                      {b.studentCount} / {b.capacity || '∞'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  <span className="flex items-center gap-1 text-[#1E3A8A] font-bold group-hover:underline"><Eye size={14} /> View Roster</span>
                  {profile?.role !== 'staff' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenForm(b) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                        title="Edit Batch"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(b, e)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        title="Delete Batch"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add / Edit Batch Modal */}
      {showForm && (
        <Modal
          isOpen={true}
          onClose={() => setShowForm(false)}
          title={editing ? 'Edit Batch' : 'Create New Batch'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={formLoading}>Cancel</Button>
              <Button loading={formLoading} onClick={handleSubmit}>
                {editing ? 'Update Batch' : 'Create Batch'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Batch Name *"
              placeholder="e.g. Morning 8:00 AM Batch"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Select
              label="Course *"
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              options={courses.map(c => ({ value: c.id, label: c.name }))}
              required
            />
            <Input
              label="Timing (e.g. 7:00 AM - 9:00 AM) *"
              placeholder="e.g. 7:00 AM - 9:00 AM"
              value={form.timing}
              onChange={(e) => setForm({ ...form, timing: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date *"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
              <Input
                label="End Date (optional)"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Capacity (Max Students)"
                type="number"
                placeholder="e.g. 30"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
              <Select
                label="Assign Teacher"
                value={form.teacher_id}
                onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...teachers.map(t => ({ value: t.id, label: t.name }))
                ]}
              />
            </div>

            {/* Days of Week Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700">Days of Week (Class Schedule)</label>
              <div className="grid grid-cols-7 gap-1">
                {[
                  { id: 1, label: 'Mon' },
                  { id: 2, label: 'Tue' },
                  { id: 3, label: 'Wed' },
                  { id: 4, label: 'Thu' },
                  { id: 5, label: 'Fri' },
                  { id: 6, label: 'Sat' },
                  { id: 0, label: 'Sun' }
                ].map(day => {
                  const isChecked = form.weekdays?.includes(day.id)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => {
                        const next = isChecked
                          ? form.weekdays.filter(d => d !== day.id)
                          : [...(form.weekdays || []), day.id]
                        setForm({ ...form, weekdays: next })
                      }}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${isChecked ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-medium">
                {error}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Batch Detail Drawer Modal */}
      {selectedBatchModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBatchModal(null)}
          title={`Batch Overview: ${selectedBatchModal.name}`}
          size="lg"
          footer={
            <div className="flex justify-between items-center w-full">
              {todayStatus !== 'cancelled' ? (
                <Button variant="danger" icon={XCircle} onClick={() => setShowCancelModal(true)}>
                  Cancel Today's Class
                </Button>
              ) : (
                <span className="text-xs text-red-500 font-bold bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                  Class Cancelled for Today
                </span>
              )}
              <Button variant="ghost" onClick={() => setSelectedBatchModal(null)}>Close</Button>
            </div>
          }
        >
          {modalLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="h-16 bg-gray-100/60 rounded-2xl animate-pulse" />
                <div className="h-16 bg-gray-100/60 rounded-2xl animate-pulse" />
                <div className="h-16 bg-gray-100/60 rounded-2xl animate-pulse" />
              </div>
              <div className="h-44 bg-gray-100/60 rounded-2xl animate-pulse" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Banner stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Enrolled</p>
                  <p className="text-xl font-extrabold text-[#1E3A8A]">{batchStudents.length} Students</p>
                </div>
                <div className="bg-green-50 border border-green-100 p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Today's Attendance</p>
                  <p className="text-xl font-extrabold text-green-700">{batchAttStats.pct}%</p>
                </div>
                <div className={`p-3 rounded-2xl border ${todayStatus === 'cancelled' ? 'bg-red-50 border-red-200 text-red-800' : todayStatus === 'extra' ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                  <p className="text-[10px] uppercase font-bold opacity-70">Class Today</p>
                  <p className="text-base font-extrabold capitalize">{todayStatus}</p>
                </div>
              </div>

              {/* Roster Table */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                  <Users size={16} className="text-[#1E3A8A]" /> Batch Student Roster ({batchStudents.length})
                </h3>
                {batchStudents.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-2xl">No students assigned to this batch yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto border border-gray-200 rounded-2xl bg-white">
                    {batchStudents.map(s => (
                      <div key={s.id} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-[#1E3A8A] font-bold text-xs flex items-center justify-center overflow-hidden">
                            {s.photo_url ? <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" /> : s.name[0]}
                          </div>
                          <span className="font-bold text-gray-900">{s.name}</span>
                        </div>
                        <span className="text-gray-500">{s.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Class Cancellation Reason Dialog Modal */}
      {showCancelModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCancelModal(false)}
          title="Cancel Today's Class"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowCancelModal(false)} disabled={cancellingClass}>Go Back</Button>
              <Button variant="danger" loading={cancellingClass} onClick={handleCancelClassSubmit}>
                Confirm Cancellation
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-150 p-4 rounded-2xl flex gap-3 text-red-800 text-xs">
              <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
              <div>
                <p className="font-bold mb-1">Class Cancellation Notice</p>
                <p>This action will mark today's class session for batch <strong>{selectedBatchModal?.name}</strong> as cancelled. Please specify a reason below so parents/students stay informed.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700">Reason for Cancellation *</label>
              <textarea
                placeholder="e.g. Teacher is unwell / Public holiday announcement / Maintenance work"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full h-24 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-xs"
                required
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
