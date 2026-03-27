import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchItems, updateRecord } from '../lib/api'
import { useAuth } from './useAuth'
import { useRealtime } from './useRealtime'
import type { Notification } from '../types'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const userIdRef = useRef(user?.id)
  userIdRef.current = user?.id

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }
    try {
      const result = await fetchItems<Notification>('notifications', {
        filter: { member: { _eq: user.id } },
        sort: ['-date_created'],
        limit: 30,
      })
      setNotifications(result)
      setUnreadCount(result.filter((n: Notification) => !n.read).length)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Listen for new notifications in realtime
  useRealtime<Notification>('notifications', (e) => {
    if (e.record.member !== userIdRef.current) return
    if (e.action === 'create') {
      setNotifications((prev) => [e.record, ...prev].slice(0, 30))
      setUnreadCount((c) => c + 1)
    } else if (e.action === 'update') {
      setNotifications((prev) => prev.map((n) => (n.id === e.record.id ? e.record : n)))
      // Recalculate unread
      setNotifications((prev) => {
        setUnreadCount(prev.filter((n) => !n.read).length)
        return prev
      })
    } else if (e.action === 'delete') {
      setNotifications((prev) => prev.filter((n) => n.id !== e.record.id))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
  })

  const markAsRead = useCallback(async (id: string) => {
    try {
      await updateRecord('notifications', id, { read: true })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // silently fail
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read)
    try {
      await Promise.all(unread.map((n) => updateRecord('notifications', n.id, { read: true })))
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silently fail
    }
  }, [notifications])

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch: fetchNotifications }
}
