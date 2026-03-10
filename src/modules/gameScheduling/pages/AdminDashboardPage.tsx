import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useGameSchedulingSeason } from '../hooks/useGameSchedulingSeason'
import { useAdminBookings } from '../hooks/useAdminBookings'
import { useTeams } from '../../../hooks/useTeams'
import LoadingSpinner from '../../../components/LoadingSpinner'
import BookingStatusBadge from '../components/BookingStatusBadge'
import AwayProposalReview from '../components/AwayProposalReview'
import ExcelExportButton from '../components/ExcelExportButton'
import type { Team } from '../../../types'
import type { ExpandedBooking } from '../hooks/useAdminBookings'

export default function AdminDashboardPage() {
  const { t } = useTranslation('gameScheduling')
  const { hasAdminAccessToSport } = useAuth()
  const { season, isLoading: seasonLoading } = useGameSchedulingSeason()
  const { bookings, opponents, slots, isLoading, confirmAwayProposal, blockSlot } = useAdminBookings(season?.id)
  const { data: teams } = useTeams()
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  if (!hasAdminAccessToSport('volleyball')) {
    return <Navigate to="/" replace />
  }

  if (seasonLoading || isLoading) return <LoadingSpinner />

  if (!season) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400">
        <p>Keine Saison konfiguriert. Bitte zuerst eine Saison erstellen.</p>
      </div>
    )
  }

  const volleyballTeams = (teams || []).filter(t => t.sport === 'volleyball' && t.active)

  const getTeamOpponents = (teamId: string) =>
    opponents.filter(o => o.kscw_team === teamId)

  const getOpponentBookings = (opponentId: string) =>
    bookings.filter(b => b.opponent === opponentId)

  const getTeamSlots = (teamId: string) =>
    slots.filter(s => s.kscw_team === teamId)

  const teamStats = (teamId: string) => {
    const teamSlots = getTeamSlots(teamId)
    const booked = teamSlots.filter(s => s.status === 'booked').length
    const available = teamSlots.filter(s => s.status === 'available').length
    const opps = getTeamOpponents(teamId)
    return { booked, available, total: teamSlots.length, opponents: opps.length }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('dashboardTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{season.season}</p>
        </div>
        <ExcelExportButton bookings={bookings} opponents={opponents} slots={slots} teams={volleyballTeams} />
      </div>

      {/* Team overview accordion */}
      <div className="space-y-3">
        {volleyballTeams.map(team => {
          const stats = teamStats(team.id)
          const isExpanded = expandedTeam === team.id

          return (
            <div
              key={team.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Team header */}
              <button
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: team.color || '#6b7280' }}
                  />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{team.name}</span>
                  {team.full_name && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{team.full_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>{stats.opponents} {t('opponent')}</span>
                  <span>{stats.booked}/{stats.total} {t('booked')}</span>
                  <span className="text-lg">{isExpanded ? '▾' : '▸'}</span>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                  <TeamBookingsContent
                    team={team}
                    opponents={getTeamOpponents(team.id)}
                    bookings={bookings}
                    slots={getTeamSlots(team.id)}
                    onConfirmAway={confirmAwayProposal}
                    onBlockSlot={blockSlot}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamBookingsContent({
  team,
  opponents: teamOpponents,
  bookings: allBookings,
  slots: teamSlots,
  onConfirmAway,
  onBlockSlot,
}: {
  team: Team
  opponents: ReturnType<typeof Array.prototype.filter>
  bookings: ExpandedBooking[]
  slots: ReturnType<typeof Array.prototype.filter>
  onConfirmAway: (bookingId: string, proposalNumber: number, notes?: string) => Promise<void>
  onBlockSlot: (slotId: string, action: 'block' | 'unblock') => Promise<void>
}) {
  const { t } = useTranslation('gameScheduling')

  if (teamOpponents.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('noBookingsYet')}</p>
  }

  return (
    <div className="space-y-4">
      {teamOpponents.map((opp: { id: string; club_name: string; contact_name: string; contact_email: string }) => {
        const oppBookings = allBookings.filter(b => b.opponent === opp.id)
        const homeBooking = oppBookings.find(b => b.type === 'home_slot_pick')
        const awayBooking = oppBookings.find(b => b.type === 'away_proposal')

        return (
          <div
            key={opp.id}
            className="rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{opp.club_name}</span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  {opp.contact_name} ({opp.contact_email})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Home game booking */}
              <div>
                <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{t('homeBookings')}</h4>
                {homeBooking ? (
                  <div className="flex items-center gap-2">
                    <BookingStatusBadge status={homeBooking.status} />
                    {homeBooking.slot && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {/* Slot details would be expanded */}
                        Slot: {homeBooking.slot}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">{t('pending')}</span>
                )}
              </div>

              {/* Away game proposals */}
              <div>
                <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{t('awayProposals')}</h4>
                {awayBooking ? (
                  <AwayProposalReview booking={awayBooking} onConfirm={onConfirmAway} />
                ) : (
                  <span className="text-sm text-gray-400">{t('pending')}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
