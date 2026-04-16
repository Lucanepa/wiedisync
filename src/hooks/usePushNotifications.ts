import { useState, useEffect, useCallback } from 'react'
import { API_URL, kscwApi } from '../lib/api'
import { toast } from 'sonner'

interface PushState {
  /** Browser supports push notifications */
  supported: boolean
  /** Notification permission: 'default' | 'granted' | 'denied' */
  permission: NotificationPermission
  /** Currently subscribed to push */
  subscribed: boolean
  /** Loading state during subscribe/unsubscribe */
  loading: boolean
}

/**
 * Hook for managing Web Push notification subscriptions.
 * Handles permission requests, SW subscription, and backend registration.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: false,
  })

  // Check initial state
  useEffect(() => {
    const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    // Brave on Android blocks FCM with no user-facing toggle to re-enable it.
    // Desktop Brave has a toggle, so only exclude mobile Brave.
    const isBraveMobile = 'brave' in navigator && /Android|Mobile/i.test(navigator.userAgent)
    const supported = hasApis && !isBraveMobile

    if (!supported) {
      setState(s => ({ ...s, supported: false }))
      return
    }

    setState(s => ({ ...s, supported: true, permission: Notification.permission }))

    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setState(s => ({ ...s, subscribed: !!sub }))
      })
    })
  }, [])

  const subscribe = useCallback(async () => {
    if (!state.supported || state.loading) return false

    setState(s => ({ ...s, loading: true }))

    try {
      // Request permission
      const permission = await Notification.requestPermission()
      setState(s => ({ ...s, permission }))

      if (permission !== 'granted') {
        setState(s => ({ ...s, loading: false }))
        return false
      }

      // Get VAPID public key from Directus (public endpoint, no auth needed)
      const vapidResp = await fetch(`${API_URL}/kscw/web-push/vapid-public-key`)
      if (!vapidResp.ok) throw new Error(`VAPID key fetch failed: ${vapidResp.status}`)
      const { publicKey } = await vapidResp.json()

      // Subscribe via PushManager
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      })

      const subJson = subscription.toJSON()

      // Register with Directus (uses kscwApi with 401 retry)
      await kscwApi('/web-push/subscribe', {
        method: 'POST',
        body: {
          endpoint: subJson.endpoint,
          keys_p256dh: subJson.keys?.p256dh || '',
          keys_auth: subJson.keys?.auth || '',
          user_agent: navigator.userAgent,
        },
      })

      setState(s => ({ ...s, subscribed: true, loading: false }))
      return true
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
      const msg = (err instanceof Error ? err.message : '') || ''
      // Detect push service failures (Brave blocks FCM, network issues, etc.)
      if (msg.includes('push service') || msg.includes('AbortError') || err instanceof DOMException) {
        const isBrave = 'brave' in navigator
        toast.error(
          isBrave
            ? 'Brave blockiert Push-Dienste. Aktiviere unter brave://settings/privacy → „Google-Dienste für Push-Nachrichten verwenden".'
            : 'Push-Dienst nicht erreichbar. Bitte prüfe deine Browser-Einstellungen oder versuche es in Chrome/Firefox.',
          { duration: 8000 },
        )
      } else {
        toast.error('Push-Benachrichtigungen konnten nicht aktiviert werden.')
      }
      setState(s => ({ ...s, loading: false }))
      return false
    }
  }, [state.supported, state.loading])

  const unsubscribe = useCallback(async () => {
    if (!state.supported || state.loading) return false

    setState(s => ({ ...s, loading: true }))

    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint

        // Unsubscribe from browser
        await subscription.unsubscribe()

        // Remove from Directus (uses kscwApi with 401 retry)
        await kscwApi('/web-push/unsubscribe', {
          method: 'POST',
          body: { endpoint },
        })
      }

      setState(s => ({ ...s, subscribed: false, loading: false }))
      return true
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err)
      toast.error('Push-Benachrichtigungen konnten nicht deaktiviert werden.')
      setState(s => ({ ...s, loading: false }))
      return false
    }
  }, [state.supported, state.loading])

  return {
    ...state,
    subscribe,
    unsubscribe,
  }
}

/** Convert base64url VAPID key to Uint8Array for PushManager.subscribe() */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
