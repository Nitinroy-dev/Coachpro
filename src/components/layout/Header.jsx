import { Menu, Bell, Search, Download } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLocation, Link } from 'react-router-dom'
import { useInAppNotifications } from '../../hooks/useInAppNotifications'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/courses': 'Courses',
  '/batches': 'Batches',
  '/fees': 'Fees & Payments',
  '/attendance': 'Attendance',
  '/schedule': 'Class Schedule',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
}

export default function Header({ onMenuToggle }) {
  const { institute, showInstallBtn, handleInstall } = useAuth()
  const { unreadCount } = useInAppNotifications()
  const location = useLocation()

  // Find best matching page title
  const title = Object.entries(pageTitles).find(
    ([path]) => location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] || 'Batch Desk'

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-4">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
        {institute && (
          <p className="text-xs text-gray-400 hidden sm:block truncate">{institute.name}</p>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {showInstallBtn && (
          <button
            onClick={handleInstall}
            className="flex md:hidden items-center gap-1.5 bg-[#F97316] hover:bg-[#ea580c] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Install</span>
          </button>
        )}
        {/* Subscription badge */}
        {institute?.subscription_status === 'trial' && (
          <div className="hidden sm:flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Trial Active
          </div>
        )}

        {/* Notification bell linking to notifications panel or toggling read */}
        <Link to="/notifications" className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F97316] text-white font-extrabold text-[9px] flex items-center justify-center border border-white leading-none shadow-xs">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
