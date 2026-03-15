import { useTranslation } from 'react-i18next'
import { Check, X, HelpCircle, Hourglass, Award } from 'lucide-react'
import { usePB } from '../hooks/usePB'
import { useRealtime } from '../hooks/useRealtime'
import type { Participation } from '../types'

interface ParticipationSummaryProps {
  activityType: Participation['activity_type']
  activityId: string
  compact?: boolean
  stacked?: boolean
}

export default function ParticipationSummary({
  activityType,
  activityId,
  compact = false,
  stacked = false,
}: ParticipationSummaryProps) {
  const { t } = useTranslation('participation')

  const { data, refetch } = usePB<Participation>('participations', {
    filter: activityId
      ? `activity_type="${activityType}" && activity_id="${activityId}"`
      : '',
    all: true,
    enabled: !!activityId,
  })

  // Auto-refresh when participations change (create/update/delete)
  useRealtime('participations', () => refetch())

  // Separate player and staff participations — staff don't count towards totals
  const playerData = data.filter(p => !p.is_staff)
  const staffData = data.filter(p => p.is_staff)

  const confirmedParts = playerData.filter(p => p.status === 'confirmed')
  const confirmed = confirmedParts.length
  const confirmedGuests = confirmedParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const tentativeParts = playerData.filter(p => p.status === 'tentative')
  const tentative = tentativeParts.length
  const tentativeGuests = tentativeParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const declined = playerData.filter(p => p.status === 'declined').length
  const waitlisted = playerData.filter(p => p.status === 'waitlisted').length
  const totalGuests = confirmedGuests + tentativeGuests

  const staffConfirmed = staffData.filter(p => p.status === 'confirmed').length

  if (data.length === 0) return null

  if (stacked) {
    return (
      <div className="flex flex-col items-end gap-0.5 text-xs">
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          {confirmed}{confirmedGuests > 0 && <span className="text-[10px] opacity-75">+{confirmedGuests}</span>}
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500"><Check className="h-2.5 w-2.5" /></span>
        </span>
        {tentative > 0 && (
          <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            {tentative}{tentativeGuests > 0 && <span className="text-[10px] opacity-75">+{tentativeGuests}</span>}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-white"><HelpCircle className="h-2.5 w-2.5" /></span>
          </span>
        )}
        {declined > 0 && (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            {declined}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white dark:bg-red-500"><X className="h-2.5 w-2.5" /></span>
          </span>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        {confirmed > 0 && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            {confirmed}{confirmedGuests > 0 && <span className="text-[10px] opacity-75">+{confirmedGuests}</span>}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500"><Check className="h-2.5 w-2.5" /></span>
          </span>
        )}
        {tentative > 0 && (
          <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            {tentative}{tentativeGuests > 0 && <span className="text-[10px] opacity-75">+{tentativeGuests}</span>}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-white"><HelpCircle className="h-2.5 w-2.5" /></span>
          </span>
        )}
        {declined > 0 && (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            {declined}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white dark:bg-red-500"><X className="h-2.5 w-2.5" /></span>
          </span>
        )}
        {waitlisted > 0 && (
          <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
            {waitlisted}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white"><Hourglass className="h-2.5 w-2.5" /></span>
          </span>
        )}
        {totalGuests > 0 && (
          <span className="text-gray-500 dark:text-gray-400">
            ({confirmed + tentative + totalGuests})
          </span>
        )}
        {staffConfirmed > 0 && (
          <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400" title={t('staffPresent')}>
            {staffConfirmed}
            <Award className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className="text-green-600 dark:text-green-400">
        {confirmed}{confirmedGuests > 0 && `+${confirmedGuests}`} {t('confirmed')}
      </span>
      <span className="text-yellow-600 dark:text-yellow-400">
        {tentative}{tentativeGuests > 0 && `+${tentativeGuests}`} {t('tentative')}
      </span>
      <span className="text-red-600 dark:text-red-400">{declined} {t('declined')}</span>
      {waitlisted > 0 && (
        <span className="text-orange-600 dark:text-orange-400">{waitlisted} {t('waitlisted')}</span>
      )}
      {staffConfirmed > 0 && (
        <span className="text-brand-600 dark:text-brand-400">
          {staffConfirmed} {t('staffPresent')}
        </span>
      )}
    </div>
  )
}
