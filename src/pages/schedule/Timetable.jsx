import { useState, useEffect } from 'react'
import { Plus, Clock, Edit2, Trash2, Copy, CalendarCheck, Calendar as CalendarIcon, Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_ORDERED = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Timetable() {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id
  const navigate = useNavigate()

  const [schedule, setSchedule] = useState([])
  const [batches, setBatches] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedBatch, setSelectedBatch] = useState('')
  const [loading, setLoading] = useState(false)

  // Mobile Active Day (1=Mon, ..., 0=Sun)
  const [mobileDay, setMobileDay] = useState(1)

  // Modals
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [sourceBatchId, setSourceBatchId] = useState('')

  // Slot Form State
  const [slotForm, setSlotForm] = useState({
    day_of_week: '1',
    start_time: '09:00',
    end_time: '10:00',
    subject: '',
    teacher_id: '',
  })

  useEffect(() => {
    if (instituteId) {
      fetchBatches()
      fetchTeachers()
    }
  }, [instituteId])

  useEffect(() => {
    if (selectedBatch) fetchSchedule()
  }, [selectedBatch])

  const fetchBatches = async () => {
    const { data } = await supabase.from('batches').select('id, name, courses(name)').eq('institute_id', instituteId).order('name')
    setBatches(data || [])
    if (data && data.length > 0 && !selectedBatch) setSelectedBatch(data[0].id)
  }

  const fetchTeachers = async () => {
    const { data } = await supabase.from('users').select('id, name').eq('institute_id', instituteId).in('role', ['admin', 'staff'])
    setTeachers(data || [])
  }

  const fetchSchedule = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('class_schedule')
        .select('*, users:teacher_id(name), batches(name)')
        .eq('batch_id', selectedBatch)
        .eq('is_active', true)
        .order('start_time')
      setSchedule(data || [])
    } catch (err) {
      console.error('Fetch schedule error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = (dayNum = 1) => {
    setEditingSlot(null)
    setSlotForm({
      day_of_week: String(dayNum),
      start_time: '09:00',
      end_time: '10:00',
      subject: '',
      teacher_id: teachers[0]?.id || '',
    })
    setShowSlotModal(true)
  }

  const handleOpenEdit = (slot) => {
    setEditingSlot(slot)
    setSlotForm({
      day_of_week: String(slot.day_of_week),
      start_time: slot.start_time?.slice(0, 5) || '09:00',
      end_time: slot.end_time?.slice(0, 5) || '10:00',
      subject: slot.subject || '',
      teacher_id: slot.teacher_id || '',
    })
    setShowSlotModal(true)
  }

  const handleSaveSlot = async (e) => {
    e.preventDefault()
    if (!slotForm.subject.trim() || !selectedBatch) return
    try {
      const payload = {
        institute_id: instituteId,
        batch_id: selectedBatch,
        day_of_week: parseInt(slotForm.day_of_week),
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
        subject: slotForm.subject.trim(),
        teacher_id: slotForm.teacher_id || null,
        is_active: true,
      }

      if (editingSlot) {
        await supabase.from('class_schedule').update(payload).eq('id', editingSlot.id)
      } else {
        await supabase.from('class_schedule').insert(payload)
      }

      setShowSlotModal(false)
      fetchSchedule()
    } catch (err) {
      alert(`Failed to save slot: ${err.message}`)
    }
  }

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to delete this class slot?')) return
    try {
      await supabase.from('class_schedule').delete().eq('id', slotId)
      fetchSchedule()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  const handleCopyTimetableSubmit = async () => {
    if (!sourceBatchId || sourceBatchId === selectedBatch) {
      alert('Select a different source batch to copy from.')
      return
    }
    try {
      const { data: sourceSlots } = await supabase
        .from('class_schedule')
        .select('*')
        .eq('batch_id', sourceBatchId)
        .eq('is_active', true)

      if (!sourceSlots || sourceSlots.length === 0) {
        alert('Source batch has no active timetable slots.')
        return
      }

      const newSlots = sourceSlots.map(s => ({
        institute_id: instituteId,
        batch_id: selectedBatch,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        subject: s.subject,
        teacher_id: s.teacher_id,
        is_active: true,
      }))

      await supabase.from('class_schedule').insert(newSlots)
      setShowCopyModal(false)
      fetchSchedule()
      alert(`Successfully copied ${newSlots.length} timetable slots!`)
    } catch (err) {
      alert(`Copy failed: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Timetable & Schedule</h1>
          <p className="text-sm text-gray-500">Configure weekly class slots, monitor daily timetables, and copy batch schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={Copy} onClick={() => setShowCopyModal(true)} className="bg-white">
            Copy Timetable
          </Button>
          <Button variant="accent" icon={Plus} onClick={() => handleOpenAdd(1)}>
            Add Class Slot
          </Button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => navigate('/schedule')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#1E3A8A] text-white shadow-md whitespace-nowrap">
          <Clock size={16} className="text-[#F97316]" /> Weekly Timetable
        </button>
        <button onClick={() => navigate('/schedule/events')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 whitespace-nowrap">
          <Megaphone size={16} className="text-gray-400" /> Class Events & Notices
        </button>
        <button onClick={() => navigate('/schedule/calendar')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 whitespace-nowrap">
          <CalendarIcon size={16} className="text-gray-400" /> Institute Calendar
        </button>
      </div>

      {/* Batch Selector Bar */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <Select
            label="Select Batch *"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            options={batches.map(b => ({ value: b.id, label: `${b.name} (${b.courses?.name || 'Course'})` }))}
          />
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-7 gap-3">
          {Array(7).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !selectedBatch ? (
        <Card className="text-center py-12 text-gray-400">Select a batch to view timetable.</Card>
      ) : (
        <>
          {/* DESKTOP 7-COLUMN GRID (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-7 gap-3">
            {DAYS_ORDERED.map((dayNum, idx) => {
              const daySlots = schedule.filter(s => s.day_of_week === dayNum)
              return (
                <div key={dayNum} className="space-y-2">
                  <div className="bg-[#1E3A8A] text-white p-2.5 rounded-xl text-center font-bold text-xs uppercase shadow-xs flex items-center justify-between">
                    <span>{DAY_LABELS[idx]}</span>
                    <button onClick={() => handleOpenAdd(dayNum)} className="hover:bg-white/20 p-0.5 rounded text-white" title="Add slot to this day">
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {daySlots.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-gray-200 text-center text-[11px] text-gray-400 bg-gray-50/50">
                        No Slots
                      </div>
                    ) : daySlots.map(s => (
                      <div key={s.id} className="p-3 bg-white border border-blue-200 rounded-2xl shadow-2xs space-y-1.5 group relative hover:border-[#1E3A8A] transition-all">
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#1E3A8A] bg-blue-50 px-2 py-0.5 rounded-md">
                          <span className="flex items-center gap-1"><Clock size={10} /> {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span>
                        </div>
                        <p className="font-bold text-gray-900 text-xs leading-tight">{s.subject === 'Batch Class' || !s.subject ? s.batches?.name : s.subject}</p>
                        <p className="text-[10px] text-gray-500 truncate">👨‍🏫 {s.users?.name || 'Unassigned'}</p>

                        <div className="pt-1 flex justify-end gap-1 border-t border-gray-100 opacity-80 group-hover:opacity-100">
                          <button onClick={() => handleOpenEdit(s)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={12} /></button>
                          <button onClick={() => handleDeleteSlot(s.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* MOBILE VIEW (One Day at a Time) */}
          <div className="block md:hidden space-y-4">
            <div className="flex justify-between bg-white p-1.5 rounded-2xl border border-gray-200 shadow-2xs overflow-x-auto">
              {DAYS_ORDERED.map((dayNum, idx) => (
                <button
                  key={dayNum}
                  onClick={() => setMobileDay(dayNum)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${mobileDay === dayNum ? 'bg-[#1E3A8A] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {DAY_LABELS[idx]}
                </button>
              ))}
            </div>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-900 text-base">{DAYS[mobileDay]} Schedule</h3>
                <Button size="xs" variant="accent" icon={Plus} onClick={() => handleOpenAdd(mobileDay)}>Add Slot</Button>
              </div>

              {schedule.filter(s => s.day_of_week === mobileDay).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">No classes scheduled for {DAYS[mobileDay]}.</div>
              ) : (
                <div className="space-y-2.5">
                  {schedule.filter(s => s.day_of_week === mobileDay).map(s => (
                    <div key={s.id} className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-[#1E3A8A] bg-white px-2 py-0.5 rounded border border-blue-100">{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span>
                        <h4 className="font-bold text-gray-900 text-sm mt-1">{s.subject === 'Batch Class' || !s.subject ? s.batches?.name : s.subject}</h4>
                        <p className="text-xs text-gray-500">Teacher: {s.users?.name || '—'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="xs" variant="ghost" icon={Edit2} onClick={() => handleOpenEdit(s)} />
                        <Button size="xs" variant="ghost" icon={Trash2} onClick={() => handleDeleteSlot(s.id)} className="text-red-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Add / Edit Slot Modal */}
      {showSlotModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowSlotModal(false)}
          title={editingSlot ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowSlotModal(false)}>Cancel</Button>
              <Button onClick={handleSaveSlot}>Save Slot</Button>
            </>
          }
        >
          <form onSubmit={handleSaveSlot} className="space-y-4">
            <Select
              label="Day of Week *"
              value={slotForm.day_of_week}
              onChange={(e) => setSlotForm({ ...slotForm, day_of_week: e.target.value })}
              options={[
                { value: '1', label: 'Monday' },
                { value: '2', label: 'Tuesday' },
                { value: '3', label: 'Wednesday' },
                { value: '4', label: 'Thursday' },
                { value: '5', label: 'Friday' },
                { value: '6', label: 'Saturday' },
                { value: '0', label: 'Sunday' },
              ]}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Start Time *" type="time" value={slotForm.start_time} onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })} required />
              <Input label="End Time *" type="time" value={slotForm.end_time} onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })} required />
            </div>
            <Input label="Subject Name *" placeholder="e.g. Physics" value={slotForm.subject} onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })} required />
            <Select
              label="Assign Teacher (Staff)"
              value={slotForm.teacher_id}
              onChange={(e) => setSlotForm({ ...slotForm, teacher_id: e.target.value })}
              options={[{ value: '', label: 'Unassigned' }, ...teachers.map(t => ({ value: t.id, label: t.name || 'Staff User' }))]}
            />
          </form>
        </Modal>
      )}

      {/* Copy Timetable Modal */}
      {showCopyModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCopyModal(false)}
          title="Copy Weekly Timetable"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowCopyModal(false)}>Cancel</Button>
              <Button variant="accent" onClick={handleCopyTimetableSubmit}>Copy Timetable</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600">
              Copy all active weekly timetable slots from another batch directly into <strong className="text-gray-900">{batches.find(b => b.id === selectedBatch)?.name}</strong>.
            </p>
            <Select
              label="Select Source Batch to Copy From *"
              value={sourceBatchId}
              onChange={(e) => setSourceBatchId(e.target.value)}
              options={[{ value: '', label: 'Select source batch...' }, ...batches.filter(b => b.id !== selectedBatch).map(b => ({ value: b.id, label: b.name }))]}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
