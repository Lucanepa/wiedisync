import type { Absence } from '../../types'
import { toXlsx, downloadBlob } from '../admin/utils/exportResults'

export interface RawAbsenceRow {
  start_date: string
  end_date: string
  reason: string
  reason_detail: string
  affects: string
}

export interface ValidatedRow extends RawAbsenceRow {
  errors: string[]
  normalizedReason: Absence['reason'] | null
  normalizedAffects: string[]
}

const VALID_REASONS: Absence['reason'][] = ['injury', 'vacation', 'work', 'personal', 'other']

const REASON_MAP: Record<string, Absence['reason']> = {
  // EN
  injury: 'injury', vacation: 'vacation', work: 'work', personal: 'personal', other: 'other',
  // DE
  verletzung: 'injury', ferien: 'vacation', urlaub: 'vacation', arbeit: 'work',
  'persönlich': 'personal', sonstiges: 'other',
  // FR
  blessure: 'injury', vacances: 'vacation', travail: 'work', personnel: 'personal', autre: 'other',
  // IT
  infortunio: 'injury', vacanza: 'vacation', lavoro: 'work', personale: 'personal', altro: 'other',
}

const VALID_AFFECTS = ['all', 'trainings', 'games']

// Map column name aliases to canonical field names
const COLUMN_ALIASES: Record<string, keyof RawAbsenceRow> = {
  start_date: 'start_date', startdate: 'start_date', from: 'start_date', von: 'start_date', du: 'start_date', da: 'start_date',
  end_date: 'end_date', enddate: 'end_date', to: 'end_date', bis: 'end_date', au: 'end_date', a: 'end_date',
  reason: 'reason', grund: 'reason', motif: 'reason', motivo: 'reason',
  reason_detail: 'reason_detail', details: 'reason_detail', detail: 'reason_detail',
  affects: 'affects', betrifft: 'affects', concerne: 'affects', riguarda: 'affects',
}

function excelDateToISO(serial: number): string {
  const utcDays = Math.floor(serial) - 25569
  const d = new Date(utcDays * 86400000)
  return d.toISOString().split('T')[0]
}

function normalizeDate(value: unknown): string {
  if (typeof value === 'number') return excelDateToISO(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    // DD.MM.YYYY (common in CH/DE)
    const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (dotMatch) return `${dotMatch[3]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`
    // DD/MM/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashMatch) return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`
    return trimmed
  }
  return ''
}

export function normalizeReason(input: string): Absence['reason'] | null {
  const key = input.trim().toLowerCase()
  if (VALID_REASONS.includes(key as Absence['reason'])) return key as Absence['reason']
  return REASON_MAP[key] ?? null
}

export function normalizeAffects(input: string | undefined): string[] {
  if (!input || !input.trim()) return ['all']
  const parts = input.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const valid = parts.filter((p) => VALID_AFFECTS.includes(p))
  if (valid.length === 0) return ['all']
  if (valid.includes('trainings') && valid.includes('games')) return ['all']
  return valid
}

export async function parseAbsenceFile(file: File): Promise<RawAbsenceRow[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  const rawRows = await readXlsxFile(file)
  if (rawRows.length === 0) return []

  const headers = rawRows[0].map((h) => String(h).trim())

  return rawRows.slice(1).map((row) => {
    const mapped: Partial<RawAbsenceRow> = {}
    for (let i = 0; i < headers.length; i++) {
      const canonical = COLUMN_ALIASES[headers[i].toLowerCase()]
      if (canonical) {
        const value = row[i]
        if (canonical === 'start_date' || canonical === 'end_date') {
          mapped[canonical] = normalizeDate(value)
        } else {
          mapped[canonical] = String(value ?? '')
        }
      }
    }
    return {
      start_date: mapped.start_date ?? '',
      end_date: mapped.end_date ?? '',
      reason: mapped.reason ?? '',
      reason_detail: mapped.reason_detail ?? '',
      affects: mapped.affects ?? '',
    }
  })
}

export function validateRow(row: RawAbsenceRow, t: (key: string, opts?: Record<string, string>) => string): ValidatedRow {
  const errors: string[] = []

  if (!row.start_date) {
    errors.push(t('startDateRequired'))
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.start_date)) {
    errors.push(t('importInvalidDate'))
  }

  if (!row.end_date) {
    errors.push(t('endDateRequired'))
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.end_date)) {
    errors.push(t('importInvalidDate'))
  }

  if (row.start_date && row.end_date && row.end_date < row.start_date) {
    errors.push(t('endAfterStart'))
  }

  const normalizedReason = row.reason ? normalizeReason(row.reason) : null
  if (!normalizedReason) {
    errors.push(t('importInvalidReason', { value: row.reason || '—' }))
  }

  const normalizedAffects = normalizeAffects(row.affects)

  return { ...row, errors, normalizedReason, normalizedAffects }
}

export async function downloadTemplate() {
  const columns = ['start_date', 'end_date', 'reason', 'reason_detail', 'affects']
  const exampleRows = [
    ['2026-04-01', '2026-04-07', 'vacation', 'Easter break', 'all'],
    ['2026-04-15', '2026-04-15', 'work', '', 'trainings'],
  ]
  const blob = await toXlsx(columns, exampleRows)
  downloadBlob(blob, 'absence_import_template.xlsx')
}
