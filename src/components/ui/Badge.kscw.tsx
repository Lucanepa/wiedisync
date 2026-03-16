import type { HTMLAttributes, ReactNode } from 'react'

const variants = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
} as const

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
} as const

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  children: ReactNode
}

export default function Badge({ variant = 'neutral', size = 'md', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

export { variants as badgeVariants }
