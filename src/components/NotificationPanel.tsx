import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Clock, AlertTriangle, Trophy, Bell, ArrowRightLeft, BellRing, BellOff } from 'lucide-react'
import type { Notification } from '../types'
import { usePushNotifications } from '../hooks/usePushNotifications'

interface NotificationPanelProps {
  notifications: Notification[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

const typeIcons: Record<string, React.ReactNode> = {
  activity_change: <ClipboardList className="h-4 w-4" />,
  upcoming_activity: <Clock className="h-4 w-4" />,
  deadline_reminder: <AlertTriangle className="h-4 w-4" />,
  result_available: <Trophy className="h-4 w-4" />,
  duty_delegation_request: <ArrowRightLeft className="h-4 w-4" />,
}

const typeLabels: Record<string, string> = {
  activity_change: 'activityChange',
  upcoming_activity: 'upcomingActivity',
  deadline_reminder: 'deadlineReminder',
  result_available: 'resultAvailable',
  duty_delegation_request: 'dutyDelegation',
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
  if (n.type === 'duty_delegation_request' || n.activity_type === 'scorer_duty') return '/scorer'
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
  const push = usePushNotifications()

  // Animated close
  const [closing, setClosing] = useState(false)
  const startClose = useCallback(() => setClosing(true), [])
  const onAnimEnd = useCallback(() => { if (closing) onClose() }, [closing, onClose])

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
      return String(t(n.title, data))
    } catch {
      return n.title
    }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={startClose}>
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/50 ${closing ? 'animate-fade-out' : 'animate-fade-in'}`} />

      {/* Panel */}
      <div
        className={`pb-safe absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white dark:bg-gray-800 lg:bottom-auto lg:left-auto lg:right-4 lg:top-4 lg:max-h-[80vh] lg:w-96 lg:rounded-2xl lg:shadow-2xl ${closing ? 'animate-sheet-down lg:animate-fade-out' : 'animate-sheet-up lg:animate-modal-enter'}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={onAnimEnd}
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
                <span className="shrink-0 pt-0.5 text-gray-500 dark:text-gray-400">{typeIcons[n.type] ?? <Bell className="h-4 w-4" />}</span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm text-gray-900 dark:text-gray-100 ${!n.read ? 'font-medium' : ''}`}>
                    {renderMessage(n)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>{t(typeLabels[n.type] ?? 'activityChange')}</span>
                    <span>·</span>
                    <span>{timeAgo(n.created ?? n.date_created ?? '', t)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Push notification toggle */}
        {push.supported && (
          <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {push.subscribed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                <span>{t('pushNotifications')}</span>
              </div>
              {push.permission === 'denied' ? (
                <span className="text-xs text-red-500">{t('pushDenied')}</span>
              ) : (
                <button
                  onClick={() => push.subscribed ? push.unsubscribe() : push.subscribe()}
                  disabled={push.loading}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    push.subscribed
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  } disabled:opacity-50`}
                >
                  {push.loading ? '...' : push.subscribed ? t('pushDisable') : t('pushEnable')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
