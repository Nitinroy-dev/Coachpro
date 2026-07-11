import { Loader2 } from 'lucide-react'

export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 16,
    md: 24,
    lg: 40,
    xl: 56,
  }
  return (
    <Loader2
      size={sizes[size]}
      className={`animate-spin text-[#1E3A8A] ${className}`}
    />
  )
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo.png"
          alt="Batch Desk Logo"
          className="h-20 w-auto object-contain animate-pulse"
        />
        <p className="text-xs text-gray-400 font-medium tracking-wider animate-pulse uppercase">Loading Batch Desk</p>
      </div>
    </div>
  )
}
