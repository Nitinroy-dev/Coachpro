import { Menu, Bell, Search, Download, Lock, Unlock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLocation, Link } from 'react-router-dom'
import { useInAppNotifications } from '../../hooks/useInAppNotifications'
import { useState, useEffect } from 'react'

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
  const { user, institute, showInstallBtn, handleInstall } = useAuth()
  const { unreadCount } = useInAppNotifications()
  const location = useLocation()
  
  const [isLocked, setIsLocked] = useState(
    localStorage.getItem('orientation_lock') === 'true'
  )

  useEffect(() => {
    const handleOrientationCheck = () => {
      const locked = localStorage.getItem('orientation_lock') === 'true'
      const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024
      
      if (locked && isLandscape) {
        document.body.classList.add('lock-portrait-rotation')
      } else {
        document.body.classList.remove('lock-portrait-rotation')
      }
    }

    const applySystemLock = () => {
      if (isLocked) {
        try {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('portrait-primary').catch(() => {})
          }
        } catch (e) {}
      }
    }

    applySystemLock()
    handleOrientationCheck()

    window.addEventListener('resize', handleOrientationCheck)
    window.addEventListener('orientationchange', handleOrientationCheck)

    return () => {
      window.removeEventListener('resize', handleOrientationCheck)
      window.removeEventListener('orientationchange', handleOrientationCheck)
      document.body.classList.remove('lock-portrait-rotation')
    }
  }, [isLocked])

  const toggleOrientationLock = () => {
    const nextState = !isLocked
    setIsLocked(nextState)
    localStorage.setItem('orientation_lock', String(nextState))
    if (!nextState) {
      try {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
          screen.orientation.unlock()
        }
      } catch (e) {}
      document.body.classList.remove('lock-portrait-rotation')
    }
  }

  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL || 'nitinroy20061995@gmail.com'
  const isSuperAdmin = user?.email && user.email.toLowerCase() === superadminEmail.toLowerCase()

  // Find best matching page title
  const title = isSuperAdmin 
    ? 'Superadmin Operations Hub' 
    : (Object.entries(pageTitles).find(
        ([path]) => location.pathname === path || location.pathname.startsWith(path + '/')
      )?.[1] || 'Batch Desk')

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
        {isSuperAdmin ? (
          <p className="text-xs text-[#F97316] font-bold hidden sm:block truncate">Global Operations Controller</p>
        ) : (
          institute && <p className="text-xs text-gray-400 hidden sm:block truncate">{institute.name}</p>
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
        {!isSuperAdmin && institute?.subscription_status === 'trial' && (
          <div className="hidden sm:flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Trial Active
          </div>
        )}

        {/* Notification bell linking to notifications panel or toggling read */}
        {!isSuperAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={toggleOrientationLock}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex items-center justify-center cursor-pointer"
              title={isLocked ? "Unlock screen rotation" : "Lock portrait orientation"}
            >
              {isLocked ? (
                <Lock size={18} className="text-[#F97316] animate-pulse" />
              ) : (
                <Unlock size={18} />
              )}
            </button>
            <Link to="/notifications" className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F97316] text-white font-extrabold text-[9px] flex items-center justify-center border border-white leading-none shadow-xs">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
