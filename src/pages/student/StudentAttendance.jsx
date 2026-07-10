import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import { TableRowSkeleton } from '../../components/ui/Skeleton'
import { CalendarCheck, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

export default function StudentAttendance() {
  const { profile } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [studentRecord, setStudentRecord] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    fetchStudentAttendance()
  }, [])

  const fetchStudentAttendance = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load student directory record
      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('email', user.email)
        .maybeSingle()

      if (sErr) throw sErr
      if (!sData) {
        setLoading(false)
        return
      }

      setStudentRecord(sData)

      // Fetch attendance history
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', sData.id)
        .order('date', { ascending: false })

      if (attErr) throw attErr
      setAttendance(attData || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load attendance calendar.')
    } finally {
      setLoading(false)
    }
  }

  // Monthly calendar calculation helpers
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayIndex = getFirstDayOfMonth(year, month)

  const calendarCells = []
  // Empty slots before 1st of month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null)
  }
  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(new Date(year, month, i))
  }

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1))
  }

  // Calculate statistics
  const totalClasses = attendance.length
  const presentCount = attendance.filter(a => a.status === 'present').length
  const lateCount = attendance.filter(a => a.status === 'late').length
  const absentCount = attendance.filter(a => a.status === 'absent').length
  const effectiveDays = presentCount + lateCount + absentCount
  const rate = effectiveDays > 0 ? Math.round(((presentCount + lateCount) / effectiveDays) * 100) : 100

  const statusMeta = {
    present: { label: 'Present', color: 'bg-green-500 text-white border-green-600', dot: '🟢' },
    absent: { label: 'Absent', color: 'bg-red-500 text-white border-red-600', dot: '🔴' },
    late: { label: 'Late', color: 'bg-yellow-500 text-gray-900 border-yellow-600', dot: '🟡' },
    holiday: { label: 'Holiday', color: 'bg-indigo-500 text-white border-indigo-600', dot: '⚫' }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 bg-gray-100/60 rounded-2xl animate-pulse" />
        <TableRowSkeleton rows={5} />
      </div>
    )
  }

  if (!studentRecord) {
    return (
      <Card className="p-8 text-center text-gray-400">
        <AlertTriangle className="mx-auto mb-2 text-amber-500" size={32} />
        <p className="font-bold">No linked student directory record.</p>
        <p className="text-xs mt-1">Please ask your administrator to link your email profile.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Attendance Calendar</h1>
        <p className="text-sm text-gray-500">Track your daily presence rates, check marked statuses, and review holidays</p>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3.5 text-center bg-green-50 border border-green-100">
          <p className="text-[10px] uppercase font-bold text-green-700">Attendance Rate</p>
          <p className="text-2xl font-extrabold text-green-700 mt-0.5">{rate}%</p>
        </Card>
        <Card className="p-3.5 text-center bg-blue-50 border border-blue-100">
          <p className="text-[10px] uppercase font-bold text-blue-700">Days Present</p>
          <p className="text-2xl font-extrabold text-blue-700 mt-0.5">{presentCount}</p>
        </Card>
        <Card className="p-3.5 text-center bg-yellow-50 border border-yellow-100">
          <p className="text-[10px] uppercase font-bold text-yellow-700">Days Late</p>
          <p className="text-2xl font-extrabold text-yellow-600 mt-0.5">{lateCount}</p>
        </Card>
        <Card className="p-3.5 text-center bg-red-50 border border-red-100">
          <p className="text-[10px] uppercase font-bold text-red-600">Days Absent</p>
          <p className="text-2xl font-extrabold text-red-600 mt-0.5">{absentCount}</p>
        </Card>
        <Card className="p-3.5 text-center bg-gray-50 border border-gray-200 md:col-span-1 col-span-2">
          <p className="text-[10px] uppercase font-bold text-gray-500">Total Enrolled Days</p>
          <p className="text-2xl font-extrabold text-gray-800 mt-0.5">{totalClasses}</p>
        </Card>
      </div>

      {/* Monthly Interactive Calendar */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4 border-b border-gray-100 flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck size={18} className="text-[#1E3A8A]" />
            {currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg hover:bg-white text-gray-600 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg hover:bg-white text-gray-600 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </CardHeader>

        {/* Calendar Grid wrapper */}
        <div className="overflow-x-auto pt-4">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 text-center font-bold text-xs text-gray-400 uppercase border-b border-gray-50 pb-2 mb-2">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((dateObj, idx) => {
                if (!dateObj) return <div key={idx} className="h-20 bg-gray-50/20 rounded-xl border border-transparent" />
                
                const dateStr = dateObj.toISOString().split('T')[0]
                const matchAtt = attendance.find(a => a.date === dateStr)
                const isToday = dateStr === new Date().toISOString().split('T')[0]

                return (
                  <div
                    key={idx}
                    className={`h-20 p-2 rounded-2xl border transition-all flex flex-col justify-between ${isToday ? 'border-orange-500 shadow-2xs' : 'border-gray-200'} ${matchAtt ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <span className={`text-xs font-bold ${isToday ? 'text-orange-600' : 'text-gray-400'}`}>{dateObj.getDate()}</span>
                    {matchAtt ? (
                      <span className={`text-[10px] font-extrabold uppercase py-0.5 px-2 rounded-lg text-center ${statusMeta[matchAtt.status]?.color}`}>
                        {matchAtt.status}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300 italic text-center">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 pt-5 mt-4 border-t border-gray-100 text-xs font-bold text-gray-600">
          <span className="flex items-center gap-1.5">🟢 Present</span>
          <span className="flex items-center gap-1.5">🔴 Absent</span>
          <span className="flex items-center gap-1.5">🟡 Late</span>
          <span className="flex items-center gap-1.5">⚫ Holiday</span>
        </div>
      </Card>
    </div>
  )
}
