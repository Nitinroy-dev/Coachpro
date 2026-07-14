import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, BookOpen, Layers, CreditCard,
  CalendarCheck, Clock, Bell, Settings, LogOut, GraduationCap,
  ChevronRight, Calendar, ShieldCheck, Receipt, Download
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function Sidebar({ open = true, onClose }) {
  const { user, profile, institute, signOut, showInstallBtn, handleInstall } = useAuth()
  const navigate = useNavigate()

  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'nitinroy20061995@gmail.com'
  const isSuperAdmin = user?.email && user.email.toLowerCase() === superadminEmail.toLowerCase()

  const isStudent = profile?.role === 'student'
  const isStaff = profile?.role === 'staff'
  const isParent = profile?.role === 'parent'

  const navItems = isSuperAdmin ? [
    { to: '/superadmin', icon: ShieldCheck, label: 'Superadmin Operations' }
  ] : isStudent ? [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/attendance', icon: CalendarCheck, label: 'My Attendance' },
    { to: '/student/fees', icon: CreditCard, label: 'Fees & Payments' },
    { to: '/student/exams', icon: BookOpen, label: 'Timetable & Exams' },
  ] : isParent ? [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/parent/attendance', icon: CalendarCheck, label: "Child's Attendance" },
    { to: '/parent/fees', icon: CreditCard, label: 'Fees & Payments' },
    { to: '/parent/exams', icon: BookOpen, label: 'Timetable & Exams' },
  ] : isStaff ? [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/courses', icon: BookOpen, label: 'Batches & Courses' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/schedule', icon: Clock, label: 'Schedule' },
    { to: '/schedule/events', icon: Calendar, label: 'Class Events' },
  ] : [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/courses', icon: BookOpen, label: 'Batches & Courses' },
    { to: '/fees', icon: CreditCard, label: 'Fees' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/schedule', icon: Clock, label: 'Schedule' },
    { to: '/schedule/events', icon: Calendar, label: 'Class Events' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/billing', icon: Receipt, label: 'Billing & Plans' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full bg-[#1E3A8A] flex flex-col
          transform transition-all duration-300 ease-in-out
          md:static md:translate-x-0 md:z-auto group
          ${open ? 'translate-x-0' : '-translate-x-full'}
          w-60 md:w-16 md:hover:w-60 lg:w-60
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 overflow-hidden">
          <img src="/logo.png?v=2" alt="Batch Desk Logo" className="h-9 w-auto max-w-[150px] object-contain flex-shrink-0 bg-white rounded-lg p-0.5" />
          <div className="min-w-0 md:opacity-0 md:group-hover:opacity-100 lg:opacity-100 transition-opacity duration-200">
            <p className="text-blue-200 text-xs truncate font-semibold leading-tight">{isSuperAdmin ? 'Operations Hub' : (institute?.name || 'Institute')}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5">
          <ul className="space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150 overflow-hidden
                    ${isActive
                      ? 'bg-white/15 text-white'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={20} className={`flex-shrink-0 ${isActive ? 'text-[#F97316]' : ''}`} />
                      <span className="flex-1 whitespace-nowrap md:opacity-0 md:group-hover:opacity-100 lg:opacity-100 transition-opacity duration-200">
                        {label}
                      </span>
                      {isActive && (
                        <ChevronRight size={14} className="opacity-60 md:hidden md:group-hover:block lg:block" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Profile + Logout */}
        <div className="p-2.5 border-t border-white/10 overflow-hidden">
          {showInstallBtn && (
            <button
              onClick={handleInstall}
              className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl text-sm bg-[#F97316] text-white hover:bg-[#ea580c] font-semibold transition-colors overflow-hidden cursor-pointer"
            >
              <Download size={18} className="flex-shrink-0" />
              <span className="whitespace-nowrap md:opacity-0 md:group-hover:opacity-100 lg:opacity-100 transition-opacity duration-200">
                Install App
              </span>
            </button>
          )}
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {(profile?.name || 'A')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 md:opacity-0 md:group-hover:opacity-100 lg:opacity-100 transition-opacity duration-200">
              <p className="text-white text-sm font-medium truncate">{profile?.name || 'Admin'}</p>
              <p className="text-blue-200 text-xs capitalize">{isSuperAdmin ? 'Super Admin' : (profile?.role || 'admin')}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-blue-100 hover:bg-white/10 hover:text-white transition-colors overflow-hidden"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className="whitespace-nowrap md:opacity-0 md:group-hover:opacity-100 lg:opacity-100 transition-opacity duration-200">
              Sign out
            </span>
          </button>
          
          <div className="mt-3 pt-3 border-t border-blue-500/20 text-[10px] text-blue-200/50 text-center font-medium md:opacity-0 md:group-hover:opacity-100 lg:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Product by NRTechWorks © 2026
          </div>
        </div>
      </aside>
    </>
  )
}
