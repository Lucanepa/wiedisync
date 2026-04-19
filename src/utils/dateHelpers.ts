// --- Intl-Zurich helpers (proper UTC convention) ---

const ZURICH = 'Europe/Zurich';

function formatZurichParts(d: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'short',
  }).formatToParts(d);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

/** Format HH:mm in Europe/Zurich, accepts ISO UTC, "YYYY-MM-DD HH:MM:SS" (treated as UTC), or bare "HH:MM". */
export function formatTimeZurich(input: string | Date | null | undefined): string {
  if (!input) return '';
  if (typeof input === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(input)) return input.slice(0, 5);
  const d = typeof input === 'string'
    ? new Date(input.includes('T') ? input : input.replace(' ', 'T') + 'Z')
    : input;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: ZURICH, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

/** Format dd.mm.yyyy in Europe/Zurich. */
export function formatDateZurich(input: string | Date | null | undefined, locale: string = 'de-CH'): string {
  if (!input) return '';
  const d = typeof input === 'string'
    ? new Date(input.includes('T') ? input : input.replace(' ', 'T') + 'Z')
    : input;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    timeZone: ZURICH, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

/** Format dd.mm.yy (compact) in Europe/Zurich. */
export function formatDateCompactZurich(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string'
    ? new Date(input.includes('T') ? input : input.replace(' ', 'T') + 'Z')
    : input;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: ZURICH, day: '2-digit', month: '2-digit', year: '2-digit',
  }).format(d);
}

/** Format MM/DD in Europe/Zurich (matches legacy formatDateShort en-US format). */
export function formatDateShortZurich(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string'
    ? new Date(input.includes('T') ? input : input.replace(' ', 'T') + 'Z')
    : input;
  if (Number.isNaN(d.getTime())) return '';
  const p = formatZurichParts(d);
  return `${p.month}/${p.day}`;
}

/** Format short weekday ("Mo", "Di", ...) in Europe/Zurich. */
export function formatWeekdayZurich(input: string | Date | null | undefined, locale: string = 'de-CH'): string {
  if (!input) return '';
  const d = typeof input === 'string'
    ? new Date(input.includes('T') ? input : input.replace(' ', 'T') + 'Z')
    : input;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { timeZone: ZURICH, weekday: 'short' }).format(d);
}

/** "dd.mm.yy HH:mm" compact datetime in Europe/Zurich. */
export function formatDateTimeCompactZurich(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string'
    ? new Date(input.includes('T') ? input : input.replace(' ', 'T') + 'Z')
    : input;
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDateCompactZurich(d)} ${formatTimeZurich(d)}`;
}

/** Relative time ("vor 2 Std.", "in 3 Tagen"). Uses actual UTC-stored instant. */
export function formatRelativeTimeZurich(input: string | Date | null | undefined, locale: string = 'de'): string {
  if (!input) return '';
  const d = typeof input === 'string'
    ? new Date(input.includes('T') ? input : input.replace(' ', 'T') + 'Z')
    : input;
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = d.getTime() - Date.now();
  const absSec = Math.abs(diffMs) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (absSec < 60)      return rtf.format(Math.round(diffMs / 1000), 'second');
  if (absSec < 3600)    return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (absSec < 86400)   return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  if (absSec < 2592000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');
  if (absSec < 31_536_000) return rtf.format(Math.round(diffMs / 2_592_000_000), 'month');
  return rtf.format(Math.round(diffMs / 31_536_000_000), 'year');
}

/** Round-trip: datetime-local input value ("2026-04-19T12:30") interpreted as Europe/Zurich -> UTC ISO. */
export function toUtcIsoFromDatetimeLocal(localStr: string): string {
  const [date, time] = localStr.split('T');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  const guessUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0);

  const offset1 = getZurichOffsetMs(guessUtcMs);
  const corrected1 = guessUtcMs - offset1;
  const offset2 = getZurichOffsetMs(corrected1);
  // Non-DST-transition times: offset1 === offset2, single pass is correct.
  // DST transition: offset2 reflects the actual zone at the corrected instant; use it.
  const offsetMs = offset1 === offset2 ? offset1 : offset2;
  return new Date(guessUtcMs - offsetMs).toISOString();
}

function getZurichOffsetMs(instantMs: number): number {
  const p = formatZurichParts(new Date(instantMs));
  const shownMs = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return shownMs - instantMs;
}

/** Inverse: UTC ISO -> "YYYY-MM-DDTHH:MM" for datetime-local input, in Europe/Zurich. */
export function toDatetimeLocalFromUtcIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = formatZurichParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// --- Legacy wall-clock helpers (kept for backward compat — A2/A3 will migrate call sites) ---

const dateFmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
const dateShortFmt = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

// Convention: API datetimes are "wall-clock time labeled as UTC" (admin typed 12:30
// Swiss → DB stores 12:30Z → we must render hours/minutes verbatim, NOT convert TZ).
// parseWallClock strips any trailing Z/offset so `new Date()` parses as LOCAL,
// making `.getHours()`, Intl formatters, etc. return the stored wall-clock values.
export function parseWallClock(input: string | Date | null | undefined): Date {
  if (input instanceof Date) return input
  if (!input) return new Date(NaN)
  const stripped = input.replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i, '')
  const withT = stripped.includes('T') ? stripped : stripped.replace(' ', 'T')
  return new Date(withT)
}

/** Swiss compact: dd.mm.yy */
export function formatDateCompact(date: string): string {
  const d = parseWallClock(date)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

export function formatDate(date: string): string {
  return dateFmt.format(parseWallClock(date))
}

export function formatDateShort(date: string): string {
  return dateShortFmt.format(parseWallClock(date))
}

export function formatWeekday(date: string): string {
  return weekdayFmt.format(parseWallClock(date))
}

export function formatTime(time: string): string {
  // For ISO/datetime strings, parse as wall-clock (stored times are admin-typed, TZ-naive)
  if (time.includes('T') || (time.includes(' ') && time.includes('-'))) {
    const d = parseWallClock(time)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  // Plain time string (e.g. "20:00" or "20:00:00")
  const [h, m] = time.split(':')
  return `${h.padStart(2, '0')}:${m}`
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  const d = new Date(date).getTime()
  return d >= new Date(start).getTime() && d <= new Date(end).getTime()
}

export function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  // Season runs Sep–May. If we're in Jan–Aug, current season started last year.
  if (month < 8) {
    return `${year - 1}/${String(year).slice(2)}`
  }
  return `${year}/${String(year + 1).slice(2)}`
}

export function getSeasonDateRange(season: string): { start: string; end: string } {
  const startYear = parseInt(season.split('/')[0])
  return {
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
  }
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today's date as YYYY-MM-DD in local timezone (NOT UTC). */
export function todayLocal(): string {
  return toISODate(new Date())
}

/** Normalize a date/datetime string to API format "YYYY-MM-DD HH:MM:SS".
 *  Handles datetime-local values ("2026-08-26T18:00"), existing API datetimes, and date-only strings. */
export function toApiDatetime(d: string): string {
  if (!d) return d
  const normalized = d.replace('T', ' ')
  if (normalized.includes(' ')) {
    const [date, time] = normalized.split(' ')
    const parts = time.split(':')
    return `${date} ${parts[0]}:${parts[1]}:${parts[2] ?? '00'}`
  }
  return `${d} 00:00:00`
}

// --- Hallenplan utilities ---

/** Returns the Monday 00:00:00 of the week containing `date` */
export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns array of 7 Dates [Mon..Sun] for the week starting at `monday` */
export function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** Parses 'HH:mm' to minutes since midnight (e.g., '08:30' => 510) */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Converts minutes since midnight to 'HH:mm' */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Returns day_of_week 0=Mon..6=Sun from a JS Date */
export function getDayOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** Returns a new Date advanced by `days` */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Format a datetime as dd.mm.yy HH:mm */
export function formatDateTimeCompact(datetime: string): string {
  const d = parseWallClock(datetime)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yy} ${hh}:${min}`
}

/** Map i18n language codes to Intl-compatible locales (gsw isn't supported by browsers) */
function toIntlLocale(locale: string): string {
  if (locale === 'gsw') return 'de-CH'
  return locale
}

/** Format a datetime as locale-aware relative time (e.g. "vor 2 Std.", "2 hr. ago"). */
export function formatRelativeTime(datetime: string, locale: string = 'de-CH'): string {
  // Use wall-clock parse so the stored "admin-typed time labeled as UTC" matches the local "now" frame.
  const diffMs = Date.now() - parseWallClock(datetime).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  const rtf = new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: 'auto', style: 'short' })
  if (diffMin < 1) {
    const justNow: Record<string, string> = { de: 'Gerade eben', gsw: 'Grad ebe', fr: "A l'instant", it: 'Proprio ora', en: 'Just now' }
    return justNow[locale.split('-')[0]] ?? justNow.en!
  }
  if (diffMin < 60) return rtf.format(-diffMin, 'minute')
  if (diffHr < 24) return rtf.format(-diffHr, 'hour')
  if (diffDay < 7) return rtf.format(-diffDay, 'day')
  return formatDateCompact(datetime)
}

/** Returns ISO week number */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 6) / 7)
}

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Returns short day name for day_of_week 0=Mon..6=Sun */
export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES_SHORT[dayOfWeek]
}

/**
 * Parse a respond_by datetime into { date, time } with backward-compatible fallback.
 * Legacy records have 00:00:00 (midnight) — treat as "no time set".
 */
export function parseRespondByTime(respondBy: string | undefined | null, fallbackTime?: string): { date: string; time: string } {
  if (!respondBy) return { date: '', time: '' }
  const normalized = respondBy.replace('T', ' ')
  const [date, rawTime] = normalized.split(' ')
  const hasExplicitTime = rawTime && rawTime !== '00:00:00'
  const time = hasExplicitTime ? rawTime.slice(0, 5) : (fallbackTime || '')
  return { date: date || '', time }
}

/**
 * Compute deadline Date from respond_by string with backward-compatible fallback.
 * Legacy 00:00:00 records fall back to activityStartTime or 23:59.
 * Handles both "YYYY-MM-DD HH:MM:SS" and ISO "YYYY-MM-DDTHH:MM:SS(.sss)Z" inputs.
 */
export function getDeadlineDate(respondBy: string, activityStartTime?: string): Date {
  // Normalize away TZ marker + T separator so we can split on space
  const normalized = respondBy
    .replace('T', ' ')
    .replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i, '')
  const [rbDate, rbTime] = normalized.split(' ')
  const effectiveTime = rbTime && rbTime !== '00:00:00' ? rbTime.slice(0, 5) : (activityStartTime || '23:59')
  return new Date(`${rbDate}T${effectiveTime}`)
}
