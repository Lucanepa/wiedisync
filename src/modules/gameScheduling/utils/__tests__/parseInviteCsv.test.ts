import { describe, it, expect } from 'vitest'
import { parseInviteCsv } from '../parseInviteCsv'

describe('parseInviteCsv', () => {
  it('parses simple rows: Verein,Email,Kontakt', () => {
    const out = parseInviteCsv('VBC Affoltern,jane@x.ch,Jane Doe')
    expect(out).toEqual([
      { team_name: 'VBC Affoltern', contact_email: 'jane@x.ch', contact_name: 'Jane Doe', line: 1 },
    ])
  })

  it('handles multiple lines + trims whitespace', () => {
    const out = parseInviteCsv('  VBC A , a@x.ch , Jane \n VBC B,b@x.ch,John')
    expect(out).toHaveLength(2)
    expect(out[0].team_name).toBe('VBC A')
    expect(out[1].contact_email).toBe('b@x.ch')
  })

  it('skips blank lines', () => {
    expect(parseInviteCsv('A,a@x.ch,J\n\n\nB,b@x.ch,K')).toHaveLength(2)
  })

  it('supports quoted names with commas', () => {
    const out = parseInviteCsv('"VBC, Grande",a@x.ch,Jane')
    expect(out[0].team_name).toBe('VBC, Grande')
  })

  it('returns parse errors on malformed lines', () => {
    const out = parseInviteCsv('onlyone')
    expect(out[0].error).toMatch(/missing/i)
    expect(out[0].line).toBe(1)
  })

  it('preserves line numbers even when skipping blanks', () => {
    const out = parseInviteCsv('A,a@x.ch,J\n\nB,b@x.ch,K')
    expect(out[0].line).toBe(1)
    expect(out[1].line).toBe(3)
  })
})
