import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { readMe, readItems } from '@directus/sdk'
import { client, login as apiLogin, logout as apiLogout, refreshAuth, isAuthenticated, API_URL, fetchItems } from '../lib/api'
import { queryClient } from '../lib/query'
import { setSentryUser, captureAuthError, captureApiError, addBreadcrumb } from '../lib/sentry'
import i18n from '../i18n'
import { backendLangToI18n } from '../utils/languageMap'
import { getCurrentSeason } from '../utils/dateHelpers'
import type { Member, Team } from '../types'

// ── Types ───────────────────────────────────────────────────────────

type MemberUser = Member & { id: string }

export interface AuthContextValue {
  user: MemberUser | null
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
  coachTeamNames: string[]
  memberTeamIds: string[]
  memberTeamNames: string[]
  teamsLoading: boolean
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

// ── Provider ────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MemberUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [coachTeamIds, setCoachTeamIds] = useState<string[]>([])
  const [coachTeamNames, setCoachTeamNames] = useState<string[]>([])
  const [memberTeamIds, setMemberTeamIds] = useState<string[]>([])
  const [memberTeamNames, setMemberTeamNames] = useState<string[]>([])
  const [memberSports, setMemberSports] = useState<Set<'volleyball' | 'basketball'>>(new Set())
  const [teamSportById, setTeamSportById] = useState<Record<string, 'volleyball' | 'basketball'>>({})
  const [guestLevelByTeam, setGuestLevelByTeam] = useState<Record<string, number>>({})
  const [teamsReady, setTeamsReady] = useState(false)
  const teamsLoading = !!user && !teamsReady

  // ── Fetch current member from Directus user ─────────────────────

  const fetchMember = useCallback(async (): Promise<MemberUser | null> => {
    try {
      const me = await client.request(readMe({ fields: ['id'] }))
      if (!me?.id) return null
      const members = await fetchItems<MemberUser>('members', {
        filter: { user: { _eq: me.id } },
        limit: 1,
      })
      return members[0] ?? null
    } catch {
      return null
    }
  }, [])

  // ── Load team context (single parallel fetch) ───────────────────

  const loadTeamContext = useCallback(async (memberId: string | number) => {
    try {
      const [coachRows, trRows, memberTeams, allTeams] = await Promise.all([
        client.request(readItems('teams_coaches', {
          filter: { members_id: { _eq: memberId } },
          fields: ['teams_id'], limit: -1,
        } as never)) as Promise<{ teams_id: number }[]>,
        client.request(readItems('teams_responsibles', {
          filter: { members_id: { _eq: memberId } },
          fields: ['teams_id'], limit: -1,
        } as never)) as Promise<{ teams_id: number }[]>,
        client.request(readItems('member_teams', {
          filter: { member: { _eq: memberId }, season: { _eq: getCurrentSeason() } },
          fields: ['team', 'guest_level'], limit: -1,
        } as never)) as Promise<{ team: number; guest_level: number }[]>,
        client.request(readItems('teams', {
          filter: { active: { _eq: true } },
          fields: ['id', 'name', 'sport'], limit: -1,
        } as never)) as Promise<Pick<Team, 'id' | 'name' | 'sport'>[]>,
      ])

      const teamMap = new Map(allTeams.map(t => [String(t.id), t]))
      const coachIdSet = new Set([...coachRows.map(r => String(r.teams_id)), ...trRows.map(r => String(r.teams_id))])

      setCoachTeamIds([...coachIdSet])
      setCoachTeamNames([...coachIdSet].map(id => teamMap.get(id)?.name).filter((n): n is string => !!n))
      setMemberTeamIds(memberTeams.map(mt => String(mt.team)))
      setMemberTeamNames(memberTeams.map(mt => teamMap.get(String(mt.team))?.name).filter((n): n is string => !!n))

      const sports = new Set<'volleyball' | 'basketball'>()
      for (const mt of memberTeams) {
        const s = teamMap.get(String(mt.team))?.sport
        if (s === 'volleyball' || s === 'basketball') sports.add(s)
      }
      setMemberSports(sports)

      const glMap: Record<string, number> = {}
      for (const mt of memberTeams) glMap[String(mt.team)] = mt.guest_level ?? 0
      setGuestLevelByTeam(glMap)

      const sportById: Record<string, 'volleyball' | 'basketball'> = {}
      for (const t of allTeams) {
        if (t.sport === 'volleyball' || t.sport === 'basketball') sportById[String(t.id)] = t.sport
      }
      setTeamSportById(sportById)
      setTeamsReady(true)
    } catch (err) {
      captureApiError(err, { operation: 'loadTeamContext', collection: 'member_teams' })
      setTeamsReady(true)
    }
  }, [])

  // ── Init ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated()) { setIsLoading(false); return }
    ;(async () => {
      try {
        await refreshAuth()
        const member = await fetchMember()
        if (member) {
          setUser(member)
          addBreadcrumb('auth.init', { memberId: member.id })
          setSentryUser({ id: member.id })
          await loadTeamContext(member.id)
        } else {
          // Token refreshed but no linked member — clear auth
          await apiLogout()
        }
      } catch (err) {
        captureAuthError(err, { action: 'session_restore' })
        // Refresh failed — token is stale/invalid, clear everything
        await apiLogout()
        // Force reload to clear SDK internal state
        window.location.reload()
        return
      } finally {
        setIsLoading(false)
      }
    })()
  }, [fetchMember, loadTeamContext])

  // Sync i18n
  useEffect(() => {
    if (user?.language) {
      const lang = backendLangToI18n(user.language)
      if (i18n.language !== lang) { i18n.changeLanguage(lang); localStorage.setItem('wiedisync-lang', lang) }
    }
  }, [user?.language])

  // Enrich Sentry user context once user + teams are fully loaded
  useEffect(() => {
    if (!user || !teamsReady) return
    setSentryUser({
      id: user.id,
      roles: Array.isArray(user.role) ? user.role : [],
      memberTeamIds,
      coachTeamIds,
      primarySport: memberSports.size === 1 ? [...memberSports][0] : 'both',
      isAdmin: Array.isArray(user.role) && (
        user.role.includes('admin') || user.role.includes('superuser') ||
        user.role.includes('vb_admin') || user.role.includes('bb_admin')
      ),
    })
  }, [user, teamsReady, memberTeamIds, coachTeamIds, memberSports])

  // ── Actions ─────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    addBreadcrumb('auth.login_attempt')
    await apiLogin(email, password)
    const member = await fetchMember()
    if (member) {
      setUser(member)
      addBreadcrumb('auth.login_success', { memberId: member.id })
      setSentryUser({ id: member.id })
      await loadTeamContext(member.id)
    }
  }, [fetchMember, loadTeamContext])

  const loginWithOAuth = useCallback(async (provider: string) => {
    window.location.href = `${API_URL}/auth/login/${provider}?redirect=${encodeURIComponent(window.location.origin + '/auth/callback')}`
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setSentryUser(null)
    setUser(null)
    setCoachTeamIds([]); setCoachTeamNames([])
    setMemberTeamIds([]); setMemberTeamNames([])
    setMemberSports(new Set()); setGuestLevelByTeam({}); setTeamSportById({})
    setTeamsReady(false)
    queryClient.clear()
  }, [])

  // ── Derived ─────────────────────────────────────────────────────

  const roles = user?.role ?? []
  const isSuperAdmin = roles.includes('superuser')
  const isGlobalAdmin = roles.includes('admin') || isSuperAdmin
  const isVbAdmin = roles.includes('vb_admin')
  const isBbAdmin = roles.includes('bb_admin')
  const isAdmin = isGlobalAdmin || isVbAdmin || isBbAdmin
  const isApproved = user?.coach_approved_team === true || isAdmin || memberTeamIds.length > 0 || coachTeamIds.length > 0
  const isProfileComplete = !!user?.language && !!user?.first_name
  const isVorstand = roles.includes('vorstand') || isGlobalAdmin
  const isCoach = coachTeamIds.length > 0 || isGlobalAdmin
  const primarySport: 'volleyball' | 'basketball' | 'both' =
    memberSports.size === 1 ? [...memberSports][0] : 'both'

  const hasAdminAccessToSport = useCallback(
    (sport: 'volleyball' | 'basketball') => isGlobalAdmin || (sport === 'volleyball' ? isVbAdmin : isBbAdmin),
    [isGlobalAdmin, isVbAdmin, isBbAdmin],
  )
  const hasAdminAccessToTeam = useCallback(
    (teamId: string) => {
      const sport = teamSportById[teamId]
      return !sport ? isGlobalAdmin : hasAdminAccessToSport(sport)
    },
    [teamSportById, isGlobalAdmin, hasAdminAccessToSport],
  )
  const isCoachOf = useCallback(
    (teamId: string) => hasAdminAccessToTeam(teamId) || coachTeamIds.includes(teamId),
    [hasAdminAccessToTeam, coachTeamIds],
  )
  const canParticipateIn = useCallback(
    (teamId: string) => memberTeamIds.includes(teamId) || coachTeamIds.includes(teamId),
    [memberTeamIds, coachTeamIds],
  )
  const isStaffOnly = useCallback(
    (teamId: string) => teamsReady && coachTeamIds.includes(teamId) && !memberTeamIds.includes(teamId),
    [coachTeamIds, memberTeamIds, teamsReady],
  )
  const canViewTeam = useCallback(
    (teamId: string) => hasAdminAccessToTeam(teamId) || isVorstand || coachTeamIds.includes(teamId) || memberTeamIds.includes(teamId),
    [hasAdminAccessToTeam, isVorstand, coachTeamIds, memberTeamIds],
  )
  const getGuestLevel = useCallback((teamId: string) => guestLevelByTeam[teamId] ?? 0, [guestLevelByTeam])
  const isGuestIn = useCallback((teamId: string) => getGuestLevel(teamId) > 0, [getGuestLevel])

  const value = useMemo<AuthContextValue>(() => ({
    user, isSuperAdmin, isAdmin, isGlobalAdmin, isVbAdmin, isBbAdmin,
    hasAdminAccessToSport, hasAdminAccessToTeam, isApproved, isProfileComplete,
    isCoach, isCoachOf, canParticipateIn, isStaffOnly, coachTeamIds, coachTeamNames,
    memberTeamIds, memberTeamNames, teamsLoading, memberSports, primarySport,
    canViewTeam, isVorstand, getGuestLevel, isGuestIn, isLoading, login, loginWithOAuth, logout,
  }), [
    user, isSuperAdmin, isAdmin, isGlobalAdmin, isVbAdmin, isBbAdmin,
    hasAdminAccessToSport, hasAdminAccessToTeam, isApproved, isProfileComplete,
    isCoach, isCoachOf, canParticipateIn, isStaffOnly, coachTeamIds, coachTeamNames,
    memberTeamIds, memberTeamNames, teamsLoading, memberSports, primarySport,
    canViewTeam, isVorstand, getGuestLevel, isGuestIn, isLoading, login, loginWithOAuth, logout,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
