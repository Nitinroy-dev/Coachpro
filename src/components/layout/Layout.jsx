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
  BookOpen, Clock, Bell, Settings, LogOut, ShieldCheck, X, GraduationCap, Calendar,
  AlertCircle
} from 'lucide-react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [notifBanner, setNotifBanner] = useState(null)
  const { user, profile, institute, signOut, showInstallBtn, handleInstall } = useAuth()
  const { inAppNotifs, unreadCount, markAllRead } = useInAppNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  // Bug & Issue Reporting states
  const [showBugModal, setShowBugModal] = useState(false)
  const [bugForm, setBugForm] = useState({ title: '', category: 'Bug/Glitch', description: '' })
  const [bugSending, setBugSending] = useState(false)

  const handleBugSubmit = async (e) => {
    e.preventDefault()
    if (!bugForm.title.trim() || !bugForm.description.trim()) {
      alert('Please fill in all required fields.')
      return
    }
    setBugSending(true)
    try {
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff;">
          <h2 style="color: #e11d48; margin-top: 0; display: flex; align-items: center; gap: 8px;">🚨 CoachPro Bug & Issue Report</h2>
          <p><strong>Reported By:</strong> ${profile?.name || user?.email || 'Unknown User'} (${profile?.role?.toUpperCase() || 'UNKNOWN'})</p>
          <p><strong>User Email:</strong> ${user?.email || 'N/A'}</p>
          <p><strong>Institute Name:</strong> ${institute?.name || 'N/A'}</p>
          <p><strong>Category:</strong> ${bugForm.category}</p>
          <p><strong>Issue Title:</strong> ${bugForm.title}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <h3 style="color: #1e3a8a;">Description / Steps to Reproduce:</h3>
          <p style="white-space: pre-wrap; color: #475569; line-height: 1.6; font-size: 14px;">${bugForm.description}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <h3 style="color: #1e3a8a;">System & Device Details:</h3>
          <ul style="color: #475569; font-size: 13px; line-height: 1.6; padding-left: 20px;">
            <li><strong>URL Path:</strong> ${window.location.href}</li>
            <li><strong>User Agent:</strong> ${navigator.userAgent}</li>
            <li><strong>Device Time:</strong> ${new Date().toLocaleString('en-IN')}</li>
          </ul>
        </div>
      `

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: institute?.settings?.resend_api_key || null,
          from: institute?.settings?.resend_sender_email || null,
          to: 'contact@nrtechworks.online',
          subject: `[CoachPro Bug Report] ${bugForm.category}: ${bugForm.title}`,
          html: emailHtml
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to dispatch email.')
      }

      alert('Thank you! Your bug report has been successfully dispatched to the development team.')
      setBugForm({ title: '', category: 'Bug/Glitch', description: '' })
      setShowBugModal(false)
    } catch (err) {
      alert(`Failed to send bug report: ${err.message}`)
    } finally {
      setBugSending(false)
    }
  }

  // Show a floating banner for every new incoming in-app notification
  useEffect(() => {
    if (inAppNotifs.length > 0) {
      setNotifBanner(inAppNotifs[0])
      const t = setTimeout(() => setNotifBanner(null), 5000)
      return () => clearTimeout(t)
    }
  }, [inAppNotifs.length])

  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'nitinroy20061995@gmail.com'
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
        {!isSuperAdmin && <TrialBanner />}

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
                
                <p className="text-[10px] text-gray-400 text-center font-bold tracking-wider uppercase pt-2">
                  Product by NRTechWorks · All Rights Reserved 2026
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Floating Report Issue FAB */}
        {!isSuperAdmin && (
          <button
            onClick={() => setShowBugModal(true)}
            className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[999] bg-[#E11D48] hover:bg-[#BE123C] text-white p-3.5 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 group"
            title="Report a bug or issue"
          >
            <AlertCircle size={22} className="group-hover:rotate-12 transition-transform" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-2 text-xs font-extrabold uppercase tracking-wider transition-all duration-300">
              Report Issue
            </span>
          </button>
        )}

        {/* Report Issue Modal */}
        {showBugModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setShowBugModal(false)}
            />
            <div className="relative bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-lg">Report an Issue / Bug</h3>
                    <p className="text-xs text-gray-500">Submit glitch or system reports directly to technical support</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBugModal(false)}
                  className="p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleBugSubmit} className="space-y-4 text-xs font-medium text-gray-700">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Category *</label>
                  <select
                    value={bugForm.category}
                    onChange={(e) => setBugForm({ ...bugForm, category: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-xs"
                  >
                    <option value="Bug/Glitch">Bug / Glitch 🐛</option>
                    <option value="Billing/Fees">Billing / Fees 💸</option>
                    <option value="Attendance">Attendance 📅</option>
                    <option value="Feature Request">Feature Request ✨</option>
                    <option value="Other">Other / Feedback 💬</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Issue Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="Short description of the bug (e.g. Cannot download receipt)"
                    value={bugForm.title}
                    onChange={(e) => setBugForm({ ...bugForm, title: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Describe the Issue *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Please explain what happened, steps to reproduce, or any error messages you saw."
                    value={bugForm.description}
                    onChange={(e) => setBugForm({ ...bugForm, description: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-xs leading-relaxed"
                  />
                </div>

                {/* Auto captured properties for developers */}
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1.5 text-[10px] text-gray-500">
                  <p className="font-bold text-gray-700 uppercase tracking-wider text-[9px]">Captured Debug Details (Sent Automatically)</p>
                  <p>👤 <strong>User:</strong> {profile?.name || user?.email || 'Guest'} ({profile?.role || 'Visitor'})</p>
                  <p>🏢 <strong>Institute:</strong> {institute?.name || 'N/A'}</p>
                  <p>🔗 <strong>Active URL:</strong> {window.location.pathname}</p>
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowBugModal(false)}
                    className="px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bugSending}
                    className="px-5 py-2.5 rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {bugSending ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending Report...
                      </>
                    ) : (
                      'Submit Bug Report'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SubscriptionGuard>
  )
}
