import { useState, useEffect, useCallback } from 'react'
import { API_URL, getAccessToken } from '../lib/api'

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
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

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

      // Get VAPID public key from Directus
      const vapidResp = await fetch(`${API_URL}/kscw/web-push/vapid-public-key`)
      const { publicKey } = await vapidResp.json()

      // Subscribe via PushManager
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      })

      const subJson = subscription.toJSON()

      // Register with Directus
      const token = getAccessToken()
      await fetch(`${API_URL}/kscw/web-push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys_p256dh: subJson.keys?.p256dh || '',
          keys_auth: subJson.keys?.auth || '',
          user_agent: navigator.userAgent,
        }),
      })

      setState(s => ({ ...s, subscribed: true, loading: false }))
      return true
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
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

        // Remove from Directus
        const token = getAccessToken()
        await fetch(`${API_URL}/kscw/web-push/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ endpoint }),
        })
      }

      setState(s => ({ ...s, subscribed: false, loading: false }))
      return true
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err)
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
