import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { usePB } from '../../hooks/usePB'
import { useNotifications } from '../../hooks/useNotifications'
import { useSportPreference } from '../../hooks/useSportPreference'
import { formatDate, formatDateCompact, formatTime, formatWeekday } from '../../utils/dateHelpers'
import TeamChip from '../../components/TeamChip'
import StatusBadge from '../../components/StatusBadge'
import VolleyballIcon from '../../components/VolleyballIcon'
import BasketballIcon from '../../components/BasketballIcon'
import NotificationPanel from '../../components/NotificationPanel'
import GameDetailModal from '../games/components/GameDetailModal'
import TrainingDetailModal from '../trainings/TrainingDetailModal'
import ParticipationSummary from '../../components/ParticipationSummary'
import { useParticipation } from '../../hooks/useParticipation'
import type { Game, Event, Team, Training, Hall, Member, MemberTeam, Notification } from '../../types'
import type { RecordModel } from 'pocketbase'
import { ClipboardList, Clock, AlertTriangle, Trophy, Bell } from 'lucide-react'

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

  const { user, isApproved, primarySport } = useAuth()
  const { sport, setSport } = useSportPreference()
  // Hide sport toggle for logged-in users who play only one sport
  const showSportToggle = !user || primarySport === 'both'
  const [selectedGame, setSelectedGame] = useState<ExpandedGame | null>(null)
  const [selectedTraining, setSelectedTraining] = useState<TrainingExpanded | null>(null)
  const [showAllGames, setShowAllGames] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
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
  const { data: memberTeams } = usePB<MemberTeamExpanded>('member_teams', {
    filter: user ? `member="${user.id}"` : '',
    expand: 'team',
    perPage: 20,
    enabled: !!user,
  })

  const userTeamIds = useMemo(() => memberTeams.map((mt) => mt.team), [memberTeams])
  const hasTeams = userTeamIds.length > 0

  // Build team filter for games
  const teamGameFilter = useMemo(() => {
    if (!hasTeams) return ''
    return userTeamIds.map((id) => `kscw_team="${id}"`).join(' || ')
  }, [userTeamIds, hasTeams])

  // Next 5 upcoming games (all)
  const allGamesFilter = [`status = "scheduled"`, `date >= "${today}"`, sportFilter].filter(Boolean).join(' && ')
  const { data: allNextGames, isLoading: gamesLoading } = usePB<ExpandedGame>('games', {
    filter: allGamesFilter,
    sort: '+date,+time',
    expand: 'kscw_team,hall',
    perPage: 5,
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

  // Latest 5 results (all)
  const allResultsFilter = [`status = "completed"`, sportFilter].filter(Boolean).join(' && ')
  const { data: allLatestResults, isLoading: resultsLoading } = usePB<ExpandedGame>('games', {
    filter: allResultsFilter,
    sort: '-date,-time',
    expand: 'kscw_team,hall',
    perPage: 5,
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
    perPage: 3,
    enabled: hasTeams,
  })

  // Decide which games/results to show
  const nextGames = hasTeams && !showAllGames ? myNextGames : allNextGames
  const latestResults = hasTeams && !showAllResults ? myLatestResults : allLatestResults

  // Upcoming events
  const { data: events, isLoading: eventsLoading } = usePB<EventExpanded>('events', {
    filter: `end_date >= "${today}"`,
    sort: '+start_date',
    expand: 'teams',
    perPage: 10,
  })

  return (
    <div className="mx-auto min-w-0 max-w-5xl">
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

      {/* Content grid: events left, games right */}
      <div className={`grid min-w-0 gap-6 ${!eventsLoading && events.length > 0 ? 'lg:grid-cols-5' : ''}`}>
        {/* Events — left column (wider) */}
        {!eventsLoading && events.length > 0 && (
          <div className="lg:col-span-2">
            <SectionHeader
              title={t('events')}
              linkTo="/events"
              linkLabel={t('allEvents')}
            />
            <div className="space-y-3">
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* Games — right column */}
        <div className={`min-w-0 ${!eventsLoading && events.length > 0 ? 'lg:col-span-3' : ''}`}>
          {/* Trainings, results & upcoming games — side by side on xl */}
          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            {/* Next trainings (logged-in only) */}
            {hasTeams && !trainingsLoading && nextTrainings.length > 0 && (
              <div className="min-w-0">
                <SectionHeader title={t('nextTrainings')} linkTo="/trainings" linkLabel={t('allTrainings')} />
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  {nextTrainings.map((tr) => (
                    <CompactTrainingRow key={tr.id} training={tr} onClick={() => setSelectedTraining(tr)} />
                  ))}
                </div>
              </div>
            )}
            {/* Latest results */}
            {!resultsLoading && latestResults.length > 0 && (
              <div className="min-w-0">
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
                    <CompactGameRow key={g.id} game={g} showScore onClick={() => setSelectedGame(g)} />
                  ))}
                </div>
              </div>
            )}

            {/* Next games */}
            {!gamesLoading && nextGames.length > 0 && (
              <div className="min-w-0">
                <SectionHeader
                  title={t('nextGames')}
                  linkTo="/games"
                  linkLabel={t('allGames')}
                  filterToggle={hasTeams ? {
                    active: !showAllGames,
                    label: t('myTeams'),
                    onToggle: () => setShowAllGames((v) => !v),
                  } : undefined}
                />
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  {nextGames.map((g) => (
                    <CompactGameRow key={g.id} game={g} showScore={false} onClick={() => setSelectedGame(g)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      <TrainingDetailModal training={selectedTraining} onClose={() => setSelectedTraining(null)} />

      {notifPanelOpen && (
        <NotificationPanel
          notifications={allNotifs}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setNotifPanelOpen(false)}
        />
      )}
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
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
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

function CompactGameRow({ game, showScore, onClick }: { game: ExpandedGame; showScore: boolean; onClick?: () => void }) {
  const { user } = useAuth()
  const dateStr = game.date ? formatDateCompact(game.date) : ''
  const homeWon = Number(game.home_score) > Number(game.away_score)
  const awayWon = Number(game.away_score) > Number(game.home_score)
  const kscwWon = game.type === 'home' ? homeWon : awayWon
  const kscwLost = game.type === 'home' ? awayWon : homeWon

  const { effectiveStatus } = useParticipation('game', game.id, game.date)

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

      <div className="flex flex-1 items-center gap-3 px-4 py-2">
        {/* Date & time */}
        <div className="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          <div>{dateStr}</div>
          {game.time && <div>{formatTime(game.time)}</div>}
        </div>

        {/* Sport icon */}
        {game.expand?.kscw_team?.sport === 'basketball'
          ? <BasketballIcon className="h-5 w-5 shrink-0" filled />
          : <VolleyballIcon className="h-5 w-5 shrink-0" filled />}

        {/* Team names — stacked, Wiedikon team bold */}
        <div className="min-w-0 flex-1">
          <ShrinkOnOverflow className={`text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-bold' : ''}`}>
            {game.home_team}
          </ShrinkOnOverflow>
          <ShrinkOnOverflow className={`text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-bold' : ''}`}>
            {game.away_team}
          </ShrinkOnOverflow>
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

function CompactTrainingRow({ training, onClick }: { training: TrainingExpanded; onClick?: () => void }) {
  const { user } = useAuth()
  const team = training.expand?.team
  const hall = training.expand?.hall
  const dateStr = training.date ? formatDate(training.date) : ''
  const weekday = training.date ? formatWeekday(training.date) : ''

  const { effectiveStatus } = useParticipation('training', training.id, training.date)

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

/** Text that starts at text-sm and shrinks to text-xs only when it would overflow/truncate */
function ShrinkOnOverflow({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useCallback((el: HTMLParagraphElement | null) => {
    if (!el) return
    // Reset to default size, check overflow, shrink if needed
    el.style.fontSize = ''
    if (el.scrollWidth > el.clientWidth) {
      el.style.fontSize = '0.75rem'
    }
  }, [children]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <p ref={ref} className={`truncate text-sm ${className ?? ''}`}>
      {children}
    </p>
  )
}

function EventRow({ event }: { event: EventExpanded }) {
  const teams = event.expand?.teams ?? []
  return (
    <Link to="/events" className="block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card transition-shadow hover:shadow-card-hover dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 p-4">
        {/* Date badge */}
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/40">
          <span className="text-lg font-bold leading-none text-brand-600 dark:text-brand-400">
            {new Date(event.start_date).getDate()}
          </span>
          <span className="text-[10px] font-medium uppercase text-brand-500 dark:text-brand-400">
            {new Date(event.start_date).toLocaleString('de-CH', { month: 'short' })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={event.event_type} />
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {event.title}
            </p>
          </div>
          {event.location && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{event.location}</p>
          )}
          {event.description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {event.description}
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
    </Link>
  )
}
