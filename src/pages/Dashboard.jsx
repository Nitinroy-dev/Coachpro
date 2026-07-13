import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, CreditCard, CalendarCheck, TrendingUp,
  BookOpen, Layers, AlertCircle, Clock, Plus, Calendar,
  Activity, ArrowUpRight, CheckCircle2, XCircle, FileText, Sparkles, AlertTriangle, UserPlus
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar, LineChart, Line
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useInstitute } from '../contexts/useInstitute'
import { supabase } from '../lib/supabase'
import StatsCard from '../components/shared/StatsCard'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Badge, { StatusBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import StudentForm from './students/StudentForm'
import FeeCollect from './fees/FeeCollect'

const COLORS = ['#1E3A8A', '#F97316', '#22C55E', '#EF4444', '#EAB308', '#8B5CF6', '#06B6D4']

export default function Dashboard() {
  const { user, profile, institute } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const instituteId = profile?.institute_id
  const isStaff = profile?.role === 'staff'

  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'admin@coachpro.com'
  const isSuperAdmin = user?.email && user.email.toLowerCase() === superadminEmail.toLowerCase()

  useEffect(() => {
    if (isSuperAdmin) {
      navigate('/superadmin', { replace: true })
    }
  }, [isSuperAdmin])

  if (isSuperAdmin) {
    return null
  }

  // Student specific states
  const [studentRecord, setStudentRecord] = useState(null)
  const [studentAnnouncements, setStudentAnnouncements] = useState([])
  const [studentSchedule, setStudentSchedule] = useState([])
  const [studentPendingFeeTotal, setStudentPendingFeeTotal] = useState(0)

  // Dashboard state
  const [loading, setLoading] = useState(true)
  const [dashStats, setDashStats] = useState({
    activeStudents: 0,
    totalBatches: 0,
    monthRevenue: 0,
    pendingFees: 0,
    todayAttendancePct: 0,
    monthEnrollments: 0,
    overdueCount: 0,
    classesTodayCount: 0,
  })

  const [todayClasses, setTodayClasses] = useState([])
  const [upcomingExams, setUpcomingExams] = useState([])
  const [monthlyFeeChart, setMonthlyFeeChart] = useState([])
  const [batchDistChart, setBatchDistChart] = useState([])
  const [attendanceTrendChart, setAttendanceTrendChart] = useState([])
  const [recentActivities, setRecentActivities] = useState([])

  // Quick Action Modal states
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [showFeeModal, setShowFeeModal] = useState(false)

  useEffect(() => {
    if (profile?.role === 'student') {
      fetchStudentDashboardData()
    } else if (instituteId) {
      fetchComprehensiveDashboardData()
    }
  }, [instituteId, profile])

  const fetchStudentDashboardData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('*, batches(name, courses(name))')
        .eq('email', user.email)
        .maybeSingle()

      if (sErr) throw sErr
      if (!sData) {
        console.warn('No directory record matches student email.')
        setLoading(false)
        return
      }

      setStudentRecord(sData)
      const batchId = sData.batch_id
      const todayStr = new Date().toISOString().split('T')[0]
      const dayOfWeek = new Date().getDay()

      const [eventsRes, scheduleRes, feesRes, attRes] = await Promise.all([
        supabase
          .from('class_events')
          .select('*, batches(name)')
          .or(`batch_id.eq.${batchId},batch_id.is.null`)
          .order('event_date', { ascending: false })
          .limit(8),
        supabase
          .from('class_schedule')
          .select('*, users(name)')
          .eq('batch_id', batchId)
          .eq('day_of_week', dayOfWeek)
          .eq('is_active', true),
        supabase
          .from('fee_installments')
          .select('amount, paid_amount, status')
          .eq('student_id', sData.id),
        supabase
          .from('attendance')
          .select('status')
          .eq('student_id', sData.id)
      ])

      setStudentAnnouncements(eventsRes.data || [])
      setStudentSchedule(scheduleRes.data || [])

      const pendingTotal = (feesRes.data || [])
        .filter(i => i.status !== 'paid' && i.status !== 'waived')
        .reduce((sum, i) => sum + (Number(i.amount) - Number(i.paid_amount || 0)), 0)
      setStudentPendingFeeTotal(pendingTotal)

      const atts = attRes.data || []
      const present = atts.filter(a => a.status === 'present' || a.status === 'late').length
      const rate = atts.length > 0 ? Math.round((present / atts.length) * 100) : 100

      setDashStats({
        activeStudents: 1,
        totalBatches: 1,
        monthRevenue: 0,
        pendingFees: pendingTotal,
        todayAttendancePct: rate,
        monthEnrollments: 0,
        overdueCount: (feesRes.data || []).filter(i => i.status === 'overdue').length,
        classesTodayCount: (scheduleRes.data || []).length
      })

    } catch (err) {
      console.error('Fetch student dash error:', err)
      toast.error('Failed to load student data.')
    } finally {
      setLoading(false)
    }
  }

  const fetchComprehensiveDashboardData = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const todayStr = now.toISOString().split('T')[0]
      const dayOfWeek = now.getDay() // 0 = Sun, 1 = Mon ...
      const last30DaysStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const last6MonthsStr = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const next7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Parallel queries
      const [
        studentsRes,
        batchesRes,
        thisMonthFeesRes,
        pendingFeesRes,
        todayAttendanceRes,
        newEnrollmentsRes,
        overdueRes,
        timetableRes,
        classEventsTodayRes,
        upcomingExamsRes,
        feeHistoryRes,
        attendanceHistoryRes,
        notificationsRes
      ] = await Promise.all([
        supabase.from('students').select('id, batch_id, batches(name)').eq('institute_id', instituteId).eq('status', 'active'),
        supabase.from('batches').select('id, name').eq('institute_id', instituteId),
        supabase.from('fee_installments').select('paid_amount, paid_date').eq('institute_id', instituteId).not('paid_date', 'is', null).gte('paid_date', startOfMonth.split('T')[0]),
        supabase.from('fee_installments').select('amount, paid_amount').eq('institute_id', instituteId).in('status', ['pending', 'overdue', 'partial']),
        supabase.from('attendance').select('status').eq('institute_id', instituteId).eq('date', todayStr),
        supabase.from('students').select('id').eq('institute_id', instituteId).gte('enrolled_at', startOfMonth),
        supabase.from('fee_installments').select('id').eq('institute_id', instituteId).eq('status', 'overdue'),
        supabase.from('class_schedule').select('*, batches(name)').eq('institute_id', instituteId).eq('day_of_week', dayOfWeek).eq('is_active', true),
        supabase.from('class_events').select('*, batches(name)').eq('institute_id', instituteId).eq('event_date', todayStr),
        supabase.from('class_events').select('*, batches(name)').eq('institute_id', instituteId).eq('event_type', 'exam').gte('event_date', todayStr).lte('event_date', next7DaysStr),
        supabase.from('fee_installments').select('paid_amount, paid_date').eq('institute_id', instituteId).not('paid_date', 'is', null).gte('paid_date', last6MonthsStr),
        supabase.from('attendance').select('date, status').eq('institute_id', instituteId).gte('date', last30DaysStr),
        supabase.from('notifications').select('*, students(name)').eq('institute_id', instituteId).order('created_at', { ascending: false }).limit(10)
      ])

      const activeStudentsList = studentsRes.data || []
      const batchesList = batchesRes.data || []
      const thisMonthFeesList = thisMonthFeesRes.data || []
      const pendingFeesList = pendingFeesRes.data || []
      const todayAttendanceList = todayAttendanceRes.data || []
      const newEnrollmentsList = newEnrollmentsRes.data || []
      const overdueList = overdueRes.data || []
      const timetableList = timetableRes.data || []
      const classEventsTodayList = classEventsTodayRes.data || []
      const upcomingExamsList = upcomingExamsRes.data || []
      const feeHistoryList = feeHistoryRes.data || []
      const attendanceHistoryList = attendanceHistoryRes.data || []
      const notificationsList = notificationsRes.data || []

      // 1. Calculate Summary Cards
      const monthRevTotal = thisMonthFeesList.reduce((sum, f) => sum + (Number(f.paid_amount) || 0), 0)
      const pendingFeesTotal = pendingFeesList.reduce((sum, f) => sum + ((Number(f.amount) || 0) - (Number(f.paid_amount) || 0)), 0)
      
      const activeToday = todayAttendanceList.filter(a => a.status !== 'holiday')
      const presentToday = activeToday.filter(a => a.status === 'present' || a.status === 'late').length
      const attPctToday = activeToday.length > 0 ? Math.round((presentToday / activeToday.length) * 100) : 100

      setDashStats({
        activeStudents: activeStudentsList.length,
        totalBatches: batchesList.length,
        monthRevenue: monthRevTotal,
        pendingFees: pendingFeesTotal,
        todayAttendancePct: attPctToday,
        monthEnrollments: newEnrollmentsList.length,
        overdueCount: overdueList.length,
        classesTodayCount: timetableList.length + classEventsTodayList.filter(e => e.event_type === 'extra').length,
      })

      // 2. Process Today's Schedule & Events
      const mergedSchedule = timetableList.map(t => {
        const cancelledEvent = classEventsTodayList.find(e => e.batch_id === t.batch_id && e.event_type === 'cancelled')
        return {
          id: t.id,
          batchName: t.batches?.name || 'Batch',
          subject: t.subject || 'Regular Class',
          timing: `${t.start_time?.slice(0, 5)} - ${t.end_time?.slice(0, 5)}`,
          isCancelled: !!cancelledEvent,
          isExtra: false,
        }
      })

      classEventsTodayList.filter(e => e.event_type === 'extra').forEach(e => {
        mergedSchedule.push({
          id: e.id,
          batchName: e.batches?.name || 'Batch',
          subject: e.subject || 'Extra Class',
          timing: e.new_time || 'Extra Time',
          isCancelled: false,
          isExtra: true,
        })
      })

      setTodayClasses(mergedSchedule)
      setUpcomingExams(upcomingExamsList)

      // 3. Process Recharts Data
      // 3a. Monthly fee collection last 6 months
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const feeMonthMap = {}
      feeHistoryList.forEach(f => {
        if (!f.paid_date) return
        const d = new Date(f.paid_date)
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
        feeMonthMap[key] = (feeMonthMap[key] || 0) + (Number(f.paid_amount) || 0)
      })
      const feeChartData = Object.entries(feeMonthMap).map(([month, amount]) => ({ month, amount }))
      setMonthlyFeeChart(feeChartData.slice(-6))

      // 3b. Students per batch pie chart
      const batchDistributionMap = {}
      activeStudentsList.forEach(s => {
        const bName = s.batches?.name || 'Unassigned'
        batchDistributionMap[bName] = (batchDistributionMap[bName] || 0) + 1
      })
      const pieData = Object.entries(batchDistributionMap).map(([name, value]) => ({ name, value }))
      setBatchDistChart(pieData)

      // 3c. 30-day attendance line chart
      const attTrendMap = {}
      attendanceHistoryList.forEach(a => {
        if (a.status === 'holiday') return // Skip holiday logs in rate tracking
        if (!attTrendMap[a.date]) attTrendMap[a.date] = { date: a.date, present: 0, total: 0 }
        attTrendMap[a.date].total += 1
        if (a.status === 'present' || a.status === 'late') attTrendMap[a.date].present += 1
      })
      const lineData = Object.values(attTrendMap).map(item => ({
        date: new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        pct: item.total > 0 ? Math.round((item.present / item.total) * 100) : 100
      }))
      setAttendanceTrendChart(lineData.slice(-14)) // last 14 active days for clean rendering

      // 4. Process Activity Feed
      const activities = notificationsList.map(n => {
        const d = new Date(n.created_at || Date.now())
        const hoursAgo = Math.max(0, Math.floor((now - d) / (1000 * 60 * 60)))
        const timeAgo = hoursAgo === 0 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`
        
        return {
          id: n.id,
          text: n.message || `Notification sent for ${n.students?.name || 'Student'}`,
          timeAgo,
          type: n.type || 'announcement'
        }
      })
      setRecentActivities(activities)

    } catch (err) {
      console.error('Comprehensive dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'morning'
    if (hour < 17) return 'afternoon'
    return 'evening'
  }

  // Student view rendering logic
  if (profile?.role === 'student') {
    const typeBadgeColors = {
      cancelled: 'bg-red-500 text-white',
      extra: 'bg-green-500 text-white',
      exam: 'bg-blue-500 text-white',
      rescheduled: 'bg-yellow-500 text-white',
      holiday: 'bg-purple-500 text-white',
      announcement: 'bg-indigo-500 text-white',
    }

    return (
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome Back, {profile?.name || 'Student'} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Course: <strong className="text-gray-800">{studentRecord?.batches?.courses?.name || 'Academic Course'}</strong> · Batch: <strong className="text-[#1E3A8A]">{studentRecord?.batches?.name || 'Assigned Batch'}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl text-xs text-[#1E3A8A] font-medium">
            <Calendar size={16} className="text-[#F97316]" />
            <span>Today: <strong>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</strong></span>
          </div>
        </div>

        {/* Loading skeletons for Student Dashboard */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100/60 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !studentRecord ? (
          <Card className="p-8 text-center text-gray-400">
            <AlertTriangle className="mx-auto mb-2 text-amber-500" size={32} />
            <p className="font-bold">No linked student directory record.</p>
            <p className="text-xs mt-1">Please ask your administrator to link your email ({user?.email}) to a student profile.</p>
          </Card>
        ) : (
          <>
            {/* Student Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="My Attendance Rate"
                value={dashStats.todayAttendancePct}
                icon={CalendarCheck}
                color="success"
                suffix="%"
              />
              <StatsCard
                title="Classes Today"
                value={dashStats.classesTodayCount}
                icon={Clock}
                color="primary"
              />
              <StatsCard
                title="Pending Fees"
                value={dashStats.pendingFees}
                icon={CreditCard}
                color="error"
                prefix="₹"
              />
              <StatsCard
                title="Overdue Installments"
                value={dashStats.overdueCount}
                icon={AlertCircle}
                color="warning"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Today's schedule list */}
              <Card className="lg:col-span-2 p-5 h-fit">
                <CardHeader className="p-0 pb-4 border-b border-gray-100 flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock size={18} className="text-[#1E3A8A]" /> Today's Timetable Classes
                  </CardTitle>
                  <Badge variant="primary">{studentSchedule.length} Sessions</Badge>
                </CardHeader>

                <div className="pt-4 space-y-3">
                  {studentSchedule.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">No classes scheduled for today.</p>
                  ) : (
                    studentSchedule.map(slot => (
                      <div key={slot.id} className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs sm:text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1E3A8A] font-bold flex items-center justify-center">
                            {slot.subject ? slot.subject[0].toUpperCase() : 'C'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{slot.subject || 'Regular Class'}</p>
                            <p className="text-[10px] text-gray-400">Teacher: {slot.users?.name || 'Faculty'}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-gray-800 bg-white border px-3 py-1 rounded-full shadow-2xs">
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Direct dues pay shortcut card */}
              <Card className="p-5 h-fit bg-gradient-to-br from-indigo-900 to-blue-950 border-0 text-white shadow-xl">
                <CardHeader className="p-0 pb-3 border-b border-white/10 flex items-center justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Sparkles size={16} className="text-[#F97316]" /> Online Dues
                  </CardTitle>
                </CardHeader>
                <div className="pt-4 space-y-4 text-xs font-semibold leading-relaxed">
                  <p className="opacity-90">Avoid late penalty fees by clearing outstanding student dues instantly.</p>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[10px] text-blue-200 uppercase font-bold">Outstanding Balance</p>
                    <p className="text-2xl font-extrabold text-white">₹{studentPendingFeeTotal.toLocaleString('en-IN')}</p>
                  </div>
                  <Button
                    variant="accent"
                    fullWidth
                    onClick={() => navigate('/student/fees')}
                    icon={ArrowUpRight}
                    className="shadow-md"
                  >
                    View & Pay Online
                  </Button>
                </div>
              </Card>
            </div>

            {/* Announcement Board Feed */}
            <Card className="p-5">
              <CardHeader className="p-0 pb-4 border-b border-gray-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell size={18} className="text-[#F97316]" /> Institute Notice Board & Announcements
                </CardTitle>
              </CardHeader>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentAnnouncements.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center col-span-2">No active announcements posted on the notices board.</p>
                ) : (
                  studentAnnouncements.map(ann => (
                    <div key={ann.id} className="p-4 border border-gray-200/80 rounded-2xl space-y-2 bg-white flex flex-col justify-between hover:border-gray-300 transition-colors text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase shadow-2xs ${typeBadgeColors[ann.event_type] || 'bg-gray-800 text-white'}`}>
                            {ann.event_type}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-gray-400">
                            {ann.event_date ? new Date(ann.event_date).toLocaleDateString('en-IN') : '—'}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-sm leading-snug">{ann.subject}</h4>
                        {ann.notes && <p className="text-gray-600 leading-normal font-medium mt-1">{ann.notes}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {getGreeting()}, {isStaff ? `Teacher ${profile?.name?.split(' ')[0] || ''}` : (profile?.name?.split(' ')[0] || 'Admin')} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's the real-time performance overview for <strong className="text-gray-800">{institute?.name || 'your Institute'}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl text-xs text-[#1E3A8A] font-medium">
          <Calendar size={16} className="text-[#F97316]" />
          <span>Today: <strong>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className={`grid grid-cols-2 sm:grid-cols-${isStaff ? '2' : '6'} gap-3`}>
        {!isStaff && (
          <Button
            size="lg"
            icon={Layers}
            fullWidth
            className="shadow-md py-3.5 text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white border-0 transition-all hover:scale-[1.02] duration-200"
            onClick={() => navigate('/courses')}
          >
            Add Batches/Courses
          </Button>
        )}
        {!isStaff && (
          <Button
            variant="primary"
            size="lg"
            icon={UserPlus}
            fullWidth
            className="shadow-md py-3.5 text-xs sm:text-sm"
            onClick={() => setShowStudentModal(true)}
          >
            Add Student
          </Button>
        )}
        {!isStaff && (
          <Button
            variant="success"
            size="lg"
            icon={CreditCard}
            fullWidth
            className="shadow-md py-3.5 text-xs sm:text-sm"
            onClick={() => setShowFeeModal(true)}
          >
            Record Fee
          </Button>
        )}
        <Button
          variant="accent"
          size="lg"
          icon={CalendarCheck}
          fullWidth
          className="shadow-md py-3.5 text-xs sm:text-sm"
          onClick={() => navigate('/attendance/mark')}
        >
          Mark Attendance
        </Button>
        <Button
          variant="purple"
          size="lg"
          icon={Plus}
          fullWidth
          className="shadow-md py-3.5 text-xs sm:text-sm"
          onClick={() => navigate('/schedule/events')}
        >
          Class Event
        </Button>
        {!isStaff && (
          <Button
            size="lg"
            icon={Users}
            fullWidth
            className="shadow-md py-3.5 text-xs sm:text-sm bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white border-0 transition-all hover:scale-[1.02] duration-200"
            onClick={() => navigate('/settings?tab=staff')}
          >
            Add Teacher
          </Button>
        )}
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Active Students"
          value={dashStats.activeStudents}
          icon={Users}
          color="primary"
          loading={loading}
        />
        <StatsCard
          title="Total Batches"
          value={dashStats.totalBatches}
          icon={Layers}
          color="purple"
          loading={loading}
        />
        {!isStaff ? (
          <>
            <StatsCard
              title="Fees Collected This Month"
              value={dashStats.monthRevenue}
              icon={CreditCard}
              color="success"
              prefix={'₹'}
              loading={loading}
            />
            <StatsCard
              title="Pending Fees"
              value={dashStats.pendingFees}
              icon={AlertCircle}
              color="error"
              prefix={'₹'}
              loading={loading}
            />
            <StatsCard
              title="Today's Attendance"
              value={dashStats.todayAttendancePct}
              icon={CalendarCheck}
              color="accent"
              suffix="%"
              loading={loading}
            />
            <StatsCard
              title="New Enrollments (Month)"
              value={dashStats.monthEnrollments}
              icon={TrendingUp}
              color="purple"
              loading={loading}
            />
            <StatsCard
              title="Overdue Fees Count"
              value={dashStats.overdueCount}
              icon={Clock}
              color="error"
              loading={loading}
            />
            <StatsCard
              title="Classes Today"
              value={dashStats.classesTodayCount}
              icon={BookOpen}
              color="primary"
              loading={loading}
            />
          </>
        ) : (
          <>
            <StatsCard
              title="Today's Attendance"
              value={dashStats.todayAttendancePct}
              icon={CalendarCheck}
              color="accent"
              suffix="%"
              loading={loading}
            />
            <StatsCard
              title="Classes Today"
              value={dashStats.classesTodayCount}
              icon={BookOpen}
              color="primary"
              loading={loading}
            />
          </>
        )}
      </div>

      {/* Mid Row: Today's Schedule & Exams + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule Card (2 cols) */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={18} className="text-[#1E3A8A]" />
              Today's Schedule & Upcoming Exams
            </CardTitle>
            <Badge variant="primary">{todayClasses.length} classes today</Badge>
          </CardHeader>

          <div className="space-y-4">
            {/* Today's Classes List */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Today's Classes</p>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                </div>
              ) : todayClasses.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-2xl text-center text-sm text-gray-400 border border-gray-100">
                  No classes scheduled for today.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {todayClasses.map(c => (
                    <div
                      key={c.id}
                      className={`
                        flex items-center justify-between p-3 rounded-2xl border transition-all text-sm
                        ${c.isCancelled
                          ? 'bg-red-50/60 border-red-100 text-red-700'
                          : c.isExtra
                          ? 'bg-green-50/60 border-green-100 text-green-800'
                          : 'bg-gray-50 border-gray-100 text-gray-800'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${c.isCancelled ? 'bg-red-200 text-red-800' : c.isExtra ? 'bg-green-200 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {c.batchName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-semibold ${c.isCancelled ? 'line-through text-red-600' : ''}`}>
                            {c.subject}
                          </p>
                          <p className="text-xs opacity-75">{c.batchName}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 border shadow-2xs">
                          {c.timing}
                        </span>
                        {c.isCancelled && <span className="block text-[10px] font-bold text-red-600 mt-0.5">CANCELLED</span>}
                        {c.isExtra && <span className="block text-[10px] font-bold text-green-600 mt-0.5">EXTRA CLASS</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Exams in Next 14 Days Widget */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-[#F97316]" /> Upcoming Exams (Next 14 Days)
                </p>
                <button onClick={() => navigate('/schedule/events')} className="text-xs font-bold text-[#1E3A8A] hover:underline">View All</button>
              </div>

              {upcomingExams.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No exams scheduled in the next 14 days.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {upcomingExams.map(ex => {
                    const exDate = new Date(ex.event_date)
                    const diffDays = Math.ceil((exDate - new Date()) / (1000 * 60 * 60 * 24))
                    const badgeBg = diffDays <= 3 
                      ? 'bg-red-500 text-white' 
                      : diffDays <= 7 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-blue-600 text-white'

                    return (
                      <div key={ex.id} className="p-3 bg-white border border-gray-200 rounded-2xl shadow-2xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-xs truncate">{ex.subject || 'Exam'}</p>
                          <p className="text-[10px] text-gray-500 truncate">{ex.batches?.name || 'Batch'}</p>
                          <p className="text-[10px] font-mono text-gray-400 mt-0.5">{exDate.toLocaleDateString('en-IN')}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex-shrink-0 shadow-2xs ${badgeBg}`}>
                          {diffDays <= 0 ? 'Today' : `${diffDays} Days Left`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Recent Activity Feed Card (1 col) */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={18} className="text-[#F97316]" />
              Recent Activity
            </CardTitle>
          </CardHeader>

          <div className="flex-1 overflow-y-auto max-h-[320px] space-y-3 pr-1">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              ))
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No recent activity logged yet.
              </div>
            ) : (
              recentActivities.map(act => (
                <div key={act.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-medium leading-relaxed">{act.text}</p>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">{act.timeAgo}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isStaff ? (
          <>
            {/* Attendance Trend Line Chart for Staff (2 cols) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Attendance Trend (Last 30 Days %)</CardTitle>
                <Badge variant="primary">Daily %</Badge>
              </CardHeader>

              {loading ? (
                <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
              ) : attendanceTrendChart.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                  No daily attendance records yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={attendanceTrendChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                    <Line type="monotone" dataKey="pct" stroke="#F97316" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </>
        ) : (
          <>
            {/* Monthly Fee Collection Bar Chart for Admin (2 cols) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Monthly Fee Collection (Last 6 Months)</CardTitle>
                <Badge variant="success">₹ Collection Trend</Badge>
              </CardHeader>

              {loading ? (
                <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
              ) : monthlyFeeChart.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                  No fee collection data recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyFeeChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Collected']} />
                    <Bar dataKey="amount" fill="#22C55E" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </>
        )}

        {/* Students Per Batch Distribution Pie Chart (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle>Students Per Batch</CardTitle>
          </CardHeader>

          {loading ? (
            <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ) : batchDistChart.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              No batch distribution data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={batchDistChart}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {batchDistChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} students`, 'Count']} />
                <Legend tick={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Admin-only bottom Row: Attendance 30-Day Line Chart */}
      {!isStaff && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trend (Last 30 Days %)</CardTitle>
            <Badge variant="primary">Daily %</Badge>
          </CardHeader>

          {loading ? (
            <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ) : attendanceTrendChart.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              No daily attendance records yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attendanceTrendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                <Line type="monotone" dataKey="pct" stroke="#F97316" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {/* Quick Action Popups */}
      {showStudentModal && (
        <StudentForm
          onClose={() => setShowStudentModal(false)}
          onSaved={() => {
            setShowStudentModal(false)
            fetchComprehensiveDashboardData()
          }}
        />
      )}

      {showFeeModal && (
        <FeeCollect
          onClose={() => setShowFeeModal(false)}
          onSaved={() => {
            setShowFeeModal(false)
            fetchComprehensiveDashboardData()
          }}
        />
      )}
    </div>
  )
}
