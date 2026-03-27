import { useEffect, useRef } from 'react'
import directus from '../directus'

type RealtimeAction = 'create' | 'update' | 'delete'

interface RealtimeEvent<T = Record<string, unknown>> {
  action: RealtimeAction
  record: T
}

export function useRealtime<T = Record<string, unknown>>(
  collection: string,
  callback: (data: RealtimeEvent<T>) => void,
  actions?: RealtimeAction[],
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    let cleanup: (() => void) | undefined

    const setup = async () => {
      try {
        // Directus WebSocket subscription
        const { subscription, unsubscribe } = await directus.subscribe(collection, {
          event: 'changes' as never,
        })

        cleanup = unsubscribe

        // Listen for messages
        ;(async () => {
          for await (const message of subscription) {
            const event = message as unknown as { event: string; data: T[] }
            if (!event.data) continue

            // Map Directus events to our action types
            let action: RealtimeAction = 'update'
            if (event.event === 'create') action = 'create'
            else if (event.event === 'delete') action = 'delete'
            else if (event.event === 'update') action = 'update'

            if (!actionsRef.current || actionsRef.current.includes(action)) {
              for (const record of event.data) {
                callbackRef.current({ action, record })
              }
            }
          }
        })()
      } catch {
        // WebSocket connection failed — ignore (works without realtime)
      }
    }

    setup()

    return () => {
      cleanup?.()
    }
  }, [collection])
}
