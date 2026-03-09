import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BookingStatusBadge from './BookingStatusBadge'
import type { GameSchedulingBooking } from '../../../types'

interface Props {
  booking: GameSchedulingBooking
  onConfirm: (bookingId: string, proposalNumber: number, notes?: string) => Promise<void>
}

export default function AwayProposalReview({ booking, onConfirm }: Props) {
  const { t } = useTranslation('gameScheduling')
  const [confirming, setConfirming] = useState(false)

  const proposals = [
    { num: 1, datetime: booking.proposed_datetime_1, place: booking.proposed_place_1 },
    { num: 2, datetime: booking.proposed_datetime_2, place: booking.proposed_place_2 },
    { num: 3, datetime: booking.proposed_datetime_3, place: booking.proposed_place_3 },
  ].filter(p => p.datetime)

  const handleConfirm = async (num: number) => {
    setConfirming(true)
    try {
      await onConfirm(booking.id, num)
    } finally {
      setConfirming(false)
    }
  }

  if (booking.status === 'confirmed') {
    const confirmed = proposals.find(p => p.num === booking.confirmed_proposal)
    return (
      <div className="flex items-center gap-2">
        <BookingStatusBadge status="confirmed" />
        {confirmed && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {confirmed.datetime} — {confirmed.place}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <BookingStatusBadge status={booking.status} />
      {proposals.map(p => (
        <div
          key={p.num}
          className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('proposalNumber', { number: p.num })}
            </span>
            <p className="text-sm text-gray-900 dark:text-gray-100">{p.datetime}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{p.place}</p>
          </div>
          {booking.status === 'pending' && (
            <button
              onClick={() => handleConfirm(p.num)}
              disabled={confirming}
              className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t('confirmProposal')}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
