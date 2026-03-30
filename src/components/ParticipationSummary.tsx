import { useTranslation } from 'react-i18next'
import { Check, X, HelpCircle, Hourglass } from 'lucide-react'
import { useCollection } from '../lib/query'
import { useRealtime } from '../hooks/useRealtime'
import type { Participation } from '../types'

interface ParticipationSummaryProps {
  activityType: Participation['activity_type']
  activityId: string
  compact?: boolean
  stacked?: boolean
  /** Hide coach/guest breakdowns — show only raw counts */
  hideExtras?: boolean
  /** Pre-fetched participations — skips internal API call when provided */
  participations?: Participation[]
  /** Coach/captain/TR member IDs — used to detect "Coach present" for player-coaches */
  coachMemberIds?: string[]
}

export default function ParticipationSummary({
  activityType,
  activityId,
  compact = false,
  stacked = false,
  hideExtras = false,
  participations: prefetched,
  coachMemberIds,
}: ParticipationSummaryProps) {
  const { t } = useTranslation('participation')

  const skipFetch = !!prefetched
  const { data: fetchedRaw, isLoading, refetch } = useCollection<Participation>('participations', {
    filter: activityId
      ? { _and: [{ activity_type: { _eq: activityType } }, { activity_id: { _eq: activityId } }] }
      : { id: { _eq: -1 } },
    all: true,
    enabled: !!activityId && !skipFetch,
  })
  const fetched = fetchedRaw ?? []

  // Auto-refresh when participations change (create/update/delete)
  useRealtime('participations', () => { if (!skipFetch) refetch() })

  const data = prefetched ?? fetched

  // Deduplicate by member: when an event has multiple sessions, a member may
  // have several participation records. Pick the "best" status per member
  // (confirmed > tentative > waitlisted > declined) so counters reflect unique members.
  const statusPriority: Record<string, number> = { confirmed: 4, tentative: 3, waitlisted: 2, declined: 1 }
  const deduped = (() => {
    const byMember = new Map<string, Participation>()
    for (const p of data) {
      const existing = byMember.get(p.member)
      if (!existing || (statusPriority[p.status] ?? 0) > (statusPriority[existing.status] ?? 0)) {
        byMember.set(p.member, p)
      }
    }
    return Array.from(byMember.values())
  })()

  // Separate player and staff participations — staff don't count towards totals
  const playerData = deduped.filter(p => !p.is_staff)
  const staffData = deduped.filter(p => p.is_staff)

  const confirmedParts = playerData.filter(p => p.status === 'confirmed')
  const confirmed = confirmedParts.length
  const confirmedGuests = confirmedParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const tentativeParts = playerData.filter(p => p.status === 'tentative')
  const tentative = tentativeParts.length
  const tentativeGuests = tentativeParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const declined = playerData.filter(p => p.status === 'declined').length
  const waitlisted = playerData.filter(p => p.status === 'waitlisted').length

  // Coach present: count staff-only confirmed + player-coaches confirmed (via coachMemberIds)
  const staffOnlyConfirmed = staffData.filter(p => p.status === 'confirmed')
  const playerCoachConfirmed = coachMemberIds?.length
    ? playerData.filter(p => p.status === 'confirmed' && coachMemberIds.includes(p.member))
    : []
  const staffConfirmed = staffOnlyConfirmed.length + playerCoachConfirmed.length
  const staffConfirmedGuests = staffOnlyConfirmed.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)

  // Total for green counter = players + all guests (coaches excluded from number)
  const allGuests = confirmedGuests + staffConfirmedGuests
  const confirmedTotal = confirmed + allGuests
  const hasGuestBreakdown = allGuests > 0

  // Don't hide during loading — only hide when fetch completed with no data
  if (data.length === 0 && !isLoading) return null
  if (data.length === 0) return <span className="text-xs text-gray-400">…</span>

  if (stacked) {
    return (
      <div className="flex flex-col items-end gap-0.5 text-xs">
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          {!hideExtras && staffConfirmed > 0 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('coachPresent')}</span>
          )}
          {confirmedTotal}
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500"><Check className="h-2.5 w-2.5" /></span>
          {!hideExtras && hasGuestBreakdown && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              ({confirmed}P {allGuests}G)
            </span>
          )}
        </span>
        {tentative > 0 && (
          <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            {tentative}{!hideExtras && tentativeGuests > 0 && <span className="text-[10px] opacity-75">+{tentativeGuests}</span>}
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
      <div className="flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs">
          {confirmedTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
              {confirmedTotal}
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500"><Check className="h-2.5 w-2.5" /></span>
              {!hideExtras && hasGuestBreakdown && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  ({confirmed}P {allGuests}G)
                </span>
              )}
            </span>
          )}
          {tentative > 0 && (
            <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              {tentative}{!hideExtras && tentativeGuests > 0 && <span className="text-[10px] opacity-75">+{tentativeGuests}</span>}
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
        </span>
        {!hideExtras && staffConfirmed > 0 && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('coachPresent')}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="inline-flex items-center gap-2 text-xs">
        <span className="text-green-600 dark:text-green-400">
          {confirmedTotal}{!hideExtras && hasGuestBreakdown && ` (${confirmed}P ${allGuests}G)`} {t('confirmed')}
        </span>
        <span className="text-yellow-600 dark:text-yellow-400">
          {tentative}{!hideExtras && tentativeGuests > 0 && `+${tentativeGuests}`} {t('tentative')}
        </span>
        <span className="text-red-600 dark:text-red-400">{declined} {t('declined')}</span>
        {waitlisted > 0 && (
          <span className="text-orange-600 dark:text-orange-400">{waitlisted} {t('waitlisted')}</span>
        )}
      </div>
      {!hideExtras && staffConfirmed > 0 && (
        <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('coachPresent')}</span>
      )}
    </div>
  )
}
