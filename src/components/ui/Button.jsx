import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-[#1E3A8A] hover:bg-[#1e40af] text-white shadow-sm',
  accent: 'bg-[#F97316] hover:bg-[#ea6c07] text-white shadow-sm',
  success: 'bg-[#22C55E] hover:bg-[#16a34a] text-white shadow-sm',
  danger: 'bg-[#EF4444] hover:bg-[#dc2626] text-white shadow-sm',
  warning: 'bg-[#EAB308] hover:bg-[#ca8a04] text-white shadow-sm',
  purple: 'bg-[#8B5CF6] hover:bg-[#7c3aed] text-white shadow-sm',
  outline: 'border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white',
  ghost: 'text-gray-600 hover:bg-gray-100',
  white: 'bg-white text-[#1E3A8A] border border-gray-200 hover:bg-gray-50 shadow-sm',
}

const sizes = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
}

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon: Icon,
    iconRight,
    className = '',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
        focus:ring-[#1E3A8A] disabled:opacity-60 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      {children}
      {iconRight && !loading && <span>{iconRight}</span>}
    </button>
  )
})

export default Button
