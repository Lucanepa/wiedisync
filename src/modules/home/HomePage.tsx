import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { usePB } from '../../hooks/usePB'
import { useNotifications } from '../../hooks/useNotifications'
import { useSportPreference } from '../../hooks/useSportPreference'
import { formatDate, formatDateCompact, formatTime, formatWeekday } from '../../utils/dateHelpers'
import TeamChip from '../../components/TeamChip'
import StatusBadge from '../../components/StatusBadge'
import { stripHtml } from '../../components/RichText'
import VolleyballIcon from '../../components/VolleyballIcon'
import BasketballIcon from '../../components/BasketballIcon'
import NotificationPanel from '../../components/NotificationPanel'
import GameDetailModal from '../games/components/GameDetailModal'
import TrainingDetailModal from '../trainings/TrainingDetailModal'
import EventDetailModal from '../events/EventDetailModal'
import ParticipationSummary from '../../components/ParticipationSummary'
import { useBulkParticipationStatuses } from '../../hooks/useBulkParticipationStatuses'
import type { Game, Event, Team, Training, Hall, Member, MemberTeam, Notification } from '../../types'
import type { RecordModel } from 'pocketbase'
import { ClipboardList, Clock, AlertTriangle, Trophy, Bell, Calendar, LayoutGrid, List } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'

type ExpandedGame = Game & {
  expand?: { kscw_team?: Team & RecordModel; hall?: RecordModel }
}

type EventExpanded = Event & { expand?: { teams?: Team[] } }

type TrainingExpanded = Training & {
  expand?: { team?: Team; hall?: Hall; coach?: Member }
}

type MemberTeamExpanded = MemberTeam & { expand?: { team?: Team } }


export default function HomePage() {
  const { t } = useTranslation('home')
  const { t: tn } = useTranslation('notifications')

  const { user, isApproved, primarySport, coachTeamIds } = useAuth()
  const { sport, setSport } = useSportPreference()
  // Hide sport toggle for logged-in users who play only one sport
  const showSportToggle = !user || primarySport === 'both'
  const [selectedGame, setSelectedGame] = useState<ExpandedGame | null>(null)
  const [selectedTraining, setSelectedTraining] = useState<TrainingExpanded | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventExpanded | null>(null)
  const [showAllGames, setShowAllGames] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  const [showCategorized, setShowCategorized] = useState(false)
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const { notifications: allNotifs, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const latestNews = allNotifs.slice(0, 3)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Sport filter clause for PB queries (filter via kscw_team relation)
  const sportFilter = useMemo(() => {
    if (sport === 'vb') return 'kscw_team.sport = "volleyball"'
    if (sport === 'bb') return 'kscw_team.sport = "basketball"'
    return '' // 'all' — no filter
  }, [sport])

  // Fetch user's team memberships (only when logged in)
  const { data: memberTeams, isLoading: memberTeamsLoading } = usePB<MemberTeamExpanded>('member_teams', {
    filter: user ? `member="${user.id}"` : '',
    expand: 'team',
    perPage: 20,
    enabled: !!user,
  })

  const userTeamIds = useMemo(() => [...new Set([...memberTeams.map((mt) => mt.team), ...coachTeamIds])], [memberTeams, coachTeamIds])
  const hasTeams = userTeamIds.length > 0

  // Build team filter for games
  const teamGameFilter = useMemo(() => {
    if (!hasTeams) return ''
    return userTeamIds.map((id) => `kscw_team="${id}"`).join(' || ')
  }, [userTeamIds, hasTeams])

  // Next 5 upcoming games (all) — only fetch when user toggled "show all" or has no teams
  const allGamesFilter = [`status = "scheduled"`, `date >= "${today}"`, sportFilter].filter(Boolean).join(' && ')
  const { data: allNextGames, isLoading: gamesLoading } = usePB<ExpandedGame>('games', {
    filter: allGamesFilter,
    sort: '+date,+time',
    expand: 'kscw_team,hall',
    perPage: 5,
    enabled: showAllGames || !hasTeams,
  })

  // Next 5 upcoming games (my teams only)
  const myGamesFilter = [`status = "scheduled"`, `date >= "${today}"`, `(${teamGameFilter})`, sportFilter].filter(Boolean).join(' && ')
  const { data: myNextGames } = usePB<ExpandedGame>('games', {
    filter: myGamesFilter,
    sort: '+date,+time',
    expand: 'kscw_team,hall',
    perPage: 5,
    enabled: hasTeams && !showAllGames,
  })

  // Latest 5 results (all) — only fetch when user toggled "show all" or has no teams
  const allResultsFilter = [`status = "completed"`, sportFilter].filter(Boolean).join(' && ')
  const { data: allLatestResults, isLoading: resultsLoading } = usePB<ExpandedGame>('games', {
    filter: allResultsFilter,
    sort: '-date,-time',
    expand: 'kscw_team,hall',
    perPage: 5,
    enabled: showAllResults || !hasTeams,
  })

  // Latest 5 results (my teams only)
  const myResultsFilter = [`status = "completed"`, `(${teamGameFilter})`, sportFilter].filter(Boolean).join(' && ')
  const { data: myLatestResults } = usePB<ExpandedGame>('games', {
    filter: myResultsFilter,
    sort: '-date,-time',
    expand: 'kscw_team,hall',
    perPage: 5,
    enabled: hasTeams && !showAllResults,
  })

  // Next trainings for user's teams
  const trainingFilter = useMemo(() => {
    if (!hasTeams) return ''
    const teamPart = userTeamIds.map((id) => `team="${id}"`).join(' || ')
    const parts = [`(${teamPart})`, `date >= "${today}"`, `cancelled = false`]
    if (sport === 'vb') parts.push('team.sport = "volleyball"')
    else if (sport === 'bb') parts.push('team.sport = "basketball"')
    return parts.join(' && ')
  }, [userTeamIds, hasTeams, today, sport])

  const { data: nextTrainings, isLoading: trainingsLoading } = usePB<TrainingExpanded>('trainings', {
    filter: trainingFilter,
    sort: '+date,+start_time',
    expand: 'team,hall,coach',
    perPage: 10,
    enabled: hasTeams,
  })

  // Decide which games/results to show
  const nextGames = hasTeams && !showAllGames ? myNextGames : allNextGames
  const latestResults = hasTeams && !showAllResults ? myLatestResults : allLatestResults

  // Upcoming events — scope to user's teams + club-wide events
  // Non-logged-in users only see club-wide events (no team-specific ones)
  const eventFilter = useMemo(() => {
    const parts = [`end_date >= "${today}"`]
    if (hasTeams) {
      const teamClauses = userTeamIds.map(id => `teams~"${id}"`).join(' || ')
      parts.push(`(teams:length = 0 || ${teamClauses})`)
    } else {
      // Non-logged-in: only club-wide events (no teams) with public event types
      parts.push('teams:length = 0')
      parts.push('(event_type = "verein" || event_type = "social")')
    }
    return parts.join(' && ')
  }, [today, hasTeams, userTeamIds])

  const { data: events, isLoading: eventsLoading } = usePB<EventExpanded>('events', {
    filter: eventFilter,
    sort: '+start_date',
    expand: 'teams',
    perPage: 10,
  })

  // Bulk-fetch participation statuses for all displayed activities (2 queries total
  // instead of 2 per row) so banners appear together with everything else.
  // Gate on all sub-queries being done so the participation fetch fires once with
  // the complete activity list — prevents partial results overwriting full results.
  const allDataLoaded = !gamesLoading && !resultsLoading && !eventsLoading && !(hasTeams && trainingsLoading)
  const allActivities = useMemo(() => {
    if (!allDataLoaded) return []
    const items: Array<{ id: string; type: 'game' | 'training' | 'event'; date: string }> = []
    for (const g of nextGames) items.push({ id: g.id, type: 'game', date: g.date })
    for (const g of latestResults) items.push({ id: g.id, type: 'game', date: g.date })
    for (const tr of nextTrainings) items.push({ id: tr.id, type: 'training', date: tr.date })
    for (const ev of events) items.push({ id: ev.id, type: 'event', date: ev.start_date?.split(' ')[0] ?? '' })
    return items
  }, [allDataLoaded, nextGames, latestResults, nextTrainings, events])

  const { statusMap: participationStatuses, isLoading: bulkPartLoading } = useBulkParticipationStatuses(allActivities)

  // Combined loading: wait for all primary data + participation statuses
  // For logged-in users, we need member_teams + all dependent queries + participation statuses
  // For guests, just the public queries (games, results, events)
  const isInitialLoading = user
    ? memberTeamsLoading || gamesLoading || resultsLoading || eventsLoading || (hasTeams && trainingsLoading) || bulkPartLoading
    : gamesLoading || resultsLoading || eventsLoading

  return (
    <div className="min-w-0">
      {isInitialLoading ? (
        <LoadingSpinner label={t('loading', { defaultValue: 'Loading...' })} />
      ) : (<>

      {/* Hero with sport icons flanking logo */}
      <div className="flex flex-col items-center pb-6 pt-2 text-center">
        <div className="flex items-center gap-4">
          {showSportToggle && (
            <button
              onClick={() => setSport('vb')}
              className={`rounded-full p-2 transition-all ${
                sport === 'vb' || sport === 'all'
                  ? 'scale-110'
                  : 'opacity-30 hover:opacity-50'
              }`}
              aria-label="Volleyball"
            >
              <VolleyballIcon className="h-9 w-9 sm:h-10 sm:w-10" filled />
            </button>
          )}
          {showSportToggle ? (
            <button
              onClick={() => setSport('all')}
              className={`rounded-xl p-1 transition-opacity ${sport === 'all' ? '' : 'opacity-60 hover:opacity-80'}`}
              aria-label="Show all sports"
            >
              <img
                src="/wiedisync_logo.svg"
                alt="KSC Wiedikon"
                className="h-20 w-auto sm:h-24"
              />
            </button>
          ) : (
            <img
              src="/wiedisync_logo.svg"
              alt="KSC Wiedikon"
              className="h-20 w-auto sm:h-24"
            />
          )}
          {showSportToggle && (
            <button
              onClick={() => setSport('bb')}
              className={`rounded-full p-2 transition-all ${
                sport === 'bb' || sport === 'all'
                  ? 'scale-110'
                  : 'opacity-30 hover:opacity-50'
              }`}
              aria-label="Basketball"
            >
              <BasketballIcon className="h-9 w-9 sm:h-10 sm:w-10" filled />
            </button>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-100">
          KSC Wiedikon
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      {/* News section — latest notifications */}
      {user && isApproved && latestNews.length > 0 && (
        <div className="mb-6">
          <SectionHeader
            title={tn('news')}
            linkTo="#"
            linkLabel={tn('showAll')}
            onLinkClick={(e) => { e.preventDefault(); setNotifPanelOpen(true) }}
          />
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            {latestNews.map((n) => (
              <NewsRow key={n.id} notification={n} onMarkAsRead={markAsRead} />
            ))}
          </div>
        </div>
      )}

      {/* View toggle: unified appointments vs categorized sections */}
      {user && isApproved && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowCategorized((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {showCategorized ? (
              <><List className="h-4 w-4" />{t('showAppointments', { defaultValue: 'My appointments' })}</>
            ) : (
              <><LayoutGrid className="h-4 w-4" />{t('showCategories', { defaultValue: 'By category' })}</>
            )}
          </button>
        </div>
      )}

      {/* Unified "My next appointments" view (default for logged-in users) */}
      {user && isApproved && !showCategorized && (
        <NextAppointments
          games={nextGames}
          trainings={nextTrainings}
          events={events}
          onGameClick={setSelectedGame}
          onTrainingClick={setSelectedTraining}
          onEventClick={setSelectedEvent}
          participationStatuses={participationStatuses}
        />
      )}

      {/* Categorized view: trainings, events, games in columns */}
      {/* Default for guests, toggle for logged-in users */}
      {(!user || !isApproved || showCategorized) && (
        <HomeSections
          trainingsSection={hasTeams && nextTrainings.length > 0 ? (
            <div className="min-w-0">
              <SectionHeader title={t('nextTrainings')} linkTo="/trainings" linkLabel={t('allTrainings')} />
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {nextTrainings.map((tr) => (
                  <CompactTrainingRow key={tr.id} training={tr} onClick={() => setSelectedTraining(tr)} participationStatus={participationStatuses.get(tr.id)} />
                ))}
              </div>
            </div>
          ) : null}
          trainingsDate={nextTrainings[0]?.date}
          eventsSection={events.length > 0 ? (
            <div className="min-w-0">
              <SectionHeader title={t('events')} linkTo="/events" linkLabel={t('allEvents')} />
              <div className="space-y-3">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} participationStatus={participationStatuses.get(event.id)} />
                ))}
              </div>
            </div>
          ) : null}
          eventsDate={events[0]?.start_date?.split(' ')[0]}
          gamesSection={
            <div className="min-w-0 space-y-6">
              {latestResults.length > 0 && (
                <div>
                  <SectionHeader
                    title={t('latestResults')}
                    linkTo="/games"
                    linkLabel={t('allResults')}
                    filterToggle={hasTeams ? {
                      active: !showAllResults,
                      label: t('myTeams'),
                      onToggle: () => setShowAllResults((v) => !v),
                    } : undefined}
                  />
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    {latestResults.map((g) => (
                      <CompactGameRow key={g.id} game={g} showScore onClick={() => setSelectedGame(g)} participationStatus={participationStatuses.get(g.id)} />
                    ))}
                  </div>
                </div>
              )}
              {/* When trainings column is present, keep next games stacked here */}
              {hasTeams && nextGames.length > 0 && (
                <div>
                  <SectionHeader
                    title={t('nextGames')}
                    linkTo="/games"
                    linkLabel={t('allGames')}
                    filterToggle={{
                      active: !showAllGames,
                      label: t('myTeams'),
                      onToggle: () => setShowAllGames((v) => !v),
                    }}
                  />
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    {nextGames.map((g) => (
                      <CompactGameRow key={g.id} game={g} showScore={false} onClick={() => setSelectedGame(g)} participationStatus={participationStatuses.get(g.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          }
          gamesDate={latestResults[0]?.date ?? nextGames[0]?.date}
          nextGamesSection={!hasTeams && nextGames.length > 0 ? (
            <div className="min-w-0">
              <SectionHeader title={t('nextGames')} linkTo="/games" linkLabel={t('allGames')} />
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {nextGames.map((g) => (
                  <CompactGameRow key={g.id} game={g} showScore={false} onClick={() => setSelectedGame(g)} participationStatus={participationStatuses.get(g.id)} />
                ))}
              </div>
            </div>
          ) : undefined}
          nextGamesDate={!hasTeams ? nextGames[0]?.date : undefined}
        />
      )}

      <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      <TrainingDetailModal training={selectedTraining} onClose={() => setSelectedTraining(null)} />
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      {notifPanelOpen && (
        <NotificationPanel
          notifications={allNotifs}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setNotifPanelOpen(false)}
        />
      )}
      </>)}
    </div>
  )
}

/* ---------- Sub-components ---------- */

function SectionHeader({
  title,
  linkTo,
  linkLabel,
  filterToggle,
  onLinkClick,
}: {
  title: string
  linkTo: string
  linkLabel: string
  filterToggle?: { active: boolean; label: string; onToggle: () => void }
  onLinkClick?: (e: React.MouseEvent) => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {filterToggle && (
          <button
            onClick={filterToggle.onToggle}
            className={`min-h-[36px] rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
              filterToggle.active
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {filterToggle.active ? filterToggle.label : filterToggle.label}
          </button>
        )}
      </div>
      <Link
        to={linkTo}
        onClick={onLinkClick}
        className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
      >
        {linkLabel} →
      </Link>
    </div>
  )
}

const newsTypeIcons: Record<string, React.ReactNode> = {
  activity_change: <ClipboardList className="h-4 w-4" />,
  upcoming_activity: <Clock className="h-4 w-4" />,
  deadline_reminder: <AlertTriangle className="h-4 w-4" />,
  result_available: <Trophy className="h-4 w-4" />,
}

function getNotificationPath(n: Notification): string {
  if (n.type === 'duty_delegation_request' || n.activity_type === 'scorer_duty') return '/scorer'
  switch (n.activity_type) {
    case 'game': return '/games'
    case 'training': return '/trainings'
    case 'event': return '/events'
    default: return '/'
  }
}

function NewsRow({ notification, onMarkAsRead }: { notification: Notification; onMarkAsRead: (id: string) => void }) {
  const { t } = useTranslation('notifications')
  const navigate = useNavigate()
  const message = (() => {
    try {
      const data = notification.body ? JSON.parse(notification.body) : {}
      return String(t(notification.title, data))
    } catch {
      return notification.title
    }
  })()

  const timeAgo = (() => {
    const diff = Date.now() - new Date(notification.created).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return String(t('justNow'))
    if (minutes < 60) return String(t('minutesAgo', { count: minutes }))
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return String(t('hoursAgo', { count: hours }))
    const days = Math.floor(hours / 24)
    return String(t('daysAgo', { count: days }))
  })()

  return (
    <div
      className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700/50 dark:active:bg-gray-700"
      onClick={() => {
        if (!notification.read) onMarkAsRead(notification.id)
        navigate(getNotificationPath(notification))
      }}
    >
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{newsTypeIcons[notification.type] ?? <Bell className="h-4 w-4" />}</span>
      <p className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{message}</p>
      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{timeAgo}</span>
    </div>
  )
}

function CompactGameRow({ game, showScore, onClick, participationStatus }: { game: ExpandedGame; showScore: boolean; onClick?: () => void; participationStatus?: string }) {
  const { user } = useAuth()
  const dateStr = game.date ? formatDateCompact(game.date) : ''
  const homeWon = Number(game.home_score) > Number(game.away_score)
  const awayWon = Number(game.away_score) > Number(game.home_score)
  const kscwWon = game.type === 'home' ? homeWon : awayWon
  const kscwLost = game.type === 'home' ? awayWon : homeWon

  const effectiveStatus = participationStatus

  const statusBorderColor: Record<string, string> = {
    confirmed: 'bg-green-500 dark:bg-green-400',
    tentative: 'bg-yellow-500 dark:bg-yellow-400',
    declined: 'bg-red-500 dark:bg-red-400',
    waitlisted: 'bg-orange-500 dark:bg-orange-400',
    absent: 'bg-gray-400 dark:bg-gray-500',
  }

  return (
    <div
      className="flex cursor-pointer items-stretch border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700/50 dark:active:bg-gray-700"
      onClick={onClick}
    >
      {/* Participation status vertical banner */}
      {user && effectiveStatus && (
        <div className={`w-1 shrink-0 ${statusBorderColor[effectiveStatus] ?? ''}`} />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2">
        {/* Date & time */}
        <div className="w-14 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          <div>{dateStr}</div>
          {game.time && <div>{formatTime(game.time)}</div>}
        </div>

        {/* Sport icon */}
        {game.expand?.kscw_team?.sport === 'basketball'
          ? <BasketballIcon className="h-5 w-5 shrink-0" filled />
          : <VolleyballIcon className="h-5 w-5 shrink-0" filled />}

        {/* Team names — stacked, Wiedikon team bold, wrap on small screens */}
        <div className="min-w-0 flex-1">
          <p className={`break-words text-sm leading-tight text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-bold' : ''}`}>
            {game.home_team}
          </p>
          <p className={`break-words text-sm leading-tight text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-bold' : ''}`}>
            {game.away_team}
          </p>
        </div>

        {/* Vertical score: KSCW line colored, opponent neutral */}
        {showScore && game.status === 'completed' && (
          <div className="shrink-0 text-right font-mono text-sm leading-snug">
            <div className={`${game.type === 'home' ? (kscwWon ? 'text-green-600 dark:text-green-400' : kscwLost ? 'text-red-500' : 'text-gray-500') : 'text-gray-500 dark:text-gray-400'} ${game.type === 'home' ? 'font-bold' : 'font-medium'}`}>
              {game.home_score}
            </div>
            <div className={`${game.type === 'away' ? (kscwWon ? 'text-green-600 dark:text-green-400' : kscwLost ? 'text-red-500' : 'text-gray-500') : 'text-gray-500 dark:text-gray-400'} ${game.type === 'away' ? 'font-bold' : 'font-medium'}`}>
              {game.away_score}
            </div>
          </div>
        )}

        {/* Participation summary — right-aligned, stacked vertically (scheduled games only) */}
        {game.status === 'scheduled' && (
          <div className="ml-auto shrink-0">
            <ParticipationSummary activityType="game" activityId={game.id} stacked />
          </div>
        )}
      </div>
    </div>
  )
}

function CompactTrainingRow({ training, onClick, participationStatus }: { training: TrainingExpanded; onClick?: () => void; participationStatus?: string }) {
  const { user } = useAuth()
  const team = training.expand?.team
  const hall = training.expand?.hall
  const dateStr = training.date ? formatDate(training.date) : ''
  const weekday = training.date ? formatWeekday(training.date) : ''

  const effectiveStatus = participationStatus

  const statusBorderColor: Record<string, string> = {
    confirmed: 'bg-green-500 dark:bg-green-400',
    tentative: 'bg-yellow-500 dark:bg-yellow-400',
    declined: 'bg-red-500 dark:bg-red-400',
    waitlisted: 'bg-orange-500 dark:bg-orange-400',
    absent: 'bg-gray-400 dark:bg-gray-500',
  }

  return (
    <div
      className="flex cursor-pointer items-stretch border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700/50 dark:active:bg-gray-700"
      onClick={onClick}
    >
      {/* Participation status vertical banner */}
      {user && effectiveStatus && (
        <div className={`w-1 shrink-0 ${statusBorderColor[effectiveStatus] ?? ''}`} />
      )}

      <div className="flex flex-1 items-center gap-3 px-4 py-3">
        {/* Date & time */}
        <div className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          <div>{weekday}, {dateStr}</div>
          <div>{formatTime(training.start_time)} – {formatTime(training.end_time)}</div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {team && <TeamChip team={team.name} size="sm" />}
            {hall && <span className="text-sm text-gray-700 dark:text-gray-300">{hall.name}</span>}
          </div>
        </div>

        {/* Participation summary — right-aligned, stacked vertically */}
        <div className="ml-auto shrink-0">
          <ParticipationSummary activityType="training" activityId={training.id} stacked />
        </div>
      </div>
    </div>
  )
}


/** Inline cone SVG for training icon */
function TrainingConeIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.05 10.966a5 2.5 0 0 1-8.1 0" />
      <path d="m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04" />
      <path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z" />
      <path d="M9.194 6.57a5 2.5 0 0 0 5.61 0" />
    </svg>
  )
}

/** Single appointment row with participation banner */
function AppointmentRow({ appointment, onClick, participationStatus }: {
  appointment: { type: 'game' | 'training' | 'event'; date: string; data: ExpandedGame | TrainingExpanded | EventExpanded }
  onClick?: () => void
  participationStatus?: string
}) {
  const { user } = useAuth()

  const effectiveStatus = participationStatus

  const statusBorderColor: Record<string, string> = {
    confirmed: 'bg-green-500 dark:bg-green-400',
    tentative: 'bg-yellow-500 dark:bg-yellow-400',
    declined: 'bg-red-500 dark:bg-red-400',
    waitlisted: 'bg-orange-500 dark:bg-orange-400',
    absent: 'bg-gray-400 dark:bg-gray-500',
  }

  const typeIcon = {
    game: <VolleyballIcon className="h-4 w-4 shrink-0" filled />,
    training: <TrainingConeIcon className="h-4 w-4 shrink-0" />,
    event: <Calendar className="h-4 w-4 shrink-0" />,
  }

  const dateStr = formatDateCompact(appointment.date)
  const weekday = formatWeekday(appointment.date)

  let label = ''
  let timeStr = ''
  if (appointment.type === 'game') {
    const g = appointment.data as ExpandedGame
    label = `${g.home_team} vs ${g.away_team}`
    if (g.time) timeStr = formatTime(g.time)
  } else if (appointment.type === 'training') {
    const tr = appointment.data as TrainingExpanded
    const team = tr.expand?.team
    const hall = tr.expand?.hall
    label = [team?.name, hall?.name].filter(Boolean).join(' · ')
    if (tr.start_time) timeStr = formatTime(tr.start_time)
  } else {
    const ev = appointment.data as EventExpanded
    label = ev.title
    const timePart = ev.start_date?.split(' ')[1]
    if (timePart) timeStr = formatTime(timePart)
  }

  return (
    <div
      className="flex cursor-pointer items-stretch border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700/50 dark:active:bg-gray-700"
      onClick={onClick}
    >
      {/* Participation status vertical banner */}
      {user && effectiveStatus && (
        <div className={`w-1 shrink-0 ${statusBorderColor[effectiveStatus] ?? ''}`} />
      )}

      <div className="flex flex-1 items-center gap-3 px-4 py-2.5">
        <div className="w-20 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          <div>{weekday}</div>
          <div>{dateStr}</div>
          {timeStr && <div>{timeStr}</div>}
        </div>
        <span className="text-gray-500 dark:text-gray-400">{typeIcon[appointment.type]}</span>
        <p className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{label}</p>

        {/* Participation summary */}
        <div className="ml-auto shrink-0">
          <ParticipationSummary activityType={appointment.type} activityId={appointment.data.id} stacked />
        </div>
      </div>
    </div>
  )
}

/** Unified "My next appointments" — merges games, trainings, events sorted by date, shows next 5 */
function NextAppointments({
  games,
  trainings,
  events,
  onGameClick,
  onTrainingClick,
  onEventClick,
  participationStatuses,
}: {
  games: ExpandedGame[]
  trainings: TrainingExpanded[]
  events: EventExpanded[]
  onGameClick: (g: ExpandedGame) => void
  onTrainingClick: (t: TrainingExpanded) => void
  onEventClick: (e: EventExpanded) => void
  participationStatuses: Map<string, string>
}) {
  const { t } = useTranslation('home')
  const [visibleCount, setVisibleCount] = useState(10)

  type Appointment = { type: 'game'; date: string; data: ExpandedGame }
    | { type: 'training'; date: string; data: TrainingExpanded }
    | { type: 'event'; date: string; data: EventExpanded }

  const allAppointments = useMemo(() => {
    const items: Appointment[] = []
    for (const g of games) {
      if (g.date) items.push({ type: 'game', date: g.date, data: g })
    }
    for (const tr of trainings) {
      if (tr.date) items.push({ type: 'training', date: tr.date, data: tr })
    }
    for (const ev of events) {
      if (ev.start_date) items.push({ type: 'event', date: ev.start_date.split(' ')[0], data: ev })
    }
    items.sort((a, b) => a.date.localeCompare(b.date))
    return items
  }, [games, trainings, events])

  const appointments = allAppointments.slice(0, visibleCount)
  const hasMore = allAppointments.length > visibleCount

  if (appointments.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{t('myNextAppointments')}</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {appointments.map((apt) => {
          let onClick: (() => void) | undefined
          if (apt.type === 'game') onClick = () => onGameClick(apt.data as ExpandedGame)
          else if (apt.type === 'training') onClick = () => onTrainingClick(apt.data as TrainingExpanded)
          else onClick = () => onEventClick(apt.data as EventExpanded)

          return (
            <AppointmentRow
              key={`${apt.type}-${apt.data.id}`}
              appointment={apt}
              onClick={onClick}
              participationStatus={participationStatuses.get(apt.data.id)}
            />
          )
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setVisibleCount((v) => v + 10)}
          className="mt-2 w-full rounded-lg py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          {t('showMore', { defaultValue: 'Show more' })}
        </button>
      )}
    </div>
  )
}

/** Renders 3 sections in 1/3 columns on desktop, ordered by closest date on mobile */
function HomeSections({
  trainingsSection,
  trainingsDate,
  eventsSection,
  eventsDate,
  gamesSection,
  gamesDate,
  nextGamesSection,
  nextGamesDate,
}: {
  trainingsSection: React.ReactNode
  trainingsDate?: string
  eventsSection: React.ReactNode
  eventsDate?: string
  gamesSection: React.ReactNode
  gamesDate?: string
  nextGamesSection?: React.ReactNode
  nextGamesDate?: string
}) {
  // Build sections with their earliest date for mobile ordering
  const sections = useMemo(() => {
    const items: { key: string; date: string; node: React.ReactNode }[] = []
    if (trainingsSection) items.push({ key: 'trainings', date: trainingsDate ?? '9999', node: trainingsSection })
    if (eventsSection) items.push({ key: 'events', date: eventsDate ?? '9999', node: eventsSection })
    if (gamesSection) items.push({ key: 'games', date: gamesDate ?? '9999', node: gamesSection })
    if (nextGamesSection) items.push({ key: 'nextGames', date: nextGamesDate ?? '9999', node: nextGamesSection })
    // Sort by closest date for mobile
    items.sort((a, b) => a.date.localeCompare(b.date))
    return items
  }, [trainingsSection, trainingsDate, eventsSection, eventsDate, gamesSection, gamesDate, nextGamesSection, nextGamesDate])

  if (sections.length === 0) return null

  return (
    <>
      {/* Desktop: always 1/3 columns in fixed order */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-3">
        {trainingsSection && <div className="min-w-0">{trainingsSection}</div>}
        {eventsSection && <div className="min-w-0">{eventsSection}</div>}
        {gamesSection && <div className="min-w-0">{gamesSection}</div>}
        {/* When no trainings column, promote next games to fill the empty column */}
        {!trainingsSection && nextGamesSection && <div className="min-w-0">{nextGamesSection}</div>}
      </div>
      {/* Mobile: stacked, ordered by closest upcoming date */}
      <div className="space-y-6 lg:hidden">
        {sections.map((s) => (
          <div key={s.key}>{s.node}</div>
        ))}
      </div>
    </>
  )
}

function EventRow({ event, onClick, participationStatus }: { event: EventExpanded; onClick: () => void; participationStatus?: string }) {
  const { i18n } = useTranslation()
  const effectiveStatus = participationStatus
  const teams = event.expand?.teams ?? []

  const statusBorderColor: Record<string, string> = {
    confirmed: 'bg-green-500 dark:bg-green-400',
    tentative: 'bg-yellow-500 dark:bg-yellow-400',
    declined: 'bg-red-500 dark:bg-red-400',
    waitlisted: 'bg-orange-500 dark:bg-orange-400',
  }

  return (
    <button onClick={onClick} className="flex w-full items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-card transition-shadow hover:shadow-card-hover dark:border-gray-700 dark:bg-gray-800">
      {effectiveStatus && (
        <div className={`w-1 shrink-0 ${statusBorderColor[effectiveStatus] ?? ''}`} />
      )}
      <div className="min-w-0 flex-1 p-3">
        {/* Top row: event type badge */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <StatusBadge status={event.event_type} />
          {effectiveStatus && (
            <ParticipationSummary activityType="event" activityId={event.id} compact hideExtras />
          )}
        </div>

        {/* Content row: date badge + details */}
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/40">
            <span className="text-sm font-bold leading-none text-brand-600 dark:text-brand-400">
              {new Date(event.start_date).getDate()}
            </span>
            <span className="text-[9px] font-medium uppercase text-brand-500 dark:text-brand-400">
              {new Date(event.start_date).toLocaleString(i18n.language, { month: 'short' })}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">
              {event.title}
            </p>
            {event.location && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{event.location}</p>
            )}
            {event.description && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {stripHtml(event.description)}
              </p>
            )}
            {teams.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {teams.map((team) => (
                  <TeamChip key={team.id} team={team.name} size="sm" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
