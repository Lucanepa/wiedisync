import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'
import pb from '../pb'
import { useAuth } from './useAuth'
import { CLUB_COLLECTIONS } from '../clubConfig'

type RealtimeAction = 'create' | 'update' | 'delete'

export function useRealtime<T extends RecordModel>(
  collection: string,
  callback: (data: RecordSubscription<T>) => void,
  actions?: RealtimeAction[],
) {
  const { clubId } = useAuth()
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const clubIdRef = useRef(clubId)
  clubIdRef.current = clubId

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    pb.collection(collection)
      .subscribe('*', (e: RecordSubscription<T>) => {
        // Filter realtime events by club for domain collections
        if (clubIdRef.current && CLUB_COLLECTIONS.has(collection)) {
          const recordClub = (e.record as Record<string, unknown>).club as string | undefined
          if (recordClub && recordClub !== clubIdRef.current) return
        }
        if (!actionsRef.current || actionsRef.current.includes(e.action as RealtimeAction)) {
          callbackRef.current(e)
        }
      })
      .then((unsub) => {
        if (cancelled) unsub()
        else unsubscribe = unsub
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [collection])
}
