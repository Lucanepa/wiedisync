import { useTranslation } from 'react-i18next'
import { formatDate } from '../../utils/dateHelpers'
import { TableCell, TableRow } from '../../components/ui/table'
import type { Absence, Member } from '../../types'
import { asObj } from '../../utils/relations'

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

/**
 * Renders a single `<TableRow>` — must be used inside a `<Table>`.
 */
export default function WeeklyUnavailabilityCard({ absence, onEdit, onDelete, showMemberName, canEdit }: WeeklyUnavailabilityCardProps) {
  const { t } = useTranslation('absences')
  const m = asObj<Member>(absence.member)
  const memberName = m ? `${m.first_name} ${m.last_name}`.trim() : undefined

  const affectsLabels: Record<string, string> = {
    trainings: t('affectsTrainings'),
    games: t('affectsGames'),
    events: t('affectsEvents'),
    all: t('affectsAll'),
  }

  const dateRange = `${formatDate(absence.start_date)}${
    absence.indefinite
      ? ` — ${t('indefinite')}`
      : absence.start_date !== absence.end_date
        ? ` — ${formatDate(absence.end_date)}`
        : ''
  }`

  return (
    <TableRow className="align-top">
      {showMemberName && (
        <TableCell className="whitespace-normal text-sm font-medium text-gray-900 dark:text-gray-100">
          {memberName ?? '—'}
        </TableCell>
      )}
      <TableCell className="whitespace-normal">
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
        <div className="md:hidden mt-1 text-xs text-gray-600 dark:text-gray-400">{dateRange}</div>
      </TableCell>
      <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
        {dateRange}
      </TableCell>
      <TableCell className="hidden sm:table-cell whitespace-normal">
        {absence.affects && absence.affects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {absence.affects.map((a) => (
              <span key={a} className={`rounded px-2 py-0.5 text-xs ${AFFECTS_COLORS[a] ?? AFFECTS_COLORS.all}`}>
                {affectsLabels[a] ?? a}
              </span>
            ))}
          </div>
        )}
        {absence.reason_detail && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{absence.reason_detail}</p>
        )}
      </TableCell>
      {canEdit ? (
        <TableCell className="text-right">
          <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:justify-end sm:gap-2">
            <button
              onClick={() => onEdit(absence)}
              className="min-h-[36px] rounded px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 hover:text-brand-700"
            >
              {t('common:edit')}
            </button>
            <button
              onClick={() => onDelete(absence.id)}
              className="min-h-[36px] rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-800"
            >
              {t('common:delete')}
            </button>
          </div>
        </TableCell>
      ) : (
        <TableCell />
      )}
    </TableRow>
  )
}
