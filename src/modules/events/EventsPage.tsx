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
import TeamFilter from '../../components/TeamFilter'
import EventCard from './EventCard'
import EventDetailModal from './EventDetailModal'
import EventForm from './EventForm'
import { Button } from '@/components/ui/button'
import { isFeatureEnabled } from '../../utils/featureToggles'
import type { Event, Team, Participation } from '../../types'

type EventExpanded = Event & { expand?: { teams?: Team[] } }

export default function EventsPage() {
  const { t } = useTranslation('events')
  const { user, isCoach, isCoachOf, isAdmin, memberTeamIds, coachTeamIds, teamsLoading } = useAuth()
  // Merge member + coach teams for visibility
  const allUserTeamIds = useMemo(() => [...new Set([...memberTeamIds, ...coachTeamIds])], [memberTeamIds, coachTeamIds])
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rosterEvent, setRosterEvent] = useState<EventExpanded | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventExpanded | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Show events for selected team, or all user teams + club-wide events
  const eventFilter = useMemo(() => {
    const parts: string[] = []
    if (!showPast) parts.push(`end_date >= "${today}" || (end_date = "" && start_date >= "${today}")`)
    if (selectedTeam) {
      parts.push(`(teams:length = 0 || teams~"${selectedTeam}")`)
    } else if (allUserTeamIds.length > 0) {
      const teamClauses = allUserTeamIds.map(id => `teams~"${id}"`).join(' || ')
      parts.push(`(teams:length = 0 || ${teamClauses})`)
    }
    return parts.join(' && ')
  }, [allUserTeamIds, selectedTeam, showPast, today])

  const { data: events, isLoading, refetch } = usePB<EventExpanded>('events', {
    filter: eventFilter,
    sort: '+start_date',
    expand: 'teams',
    perPage: 50,
    enabled: !teamsLoading,
  })

  const { remove } = useMutation<Event>('events')

  useRealtime('events', () => refetch())

  // Batch-fetch ALL participations for visible events in ONE request
  const eventIds = useMemo(() => events.map((e) => e.id), [events])
  const participationFilter = useMemo(() => {
    if (eventIds.length === 0) return ''
    const idClauses = eventIds.map((id) => `activity_id="${id}"`).join(' || ')
    return `activity_type="event" && (${idClauses})`
  }, [eventIds])

  const { data: allParticipations, refetch: refetchParticipations } = usePB<Participation>('participations', {
    filter: participationFilter,
    all: true,
    enabled: eventIds.length > 0,
  })

  useRealtime('participations', () => refetchParticipations())

  const { participationsByEvent, myParticipationByEvent } = useMemo(() => {
    const byEvent = new Map<string, Participation[]>()
    const myByEvent = new Map<string, Participation>()
    for (const p of allParticipations) {
      const list = byEvent.get(p.activity_id) ?? []
      list.push(p)
      byEvent.set(p.activity_id, list)
      if (user && p.member === user.id) {
        myByEvent.set(p.activity_id, p)
      }
    }
    return { participationsByEvent: byEvent, myParticipationByEvent: myByEvent }
  }, [allParticipations, user])

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

      {allUserTeamIds.length > 1 && (
        <div className="mt-6">
          <TeamFilter selected={selectedTeam} onChange={setSelectedTeam} limitToTeamIds={isAdmin ? undefined : allUserTeamIds} groupBySport={isAdmin} />
        </div>
      )}

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
                  onClick={() => setSelectedEvent(event)}
                  onEdit={canEdit ? handleEdit : undefined}
                  onDelete={canEdit ? setDeletingId : undefined}
                  onOpenRoster={setRosterEvent}
                  participations={participationsByEvent.get(event.id)}
                  myParticipation={myParticipationByEvent.get(event.id)}
                  onParticipationSaved={refetchParticipations}
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

      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      <ParticipationRosterModal
        open={rosterEvent !== null}
        onClose={() => setRosterEvent(null)}
        activityType="event"
        activityId={rosterEvent?.id ?? ''}
        activityDate={rosterEvent?.start_date ?? ''}
        teamIds={rosterEvent?.teams ?? []}
        title={t('participation')}
        respondBy={rosterEvent?.respond_by}
        maxPlayers={rosterEvent?.max_players}
        showRsvpTime={(rosterEvent?.expand?.teams ?? []).some(t => isFeatureEnabled(t.features_enabled, 'show_rsvp_time'))}
      />
    </div>
  )
}
