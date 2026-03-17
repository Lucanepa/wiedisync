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

const pb = new PocketBase(import.meta.env.VITE_PB_URL, store)

pb.autoCancellation(false)

export default pb
