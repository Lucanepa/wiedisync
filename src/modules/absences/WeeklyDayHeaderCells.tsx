import { useTranslation } from 'react-i18next'
import { TableHead } from '@/components/ui/table'

const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const

/**
 * Renders 7 narrow `<TableHead>` cells (Mon..Sun) shared between the personal
 * and team weekly-unavailability tables. Must be rendered inside a `<TableRow>`.
 */
export default function WeeklyDayHeaderCells() {
  const { t } = useTranslation('absences')
  return (
    <>
      {DAY_KEYS.map((key) => (
        <TableHead
          key={key}
          className="w-10 px-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          {t(key)}
        </TableHead>
      ))}
    </>
  )
}
