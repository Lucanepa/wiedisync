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
  isGlobalAdmin: boolean
  isVbAdmin: boolean
  isBbAdmin: boolean
  hasAdminAccessToSport: (sport: 'volleyball' | 'basketball') => boolean
  hasAdminAccessToTeam: (teamId: string) => boolean
  isApproved: boolean
  isProfileComplete: boolean
  isCoach: boolean
  isCoachOf: (teamId: string) => boolean
  canParticipateIn: (teamId: string) => boolean
  isStaffOnly: (teamId: string) => boolean
  coachTeamIds: string[]
  memberTeamIds: string[]
  memberTeamNames: string[]
  memberSports: Set<'volleyball' | 'basketball'>
  primarySport: 'volleyball' | 'basketball' | 'both'
  canViewTeam: (teamId: string) => boolean
  isVorstand: boolean
  getGuestLevel: (teamId: string) => number
  isGuestIn: (teamId: string) => boolean
  isLoading: boolean
  login: (email: string, password: string, turnstileToken?: string) => Promise<void>
  loginWithOAuth: (provider: string) => Promise<void>
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
  const [memberSports, setMemberSports] = useState<Set<'volleyball' | 'basketball'>>(new Set())
  const [teamSportById, setTeamSportById] = useState<Record<string, 'volleyball' | 'basketball'>>({})
  const [guestLevelByTeam, setGuestLevelByTeam] = useState<Record<string, number>>({})

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
        localStorage.setItem('wiedisync-lang', lang)
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

  // Team sport lookup map (used for scoped admin checks by teamId)
  useEffect(() => {
    if (!user?.id) {
      setTeamSportById({})
      return
    }

    pb.collection('teams')
      .getFullList<Team>({
        filter: `active=true`,
        fields: 'id,sport',
      })
      .then((allTeams) => {
        const next: Record<string, 'volleyball' | 'basketball'> = {}
        for (const t of allTeams) {
          if (t.sport === 'volleyball' || t.sport === 'basketball') {
            next[t.id] = t.sport
          }
        }
        setTeamSportById(next)
      })
      .catch(() => setTeamSportById({}))
  }, [user?.id])

  // Fetch teams the user is a member of (current season)
  useEffect(() => {
    if (!user?.id) {
      setMemberTeamIds([])
      setMemberTeamNames([])
      setMemberSports(new Set())
      setGuestLevelByTeam({})
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
        const sports = new Set<'volleyball' | 'basketball'>()
        for (const mt of mts) {
          const s = mt.expand?.team?.sport
          if (s === 'volleyball' || s === 'basketball') sports.add(s)
        }
        setMemberSports(sports)
        const glMap: Record<string, number> = {}
        for (const mt of mts) {
          glMap[mt.team] = mt.guest_level ?? 0
        }
        setGuestLevelByTeam(glMap)
      })
      .catch(() => {
        setMemberTeamIds([])
        setMemberTeamNames([])
        setMemberSports(new Set())
        setGuestLevelByTeam({})
      })
  }, [user?.id])

  const login = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    await pb.collection('members').authWithPassword(email, password, {
      headers: turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : {},
    })
  }, [])

  const loginWithOAuth = useCallback(async (provider: string) => {
    await pb.collection('members').authWithOAuth2({ provider })
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
  }, [])

  const roles = user?.role ?? []
  const isSuperAdmin = roles.includes('superuser')
  const isGlobalAdmin = roles.includes('admin') || isSuperAdmin
  const isVbAdmin = roles.includes('vb_admin')
  const isBbAdmin = roles.includes('bb_admin')
  const hasAdminAccessToSport = useCallback(
    (sport: 'volleyball' | 'basketball') =>
      isGlobalAdmin || (sport === 'volleyball' ? isVbAdmin : isBbAdmin),
    [isGlobalAdmin, isVbAdmin, isBbAdmin],
  )
  const hasAdminAccessToTeam = useCallback(
    (teamId: string) => {
      if (!teamId) return false
      const sport = teamSportById[teamId]
      if (!sport) return isGlobalAdmin
      return hasAdminAccessToSport(sport)
    },
    [teamSportById, isGlobalAdmin, hasAdminAccessToSport],
  )
  const isAdmin = isGlobalAdmin || isVbAdmin || isBbAdmin
  const isApproved = user?.coach_approved_team === true || isAdmin
  const isProfileComplete = !!user?.language && !!user?.first_name
  const isVorstand = roles.includes('vorstand') || isGlobalAdmin
  const getGuestLevel = useCallback(
    (teamId: string) => guestLevelByTeam[teamId] ?? 0,
    [guestLevelByTeam],
  )

  const isGuestIn = useCallback(
    (teamId: string) => getGuestLevel(teamId) > 0,
    [getGuestLevel],
  )
  const primarySport: 'volleyball' | 'basketball' | 'both' =
    memberSports.size === 1 ? [...memberSports][0] : 'both'

  const isCoach = coachTeamIds.length > 0 || isGlobalAdmin

  const isCoachOf = useCallback(
    (teamId: string) => hasAdminAccessToTeam(teamId) || coachTeamIds.includes(teamId),
    [hasAdminAccessToTeam, coachTeamIds],
  )

  /** Coach/team_responsible can participate (for attendance tracking) even if not a player */
  const canParticipateIn = useCallback(
    (teamId: string) => memberTeamIds.includes(teamId) || coachTeamIds.includes(teamId),
    [memberTeamIds, coachTeamIds],
  )

  /** True if user is staff (coach/team_responsible) but NOT a player on this team */
  const isStaffOnly = useCallback(
    (teamId: string) => coachTeamIds.includes(teamId) && !memberTeamIds.includes(teamId),
    [coachTeamIds, memberTeamIds],
  )

  const canViewTeam = useCallback(
    (teamId: string) =>
      hasAdminAccessToTeam(teamId) ||
      isVorstand ||
      coachTeamIds.includes(teamId) ||
      memberTeamIds.includes(teamId),
    [hasAdminAccessToTeam, isVorstand, coachTeamIds, memberTeamIds],
  )

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, isAdmin, isGlobalAdmin, isVbAdmin, isBbAdmin, hasAdminAccessToSport, hasAdminAccessToTeam, isApproved, isProfileComplete, isCoach, isCoachOf, canParticipateIn, isStaffOnly, coachTeamIds, memberTeamIds, memberTeamNames, memberSports, primarySport, canViewTeam, isVorstand, getGuestLevel, isGuestIn, isLoading, login, loginWithOAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
