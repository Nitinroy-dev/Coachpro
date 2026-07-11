import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import TrialBanner from '../shared/TrialBanner'
import SubscriptionGuard from '../shared/SubscriptionGuard'
import { useAuth } from '../../contexts/AuthContext'
import { useInAppNotifications } from '../../hooks/useInAppNotifications'
import {
  LayoutDashboard, Users, CreditCard, CalendarCheck, MoreHorizontal,
  BookOpen, Clock, Bell, Settings, LogOut, ShieldCheck, X, GraduationCap, Calendar
} from 'lucide-react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [notifBanner, setNotifBanner] = useState(null)
  const { user, profile, institute, signOut, showInstallBtn, handleInstall } = useAuth()
  const { inAppNotifs, unreadCount, markAllRead } = useInAppNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  // Show a floating banner for every new incoming in-app notification
  useEffect(() => {
    if (inAppNotifs.length > 0) {
      setNotifBanner(inAppNotifs[0])
      const t = setTimeout(() => setNotifBanner(null), 5000)
      return () => clearTimeout(t)
    }
  }, [inAppNotifs.length])

  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'admin@batchdesk.com'
  const isSuperAdmin = user?.email && user.email.toLowerCase() === superadminEmail.toLowerCase()

  const isStudent = profile?.role === 'student'
  const isStaff = profile?.role === 'staff'

  // Centralized Route Protection for Teachers/Staff
  const adminOnlyPaths = ['/fees', '/billing', '/settings', '/notifications', '/superadmin', '/students/new']
  if (isStaff && adminOnlyPaths.some(path => location.pathname.startsWith(path))) {
    return <Navigate to="/dashboard" replace />
  }

  const mobileBottomItems = isSuperAdmin ? [
    { to: '/superadmin', icon: ShieldCheck, label: 'Superadmin' },
  ] : isStudent ? [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/student/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/student/fees', icon: CreditCard, label: 'Fees' },
    { to: '/student/exams', icon: BookOpen, label: 'Exams' },
  ] : isStaff ? [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/schedule', icon: Clock, label: 'Schedule' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
  ] : [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/fees', icon: CreditCard, label: 'Fees' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
  ]

  const mobileMoreItems = isSuperAdmin ? [] : isStudent ? [] : isStaff ? [
    { to: '/courses', icon: BookOpen, label: 'Batches & Courses' },
    { to: '/schedule/events', icon: Calendar, label: 'Class Events' },
  ] : [
    { to: '/courses', icon: BookOpen, label: 'Batches & Courses' },
    { to: '/schedule', icon: Clock, label: 'Schedule' },
    { to: '/schedule/events', icon: Calendar, label: 'Class Events' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  const handleSignOut = async () => {
    setMoreSheetOpen(false)
    await signOut()
    navigate('/login')
  }

  return (
    <SubscriptionGuard>
      <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">

        {/* In-App Notification Banner */}
        {notifBanner && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-sm animate-slide-down">
            <div className="flex items-start gap-3 bg-[#1E3A8A] text-white px-4 py-3 rounded-2xl shadow-2xl border border-blue-400/30">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Bell size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-200">{notifBanner.type || 'Notification'}</p>
                <p className="text-sm font-medium leading-snug line-clamp-2">{notifBanner.message}</p>
              </div>
              <button onClick={() => setNotifBanner(null)} className="text-white/60 hover:text-white flex-shrink-0">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Sticky Trial Banner */}
        <TrialBanner />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar (Desktop / Tablet) */}
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
            <Header onMenuToggle={() => setSidebarOpen(true)} />
            <main
              className="flex-1 overflow-y-auto"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
            >
              <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
                <Outlet />
              </div>
            </main>
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar (<768px) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex items-center justify-around h-16 px-2 shadow-lg" style={{ contain: 'layout style', willChange: 'transform' }}>
          {mobileBottomItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors
                ${isActive ? 'text-[#1E3A8A] font-bold' : 'text-gray-500'}
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} className={isActive ? 'text-[#F97316]' : ''} />
                  <span className="mt-0.5">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {!isStudent && (
            <button
              onClick={() => setMoreSheetOpen(true)}
              className={`
                flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors
                ${moreSheetOpen ? 'text-[#1E3A8A] font-bold' : 'text-gray-500 hover:text-gray-800'}
              `}
            >
              <MoreHorizontal size={20} />
              <span className="mt-0.5">More</span>
            </button>
          )}
        </div>

        {/* Mobile Slide-up "More" Sheet */}
        {moreSheetOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMoreSheetOpen(false)}
            />
            <div className="relative bg-white rounded-t-3xl p-6 shadow-2xl space-y-4 animate-slide-up max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-sm">
                    C
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Menu Options</h3>
                    <p className="text-xs text-gray-400">{institute?.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMoreSheetOpen(false)}
                  className="p-2 rounded-full text-gray-400 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                {mobileMoreItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreSheetOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 p-3 rounded-2xl border transition-all
                      ${isActive
                        ? 'bg-blue-50 border border-blue-200 text-[#1E3A8A] font-bold'
                        : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon size={18} className="text-[#F97316]" />
                    <span className="text-xs">{label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-2">
                {showInstallBtn && (
                  <button
                    onClick={() => {
                      setMoreSheetOpen(false)
                      handleInstall()
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors cursor-pointer"
                  >
                    📲 Install Batch Desk App
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors"
                >
                  <LogOut size={18} />
                  Sign out of Batch Desk
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SubscriptionGuard>
  )
}
