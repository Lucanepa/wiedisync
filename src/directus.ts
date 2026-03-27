import { createDirectus, rest, authentication, realtime } from '@directus/sdk'

const AUTH_KEY = 'directus_auth'
const REMEMBER_KEY = 'wiedisync-remember-me'

function isRememberMe(): boolean {
  return localStorage.getItem(REMEMBER_KEY) !== 'false'
}

function getStorage(): Storage {
  return isRememberMe() ? localStorage : sessionStorage
}

// Auto-detect API: only wiedisync.kscw.ch uses prod, everything else uses dev
const host = typeof window !== 'undefined' ? window.location.hostname : ''
const isProd = host === 'wiedisync.kscw.ch'
const directusUrl = isProd
  ? 'https://directus.kscw.ch'
  : (import.meta.env.VITE_DIRECTUS_URL || 'https://directus-dev.kscw.ch')

const directus = createDirectus(directusUrl)
  .with(authentication('json', {
    storage: {
      get: () => {
        const raw = getStorage().getItem(AUTH_KEY)
        return raw ? JSON.parse(raw) : null
      },
      set: (data) => {
        getStorage().setItem(AUTH_KEY, JSON.stringify(data))
      },
    },
    autoRefresh: true,
  }))
  .with(rest())
  .with(realtime())

export const getDirectusUrl = () => directusUrl

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(AUTH_KEY)
  localStorage.removeItem('wiedisync-sql-history')
}

export function getAccessToken(): string | null {
  const raw = getStorage().getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)?.access_token || null
  } catch {
    return null
  }
}

export function getFileUrl(fileId: string | null): string {
  if (!fileId) return ''
  return `${directusUrl}/assets/${fileId}`
}

export default directus
