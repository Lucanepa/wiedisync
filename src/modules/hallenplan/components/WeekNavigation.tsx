import { useTranslation } from 'react-i18next'
import type { Hall } from '../../../types'
import type { FreedSlotInfo } from '../HallenplanPage'

interface WeekNavigationProps {
  weekLabel: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  halls: Hall[]
  selectedHallIds: string[]
  onSelectHalls: (hallIds: string[]) => void
  isAdmin: boolean
  onOpenClosureManager: () => void
  showSummary: boolean
  onToggleSummary: () => void
  vbOnly: boolean
  onToggleVbOnly: () => void
  freedSlots?: FreedSlotInfo[]
}

export default function WeekNavigation({
  weekLabel,
  onPrev,
  onNext,
  onToday,
  halls: _halls,
  selectedHallIds: _selectedHallIds,
  onSelectHalls: _onSelectHalls,
  isAdmin,
  onOpenClosureManager,
  showSummary,
  onToggleSummary,
  vbOnly,
  onToggleVbOnly,
  freedSlots = [],
}: WeekNavigationProps) {
  // Hall filter chips are rendered separately below content by HallenplanView
  void _halls; void _selectedHallIds; void _onSelectHalls
  const { t } = useTranslation('hallenplan')

  return (
    <div className="mb-4 space-y-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      {/* Top row: week nav + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 sm:p-1.5 dark:hover:bg-gray-700"
            title={t('prevWeek')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[220px] text-center text-sm font-semibold text-gray-900 dark:text-gray-100 lg:text-base">
            {weekLabel}
          </span>
          <button
            onClick={onNext}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 sm:p-1.5 dark:hover:bg-gray-700"
            title={t('nextWeek')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={onToday}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t('today')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSummary}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              showSummary
                ? 'border-brand-400 bg-brand-100 text-brand-800 dark:border-brand-400 dark:bg-brand-700 dark:text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {t('summary')}
          </button>

          <button
            onClick={onToggleVbOnly}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              vbOnly
                ? 'border-brand-400 bg-brand-100 text-brand-800 dark:border-brand-400 dark:bg-brand-700 dark:text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {t('vbOnly')}
          </button>

          {isAdmin && (
            <button
              onClick={onOpenClosureManager}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t('closures')}
            </button>
          )}
        </div>
      </div>

      {/* Available slots summary */}
      {freedSlots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('slotsAvailable', { count: freedSlots.length })}
          </span>
          {freedSlots.map((fs, i) => (
            <span key={i} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {fs.dayLabel} {fs.startTime}–{fs.endTime} · {fs.hallName}
            </span>
          ))}
        </div>
      )}

      {/* Hall filter chips — hidden, rendered separately below content by HallenplanView */}
    </div>
  )
}
