import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { kscwApi } from '../../lib/api'
import DashboardSection from './components/DashboardSection'
import TeamChip from '../../components/TeamChip'

// ── Types ────────────────────────────────────────────────────────

interface StatsOverview {
  active_members: string
  active_teams: string
  vb_teams: string
  bb_teams: string
  upcoming_games: string
  completed_games: string
  upcoming_trainings: string
  upcoming_events: string
  upcoming_home_games: string
  upcoming_home_games_no_schreiber: string
}

interface StatsMembers {
  total_members: string
  active_wiedisync: string
  shell_accounts: string
  registered_users: string
  licence_scorer_vb: string
  licence_referee_vb: string
  licence_otr1_bb: string
  licence_otr2_bb: string
  role_superuser: string
  role_admin: string
  role_vb_admin: string
  role_bb_admin: string
  role_vorstand: string
}

interface TeamRoster {
  team_id: number
  team_name: string
  sport: string
  league: string
  roster_size: string
  guest_count: string
  members_with_scorer_licence: string
  coach_count: string
  captain_count: string
  team_responsible_count: string
}

interface SchreiberCoverage {
  team_id: number
  team_name: string
  sport: string
  total_home_games: string
  vb_any_duty_assigned: string
  vb_no_duty_assigned: string
  bb_any_duty_assigned: string
  bb_no_duty_assigned: string
}

interface MissingSchreiber {
  game_id: number
  game_date: string
  game_time: string
  home_team: string
  away_team: string
  league: string
  team_id: number
  team_name: string
  sport: string
  missing_roles: string
}

interface Participation {
  team_id: number
  team_name: string
  sport: string
  games_total: string
  games_responses: string
  games_confirmed: string
  games_declined: string
  games_tentative: string
  trainings_total: string
  trainings_responses: string
  trainings_confirmed: string
  trainings_declined: string
  trainings_tentative: string
}

interface GameResult {
  team_id: number
  team_name: string
  sport: string
  season: string
  games_played: string
  total_wins: string
  total_losses: string
  home_wins: string
  home_losses: string
  away_wins: string
  away_losses: string
}

interface Delegation {
  team_id: number
  team_name: string
  sport: string
  total_delegations: string
  accepted: string
  declined_count: string
  pending: string
  expired: string
  same_team_transfers: string
  cross_team_transfers: string
}

interface AllStats {
  overview: StatsOverview
  members: StatsMembers
  roster: TeamRoster[]
  schreiber: SchreiberCoverage[]
  missing: MissingSchreiber[]
  participation: Participation[]
  results: GameResult[]
  delegations: Delegation[]
}

// ── Helpers ──────────────────────────────────────────────────────

const n = (v: string | number) => Number(v) || 0
const pct = (a: number, b: number) => b > 0 ? `${Math.round((a / b) * 100)}%` : '–'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function ProgressBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${w}%` }} />
    </div>
  )
}

function SportHeading({ sport }: { sport: string }) {
  return (
    <tr>
      <td colSpan={99} className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {sport === 'volleyball' ? '🏐 Volleyball' : '🏀 Basketball'}
      </td>
    </tr>
  )
}

/** Insert sport heading rows into a sorted-by-sport list */
function groupBySport<T extends { sport: string }>(items: T[]): { sport: string; items: T[] }[] {
  const vb = items.filter(i => i.sport === 'volleyball')
  const bb = items.filter(i => i.sport === 'basketball')
  const groups: { sport: string; items: T[] }[] = []
  if (vb.length > 0) groups.push({ sport: 'volleyball', items: vb })
  if (bb.length > 0) groups.push({ sport: 'basketball', items: bb })
  return groups
}

// ── Main ─────────────────────────────────────────────────────────

export default function ClubStatsPage() {
  const { t } = useTranslation('admin')
  const [data, setData] = useState<AllStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState<'all' | 'volleyball' | 'basketball'>('all')

  async function fetchStats() {
    try {
      setError(null)
      const resp = await kscwApi<{ data: AllStats }>('/stats/all')
      setData(resp.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    }
  }

  useEffect(() => { fetchStats() }, [])

  const filtered = useMemo(() => {
    if (!data || sportFilter === 'all') return data
    return {
      ...data,
      roster: data.roster.filter(r => r.sport === sportFilter),
      schreiber: data.schreiber.filter(s => s.sport === sportFilter),
      missing: data.missing.filter(m => m.sport === sportFilter),
      participation: data.participation.filter(p => p.sport === sportFilter),
      results: data.results.filter(r => r.sport === sportFilter),
      delegations: data.delegations.filter(d => d.sport === sportFilter),
    }
  }, [data, sportFilter])

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">{t('clubStatsTitle')}</h1>
        <div className="text-destructive">{error}</div>
        <button onClick={fetchStats} className="mt-2 text-sm underline">{t('retry')}</button>
      </div>
    )
  }

  if (!filtered) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">{t('clubStatsTitle')}</h1>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const { overview: ov, members: mem } = filtered

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold">{t('clubStatsTitle')}</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(['all', 'volleyball', 'basketball'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSportFilter(s)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                sportFilter === s ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? t('clubStatsAll') : s === 'volleyball' ? 'VB' : 'BB'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('clubStatsActiveMembers')} value={n(ov.active_members)} sub={`${n(mem.total_members)} ${t('clubStatsTotal')}`} />
        <StatCard label={t('clubStatsTeams')} value={n(ov.active_teams)} sub={`VB ${n(ov.vb_teams)} · BB ${n(ov.bb_teams)}`} />
        <StatCard label={t('clubStatsUpcomingGames')} value={n(ov.upcoming_games)} sub={`${n(ov.completed_games)} ${t('clubStatsCompleted')}`} />
        <StatCard
          label={t('clubStatsSchreiberGaps')}
          value={n(ov.upcoming_home_games_no_schreiber)}
          sub={`${t('clubStatsOf')} ${n(ov.upcoming_home_games)} ${t('clubStatsHomeGames')}`}
        />
      </div>

      {/* Members & Licences */}
      <DashboardSection id="stats-members" title={t('clubStatsMembersLicences')} icon="👥">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('clubStatsRegistered')} value={n(mem.registered_users)} />
          <StatCard label={t('clubStatsShell')} value={n(mem.shell_accounts)} />
          <StatCard label={t('clubStatsScorerVB')} value={n(mem.licence_scorer_vb)} />
          <StatCard label={t('clubStatsRefereeVB')} value={n(mem.licence_referee_vb)} />
          <StatCard label={t('clubStatsOTR1BB')} value={n(mem.licence_otr1_bb)} />
          <StatCard label={t('clubStatsOTR2BB')} value={n(mem.licence_otr2_bb)} />
          <StatCard label={t('clubStatsVorstand')} value={n(mem.role_vorstand)} />
          <StatCard label={t('clubStatsAdmins')} value={n(mem.role_admin) + n(mem.role_superuser)} sub={`VB ${n(mem.role_vb_admin)} · BB ${n(mem.role_bb_admin)}`} />
        </div>
      </DashboardSection>

      {/* Team Roster */}
      <DashboardSection id="stats-roster" title={t('clubStatsRoster')} icon="📋">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t('clubStatsTeam')}</th>
                <th className="py-2 pr-3 font-medium text-center">{t('clubStatsRosterSize')}</th>
                <th className="py-2 pr-3 font-medium text-center">{t('clubStatsScorerLic')}</th>
                <th className="py-2 pr-3 font-medium text-center">{t('clubStatsCoach')}</th>
                <th className="py-2 font-medium text-center">{t('clubStatsCaptain')}</th>
              </tr>
            </thead>
            <tbody>
              {groupBySport(filtered.roster).map(group => (
                <>
                  <SportHeading key={`h-${group.sport}`} sport={group.sport} />
                  {group.items.map(r => (
                    <tr key={r.team_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <TeamChip team={r.team_name} size="sm" />
                      </td>
                      <td className="py-2 pr-3 text-center tabular-nums">{n(r.roster_size)}{n(r.guest_count) > 0 && <span className="text-muted-foreground"> +{n(r.guest_count)}</span>}</td>
                      <td className="py-2 pr-3 text-center tabular-nums">{n(r.members_with_scorer_licence)}</td>
                      <td className="py-2 pr-3 text-center tabular-nums">{n(r.coach_count)}</td>
                      <td className="py-2 text-center tabular-nums">{n(r.captain_count)}</td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* Schreiber Coverage */}
      <DashboardSection id="stats-schreiber" title={t('clubStatsSchreiberCoverage')} icon="✍️">
        <div className="space-y-4">
          {groupBySport(filtered.schreiber.filter(s => n(s.total_home_games) > 0)).map(group => (
            <div key={group.sport}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.sport === 'volleyball' ? '🏐 Volleyball' : '🏀 Basketball'}
              </p>
              <div className="space-y-3">
                {group.items.map(s => {
                  const assigned = s.sport === 'volleyball' ? n(s.vb_any_duty_assigned) : n(s.bb_any_duty_assigned)
                  const total = n(s.total_home_games)
                  return (
                    <div key={s.team_id}>
                      <div className="flex items-center justify-between mb-1">
                        <TeamChip team={s.team_name} size="sm" />
                        <span className="text-sm tabular-nums text-muted-foreground">{assigned}/{total} ({pct(assigned, total)})</span>
                      </div>
                      <ProgressBar value={assigned} max={total} color={assigned === total ? 'bg-green-500' : assigned > 0 ? 'bg-amber-500' : 'bg-destructive'} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* Missing Schreiber (upcoming) */}
      {filtered.missing.length > 0 && (
        <DashboardSection id="stats-missing" title={t('clubStatsMissingSchreiber')} icon="⚠️">
          <div className="space-y-2">
            {filtered.missing.map(m => (
              <div key={m.game_id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-sm font-medium">{new Date(m.game_date).toLocaleDateString('de-CH')} {m.game_time?.slice(0, 5)}</span>
                <TeamChip team={m.team_name} size="sm" />
                <span className="text-sm">{m.home_team} vs {m.away_team}</span>
                <span className="text-xs text-destructive font-medium ml-auto">{m.missing_roles}</span>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      {/* Participation Rates */}
      <DashboardSection id="stats-participation" title={t('clubStatsParticipation')} icon="📊">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t('clubStatsTeam')}</th>
                <th className="py-2 pr-3 font-medium text-center">{t('clubStatsGamesRSVP')}</th>
                <th className="py-2 pr-3 font-medium text-center">{t('clubStatsTrainingsRSVP')}</th>
              </tr>
            </thead>
            <tbody>
              {groupBySport(filtered.participation.filter(p => n(p.games_total) > 0 || n(p.trainings_total) > 0)).map(group => (
                <>
                  <SportHeading key={`h-${group.sport}`} sport={group.sport} />
                  {group.items.map(p => (
                    <tr key={p.team_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3"><TeamChip team={p.team_name} size="sm" /></td>
                      <td className="py-2 pr-3 text-center tabular-nums">
                        {n(p.games_total) > 0
                          ? <span title={`${n(p.games_confirmed)}✓ ${n(p.games_declined)}✗ ${n(p.games_tentative)}?`}>
                              {n(p.games_responses)} / {n(p.games_total)} {t('clubStatsGames')}
                            </span>
                          : '–'}
                      </td>
                      <td className="py-2 text-center tabular-nums">
                        {n(p.trainings_total) > 0
                          ? <span title={`${n(p.trainings_confirmed)}✓ ${n(p.trainings_declined)}✗ ${n(p.trainings_tentative)}?`}>
                              {n(p.trainings_responses)} / {n(p.trainings_total)} {t('clubStatsTrainings')}
                            </span>
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* Game Results */}
      <DashboardSection id="stats-results" title={t('clubStatsResults')} icon="🏆">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t('clubStatsTeam')}</th>
                <th className="py-2 pr-3 font-medium">{t('clubStatsSeason')}</th>
                <th className="py-2 pr-3 font-medium text-center">{t('clubStatsPlayed')}</th>
                <th className="py-2 pr-3 font-medium text-center">{t('clubStatsW')}</th>
                <th className="py-2 font-medium text-center">{t('clubStatsL')}</th>
              </tr>
            </thead>
            <tbody>
              {groupBySport(filtered.results).map(group => (
                <>
                  <SportHeading key={`h-${group.sport}`} sport={group.sport} />
                  {group.items.map(r => (
                    <tr key={`${r.team_id}-${r.season}`} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3"><TeamChip team={r.team_name} size="sm" /></td>
                      <td className="py-2 pr-3 text-sm text-muted-foreground">{r.season}</td>
                      <td className="py-2 pr-3 text-center tabular-nums">{n(r.games_played)}</td>
                      <td className="py-2 pr-3 text-center tabular-nums text-green-600 dark:text-green-400">{n(r.total_wins)}</td>
                      <td className="py-2 text-center tabular-nums text-red-600 dark:text-red-400">{n(r.total_losses)}</td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* Delegations */}
      {filtered.delegations.length > 0 && (
        <DashboardSection id="stats-delegations" title={t('clubStatsDelegations')} icon="🔄">
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('clubStatsTeam')}</th>
                  <th className="py-2 pr-3 font-medium text-center">{t('clubStatsTotal')}</th>
                  <th className="py-2 pr-3 font-medium text-center">{t('clubStatsAccepted')}</th>
                  <th className="py-2 pr-3 font-medium text-center">{t('clubStatsDeclined')}</th>
                  <th className="py-2 font-medium text-center">{t('clubStatsPending')}</th>
                </tr>
              </thead>
              <tbody>
                {groupBySport(filtered.delegations).map(group => (
                  <>
                    <SportHeading key={`h-${group.sport}`} sport={group.sport} />
                    {group.items.map(d => (
                      <tr key={d.team_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 pr-3"><TeamChip team={d.team_name} size="sm" /></td>
                        <td className="py-2 pr-3 text-center tabular-nums">{n(d.total_delegations)}</td>
                        <td className="py-2 pr-3 text-center tabular-nums text-green-600 dark:text-green-400">{n(d.accepted)}</td>
                        <td className="py-2 pr-3 text-center tabular-nums text-red-600 dark:text-red-400">{n(d.declined_count)}</td>
                        <td className="py-2 text-center tabular-nums text-amber-600 dark:text-amber-400">{n(d.pending)}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}
    </div>
  )
}
