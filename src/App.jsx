import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { InstituteProvider } from './contexts/InstituteContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import Layout from './components/layout/Layout'
import ErrorBoundary from './components/shared/ErrorBoundary'

import { useEffect } from 'react'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Expired from './pages/auth/Expired'
import VerifiedCredentials from './pages/auth/VerifiedCredentials'

// Public landing pages
import Pricing from './pages/pricing/Pricing'

// App pages
import Dashboard from './pages/Dashboard'
import StudentList from './pages/students/StudentList'
import StudentCreate from './pages/students/StudentCreate'
import StudentDetail from './pages/students/StudentDetail'
import CourseList from './pages/courses/CourseList'
import BatchList from './pages/batches/BatchList'
import FeeList from './pages/fees/FeeList'
import FeeStructureList from './pages/fees/FeeStructureList'
import AttendanceList from './pages/attendance/AttendanceList'
import AttendanceMark from './pages/attendance/AttendanceMark'
import Timetable from './pages/schedule/Timetable'
import ClassEvents from './pages/schedule/ClassEvents'
import InstituteCalendar from './pages/schedule/InstituteCalendar'
import NotificationCenter from './pages/notifications/NotificationCenter'
import Settings from './pages/settings/Settings'
import SuperAdmin from './pages/superadmin/SuperAdmin'
import Billing from './pages/billing/Billing'
import StudentAttendance from './pages/student/StudentAttendance'
import StudentFees from './pages/student/StudentFees'
import StudentExams from './pages/student/StudentExams'
import ParentAttendance from './pages/parent/ParentAttendance'
import ParentFees from './pages/parent/ParentFees'
import ParentExams from './pages/parent/ParentExams'

export default function App() {
  useEffect(() => {
    // Force window focus immediately on startup
    window.focus()

    // Enforce orientation lock to portrait if browser/PWA container supports Screen Orientation API
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
      window.screen.orientation.lock('portrait').catch((err) => {
        console.warn('Screen orientation locking not supported or requires fullscreen:', err.message)
      })
    }

    // Fallback: trigger delayed focus calls in case of OS background launch latency
    const t1 = setTimeout(() => window.focus(), 300)
    const t2 = setTimeout(() => window.focus(), 1000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <InstituteProvider>
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/expired" element={<Expired />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/verified" element={<VerifiedCredentials />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/students" element={<StudentList />} />
                <Route path="/students/new" element={<StudentCreate />} />
                <Route path="/students/:id" element={<StudentDetail />} />
                <Route path="/courses" element={<CourseList />} />
                <Route path="/batches" element={<BatchList />} />
                <Route path="/fees" element={<FeeList />} />
                <Route path="/fees/structures" element={<FeeStructureList />} />
                <Route path="/attendance" element={<AttendanceList />} />
                <Route path="/attendance/mark" element={<AttendanceMark />} />
                <Route path="/schedule" element={<Timetable />} />
                <Route path="/schedule/events" element={<ClassEvents />} />
                <Route path="/schedule/calendar" element={<InstituteCalendar />} />
                <Route path="/notifications" element={<NotificationCenter />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/superadmin" element={<SuperAdmin />} />

                {/* Student routes */}
                <Route path="/student/attendance" element={<StudentAttendance />} />
                <Route path="/student/fees" element={<StudentFees />} />
                <Route path="/student/exams" element={<StudentExams />} />

                {/* Parent routes */}
                <Route path="/parent/attendance" element={<ParentAttendance />} />
                <Route path="/parent/fees" element={<ParentFees />} />
                <Route path="/parent/exams" element={<ParentExams />} />
              </Route>
            </Route>

            {/* Default redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </InstituteProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
