import { useState, useEffect } from 'react'
import { CalendarCheck, Calendar, Users, BarChart3, Upload, ArrowRight, Check, X, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { TableRowSkeleton } from '../../components/ui/Skeleton'

export default function AttendanceList() {
  const { profile } = useAuth()
  const instituteId = profile?.institute_id
  const navigate = useNavigate()

  const [activeReportTab, setActiveReportTab] = useState('batch') // batch | student | daily
  const [loading, setLoading] = useState(false)

  // Options
  const [batches, setBatches] = useState([])
  const [students, setStudents] = useState([])

  // Selection states
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedDailyDate, setSelectedDailyDate] = useState(new Date().toISOString().split('T')[0])

  // Datasets
  const [attendanceData, setAttendanceData] = useState([])

  useEffect(() => {
    if (instituteId) fetchOptions()
  }, [instituteId])

  useEffect(() => {
    if (instituteId) fetchAttendanceData()
  }, [instituteId, selectedBatch, selectedStudent, selectedDailyDate, activeReportTab])

  const fetchOptions = async () => {
    const isStaff = profile?.role === 'staff'
    const batchQuery = supabase.from('batches').select('id, name, courses(name)').eq('institute_id', instituteId)
    if (isStaff) {
      batchQuery.eq('teacher_id', profile.id)
    }

    const [bRes, sRes] = await Promise.all([
      batchQuery.order('name'),
      supabase.from('students').select('id, name, student_code, batch_id').eq('institute_id', instituteId).eq('status', 'active').order('name')
    ])
    const bList = bRes.data || []
    const sList = sRes.data || []
    setBatches(bList)
    setStudents(sList)

    if (bList.length > 0 && !selectedBatch) setSelectedBatch(bList[0].id)
    if (sList.length > 0 && !selectedStudent) setSelectedStudent(sList[0].id)
  }

  const fetchAttendanceData = async () => {
    setLoading(true)
    try {
      let query = supabase.from('attendance').select('*, students(name, student_code, phone), batches(name)').eq('institute_id', instituteId)

      if (activeReportTab === 'daily') {
        query = query.eq('date', selectedDailyDate)
      } else if (activeReportTab === 'student') {
        if (selectedStudent) query = query.eq('student_id', selectedStudent)
      } else if (activeReportTab === 'batch') {
        if (selectedBatch) query = query.eq('batch_id', selectedBatch)
      }

      const { data } = await query.order('date', { ascending: false })
      setAttendanceData(data || [])
    } catch (err) {
      console.error('Fetch attendance error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Report 3: Batch analytics processing
  const batchStudents = students.filter(s => !selectedBatch || s.batch_id === selectedBatch)
  const batchAnalytics = batchStudents.map(s => {
    const sAtts = attendanceData.filter(a => a.student_id === s.id)
    const present = sAtts.filter(a => a.status === 'present').length
    const absent = sAtts.filter(a => a.status === 'absent').length
    const late = sAtts.filter(a => a.status === 'late').length
    const holiday = sAtts.filter(a => a.status === 'holiday').length
    const effectiveDays = present + absent + late
    const attPct = effectiveDays > 0 ? Math.round(((present + late) / effectiveDays) * 100) : 100

    return { student: s, present, absent, late, holiday, totalDays: sAtts.length, attPct }
  }).sort((a, b) => a.attPct - b.attPct) // Ascending order (lowest first)

  // Report 2: Student calendar statistics
  const studAtts = attendanceData.filter(a => a.student_id === selectedStudent)
  const stPresent = studAtts.filter(a => a.status === 'present').length
  const stAbsent = studAtts.filter(a => a.status === 'absent').length
  const stLate = studAtts.filter(a => a.status === 'late').length
  const stHoliday = studAtts.filter(a => a.status === 'holiday').length
  const stEffective = stPresent + stAbsent + stLate
  const stPct = stEffective > 0 ? Math.round(((stPresent + stLate) / stEffective) * 100) : 100

  const exportBatchReportCSV = () => {
    const headers = ['Student Code', 'Student Name', 'Present', 'Absent', 'Late', 'Holiday', 'Total Days', 'Attendance %']
    const rows = batchAnalytics.map(b => [
      b.student.student_code || 'N/A',
      `"${b.student.name}"`,
      b.present,
      b.absent,
      b.late,
      b.holiday,
      b.totalDays,
      `="${b.attPct}%"`
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Batch_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Analytics Hub</h1>
          <p className="text-sm text-gray-500">Comprehensive attendance reporting, daily logs, and student calendars</p>
        </div>
        <Button variant="accent" icon={CalendarCheck} onClick={() => navigate('/attendance/mark')} className="shadow-md">
          Mark Class Attendance
        </Button>
      </div>

      {/* 3 Report Navigation Tabs */}
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'batch', label: 'Batch Performance Report', icon: Users },
          { id: 'student', label: 'Individual Student Calendar', icon: Calendar },
          { id: 'daily', label: 'Daily Roster Log', icon: CalendarCheck },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeReportTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'bg-[#1E3A8A] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              <Icon size={16} className={isActive ? 'text-[#F97316]' : 'text-gray-400'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* REPORT 3: BATCH REPORT */}
      {activeReportTab === 'batch' && (
        <div className="space-y-4">
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <Select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                options={batches.map(b => ({ value: b.id, label: `${b.name} (${b.courses?.name || 'Course'})` }))}
              />
            </div>
            <Button size="sm" variant="outline" icon={Upload} onClick={exportBatchReportCSV} className="bg-white">
              Export CSV Report
            </Button>
          </Card>

          <Card>
            <CardHeader><CardTitle>Student Attendance Ranking (Lowest % First)</CardTitle></CardHeader>
            {loading ? (
              <TableRowSkeleton rows={4} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">Present 🟢</th>
                      <th className="p-3.5">Absent 🔴</th>
                      <th className="p-3.5">Late 🟡</th>
                      <th className="p-3.5">Holiday ⚫</th>
                      <th className="p-3.5">Total Days</th>
                      <th className="p-3.5 text-right">Attendance Rate %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {batchAnalytics.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-400">No students found in this batch.</td></tr>
                    ) : batchAnalytics.map(b => {
                      const badgeColor = b.attPct < 75 
                        ? 'bg-red-100 text-red-700 border-red-200' 
                        : b.attPct < 85 
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200' 
                        : 'bg-green-100 text-green-700 border-green-200'

                      return (
                        <tr key={b.student.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="p-3.5">
                            <p className="font-bold text-gray-900">{b.student.name}</p>
                            <p className="text-[10px] font-mono text-gray-400">{b.student.student_code}</p>
                          </td>
                          <td className="p-3.5 font-bold text-green-600">{b.present}</td>
                          <td className="p-3.5 font-bold text-red-600">{b.absent}</td>
                          <td className="p-3.5 font-bold text-yellow-600">{b.late}</td>
                          <td className="p-3.5 text-gray-500">{b.holiday}</td>
                          <td className="p-3.5 font-semibold text-gray-800">{b.totalDays}</td>
                          <td className="p-3.5 text-right">
                            <span className={`inline-block px-3 py-1 rounded-xl font-extrabold text-xs border ${badgeColor}`}>
                              {b.attPct}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* REPORT 2: STUDENT CALENDAR REPORT */}
      {activeReportTab === 'student' && (
        <div className="space-y-6">
          <Card className="p-4 max-w-md">
            <Select
              label="Select Student *"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              options={students.map(s => ({ value: s.id, label: `${s.name} (${s.student_code})` }))}
            />
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-blue-50/30 border border-blue-100">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center mb-6">
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-green-600">Present 🟢</p><p className="text-xl font-bold text-green-600">{stPresent}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-red-600">Absent 🔴</p><p className="text-xl font-bold text-red-600">{stAbsent}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-yellow-600">Late 🟡</p><p className="text-xl font-bold text-yellow-600">{stLate}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-gray-500">Holiday ⚫</p><p className="text-xl font-bold text-gray-500">{stHoliday}</p></div>
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs"><p className="text-[10px] uppercase font-bold text-[#1E3A8A]">Attendance %</p><p className="text-xl font-extrabold text-[#1E3A8A]">{stPct}%</p></div>
            </div>

            <h3 className="font-bold text-gray-900 text-sm mb-3">Attendance History Log</h3>
            {loading ? (
              <TableRowSkeleton rows={3} />
            ) : studAtts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No attendance logs found for this student.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {studAtts.map(a => (
                  <div key={a.id} className={`p-3 rounded-2xl border text-center space-y-1 ${a.status === 'present' ? 'bg-green-50 border-green-200 text-green-800' : a.status === 'absent' ? 'bg-red-50 border-red-200 text-red-800' : a.status === 'late' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                    <p className="text-xs font-bold">{new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white shadow-2xs">{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* REPORT 1: DAILY ROSTER REPORT */}
      {activeReportTab === 'daily' && (
        <div className="space-y-4">
          <Card className="p-4 max-w-md">
            <Input
              label="Select Daily Date *"
              type="date"
              value={selectedDailyDate}
              onChange={(e) => setSelectedDailyDate(e.target.value)}
            />
          </Card>

          <Card>
            <CardHeader><CardTitle>Daily Roster for {new Date(selectedDailyDate).toLocaleDateString('en-IN')}</CardTitle></CardHeader>
            {loading ? (
              <TableRowSkeleton rows={4} />
            ) : attendanceData.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No attendance recorded on this date across any batch.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">Batch</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendanceData.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-gray-900">{a.students?.name || '—'}</td>
                        <td className="p-3.5 text-xs text-gray-600">{a.batches?.name || '—'}</td>
                        <td className="p-3.5"><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
