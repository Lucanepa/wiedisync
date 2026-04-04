import { useTranslation } from 'react-i18next'
import StatusBadge from '../../components/StatusBadge'
import { formatDate } from '../../utils/dateHelpers'
import type { Absence } from '../../types'

interface AbsenceCardProps {
  absence: Absence
  onEdit: (absence: Absence) => void
  onDelete: (absenceId: string) => void
  showMemberName?: boolean
  canEdit: boolean
}

export default function AbsenceCard({ absence, onEdit, onDelete, canEdit }: AbsenceCardProps) {
  const { t } = useTranslation('absences')

  const affectsLabels: Record<string, string> = {
    trainings: t('affectsTrainings'),
    games: t('affectsGames'),
    events: t('affectsEvents'),
    all: t('affectsAll'),
  }

  const isMultiDay = absence.indefinite || absence.start_date !== absence.end_date

  const dateBlock = (
    <div className="text-sm leading-tight text-gray-700 dark:text-gray-300">
      <div>{formatDate(absence.start_date)}</div>
      {absence.indefinite ? (
        <>
          <div className="text-xs text-gray-400 dark:text-gray-500">{t('to', { defaultValue: 'to' })}</div>
          <div>{t('indefinite')}</div>
        </>
      ) : isMultiDay ? (
        <>
          <div className="text-xs text-gray-400 dark:text-gray-500">{t('to', { defaultValue: 'to' })}</div>
          <div>{formatDate(absence.end_date)}</div>
        </>
      ) : null}
    </div>
  )

  return (
    <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
      {/* Top row: badge, affects, detail, actions */}
      <div className="flex items-start gap-3">
        <StatusBadge status={absence.reason} />
        {/* Desktop: dates inline */}
        <div className="hidden sm:block">{dateBlock}</div>
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
        {canEdit && (
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
      {/* Mobile: dates as full-width bottom row */}
      <div className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:hidden">
        <span>{formatDate(absence.start_date)}</span>
        {isMultiDay && (
          <>
            <span className="text-xs text-gray-400 dark:text-gray-500">→</span>
            <span>{absence.indefinite ? t('indefinite') : formatDate(absence.end_date)}</span>
          </>
        )}
      </div>
    </div>
  )
}
