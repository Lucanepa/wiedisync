import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchAllItems, kscwApi } from '../../../lib/api'

interface TeamRecord {
  id: string
  name: string
  sport: string
  slug: string
  coach: string
  captain: string
  expand?: {
    coach?: { id: string; name: string }
    captain?: { id: string; name: string }
  }
}

interface UnapprovedMember {
  id: string
  name: string
  email: string
  requested_team: string
  created: string
}

interface TeamWithCount extends TeamRecord {
  memberCount: number
}

function getShortName(name: string): string {
  return name.length > 5 ? name.slice(0, 5) : name
}

export default function MembersTeamsSection() {
  const { t } = useTranslation('admin')
  const [teams, setTeams] = useState<TeamWithCount[]>([])
  const [unapproved, setUnapproved] = useState<UnapprovedMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [teamRecords, sqlResult, unapprovedResult] = await Promise.all([
          fetchAllItems<TeamRecord>('teams', {
            sort: ['name'],
            fields: ['id', 'name', 'sport', 'slug', 'coach', 'captain', 'expand'],
          }),
          kscwApi('/admin/sql', {
            method: 'POST',
body: {
              query: 'SELECT mt.team, COUNT(mt.id) as cnt FROM member_teams mt GROUP BY mt.team',
            },
          }) as Promise<{ rows: [string, number][] }>,
          fetchAllItems<UnapprovedMember>('members', {
            filter: { _and: [{ coach_approved_team: { _eq: false } }, { requested_team: { _nempty: true } }] },
            fields: ['id', 'name', 'email', 'requested_team', 'created'],
          }),
        ])

        const countMap: Record<string, number> = {}
        if (sqlResult?.rows) {
          for (const [teamId, cnt] of sqlResult.rows) {
            countMap[teamId] = cnt
          }
        }

        const teamsWithCount: TeamWithCount[] = teamRecords
          .map((t: TeamRecord) => ({ ...t, memberCount: countMap[t.id] ?? 0 }))
          .sort((a: TeamWithCount, b: TeamWithCount) => b.memberCount - a.memberCount)

        setTeams(teamsWithCount)
        setUnapproved(unapprovedResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-24 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{t('fetchError')}: {error}</p>
  }

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noData')}</p>
  }

  const maxCount = Math.max(...teams.map(t => t.memberCount), 1)

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      <div>
        <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 140 }}>
          {teams.map(team => {
            const barHeight = Math.max(8, Math.round((team.memberCount / maxCount) * 120))
            const isVb = team.sport === 'volleyball'
            return (
              <div key={team.id} className="flex flex-col items-center gap-1 min-w-[36px]">
                <span className="text-xs text-muted-foreground font-medium">{team.memberCount}</span>
                <div
                  className={`w-7 rounded-t transition-all ${isVb ? 'bg-brand-600' : 'bg-gold-500'}`}
                  style={{ height: barHeight }}
                  title={`${team.name}: ${team.memberCount}`}
                />
                <span className="text-xs text-muted-foreground truncate max-w-[36px]">
                  {team.slug ? getShortName(team.slug) : getShortName(team.name)}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-600" />
            Volleyball
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gold-500" />
            Basketball
          </span>
        </div>
      </div>

      {/* Team table */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t('sectionMembersTeams')}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-1.5 pr-3 font-medium">{t('teamName')}</th>
                <th className="text-right py-1.5 pr-3 font-medium">{t('memberCount')}</th>
                <th className="text-left py-1.5 pr-3 font-medium">{t('coachAssigned')}</th>
                <th className="text-left py-1.5 font-medium">{t('captainAssigned')}</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{team.name}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{team.memberCount}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {team.expand?.coach?.name ?? '—'}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {team.expand?.captain?.name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unapproved members */}
      {unapproved.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
            {t('kpiPending')} ({unapproved.length})
          </h4>
          <div className="space-y-1">
            {unapproved.map(member => (
              <div
                key={member.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm py-1 border-b border-border/50 last:border-0"
              >
                <span className="font-medium text-amber-700 dark:text-amber-300">{member.name}</span>
                <span className="text-muted-foreground text-xs">{member.email}</span>
                {member.requested_team && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                    {member.requested_team}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
