import { Bell } from 'lucide-react'

interface NotificationBellProps {
  unreadCount: number
  onClick: () => void
  className?: string
}

export default function NotificationBell({ unreadCount, onClick, className = '' }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-lg p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-brand-800 ${className}`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className="h-6 w-6 text-gray-600 dark:text-gray-300" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
