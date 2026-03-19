import { useTranslation } from 'react-i18next'
import StatusBadge from '../../components/StatusBadge'
import TeamChip from '../../components/TeamChip'
import RichText from '../../components/RichText'
import ParticipationButton from '../../components/ParticipationButton'
import ParticipationSummary from '../../components/ParticipationSummary'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../utils/dateHelpers'
import type { Event, Team } from '../../types'

type EventExpanded = Event & { expand?: { teams?: Team[] } }

const eventTypeColors: Record<string, { bg: string; text: string }> = {
  verein: { bg: '#dbeafe', text: '#1e40af' },
  social: { bg: '#dcfce7', text: '#166534' },
  meeting: { bg: '#fef3c7', text: '#92400e' },
  tournament: { bg: '#fee2e2', text: '#991b1b' },
  trainingsweekend: { bg: '#ffedd5', text: '#9a3412' },
  other: { bg: '#f3f4f6', text: '#374151' },
}

/** Check if a string contains HTML tags */
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str)
}

interface EventCardProps {
  event: EventExpanded
  onEdit?: (event: Event) => void
  onDelete?: (eventId: string) => void
  onOpenRoster?: (event: Event) => void
}

export default function EventCard({ event, onEdit, onDelete, onOpenRoster }: EventCardProps) {
  const { t } = useTranslation('events')
  const { user, canParticipateIn } = useAuth()
  const teams = event.expand?.teams ?? []
  // Club-wide events (no teams): all logged-in users can RSVP
  // Team events: only members of those teams can RSVP
  const canRSVP = user && (
    !event.teams?.length || event.teams.some((tid) => canParticipateIn(tid))
  )

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-card dark:border-gray-700 dark:bg-gray-800">
      {/* Top row: badge + title + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusBadge status={event.event_type} colorMap={eventTypeColors} />
          <h2 className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onOpenRoster && (
            <button
              onClick={() => onOpenRoster(event)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title={t('viewRoster')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title={t('editEvent')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              title={t('deleteEvent')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
        {formatDate(event.start_date)}
        {event.start_date !== event.end_date && ` — ${formatDate(event.end_date)}`}
        {event.all_day && ` · ${t('allDay')}`}
      </p>
      {event.location && (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{event.location}</p>
      )}
      {event.description && (
        isHtml(event.description)
          ? <RichText html={event.description} className="mt-1 text-sm text-gray-500 dark:text-gray-400" />
          : <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{event.description}</p>
      )}
      {teams.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {teams.map((team) => (
            <TeamChip key={team.id} team={team.name} size="sm" />
          ))}
        </div>
      )}

      {/* Bottom row: RSVP + participation counter */}
      {canRSVP && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <ParticipationButton
            activityType="event"
            activityId={event.id}
            activityDate={event.start_date?.split(' ')[0]}
            teamId={event.teams?.[0]}
            respondBy={event.respond_by?.split(' ')[0]}
            maxPlayers={event.max_players}
          />
          <ParticipationSummary activityType="event" activityId={event.id} compact hideExtras />
        </div>
      )}
    </div>
  )
}

