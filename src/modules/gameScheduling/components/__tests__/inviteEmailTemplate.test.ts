import { describe, it, expect } from 'vitest'
import { buildInviteMailto } from '../inviteEmailTemplate'

describe('buildInviteMailto', () => {
  const invite = {
    token: 'abc123',
    team_name: 'VBC Zürich Affoltern',
    contact_name: 'Jane Müller',
    contact_email: 'jane@example.ch',
    expires_at: '2026-12-31T12:00:00Z',
  }
  const kscwTeam = { name: 'DR3 Men', league: '2L' }
  const season = { name: '2026/2027' }
  const frontendUrl = 'https://wiedisync.kscw.ch'

  it('produces a valid RFC 6068 mailto:', () => {
    const href = buildInviteMailto({ invite, kscwTeam, season, frontendUrl })
    expect(href).toMatch(/^mailto:jane@example\.ch\?subject=/)
  })

  it('encodes umlauts in contact name (inside body)', () => {
    const href = buildInviteMailto({ invite, kscwTeam, season, frontendUrl })
    expect(href).toContain(encodeURIComponent('Jane Müller'))
  })

  it('includes the tokenized link url-encoded', () => {
    const href = buildInviteMailto({ invite, kscwTeam, season, frontendUrl })
    expect(href).toContain(encodeURIComponent('https://wiedisync.kscw.ch/terminplanung/abc123'))
  })

  it('includes season name in subject and body', () => {
    const href = buildInviteMailto({ invite, kscwTeam, season, frontendUrl })
    expect(decodeURIComponent(href)).toContain('Saison 2026/2027')
  })

  it('formats expires_at as Swiss date', () => {
    const href = buildInviteMailto({ invite, kscwTeam, season, frontendUrl })
    expect(decodeURIComponent(href)).toContain('31.12.2026')
  })
})
