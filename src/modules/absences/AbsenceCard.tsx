import { useTranslation } from 'react-i18next'
import StatusBadge from '../../components/StatusBadge'
import { formatDate } from '../../utils/dateHelpers'
import type { Absence, Member } from '../../types'
import { asObj } from '../../utils/relations'

interface AbsenceCardProps {
  absence: Absence
  onEdit: (absence: Absence) => void
  onDelete: (absenceId: string) => void
  showMemberName?: boolean
  canEdit: boolean
}

export default function AbsenceCard({ absence, onEdit, onDelete, showMemberName, canEdit }: AbsenceCardProps) {
  const { t } = useTranslation('absences')
  const m = asObj<Member>(absence.member)
  const memberName = m ? `${m.first_name} ${m.last_name}`.trim() : undefined

  const affectsLabels: Record<string, string> = {
    trainings: t('affectsTrainings'),
    games: t('affectsGames'),
    events: t('affectsEvents'),
    all: t('affectsAll'),
  }

  return (
    <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
      <div className="grid items-center gap-x-3 gap-y-1" style={{ gridTemplateColumns: showMemberName ? 'auto 1fr auto auto' : 'auto 1fr auto' }}>
        {/* Row 1: badge, date range, (member name), actions */}
        <StatusBadge status={absence.reason} />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {showMemberName && memberName && (
            <span className="mr-2 font-medium text-gray-900 dark:text-gray-100">{memberName} —</span>
          )}
          {formatDate(absence.start_date)}
          {absence.indefinite
            ? ` — ${t('indefinite')}`
            : absence.start_date !== absence.end_date
              ? ` — ${formatDate(absence.end_date)}`
              : ''
          }
        </span>
        {showMemberName && <span />}
        {canEdit ? (
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
        ) : <span />}
      </div>
      {absence.reason_detail && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{absence.reason_detail}</p>
      )}
      {absence.affects && absence.affects.length > 0 && (
        <div className="mt-2 flex gap-1">
          {absence.affects.map((a) => (
            <span key={a} className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
              {affectsLabels[a] ?? a}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
