import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Handles the OAuth redirect callback from Directus SSO.
 *
 * Directus redirects back with access_token + refresh_token + expires in the
 * URL search params. We require an `oauth_pending` sentinel set by
 * loginWithOAuth() to be present and fresh — that closes the CSRF window
 * where an attacker tricks a victim into loading a crafted callback URL.
 */
export default function OAuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expires = params.get('expires')

    let consumed = false
    let pending: { nonce?: string; ts?: number; provider?: string } | null = null
    try {
      const raw = sessionStorage.getItem('oauth_pending')
      if (raw) pending = JSON.parse(raw)
    } catch { /* malformed — treat as absent */ }
    // Clear the sentinel before any branch — single-use.
    try { sessionStorage.removeItem('oauth_pending') } catch { /* ignore */ }

    // Reject token params that didn't come from a recent loginWithOAuth click.
    // 5-minute freshness window covers slow Google consent screens.
    const fresh = !!pending?.ts && (Date.now() - pending.ts) < 5 * 60 * 1000
    if (accessToken && refreshToken && fresh) {
      const authData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires: expires ? Number(expires) : null,
      }
      const rememberMe = localStorage.getItem('wiedisync-remember-me') !== 'false'
      const storage = rememberMe ? localStorage : sessionStorage
      storage.setItem('directus_auth', JSON.stringify(authData))
      consumed = true
    }

    // Always strip tokens from URL before any subsequent navigation/render
    window.history.replaceState({}, '', '/auth/callback')

    if (consumed) {
      navigate('/', { replace: true })
    } else {
      // Either no tokens, or no recent OAuth attempt — bounce to login
      navigate('/login?oauth=expired', { replace: true })
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <img
        src="/wiedisync_logo.svg"
        alt="Loading…"
        className="h-24 w-24 animate-spin"
        style={{ animationDuration: '2s' }}
      />
    </div>
  )
}
