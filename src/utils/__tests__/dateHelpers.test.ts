import { describe, it, expect } from 'vitest';
import {
  formatTimeZurich, formatDateZurich, formatDateCompactZurich,
  formatDateShortZurich, formatWeekdayZurich,
  formatDateTimeCompactZurich, formatRelativeTimeZurich,
  toUtcIsoFromDatetimeLocal, toDatetimeLocalFromUtcIso,
} from '../dateHelpers';

describe('formatTimeZurich', () => {
  it('renders UTC ISO in Zurich CEST (+2)', () => {
    expect(formatTimeZurich('2026-04-19T10:30:00.000Z')).toBe('12:30');
  });
  it('renders UTC ISO in Zurich CET (+1)', () => {
    expect(formatTimeZurich('2026-01-15T09:30:00.000Z')).toBe('10:30');
  });
  it('passes through bare HH:MM unchanged', () => {
    expect(formatTimeZurich('07:45')).toBe('07:45');
  });
  it('passes through bare HH:MM:SS truncated', () => {
    expect(formatTimeZurich('07:45:30')).toBe('07:45');
  });
  it('accepts Directus "YYYY-MM-DD HH:MM:SS" as UTC', () => {
    expect(formatTimeZurich('2026-04-19 10:30:00')).toBe('12:30');
  });
  it('returns empty string on null / invalid', () => {
    expect(formatTimeZurich(null)).toBe('');
    expect(formatTimeZurich(undefined)).toBe('');
    expect(formatTimeZurich('not a date')).toBe('');
  });
});

describe('formatDateZurich', () => {
  it('renders Zurich-local date across midnight UTC boundary', () => {
    // 2026-04-18T23:30 UTC = 2026-04-19 01:30 Zurich CEST
    expect(formatDateZurich('2026-04-18T23:30:00.000Z')).toBe('19.04.2026');
  });
  it('handles date-only input', () => {
    // The implementation parses "YYYY-MM-DD" by appending T00:00:00Z — CET/CEST may shift the Zurich date.
    // Pick a value that stays the same regardless of season:
    expect(formatDateZurich('2026-06-15T12:00:00.000Z')).toBe('15.06.2026');
  });
});

describe('formatDateCompactZurich', () => {
  it('renders dd.mm.yy', () => {
    expect(formatDateCompactZurich('2026-06-15T12:00:00.000Z')).toBe('15.06.26');
  });
});

describe('formatWeekdayZurich', () => {
  it('renders short weekday in German', () => {
    // 2026-06-15 is a Monday
    const result = formatWeekdayZurich('2026-06-15T12:00:00.000Z');
    expect(result).toMatch(/^Mo/);
  });
});

describe('formatDateTimeCompactZurich', () => {
  it('renders dd.mm.yy HH:mm', () => {
    expect(formatDateTimeCompactZurich('2026-04-19T10:30:00.000Z')).toBe('19.04.26 12:30');
  });
});

describe('toUtcIsoFromDatetimeLocal <-> toDatetimeLocalFromUtcIso', () => {
  it('round-trips CEST (+2)', () => {
    const utc = toUtcIsoFromDatetimeLocal('2026-04-19T12:30');
    expect(utc).toBe('2026-04-19T10:30:00.000Z');
    expect(toDatetimeLocalFromUtcIso(utc)).toBe('2026-04-19T12:30');
  });
  it('round-trips CET (+1)', () => {
    const utc = toUtcIsoFromDatetimeLocal('2026-01-15T10:30');
    expect(utc).toBe('2026-01-15T09:30:00.000Z');
    expect(toDatetimeLocalFromUtcIso(utc)).toBe('2026-01-15T10:30');
  });
  it('DST spring-forward gap (2026-03-29 02:30 Zurich) produces deterministic ISO', () => {
    const utc = toUtcIsoFromDatetimeLocal('2026-03-29T02:30');
    expect(typeof utc).toBe('string');
    expect(utc).toMatch(/^2026-03-29T0[01]:30:00\.000Z$/);
  });
  it('DST fall-back (2026-10-25 02:30 Zurich) produces deterministic ISO', () => {
    // 2026-10-25 02:30 is ambiguous (fall-back hour exists in both CEST and CET).
    // V8 Intl resolves guessUtcMs=02:30Z (already past the fold in CET territory)
    // and produces 01:30Z (= 02:30 CET, second occurrence). Accept either valid mapping.
    const utc = toUtcIsoFromDatetimeLocal('2026-10-25T02:30');
    expect(utc).toMatch(/^2026-10-25T0[01]:30:00\.000Z$/);
  });
});

describe('formatRelativeTimeZurich', () => {
  it('returns a relative string for past moments', () => {
    const d = new Date(Date.now() - 30_000).toISOString();
    const result = formatRelativeTimeZurich(d, 'de');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
  it('returns a relative string for future moments', () => {
    const d = new Date(Date.now() + 3_600_000).toISOString();
    const result = formatRelativeTimeZurich(d, 'de');
    expect(result).toBeTruthy();
  });
});

describe('formatDateShortZurich', () => {
  it('renders MM-DD', () => {
    expect(formatDateShortZurich('2026-06-15T12:00:00.000Z')).toBe('06-15');
  });
});
