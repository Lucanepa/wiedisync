import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParticipation } from '../hooks/useParticipation'
import type { Participation } from '../types'

interface ParticipationButtonProps {
  activityType: Participation['activity_type']
  activityId: string
  activityDate?: string
  compact?: boolean
  respondBy?: string
  maxPlayers?: number
  confirmedCount?: number
}

const statusStyles = {
  confirmed: { icon: '✓', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  declined: { icon: '✗', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  tentative: { icon: '?', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  absent: { icon: '—', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' },
} as const

export default function ParticipationButton({
  activityType,
  activityId,
  activityDate,
  compact = false,
  respondBy,
  maxPlayers,
  confirmedCount,
}: ParticipationButtonProps) {
  const { t } = useTranslation('participation')
  const { effectiveStatus, hasAbsence, setStatus } = useParticipation(
    activityType,
    activityId,
    activityDate,
  )
  const [menuOpen, setMenuOpen] = useState(false)

  const statusLabels: Record<string, string> = {
    confirmed: t('confirmed'),
    declined: t('declined'),
    tentative: t('tentative'),
    absent: t('absent'),
  }

  const deadlinePassed = respondBy ? new Date(respondBy) < new Date() : false
  const isFull = maxPlayers != null && confirmedCount != null && confirmedCount >= maxPlayers

  if (hasAbsence) {
    const style = statusStyles.absent
    return (
      <span className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium sm:min-h-0 ${style.bg} ${style.text}`}>
        {style.icon} {!compact && statusLabels.absent}
      </span>
    )
  }

  const currentStyle = effectiveStatus ? statusStyles[effectiveStatus] : null

  async function handleSelect(status: Participation['status']) {
    setMenuOpen(false)
    await setStatus(status)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors sm:min-h-0 ${
          deadlinePassed && !currentStyle
            ? 'bg-gray-100 text-gray-600 ring-1 ring-red-400 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:ring-red-500 dark:hover:bg-gray-600'
            : currentStyle
              ? `${currentStyle.bg} ${currentStyle.text}`
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        {currentStyle ? (
          <>
            {currentStyle.icon} {!compact && statusLabels[effectiveStatus!]}
          </>
        ) : (
          <>{t('rsvp')}</>
        )}
      </button>

      {deadlinePassed && !currentStyle && !compact && (
        <p className="mt-0.5 text-[10px] leading-tight text-red-500 dark:text-red-400">
          {t('deadlinePassed')}
        </p>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg border bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {(['confirmed', 'tentative', 'declined'] as const).map((status) => {
              const style = statusStyles[status]
              const isDisabledConfirmed = status === 'confirmed' && isFull && effectiveStatus !== 'confirmed'

              return (
                <button
                  key={status}
                  onClick={() => !isDisabledConfirmed && handleSelect(status)}
                  disabled={isDisabledConfirmed}
                  className={`flex w-full items-center gap-2 px-3 py-3 text-left text-sm transition-colors sm:py-2 ${
                    isDisabledConfirmed
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${
                    effectiveStatus === status ? 'font-medium' : ''
                  } ${style.text}`}
                >
                  {style.icon} {statusLabels[status]}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
