import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Handles the OAuth redirect callback from Directus SSO.
 *
 * Directus redirects back with access_token + refresh_token + expires in the
 * URL search params. We extract them, store in the auth storage (so the
 * Directus SDK picks them up), clean the URL to remove tokens from browser
 * history, then redirect to the app root where useAuth will restore the session.
 */
export default function OAuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expires = params.get('expires')

    if (accessToken && refreshToken) {
      // Store tokens in the same format the Directus SDK expects
      const authData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires: expires ? Number(expires) : null,
      }

      // Determine storage based on remember-me preference
      const rememberMe = localStorage.getItem('wiedisync-remember-me') !== 'false'
      const storage = rememberMe ? localStorage : sessionStorage
      storage.setItem('directus_auth', JSON.stringify(authData))
    }

    // Clean tokens from URL to prevent leaking via browser history / Referer
    window.history.replaceState({}, '', '/auth/callback')

    // Navigate to root — useAuth init will detect the token and restore the session
    navigate('/', { replace: true })
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
