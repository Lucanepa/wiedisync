import { useTranslation } from 'react-i18next'
import { formatDate } from '../../utils/dateHelpers'
import type { Absence, Member } from '../../types'

function asObj<T>(val: T | string | null | undefined): T | null {
  return val != null && typeof val === 'object' ? val as T : null
}

const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const

const AFFECTS_COLORS: Record<string, string> = {
  trainings: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  games: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  events: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  all: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

interface WeeklyUnavailabilityCardProps {
  absence: Absence
  onEdit: (absence: Absence) => void
  onDelete: (absenceId: string) => void
  showMemberName?: boolean
  canEdit: boolean
}

export default function WeeklyUnavailabilityCard({ absence, onEdit, onDelete, showMemberName, canEdit }: WeeklyUnavailabilityCardProps) {
  const { t } = useTranslation('absences')
  const memberName = asObj<Member>(absence.member)?.name

  const affectsLabels: Record<string, string> = {
    trainings: t('affectsTrainings'),
    games: t('affectsGames'),
    events: t('affectsEvents'),
    all: t('affectsAll'),
  }

  return (
    <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          {/* Day pills */}
          <div className="flex flex-wrap gap-1.5">
            {(absence.days_of_week ?? []).sort().map((day) => (
              <span
                key={day}
                className="rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-medium text-white"
              >
                {t(DAY_KEYS[day])}
              </span>
            ))}
          </div>

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {formatDate(absence.start_date)}
              {absence.indefinite
                ? ` — ${t('indefinite')}`
                : absence.start_date !== absence.end_date
                  ? ` — ${formatDate(absence.end_date)}`
                  : ''
              }
            </span>
            {showMemberName && memberName && (
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{memberName}</span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(absence)}
              className="min-h-[44px] rounded px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 hover:text-brand-700 sm:min-h-0 sm:py-1"
            >
              {t('common:edit')}
            </button>
            <button
              onClick={() => onDelete(absence.id)}
              className="min-h-[44px] rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-800 sm:min-h-0 sm:py-1"
            >
              {t('common:delete')}
            </button>
          </div>
        )}
      </div>

      {absence.reason_detail && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{absence.reason_detail}</p>
      )}

      {/* Affects chips */}
      {absence.affects && absence.affects.length > 0 && (
        <div className="mt-2 flex gap-1">
          {absence.affects.map((a) => (
            <span key={a} className={`rounded px-2 py-0.5 text-xs ${AFFECTS_COLORS[a] ?? AFFECTS_COLORS.all}`}>
              {affectsLabels[a] ?? a}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
