import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PartyPopper } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePB } from '../../hooks/usePB'
import { useMutation } from '../../hooks/useMutation'
import { useRealtime } from '../../hooks/useRealtime'
import EmptyState from '../../components/EmptyState'
import ConfirmDialog from '@/components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import ParticipationRosterModal from '../../components/ParticipationRosterModal'
import EventCard from './EventCard'
import EventForm from './EventForm'
import { Button } from '@/components/ui/button'
import type { Event, Team } from '../../types'

type EventExpanded = Event & { expand?: { teams?: Team[] } }

export default function EventsPage() {
  const { t } = useTranslation('events')
  const { isCoach, isCoachOf, isAdmin, memberTeamIds } = useAuth()
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rosterEvent, setRosterEvent] = useState<Event | null>(null)
  const [showPast, setShowPast] = useState(false)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Non-admins: show events for own teams + club-wide events (no teams assigned)
  const eventFilter = useMemo(() => {
    const parts: string[] = []
    if (!showPast) parts.push(`end_date >= "${today}" || (end_date = "" && start_date >= "${today}")`)
    if (memberTeamIds.length > 0) {
      const teamClauses = memberTeamIds.map(id => `teams~"${id}"`).join(' || ')
      parts.push(`(teams:length = 0 || ${teamClauses})`)
    }
    return parts.join(' && ')
  }, [memberTeamIds, showPast, today])

  const { data: events, isLoading, refetch } = usePB<EventExpanded>('events', {
    filter: eventFilter,
    sort: '+start_date',
    expand: 'teams',
    perPage: 50,
  })

  const { remove } = useMutation<Event>('events')

  useRealtime('events', () => refetch())

  function handleEdit(event: Event) {
    setEditingEvent(event)
    setFormOpen(true)
  }

  function handleFormSave() {
    setFormOpen(false)
    setEditingEvent(null)
    refetch()
  }

  async function handleDelete() {
    if (!deletingId) return
    await remove(deletingId)
    setDeletingId(null)
    refetch()
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>
          <button
            onClick={() => setShowPast((v) => !v)}
            className={`min-h-[36px] rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showPast
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {t('showPast')}
          </button>
        </div>
        {isCoach && (
          <Button
            onClick={() => {
              setEditingEvent(null)
              setFormOpen(true)
            }}
          >
            {t('newEvent')}
          </Button>
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<PartyPopper className="h-10 w-10" />}
            title={t('noEvents')}
            description={t('noEventsDescription')}
          />
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              // Coaches can only edit events linked to their teams (or club-wide with no teams)
              // Admins can edit all events
              const canEdit = isAdmin || (isCoach && (
                event.teams.length === 0 ||
                event.teams.some((tid) => isCoachOf(tid))
              ))
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={canEdit ? handleEdit : undefined}
                  onDelete={canEdit ? setDeletingId : undefined}
                  onOpenRoster={setRosterEvent}
                />
              )
            })}
          </div>
        )}
      </div>

      <EventForm
        open={formOpen}
        event={editingEvent}
        onSave={handleFormSave}
        onCancel={() => {
          setFormOpen(false)
          setEditingEvent(null)
        }}
      />

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title={t('deleteEvent')}
        message={t('deleteConfirm')}
        confirmLabel={t('deleteEvent')}
        danger
      />

      <ParticipationRosterModal
        open={rosterEvent !== null}
        onClose={() => setRosterEvent(null)}
        activityType="event"
        activityId={rosterEvent?.id ?? ''}
        activityDate={rosterEvent?.start_date ?? ''}
        teamId={rosterEvent?.teams?.[0] ?? null}
        title={t('participation')}
        respondBy={rosterEvent?.respond_by}
        maxPlayers={rosterEvent?.max_players}
      />
    </div>
  )
}
