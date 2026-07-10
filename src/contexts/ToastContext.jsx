import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      removeToast(id)
    }, 3000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  }

  const icons = {
    success: <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />,
    error: <XCircle size={16} className="text-red-600 flex-shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
    info: <Info size={16} className="text-blue-500 flex-shrink-0" />,
  }

  const bgColors = {
    success: 'bg-green-50/90 border-green-200 text-green-800 shadow-green-100/20',
    error: 'bg-red-50/90 border-red-200 text-red-800 shadow-red-100/20',
    warning: 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-amber-100/20',
    info: 'bg-blue-50/90 border-blue-200 text-blue-800 shadow-blue-100/20',
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container stack */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border backdrop-blur-xs shadow-lg pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 animate-[slideIn_0.2s_ease-out] ${bgColors[t.type]}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5">{icons[t.type]}</span>
              <p className="text-xs font-semibold leading-relaxed break-words">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-lg hover:bg-black/5 flex-shrink-0 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
