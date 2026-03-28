import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PartyPopper } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCollection } from '../../lib/query'
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

function asTeams(teams: (Team | string)[] | null | undefined): Team[] {
  if (!Array.isArray(teams) || teams.length === 0) return []
  return typeof teams[0] === 'object' ? (teams as Team[]) : []
}

function teamId(val: Team | string | null | undefined): string {
  if (!val) return ''
  return typeof val === 'object' ? val.id : val
}

export default function EventsPage() {
  const { t } = useTranslation('events')
  const { user, isCoach, isCoachOf, isAdmin, memberTeamIds, coachTeamIds, teamsLoading } = useAuth()
  // Merge member + coach teams for visibility
  const allUserTeamIds = useMemo(() => [...new Set([...memberTeamIds, ...coachTeamIds])], [memberTeamIds, coachTeamIds])
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rosterEvent, setRosterEvent] = useState<Event | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Show events for selected team, or all user teams + club-wide events
  const eventFilter = useMemo((): Record<string, unknown> => {
    const conditions: Record<string, unknown>[] = []
    if (!showPast) {
      conditions.push({
        _or: [
          { end_date: { _gte: today } },
          { _and: [{ end_date: { _null: true } }, { start_date: { _gte: today } }] },
        ],
      })
    }
    if (selectedTeam) {
      conditions.push({
        _or: [{ teams: { _null: true } }, { teams: { teams_id: { _eq: selectedTeam } } }],
      })
    } else if (allUserTeamIds.length > 0) {
      conditions.push({
        _or: [
          { teams: { _null: true } },
          ...allUserTeamIds.map(id => ({ teams: { teams_id: { _eq: id } } })),
        ],
      })
    }
    if (conditions.length === 0) return {}
    return conditions.length === 1 ? conditions[0] : { _and: conditions }
  }, [allUserTeamIds, selectedTeam, showPast, today])

  const { data: eventsRaw, isLoading, refetch } = useCollection<Event>('events', {
    filter: eventFilter,
    sort: ['start_date'],
    limit: 50,
    fields: ['*', 'teams.*'],
    enabled: !teamsLoading,
  })
  const events = eventsRaw ?? []

  const { remove } = useMutation<Event>('events')

  useRealtime('events', () => refetch())

  // Batch-fetch ALL participations for visible events in ONE request
  const eventIds = useMemo(() => events.map((e) => e.id), [events])
  const participationFilter = useMemo((): Record<string, unknown> | string => {
    if (eventIds.length === 0) return ''
    return { _and: [{ activity_type: { _eq: 'event' } }, { activity_id: { _in: eventIds } }] }
  }, [eventIds])

  const { data: allParticipationsRaw, refetch: refetchParticipations } = useCollection<Participation>('participations', {
    filter: participationFilter as Record<string, unknown> | undefined,
    all: true,
    enabled: eventIds.length > 0,
  })
  const allParticipations = allParticipationsRaw ?? []

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
                event.teams.some((tid) => isCoachOf(teamId(tid)))
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
        teamIds={(rosterEvent?.teams ?? []).map(t => teamId(t))}
        title={t('participation')}
        respondBy={rosterEvent?.respond_by}
        maxPlayers={rosterEvent?.max_players}
        showRsvpTime={asTeams(rosterEvent?.teams).some(t => isFeatureEnabled(t.features_enabled, 'show_rsvp_time'))}
      />
    </div>
  )
}
