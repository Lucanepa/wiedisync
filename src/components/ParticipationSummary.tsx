import { useTranslation } from 'react-i18next'
import { usePB } from '../hooks/usePB'
import type { Participation } from '../types'

interface ParticipationSummaryProps {
  activityType: Participation['activity_type']
  activityId: string
  compact?: boolean
}

export default function ParticipationSummary({
  activityType,
  activityId,
  compact = false,
}: ParticipationSummaryProps) {
  const { t } = useTranslation('participation')

  const { data } = usePB<Participation>('participations', {
    filter: activityId
      ? `activity_type="${activityType}" && activity_id="${activityId}"`
      : '',
    perPage: 200,
    enabled: !!activityId,
  })

  const confirmed = data.filter(p => p.status === 'confirmed').length
  const tentative = data.filter(p => p.status === 'tentative').length
  const declined = data.filter(p => p.status === 'declined').length

  if (data.length === 0) return null

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        {confirmed > 0 && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            {confirmed}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold leading-none text-white dark:bg-green-500">✓</span>
          </span>
        )}
        {tentative > 0 && (
          <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            {tentative}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold leading-none text-white">?</span>
          </span>
        )}
        {declined > 0 && (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            {declined}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white dark:bg-red-500">✗</span>
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className="text-green-600 dark:text-green-400">{confirmed} {t('confirmed')}</span>
      <span className="text-yellow-600 dark:text-yellow-400">{tentative} {t('tentative')}</span>
      <span className="text-red-600 dark:text-red-400">{declined} {t('declined')}</span>
    </div>
  )
}
