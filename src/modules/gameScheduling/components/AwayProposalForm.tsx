import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BookingData } from '../hooks/useAvailableSlots'

interface Props {
  existingProposal?: BookingData
  onSubmit: (proposals: {
    proposed_datetime_1: string
    proposed_place_1: string
    proposed_datetime_2: string
    proposed_place_2: string
    proposed_datetime_3: string
    proposed_place_3: string
  }) => Promise<void>
}

export default function AwayProposalForm({ existingProposal, onSubmit }: Props) {
  const { t } = useTranslation('gameScheduling')
  const [submitting, setSubmitting] = useState(false)
  const [proposals, setProposals] = useState([
    {
      datetime: existingProposal?.proposed_datetime_1 || '',
      place: existingProposal?.proposed_place_1 || '',
    },
    {
      datetime: existingProposal?.proposed_datetime_2 || '',
      place: existingProposal?.proposed_place_2 || '',
    },
    {
      datetime: existingProposal?.proposed_datetime_3 || '',
      place: existingProposal?.proposed_place_3 || '',
    },
  ])

  const updateProposal = (index: number, field: 'datetime' | 'place', value: string) => {
    const updated = [...proposals]
    updated[index] = { ...updated[index], [field]: value }
    setProposals(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        proposed_datetime_1: proposals[0].datetime,
        proposed_place_1: proposals[0].place,
        proposed_datetime_2: proposals[1].datetime,
        proposed_place_2: proposals[1].place,
        proposed_datetime_3: proposals[2].datetime,
        proposed_place_3: proposals[2].place,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const allFilled = proposals.every(p => p.datetime && p.place)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {proposals.map((p, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700">
          <span className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('proposalNumber', { number: i + 1 })}
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">{t('proposalDate')}</label>
              <input
                type="datetime-local"
                value={p.datetime}
                onChange={e => updateProposal(i, 'datetime', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-500 dark:bg-gray-600 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">{t('proposalPlace')}</label>
              <input
                type="text"
                value={p.place}
                onChange={e => updateProposal(i, 'place', e.target.value)}
                placeholder="z.B. Sporthalle Muster, Musterstr. 1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-500 dark:bg-gray-600 dark:text-gray-100"
                required
              />
            </div>
          </div>
        </div>
      ))}

      {existingProposal && existingProposal.status === 'pending' && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400">{t('awaitingConfirmation')}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !allFilled}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? t('submitting') : existingProposal ? 'Vorschläge aktualisieren' : t('submitProposals')}
      </button>
    </form>
  )
}
