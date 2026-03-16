import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { parseISO } from 'date-fns'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  toDateKey,
  formatDateLocale,
} from '../../utils/dateUtils'

const baseClass =
  'min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400'

const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'
const errorClass = 'mt-1 text-xs text-red-600 dark:text-red-400'
const helperClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  helperText?: string
  min?: string
  max?: string
  placeholder?: string
  id?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export default function DatePicker({
  value,
  onChange,
  label,
  error,
  helperText,
  min,
  max,
  placeholder,
  id,
  disabled,
  className = '',
}: DatePickerProps) {
  const { t, i18n } = useTranslation('common')
  const lang = i18n.language
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Find closest <dialog> to portal into (so popover stays in top-layer)
  useEffect(() => {
    containerRef.current = triggerRef.current?.closest('dialog') ?? null
  }, [])

  const selectedDate = value ? parseISO(value) : null
  const [viewMonth, setViewMonth] = useState(() =>
    selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date()),
  )

  // Sync viewMonth when value changes externally
  useEffect(() => {
    if (selectedDate) setViewMonth(startOfMonth(selectedDate))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval(gridStart, gridEnd)

  const today = new Date()
  const minDate = min ? parseISO(min) : null
  const maxDate = max ? parseISO(max) : null

  // Weekday headers from locale (Monday-start)
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    return formatDateLocale(d, 'EEEEEE', lang)
  })

  function isDayDisabled(date: Date): boolean {
    if (minDate && toDateKey(date) < toDateKey(minDate)) return true
    if (maxDate && toDateKey(date) > toDateKey(maxDate)) return true
    return false
  }

  function selectDay(date: Date) {
    onChange(toDateKey(date))
    setOpen(false)
  }

  function selectToday() {
    if (!isDayDisabled(today)) {
      onChange(toDateKey(today))
      setViewMonth(startOfMonth(today))
      setOpen(false)
    }
  }

  const displayValue = selectedDate
    ? formatDateLocale(selectedDate, 'd. MMM yyyy', lang)
    : ''

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className={labelClass}>
          {label}
        </label>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            id={inputId}
            disabled={disabled}
            data-testid="datepicker-trigger"
            className={`${baseClass} flex cursor-pointer items-center justify-between text-left ${error ? 'border-red-500 dark:border-red-400' : ''} ${className}`}
          >
            <span className={displayValue ? '' : 'text-gray-400 dark:text-gray-500'}>
              {displayValue || placeholder || t('selectDate')}
            </span>
            <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </Popover.Trigger>

        <Popover.Portal container={containerRef.current ?? undefined}>
          <Popover.Content
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className="z-[100] w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {/* Month navigation header */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label={t('prevMonth')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {formatDateLocale(viewMonth, 'MMMM yyyy', lang)}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label={t('nextMonth')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="mb-1 grid grid-cols-7">
              {weekdays.map((d, i) => (
                <div
                  key={i}
                  className="py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((date) => {
                const key = toDateKey(date)
                const inMonth = isSameMonth(date, viewMonth)
                const isSelected = selectedDate ? isSameDay(date, selectedDate) : false
                const isToday = isSameDay(date, today)
                const dayDisabled = isDayDisabled(date)

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={dayDisabled || !inMonth}
                    onClick={() => selectDay(date)}
                    className={`flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-brand-500 font-semibold text-white'
                        : isToday
                          ? 'font-semibold text-gold-600 ring-2 ring-inset ring-gold-400 dark:text-gold-400 dark:ring-gold-500'
                          : !inMonth
                            ? 'text-gray-300 dark:text-gray-600'
                            : dayDisabled
                              ? 'text-gray-300 opacity-40 dark:text-gray-600'
                              : 'text-gray-900 hover:bg-brand-50 dark:text-gray-100 dark:hover:bg-brand-900/30'
                    } ${!inMonth || dayDisabled ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Today button */}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={selectToday}
                disabled={isDayDisabled(today)}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {t('today')}
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {error && <p className={errorClass}>{error}</p>}
      {helperText && !error && <p className={helperClass}>{helperText}</p>}
    </div>
  )
}
