import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, HelpCircle, Hourglass } from 'lucide-react'
import { useParticipation } from '../hooks/useParticipation'
import { useAuth } from '../hooks/useAuth'
import type { Participation, EventSession } from '../types'
import SessionParticipationSheet from './SessionParticipationSheet'

interface ParticipationButtonProps {
  activityType: Participation['activity_type']
  activityId: string
  activityDate?: string
  compact?: boolean
  respondBy?: string
  activityStartTime?: string
  maxPlayers?: number
  confirmedCount?: number
  sessionId?: string
  /** For multi-session events: pass mode + sessions to show session sheet */
  participationMode?: 'whole' | 'per_day' | 'per_session' | ''
  eventSessions?: EventSession[]
}

const statusStyles = {
  confirmed: { icon: <Check className="h-3.5 w-3.5" />, bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  declined: { icon: <X className="h-3.5 w-3.5" />, bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  tentative: { icon: <HelpCircle className="h-3.5 w-3.5" />, bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  waitlisted: { icon: <Hourglass className="h-3.5 w-3.5" />, bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
}

export default function ParticipationButton({
  activityType,
  activityId,
  activityDate,
  compact = false,
  respondBy,
  activityStartTime,
  maxPlayers,
  confirmedCount,
  sessionId,
  participationMode,
  eventSessions,
}: ParticipationButtonProps) {
  const { t } = useTranslation('participation')
  const { isGuest } = useAuth()
  const { participation, effectiveStatus, setStatus, saveConfirmed, dismissConfirmed } = useParticipation(
    activityType,
    activityId,
    activityDate,
    sessionId,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false)
  const [guestCount, setGuestCount] = useState(0)

  // Sync guest count from existing participation
  useEffect(() => {
    setGuestCount(participation?.guest_count ?? 0)
  }, [participation?.guest_count])

  // Auto-dismiss save confirmation after 2s
  useEffect(() => {
    if (!saveConfirmed) return
    const timer = setTimeout(dismissConfirmed, 2000)
    return () => clearTimeout(timer)
  }, [saveConfirmed, dismissConfirmed])

  const hasSessionMode = participationMode && participationMode !== 'whole' && eventSessions && eventSessions.length > 0

  const statusLabels: Record<string, string> = {
    confirmed: t('confirmed'),
    declined: t('declined'),
    tentative: t('tentative'),
    waitlisted: t('waitlisted'),
  }

  const deadlinePassed = respondBy ? (() => {
    const deadlineDate = new Date(`${respondBy}T${activityStartTime || '23:59'}`)
    return deadlineDate < new Date()
  })() : false
  const isFull = maxPlayers != null && confirmedCount != null && confirmedCount >= maxPlayers

  const currentStyle = effectiveStatus ? statusStyles[effectiveStatus as keyof typeof statusStyles] : null

  async function handleSelect(status: Participation['status']) {
    setMenuOpen(false)
    await setStatus(status, '', status === 'declined' ? 0 : guestCount)
  }

  async function handleGuestChange(delta: number) {
    const newCount = Math.max(0, guestCount + delta)
    setGuestCount(newCount)
    if (effectiveStatus && effectiveStatus !== 'declined') {
      await setStatus(effectiveStatus as Participation['status'], participation?.note ?? '', newCount)
    }
  }

  // Multi-session mode: render session-aware button
  if (hasSessionMode) {
    return (
      <>
        <button
          onClick={() => setSessionSheetOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-200 dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50 sm:min-h-0"
        >
          {t('events:sessionParticipation')}
        </button>
        {sessionSheetOpen && (
          <SessionParticipationSheet
            activityId={activityId}
            sessions={eventSessions!}
            onClose={() => setSessionSheetOpen(false)}
          />
        )}
      </>
    )
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
            {guestCount > 0 && (
              <span className="ml-0.5 text-[10px] opacity-75">+{guestCount}</span>
            )}
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
          <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {(['confirmed', 'tentative', 'declined'] as const).map((status) => {
              const style = statusStyles[status]
              // Guests can't confirm when full (they'll be waitlisted server-side)
              // Licenced players CAN confirm when full (server bumps a guest)
              const isDisabledConfirmed = status === 'confirmed' && isFull && isGuest && effectiveStatus !== 'confirmed'

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
                  {isDisabledConfirmed && (
                    <span className="text-[10px] opacity-60">({t('waitlistHint')})</span>
                  )}
                </button>
              )
            })}

            {/* Guest counter — shown when confirmed or tentative */}
            {effectiveStatus && effectiveStatus !== 'declined' && (
              <div className="border-t px-3 py-2 dark:border-gray-700">
                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{t('guests')}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGuestChange(-1)}
                    disabled={guestCount <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-30 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    −
                  </button>
                  <span className="min-w-[1.5rem] text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                    {guestCount}
                  </span>
                  <button
                    onClick={() => handleGuestChange(1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Save confirmation popover */}
      {saveConfirmed && !menuOpen && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg animate-fade-in">
          <Check className="h-3 w-3" />
          {t('saved')}
        </span>
      )}
    </div>
  )
}
