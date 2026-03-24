import PocketBase, { AsyncAuthStore } from 'pocketbase'

const AUTH_KEY = 'pocketbase_auth'
const REMEMBER_KEY = 'wiedisync-remember-me'

function isRememberMe(): boolean {
  return localStorage.getItem(REMEMBER_KEY) !== 'false'
}

function getStorage(): Storage {
  return isRememberMe() ? localStorage : sessionStorage
}

const store = new AsyncAuthStore({
  save: async (serialized: string) => {
    getStorage().setItem(AUTH_KEY, serialized)
  },
  clear: async () => {
    localStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(AUTH_KEY)
    localStorage.removeItem('wiedisync-sql-history')
  },
  initial: getStorage().getItem(AUTH_KEY) || '',
})

// Auto-detect API: dev/preview domains use dev API, production uses prod API
const host = typeof window !== 'undefined' ? window.location.hostname : ''
const isDevDomain = host.startsWith('dev.') || (host.endsWith('.pages.dev') && !host.startsWith('wiedisync.pages.dev'))
const pbUrl = isDevDomain ? 'https://api-dev.kscw.ch' : (import.meta.env.VITE_PB_URL || 'https://api.kscw.ch')

const pb = new PocketBase(pbUrl, store)

pb.autoCancellation(false)

export default pb
