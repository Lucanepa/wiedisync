import { useTranslation } from 'react-i18next'
import StatusBadge from '../../components/StatusBadge'
import { formatDate } from '../../utils/dateHelpers'
import type { Absence } from '../../types'

interface AbsenceCardProps {
  absence: Absence
  onEdit?: (absence: Absence) => void
  onDelete?: (absenceId: string) => void
  /** Show member name (for team view) */
  memberName?: string
  canEdit?: boolean
}

export default function AbsenceCard({ absence, onEdit, onDelete, memberName, canEdit }: AbsenceCardProps) {
  const { t } = useTranslation('absences')

  const affectsLabels: Record<string, string> = {
    trainings: t('affectsTrainings'),
    games: t('affectsGames'),
    events: t('affectsEvents'),
    all: t('affectsAll'),
  }

  const isMultiDay = absence.indefinite || absence.start_date !== absence.end_date

  return (
    <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
      {/* Top row: name (if team view), badge, affects, detail, actions */}
      <div className="flex items-start gap-3">
        {memberName && (
          <span className="text-[0.8rem] font-medium text-gray-900 dark:text-gray-100">{memberName}</span>
        )}
        <StatusBadge status={absence.reason} />
        {absence.affects && absence.affects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {absence.affects.map((a) => (
              <span key={a} className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                {affectsLabels[a] ?? a}
              </span>
            ))}
          </div>
        )}
        {absence.reason_detail && (
          <span className="hidden text-sm text-gray-500 dark:text-gray-400 sm:inline">{absence.reason_detail}</span>
        )}
        {canEdit && onEdit && onDelete && (
          <div className="ml-auto flex items-start gap-2">
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
      {/* Mobile: reason detail below */}
      {absence.reason_detail && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 sm:hidden">{absence.reason_detail}</p>
      )}
      {/* Date row — full width at bottom */}
      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {formatDate(absence.start_date)}
        {absence.indefinite
          ? ` – ${t('indefinite')}`
          : isMultiDay
            ? ` – ${formatDate(absence.end_date)}`
            : null}
      </div>
    </div>
  )
}
