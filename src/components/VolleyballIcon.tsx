import { Volleyball } from '@phosphor-icons/react'

export default function VolleyballIcon({ className = 'h-5 w-5', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <Volleyball
      className={className}
      weight={filled ? 'fill' : 'regular'}
      color={filled ? '#FFC832' : 'currentColor'}
    />
  )
}
