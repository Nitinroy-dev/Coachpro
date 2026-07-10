import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Download, Eye, X, Filter } from 'lucide-react'
import jsPDF from 'jspdf'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

const eventDotColors = {
  cancelled: 'bg-red-500',
  extra: 'bg-green-500',
  exam: 'bg-blue-500',
  rescheduled: 'bg-yellow-500',
  holiday: 'bg-purple-500',
  announcement: 'bg-indigo-500',
}

export default function InstituteCalendar() {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id

  const [currentDate, setCurrentDate] = useState(new Date())
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDateEvents, setSelectedDateEvents] = useState(null)

  useEffect(() => {
    if (instituteId) fetchOptions()
  }, [instituteId])

  useEffect(() => {
    if (instituteId) fetchMonthEvents()
  }, [instituteId, currentDate, selectedBatch])

  const fetchOptions = async () => {
    const { data } = await supabase.from('batches').select('id, name').eq('institute_id', instituteId).order('name')
    setBatches(data || [])
  }

  const fetchMonthEvents = async () => {
    setLoading(true)
    try {
      let query = supabase.from('class_events').select('*, batches(name)').eq('institute_id', instituteId)
      if (selectedBatch) query = query.eq('batch_id', selectedBatch)

      const { data } = await query
      setEvents(data || [])
    } catch (err) {
      console.error('Fetch calendar events error:', err)
    } finally {
      setLoading(false)
    }
  }

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const jumpToday = () => setCurrentDate(new Date())

  // Calendar calculations
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const calendarDays = []
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(year, month, d))

  const exportPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const monthStr = currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`Institute Calendar Overview — ${monthStr}`, 15, 16)

    let y = 35
    events.forEach(e => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`${e.event_date ? new Date(e.event_date).toLocaleDateString('en-IN') : '—'} [${(e.event_type || 'event').toUpperCase()}]`, 15, y)
      doc.setFont('helvetica', 'normal')
      doc.text(`${e.subject || 'Event'} — Batch: ${e.batches?.name || 'All'} (${e.notes || ''})`, 15, y + 6)
      y += 14
    })

    doc.save(`Institute_Calendar_${monthStr.replace(/[^a-z0-9]/gi, '_')}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" icon={ChevronLeft} onClick={prevMonth} className="bg-white" />
          <h2 className="font-extrabold text-gray-900 text-lg sm:text-xl min-w-[160px] text-center">
            {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h2>
          <Button variant="outline" size="sm" icon={ChevronRight} onClick={nextMonth} className="bg-white" />
          <Button variant="ghost" size="sm" onClick={jumpToday} className="text-xs font-bold text-[#1E3A8A]">Today</Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-48 sm:w-60">
            <Select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              options={[{ value: '', label: 'All Batches' }, ...batches.map(b => ({ value: b.id, label: b.name }))]}
            />
          </div>
          <Button size="sm" variant="outline" icon={Download} onClick={exportPDF} className="bg-white">
            Export PDF
          </Button>
        </div>
      </Card>

      {/* Color Dots Legend */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3.5 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-700">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Cancelled</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Extra Class</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Exam/Test</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Rescheduled</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Holiday</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Announcement</span>
      </div>

      {/* 35-Day Grid */}
      <Card className="p-4 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-7 text-center font-bold text-xs text-gray-400 uppercase border-b border-gray-100 pb-3 mb-2">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array(35).fill(0).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100/60 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((dateObj, idx) => {
                if (!dateObj) return <div key={idx} className="h-24 bg-gray-50/50 rounded-2xl border border-transparent" />
                const dateStr = dateObj.toISOString().split('T')[0]
                const dayEvts = events.filter(e => e.event_date === dateStr)
                const isToday = dateStr === new Date().toISOString().split('T')[0]

                return (
                  <div
                    key={idx}
                    onClick={() => dayEvts.length > 0 && setSelectedDateEvents({ dateStr, dayEvts })}
                    className={`h-24 p-2 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${isToday ? 'bg-blue-50/60 border-[#1E3A8A] ring-1 ring-[#1E3A8A]' : dayEvts.length > 0 ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm' : 'bg-white border-gray-100'}`}
                  >
                    <span className={`text-xs font-bold ${isToday ? 'text-[#1E3A8A] font-extrabold' : 'text-gray-700'}`}>{dateObj.getDate()}</span>

                    <div className="space-y-1 overflow-y-auto max-h-14">
                      {dayEvts.map(e => (
                        <div key={e.id} className="flex items-center gap-1.5 text-[10px] font-bold bg-gray-50 px-1.5 py-0.5 rounded-md truncate border border-gray-100">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${eventDotColors[e.event_type] || 'bg-gray-400'}`} />
                          <span className="truncate text-gray-800">{e.subject}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Event Details Popup Modal */}
      {selectedDateEvents && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDateEvents(null)}
          title={`Events on ${new Date(selectedDateEvents.dateStr).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          footer={<Button variant="ghost" onClick={() => setSelectedDateEvents(null)}>Close</Button>}
        >
          <div className="space-y-3">
            {selectedDateEvents.dayEvts.map(e => (
              <div key={e.id} className="p-4 rounded-2xl border bg-gray-50 border-gray-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-sm">{e.subject}</span>
                  <span className="uppercase text-[10px] font-extrabold px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: e.event_type === 'cancelled' ? '#EF4444' : e.event_type === 'extra' ? '#22C55E' : e.event_type === 'exam' ? '#3B82F6' : '#8B5CF6' }}>
                    {e.event_type}
                  </span>
                </div>
                <p className="text-xs text-gray-600">Batch: <strong className="text-gray-900">{e.batches?.name || 'All Batches'}</strong></p>
                {e.notes && <p className="text-xs text-gray-500 pt-1 border-t border-gray-200">{e.notes}</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
