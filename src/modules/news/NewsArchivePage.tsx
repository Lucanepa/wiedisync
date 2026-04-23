import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import AnnouncementRow from '../home/components/AnnouncementRow'
import AnnouncementDetailModal from '../home/components/AnnouncementDetailModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import type { Announcement, Notification } from '../../types'

type FeedItem =
  | { kind: 'announcement'; id: string; ts: number; pinned: boolean; record: Announcement }
  | { kind: 'notification'; id: string; ts: number; pinned: false; record: Notification }

const PAGE_SIZE = 20

export default function NewsArchivePage() {
  const { t } = useTranslation('announcements')
  const { t: tn } = useTranslation('notifications')
  const navigate = useNavigate()
  const { user, isApproved } = useAuth()
  const { notifications, isLoading: notifLoading, markAsRead } = useNotifications()
  const { announcements, isLoading: annLoading } = useAnnouncements({ limit: 100 })
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [page, setPage] = useState(0)

  const isLoading = notifLoading || annLoading

  const items = useMemo<FeedItem[]>(() => {
    const annItems: FeedItem[] = announcements.map((a) => ({
      kind: 'announcement',
      id: `a:${a.id}`,
      ts: new Date(a.published_at ?? a.date_created ?? 0).getTime(),
      pinned: !!a.pinned,
      record: a,
    }))
    const notifItems: FeedItem[] = notifications.map((n) => ({
      kind: 'notification',
      id: `n:${n.id}`,
      ts: new Date(n.date_created ?? n.created ?? 0).getTime(),
      pinned: false,
      record: n,
    }))
    const merged = [...annItems, ...notifItems]
    merged.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.ts - a.ts
    })
    return merged
  }, [announcements, notifications])

  const visible = items.slice(0, (page + 1) * PAGE_SIZE)
  const hasMore = items.length > visible.length

  if (!user || !isApproved) {
    return (
      <div className="mx-auto max-w-2xl py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {t('signInRequired')}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{tn('news')}</h1>
      </div>

      {isLoading && items.length === 0 ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {tn('noNotifications')}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            {visible.map((item) =>
              item.kind === 'announcement' ? (
                <AnnouncementRow
                  key={item.id}
                  announcement={item.record}
                  onClick={() => setSelectedAnnouncement(item.record)}
                />
              ) : (
                <NewsArchiveNotificationRow
                  key={item.id}
                  notification={item.record}
                  onMarkAsRead={markAsRead}
                />
              ),
            )}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('loadMore')}
              </button>
            </div>
          )}
        </>
      )}

      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}
    </div>
  )
}

// Lightweight inline notification row (mirrors HomePage NewsRow but kept local
// to avoid coupling to home module internals).
function NewsArchiveNotificationRow({
  notification,
  onMarkAsRead,
}: {
  notification: Notification
  onMarkAsRead: (id: string) => void
}) {
  const { t } = useTranslation('notifications')
  const navigate = useNavigate()

  const message = (() => {
    try {
      const data = notification.body ? JSON.parse(notification.body) : {}
      const raw = String(t(notification.title, data))
      return raw.replace(/\s*@\s*$/, '').replace(/(\d{2}:\d{2}):\d{2}/g, '$1')
    } catch {
      return notification.title.replace(/(\d{2}:\d{2}):\d{2}/g, '$1')
    }
  })()

  const timeAgo = (() => {
    const ts = notification.date_created ?? notification.created
    if (!ts) return ''
    const diff = Date.now() - new Date(ts).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return String(t('justNow'))
    if (minutes < 60) return String(t('minutesAgo', { count: minutes }))
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return String(t('hoursAgo', { count: hours }))
    const days = Math.floor(hours / 24)
    return String(t('daysAgo', { count: days }))
  })()

  const path = (() => {
    if (notification.type === 'duty_delegation_request' || notification.activity_type === 'scorer_duty') return '/scorer'
    if (notification.activity_type === 'game') return '/games'
    if (notification.activity_type === 'training') return '/trainings'
    if (notification.activity_type === 'event') return '/events'
    return '/'
  })()

  return (
    <div
      onClick={() => {
        if (!notification.read) onMarkAsRead(notification.id)
        navigate(path)
      }}
      className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700/50 dark:active:bg-gray-700"
    >
      <p className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{message}</p>
      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{timeAgo}</span>
    </div>
  )
}
