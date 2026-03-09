import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAvailableSlots } from '../hooks/useAvailableSlots'
import HomeSlotPicker from '../components/HomeSlotPicker'
import AwayProposalForm from '../components/AwayProposalForm'
import BookingStatusBadge from '../components/BookingStatusBadge'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function OpponentFlowPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation('gameScheduling')
  const { opponent, slots, bookings, isLoading, error, bookHomeSlot, proposeAway } = useAvailableSlots(token)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState('')

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !opponent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Link ungültig</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{error || 'Token nicht gefunden'}</p>
        </div>
      </div>
    )
  }

  const homeBooking = bookings.find(b => b.type === 'home_slot_pick')
  const awayBooking = bookings.find(b => b.type === 'away_proposal')

  const handleBookSlot = async (slotId: string) => {
    setBookingError('')
    setBookingSuccess('')
    try {
      await bookHomeSlot(slotId)
      setBookingSuccess(t('slotBooked'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('slot_unavailable')) setBookingError(t('slotUnavailable'))
      else if (msg.includes('conflict_same_day')) setBookingError(t('conflictSameDay'))
      else if (msg.includes('conflict_gap_rule')) setBookingError(t('conflictGapRule'))
      else if (msg.includes('conflict_closure')) setBookingError(t('conflictClosure'))
      else if (msg.includes('conflict_cross_team')) setBookingError(t('conflictCrossTeam', { teams: '' }))
      else setBookingError(msg)
    }
  }

  const handleProposeAway = async (proposals: {
    proposed_datetime_1: string
    proposed_place_1: string
    proposed_datetime_2: string
    proposed_place_2: string
    proposed_datetime_3: string
    proposed_place_3: string
  }) => {
    setBookingError('')
    setBookingSuccess('')
    try {
      await proposeAway(proposals)
      setBookingSuccess(t('proposalsSubmitted'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBookingError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('publicTitle')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {opponent.club_name} vs. KSCW {opponent.kscw_team_name}
          </p>
        </div>

        {/* Feedback messages */}
        {bookingError && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {bookingError}
          </div>
        )}
        {bookingSuccess && (
          <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {bookingSuccess}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Home game — opponent picks a KSCW slot */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('homeGameTitle')}
              </h2>
              {homeBooking && <BookingStatusBadge status={homeBooking.status} />}
            </div>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t('homeGameDesc')}</p>

            {homeBooking ? (
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">{t('slotBooked')}</p>
              </div>
            ) : (
              <HomeSlotPicker slots={slots} onPickSlot={handleBookSlot} />
            )}
          </div>

          {/* Away game — opponent proposes 3 slots */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('awayGameTitle')}
              </h2>
              {awayBooking && <BookingStatusBadge status={awayBooking.status} />}
            </div>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t('awayGameDesc')}</p>

            {awayBooking?.status === 'confirmed' ? (
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">{t('confirmed')}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {awayBooking[`proposed_datetime_${awayBooking.confirmed_proposal}` as keyof typeof awayBooking] as string}
                  {' — '}
                  {awayBooking[`proposed_place_${awayBooking.confirmed_proposal}` as keyof typeof awayBooking] as string}
                </p>
              </div>
            ) : (
              <AwayProposalForm
                existingProposal={awayBooking || undefined}
                onSubmit={handleProposeAway}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
