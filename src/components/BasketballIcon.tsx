import { Basketball } from '@phosphor-icons/react'

export default function BasketballIcon({ className = 'h-5 w-5', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <Basketball
      className={className}
      weight={filled ? 'fill' : 'regular'}
      color={filled ? '#F97316' : 'currentColor'}
    />
  )
}
