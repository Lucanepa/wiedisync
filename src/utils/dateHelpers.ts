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


/** Swiss compact: dd.mm.yy */
export function formatDateCompact(d: string): string {
  return formatDateCompactZurich(d)
}

export function formatDate(d: string, locale: string = 'de-CH'): string {
  return formatDateZurich(d, locale)
}

export function formatDateShort(d: string): string {
  return formatDateShortZurich(d)
}

export function formatWeekday(d: string): string {
  return formatWeekdayZurich(d)
}

export function formatTime(t: string): string {
  return formatTimeZurich(t)
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
  return formatDateTimeCompactZurich(datetime)
}

/** Format a datetime as locale-aware relative time (e.g. "vor 2 Std.", "2 hr. ago"). */
export function formatRelativeTime(datetime: string, locale: string = 'de'): string {
  return formatRelativeTimeZurich(datetime, locale)
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

/** Parse a respond_by datetime into { date, time } in Europe/Zurich.
 * Accepts ISO UTC or the legacy "YYYY-MM-DD HH:MM:SS" space format. */
export function parseRespondByTime(
  respondBy: string | null | undefined,
  _fallbackStartTime?: string
): { date: string; time: string } | null {
  if (!respondBy) return null;
  const d = new Date(respondBy.includes('T') ? respondBy : respondBy.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return null;
  const p = formatZurichParts(d);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Compute deadline Date from respond_by ISO string.
 * When stored h+m+s in Europe/Zurich are all zero (sentinel for "unset"),
 * fall back to activityStartTime (HH:MM) or 23:59 on the Zurich-local date. */
export function getDeadlineDate(respondBy: string, activityStartTime?: string): Date {
  const d = new Date(respondBy.includes('T') ? respondBy : respondBy.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  const p = formatZurichParts(d);
  if (p.hour === '00' && p.minute === '00' && p.second === '00') {
    const fallback = activityStartTime && /^\d{2}:\d{2}$/.test(activityStartTime) ? activityStartTime : '23:59';
    return new Date(toUtcIsoFromDatetimeLocal(`${p.year}-${p.month}-${p.day}T${fallback}`));
  }
  return d;
}
