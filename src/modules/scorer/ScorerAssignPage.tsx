import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import type { Game, Team, Training, Member, MemberTeam, Hall } from '../../types'
import { usePB } from '../../hooks/usePB'
import { useAuth } from '../../hooks/useAuth'
import { getCurrentSeason, getSeasonDateRange, formatDateCompact, formatTime } from '../../utils/dateHelpers'
import { logActivity } from '../../utils/logActivity'
import pb from '../../pb'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '../../components/LoadingSpinner'
import TeamSelect from '../../components/TeamSelect'
import TeamChip from '../../components/TeamChip'
import { runAssignment, getTeamCounts, type GameAssignment } from './components/AssignmentAlgorithm'

type ExpandedGame = Game & {
  expand?: {
    kscw_team?: Team
    hall?: Hall
  }
}

export default function ScorerAssignPage() {
  const { t } = useTranslation('scorerAssign')
  const { hasAdminAccessToSport } = useAuth()

  const season = getCurrentSeason()
  const { start: seasonStart, end: seasonEnd } = getSeasonDateRange(season)

  if (!hasAdminAccessToSport('volleyball')) {
    return <Navigate to="/" replace />
  }

  // Data loading
  const { data: allGames, isLoading: gamesLoading } = usePB<ExpandedGame>('games', {
    filter: `date>="${seasonStart}" && date<="${seasonEnd}" && status!="cancelled"`,
    sort: '+date,+time',
    expand: 'kscw_team,hall',
    all: true,
  })

  const { data: teams } = usePB<Team>('teams', {
    filter: 'sport="volleyball" && active=true',
    sort: '+name',
    all: true,
  })

  const { data: trainings } = usePB<Training>('trainings', {
    filter: `date>="${seasonStart}" && date<="${seasonEnd}" && cancelled=false`,
    fields: 'id,team,date,start_time,end_time',
    all: true,
  })

  const { data: members } = usePB<Member>('members', {
    filter: 'kscw_membership_active=true',
    fields: 'id,name,first_name,last_name,licences',
    all: true,
  })

  const { data: memberTeams } = usePB<MemberTeam>('member_teams', {
    all: true,
  })

  // State
  const [assignments, setAssignments] = useState<GameAssignment[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [running, setRunning] = useState(false)

  // Derived
  const homeGames = useMemo(
    () => allGames.filter((g) => g.type === 'home' && g.status !== 'postponed'),
    [allGames],
  )

  const halls = useMemo(
    () => {
      const map = new Map<string, { id: string; name: string }>()
      for (const g of allGames) {
        if (g.expand?.hall) {
          map.set(g.expand.hall.id, { id: g.expand.hall.id, name: g.expand.hall.name })
        }
      }
      return Array.from(map.values())
    },
    [allGames],
  )

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teams) m.set(t.id, t.name)
    return m
  }, [teams])

  const teamCounts = useMemo(() => getTeamCounts(assignments, teams, allGames), [assignments, teams, allGames])

  // Actions
  function handleRunAlgorithm() {
    setRunning(true)
    setTimeout(() => {
      const results = runAssignment({
        games: allGames,
        teams,
        trainings,
        members,
        memberTeams,
        halls,
      })
      setAssignments(results)
      setRunning(false)
    }, 50)
  }

  async function handleSaveAll() {
    setSaving(true)
    setSaveMsg(null)
    let updated = 0
    try {
      for (const a of assignments) {
        if (a.conflicts.some((c) => c.key === 'existingKept')) continue
        if (!a.scorerTeamId && !a.scoreboardTeamId && !a.combinedTeamId) continue

        const fields: Partial<Game> = {}
        if (a.scorerTeamId) fields.scorer_duty_team = a.scorerTeamId
        if (a.scoreboardTeamId) fields.scoreboard_duty_team = a.scoreboardTeamId
        if (a.combinedTeamId) fields.scorer_scoreboard_duty_team = a.combinedTeamId

        await pb.collection('games').update(a.gameId, fields)
        logActivity('update', 'games', a.gameId, fields)
        updated++
      }
      setSaveMsg({ text: t('saveSuccess', { count: updated }), error: false })
    } catch {
      setSaveMsg({ text: t('saveError'), error: true })
    } finally {
      setSaving(false)
    }
  }

  function handleOverride(gameId: string, role: 'scorer' | 'scoreboard' | 'combined', teamId: string) {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.gameId !== gameId) return a
        const teamName = teamNameById.get(teamId) ?? null
        if (role === 'combined') {
          return { ...a, combinedTeamId: teamId || null, combinedTeamName: teamName }
        }
        if (role === 'scorer') {
          return { ...a, scorerTeamId: teamId || null, scorerTeamName: teamName }
        }
        return { ...a, scoreboardTeamId: teamId || null, scoreboardTeamName: teamName }
      }),
    )
  }

  const assignedCount = assignments.filter(
    (a) => a.scorerTeamId || a.scoreboardTeamId || a.combinedTeamId,
  ).length

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">{t('title')}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">{t('subtitle')}</p>

      {/* Actions bar */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {t('season')}: {season}
        </div>

        <Button
          size="sm"
          onClick={handleRunAlgorithm}
          loading={running}
          disabled={gamesLoading || homeGames.length === 0}
        >
          {running ? t('running') : t('runAlgorithm')}
        </Button>

        {assignments.length > 0 && (
          <Button
            size="sm"
            onClick={handleSaveAll}
            loading={saving}
          >
            {saving ? t('saving') : t('saveAll')}
          </Button>
        )}
      </div>

      {/* Status messages */}
      <div className="mt-2 flex flex-wrap gap-2">
        {gamesLoading && <LoadingSpinner />}
        {!gamesLoading && homeGames.length > 0 && assignments.length === 0 && (
          <span className="text-sm text-gray-500">{t('gamesLoaded', { count: homeGames.length })}</span>
        )}
        {assignments.length > 0 && (
          <span className="text-sm text-green-600 dark:text-green-400">
            {t('assignmentsDone', { assigned: assignedCount, total: homeGames.length })}
          </span>
        )}
        {saveMsg && (
          <span className={`text-sm ${saveMsg.error ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>
            {saveMsg.text}
          </span>
        )}
      </div>

      {/* Results table */}
      {assignments.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-2 py-2">{t('date')}</th>
                <th className="px-2 py-2">{t('time')}</th>
                <th className="px-2 py-2">{t('hall')}</th>
                <th className="px-2 py-2">{t('home')}</th>
                <th className="px-2 py-2">{t('away')}</th>
                <th className="px-2 py-2">{t('league')}</th>
                <th className="px-2 py-2">{t('autoScorer')}</th>
                <th className="px-2 py-2">{t('autoTaefeler')}</th>
                <th className="px-2 py-2">{t('score')}</th>
                <th className="px-2 py-2">{t('conflicts')}</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const game = homeGames.find((g) => g.id === a.gameId)
                if (!game) return null
                const expanded = game as ExpandedGame
                const hallName = expanded.expand?.hall?.name ?? ''

                const isExisting = a.conflicts.some((c) => c.key === 'existingKept')
                const hasNoAssignment = !a.scorerTeamId && !a.scoreboardTeamId && !a.combinedTeamId

                return (
                  <tr
                    key={a.gameId}
                    className={`border-b border-gray-100 dark:border-gray-700/50 ${
                      hasNoAssignment ? 'bg-red-50 dark:bg-red-900/10' :
                      isExisting ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-2 py-2 text-gray-700 dark:text-gray-300">
                      {formatDateCompact(game.date)}
                    </td>
                    <td className="px-2 py-2 text-gray-600 dark:text-gray-400">{game.time ? formatTime(game.time) : '–'}</td>
                    <td className="px-2 py-2 text-gray-600 dark:text-gray-400">{hallName}</td>
                    <td className="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">{game.home_team}</td>
                    <td className="px-2 py-2 text-gray-700 dark:text-gray-300">{game.away_team}</td>
                    <td className="px-2 py-2 text-gray-500 dark:text-gray-400">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">{game.league}</span>
                    </td>
                    {a.mode === 'combined' ? (
                      <>
                        <td className="px-2 py-2" colSpan={2}>
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">S/T</span>
                            <TeamSelect
                              value={a.combinedTeamId ?? ''}
                              onChange={(v) => handleOverride(a.gameId, 'combined', v)}
                              teams={teams}
                              placeholder={t('selectTeam')}
                              compact
                            />
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2">
                          <TeamSelect
                            value={a.scorerTeamId ?? ''}
                            onChange={(v) => handleOverride(a.gameId, 'scorer', v)}
                            teams={teams}
                            placeholder={t('selectTeam')}
                            compact
                          />
                        </td>
                        <td className="px-2 py-2">
                          <TeamSelect
                            value={a.scoreboardTeamId ?? ''}
                            onChange={(v) => handleOverride(a.gameId, 'scoreboard', v)}
                            teams={teams}
                            placeholder={t('selectTeam')}
                            compact
                          />
                        </td>
                      </>
                    )}
                    <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {a.scorerScore !== 0 || a.scoreboardScore !== 0 ? (
                        <span>{a.scorerScore}</span>
                      ) : '—'}
                    </td>
                    <td className="max-w-[200px] px-2 py-2">
                      {a.conflicts.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {a.conflicts.map((c, i) => {
                            const text = t(c.key, c.params ?? {})
                            return <div key={i} className="truncate" title={text}>{text}</div>
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Team summary — always shown once games are loaded */}
      {teamCounts.size > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('teamSummary')}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-fit text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="px-3 py-2">{t('teamName')}</th>
                  <th className="px-3 py-2 text-center">{t('ownGames')}</th>
                  <th className="px-3 py-2 text-center">{t('scorerCount')}</th>
                  <th className="px-3 py-2 text-center">{t('scoreboardCount')}</th>
                  <th className="px-3 py-2 text-center">{t('combinedCount')}</th>
                  <th className="px-3 py-2 text-center">{t('totalCount')}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(teamCounts.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([name, counts]) => (
                    <tr key={name} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="px-3 py-2"><TeamChip team={name} size="sm" /></td>
                      <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">{counts.ownGames}</td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{counts.scorer || '—'}</td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{counts.scoreboard || '—'}</td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{counts.combined || '—'}</td>
                      <td className="px-3 py-2 text-center font-medium text-gray-900 dark:text-gray-100">{counts.totalDuties || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!gamesLoading && homeGames.length === 0 && (
        <div className="mt-12 py-12 text-center text-gray-500 dark:text-gray-400">
          <p>{t('noGames')}</p>
        </div>
      )}
    </div>
  )
}
