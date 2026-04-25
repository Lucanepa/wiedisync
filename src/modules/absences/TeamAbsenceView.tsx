import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, List, CheckCircle } from 'lucide-react'
import { useTeamAbsences } from '../../hooks/useTeamAbsences'
import EmptyState from '../../components/EmptyState'
import AbsenceCard from './AbsenceCard'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import MonthGrid from '../calendar/components/MonthGrid'
import CalendarEntryModal from '../calendar/CalendarEntryModal'
import { toISODate } from '../../utils/dateHelpers'
import { parseDate, isSameDay, startOfMonth } from '../../utils/dateUtils'
import DatePicker from '@/components/ui/DatePicker'
import type { CalendarEntry } from '../../types/calendar'
import type { Absence, Member } from '../../types'
import { relId, asObj } from '../../utils/relations'

interface TeamAbsenceViewProps {
  teamIds: string[]
  onEdit?: (absence: Absence) => void
  onDelete?: (absenceId: string) => void
  canEdit?: boolean
}

/** Convert team absences into CalendarEntry[] for MonthGrid */
function absencesToEntries(absences: Absence[], memberMap: Record<string, Member>): CalendarEntry[] {
  return absences.map((a) => {
    const start = parseDate(a.start_date)
    const end = parseDate(a.end_date)
    const isMultiDay = !isSameDay(start, end)
    const m = asObj<Member>(a.member) ?? memberMap[relId(a.member)]
    const memberName = [m?.first_name, m?.last_name].filter(Boolean).join(' ') || ''

    return {
      id: a.id,
      type: 'absence' as const,
      title: memberName,
      date: start,
      endDate: isMultiDay ? end : undefined,
      startTime: null,
      endTime: null,
      allDay: true,
      location: '',
      teamNames: [],
      description: a.reason_detail ?? '',
      source: a,
    }
  })
}

export default function TeamAbsenceView({ teamIds, onEdit, onDelete, canEdit }: TeamAbsenceViewProps) {
  const { t } = useTranslation('absences')
  const today = toISODate(new Date())
  const oneYearLater = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return toISODate(d)
  })()

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(oneYearLater)
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null)

  const { absences, memberMap, isLoading } = useTeamAbsences(teamIds, startDate, endDate)

  // Flat list sorted by most recent first
  const sortedAbsences = useMemo(() =>
    [...absences].sort((a, b) => b.start_date.localeCompare(a.start_date)),
  [absences])

  // Calendar entries
  const calendarEntries = useMemo(
    () => absencesToEntries(absences, memberMap),
    [absences, memberMap],
  )

  if (isLoading) {
    return <div className="py-8 text-center text-gray-500 dark:text-gray-400">{t('common:loading')}</div>
  }

  return (
    <div>
      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <DatePicker label={t('fromTo')} value={startDate} onChange={setStartDate} />
          <DatePicker label={t('until')} value={endDate} onChange={setEndDate} />
        </div>
        {/* View toggle */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-2 transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            title={t('common:list')}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`rounded-md p-2 transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            title={t('common:calendar')}
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* ── List view ── */
        sortedAbsences.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="h-10 w-10" />}
            title={t('noTeamAbsences')}
            description={t('noTeamAbsencesDescription')}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-gray-500 dark:text-gray-400">{t('colMember')}</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">{t('colReason')}</TableHead>
                  <TableHead className="hidden md:table-cell text-gray-500 dark:text-gray-400">{t('colWhen')}</TableHead>
                  <TableHead className="hidden sm:table-cell text-gray-500 dark:text-gray-400">{t('colAffects')}</TableHead>
                  <TableHead className="w-32 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAbsences.map((a) => {
                  const member = asObj<Member>(a.member) ?? memberMap[relId(a.member)]
                  const memberName = [member?.first_name, member?.last_name].filter(Boolean).join(' ') || t('common:unknown')
                  return (
                    <AbsenceCard
                      key={a.id}
                      absence={a}
                      memberName={memberName}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      canEdit={canEdit}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )
      ) : (
        /* ── Calendar view ── */
        <>
          <MonthGrid
            entries={calendarEntries}
            closedDates={new Set()}
            month={month}
            onMonthChange={setMonth}
            onEntryClick={setSelectedEntry}
          />
          <CalendarEntryModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
          />
        </>
      )}
    </div>
  )
}
