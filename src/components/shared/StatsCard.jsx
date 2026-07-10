import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = 'primary',
  trend,
  trendLabel,
  prefix = '',
  suffix = '',
  loading = false,
}) {
  const colorMap = {
    primary: {
      bg: 'bg-blue-50',
      icon: 'bg-[#1E3A8A] text-white',
      text: 'text-[#1E3A8A]',
    },
    accent: {
      bg: 'bg-orange-50',
      icon: 'bg-[#F97316] text-white',
      text: 'text-[#F97316]',
    },
    success: {
      bg: 'bg-green-50',
      icon: 'bg-[#22C55E] text-white',
      text: 'text-[#22C55E]',
    },
    error: {
      bg: 'bg-red-50',
      icon: 'bg-[#EF4444] text-white',
      text: 'text-[#EF4444]',
    },
    warning: {
      bg: 'bg-yellow-50',
      icon: 'bg-[#EAB308] text-white',
      text: 'text-[#EAB308]',
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'bg-purple-600 text-white',
      text: 'text-purple-600',
    },
  }

  const c = colorMap[color]

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl bg-gray-200" />
          <div className="w-16 h-5 rounded bg-gray-200" />
        </div>
        <div className="w-24 h-8 rounded bg-gray-200 mb-1" />
        <div className="w-32 h-4 rounded bg-gray-200" />
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6 hover:shadow-md transition-all duration-200 group`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0`}>
          {Icon && <Icon size={20} />}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className={`text-2xl sm:text-3xl font-bold text-gray-900 mb-0.5`}>
        {prefix}
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        {suffix}
      </p>
      <p className="text-sm text-gray-500">{title}</p>
      {trendLabel && (
        <p className="text-xs text-gray-400 mt-1">{trendLabel}</p>
      )}
    </div>
  )
}
