import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Notification } from '../types'

interface NotificationPanelProps {
  notifications: Notification[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

const typeIcons: Record<string, string> = {
  activity_change: '📋',
  upcoming_activity: '⏰',
  deadline_reminder: '⚠️',
  result_available: '🏆',
}

const typeLabels: Record<string, string> = {
  activity_change: 'activityChange',
  upcoming_activity: 'upcomingActivity',
  deadline_reminder: 'deadlineReminder',
  result_available: 'resultAvailable',
}

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('daysAgo', { count: days })
}

function getNavigationPath(n: Notification): string {
  switch (n.activity_type) {
    case 'game': return '/games'
    case 'training': return '/trainings'
    case 'event': return '/events'
    default: return '/'
  }
}

export default function NotificationPanel({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationPanelProps) {
  const { t } = useTranslation('notifications')
  const navigate = useNavigate()

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleClick(n: Notification) {
    if (!n.read) onMarkAsRead(n.id)
    onClose()
    navigate(getNavigationPath(n))
  }

  function renderMessage(n: Notification): string {
    try {
      const data = n.body ? JSON.parse(n.body) : {}
      return t(n.title, data)
    } catch {
      return n.title
    }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Panel */}
      <div
        className="pb-safe absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white dark:bg-gray-800 lg:bottom-auto lg:left-auto lg:right-4 lg:top-4 lg:max-h-[80vh] lg:w-96 lg:rounded-2xl lg:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle (mobile) */}
        <div className="sticky top-0 z-10 rounded-t-2xl bg-white dark:bg-gray-800 lg:rounded-t-2xl">
          <div className="flex justify-center pb-1 pt-3 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 pb-3 pt-2 dark:border-gray-700 lg:pt-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('title')}
            </h2>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {t('markAllRead')}
              </button>
            )}
          </div>
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {t('noNotifications')}
          </p>
        ) : (
          <div>
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700/50 dark:active:bg-gray-700 ${
                  !n.read ? 'bg-brand-50/50 dark:bg-brand-900/20' : ''
                }`}
              >
                {/* Unread dot */}
                <div className="flex shrink-0 items-center pt-1.5">
                  {!n.read ? (
                    <div className="h-2 w-2 rounded-full bg-brand-500" />
                  ) : (
                    <div className="h-2 w-2" />
                  )}
                </div>

                {/* Icon */}
                <span className="shrink-0 pt-0.5 text-base">{typeIcons[n.type] ?? '🔔'}</span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm text-gray-900 dark:text-gray-100 ${!n.read ? 'font-medium' : ''}`}>
                    {renderMessage(n)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>{t(typeLabels[n.type] ?? 'activityChange')}</span>
                    <span>·</span>
                    <span>{timeAgo(n.created, t)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
