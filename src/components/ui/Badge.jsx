const variants = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-blue-100 text-[#1E3A8A]',
  accent: 'bg-orange-100 text-[#F97316]',
  success: 'bg-green-100 text-[#22C55E]',
  error: 'bg-red-100 text-[#EF4444]',
  warning: 'bg-yellow-100 text-[#EAB308]',
  purple: 'bg-purple-100 text-purple-700',
}

const dotColors = {
  default: 'bg-gray-400',
  primary: 'bg-[#1E3A8A]',
  accent: 'bg-[#F97316]',
  success: 'bg-[#22C55E]',
  error: 'bg-[#EF4444]',
  warning: 'bg-[#EAB308]',
  purple: 'bg-purple-500',
}

export default function Badge({ children, variant = 'default', dot = false, className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
        ${variants[variant]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  )
}

// Status badge presets
export function StatusBadge({ status }) {
  const map = {
    active: { variant: 'success', label: 'Active' },
    inactive: { variant: 'default', label: 'Inactive' },
    pending: { variant: 'warning', label: 'Pending' },
    paid: { variant: 'success', label: 'Paid' },
    overdue: { variant: 'error', label: 'Overdue' },
    partial: { variant: 'accent', label: 'Partial' },
    waived: { variant: 'purple', label: 'Waived' },
    present: { variant: 'success', label: 'Present' },
    absent: { variant: 'error', label: 'Absent' },
    late: { variant: 'warning', label: 'Late' },
    holiday: { variant: 'primary', label: 'Holiday' },
    trial: { variant: 'warning', label: 'Trial' },
    expired: { variant: 'error', label: 'Expired' },
    cancelled: { variant: 'error', label: 'Cancelled' },
    failed: { variant: 'error', label: 'Failed' },
    refunded: { variant: 'purple', label: 'Refunded' },
    success: { variant: 'success', label: 'Success' },
    extra: { variant: 'success', label: 'Extra Class' },
    rescheduled: { variant: 'accent', label: 'Rescheduled' },
    exam: { variant: 'purple', label: 'Exam' },
    announcement: { variant: 'primary', label: 'Announcement' },
  }
  const config = map[status] || { variant: 'default', label: status }
  return <Badge variant={config.variant} dot>{config.label}</Badge>
}
