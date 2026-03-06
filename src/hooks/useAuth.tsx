import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { RecordModel } from 'pocketbase'
import pb from '../pb'
import i18n from '../i18n'
import { pbLangToI18n } from '../utils/languageMap'
import { getCurrentSeason } from '../utils/dateHelpers'
import type { Member, MemberTeam, Team } from '../types'

interface AuthContextValue {
  user: (RecordModel & Member) | null
  isSuperAdmin: boolean
  isAdmin: boolean
  isApproved: boolean
  isProfileComplete: boolean
  isCoach: boolean
  isCoachOf: (teamId: string) => boolean
  coachTeamIds: string[]
  memberTeamIds: string[]
  memberTeamNames: string[]
  canViewTeam: (teamId: string) => boolean
  isVorstand: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(RecordModel & Member) | null>(
    pb.authStore.record as (RecordModel & Member) | null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [coachTeamIds, setCoachTeamIds] = useState<string[]>([])
  const [memberTeamIds, setMemberTeamIds] = useState<string[]>([])
  const [memberTeamNames, setMemberTeamNames] = useState<string[]>([])

  // Auth refresh — skip if token was just issued (within last 5s, e.g. right after login)
  useEffect(() => {
    if (pb.authStore.isValid) {
      const token = pb.authStore.token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const issuedAt = (payload.iat ?? 0) * 1000
        const isFresh = Date.now() - issuedAt < 5000
        if (isFresh) {
          setIsLoading(false)
        } else {
          pb.collection('members').authRefresh()
            .catch(() => pb.authStore.clear())
            .finally(() => setIsLoading(false))
        }
      } catch {
        pb.collection('members').authRefresh()
          .catch(() => pb.authStore.clear())
          .finally(() => setIsLoading(false))
      }
    } else {
      setIsLoading(false)
    }

    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(record as (RecordModel & Member) | null)
    })

    return unsubscribe
  }, [])

  // Sync i18n language from user's stored preference
  useEffect(() => {
    if (user?.language) {
      const lang = pbLangToI18n(user.language)
      if (i18n.language !== lang) {
        i18n.changeLanguage(lang)
        localStorage.setItem('kscw-lang', lang)
      }
    }
  }, [user?.language])

  // Fetch teams where user has a leadership role (coach, team_responsible)
  useEffect(() => {
    if (!user?.id) {
      setCoachTeamIds([])
      return
    }

    const uid = user.id
    pb.collection('teams')
      .getFullList<Team>({
        filter: `active=true && (coach~"${uid}" || team_responsible~"${uid}")`,
      })
      .then((teams) => {
        setCoachTeamIds(teams.map((t) => t.id))
      })
      .catch(() => setCoachTeamIds([]))
  }, [user?.id])

  // Fetch teams the user is a member of (current season)
  useEffect(() => {
    if (!user?.id) {
      setMemberTeamIds([])
      setMemberTeamNames([])
      return
    }
    const season = getCurrentSeason()
    pb.collection('member_teams')
      .getFullList<MemberTeam & { expand?: { team?: Team } }>({
        filter: `member="${user.id}" && season="${season}"`,
        expand: 'team',
      })
      .then((mts) => {
        setMemberTeamIds(mts.map((mt) => mt.team))
        setMemberTeamNames(mts.map((mt) => mt.expand?.team?.name).filter((n): n is string => !!n))
      })
      .catch(() => {
        setMemberTeamIds([])
        setMemberTeamNames([])
      })
  }, [user?.id])

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection('members').authWithPassword(email, password)
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
  }, [])

  const roles = user?.role ?? []
  const isSuperAdmin = roles.includes('superuser')
  const isAdmin = roles.includes('admin') || isSuperAdmin
  const isApproved = user?.approved === true || isAdmin
  const isProfileComplete = !!user?.language
  const isVorstand = roles.includes('vorstand') || isAdmin

  const isCoach = coachTeamIds.length > 0 || isAdmin

  const isCoachOf = useCallback(
    (teamId: string) => isAdmin || coachTeamIds.includes(teamId),
    [isAdmin, coachTeamIds],
  )

  const canViewTeam = useCallback(
    (teamId: string) => isAdmin || isVorstand || isCoach || memberTeamIds.includes(teamId),
    [isAdmin, isVorstand, isCoach, memberTeamIds],
  )

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, isAdmin, isApproved, isProfileComplete, isCoach, isCoachOf, coachTeamIds, memberTeamIds, memberTeamNames, canViewTeam, isVorstand, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
