export interface BuildMailtoArgs {
  invite: {
    token: string
    team_name: string
    contact_name: string
    contact_email: string
    expires_at: string
  }
  kscwTeam: { name: string; league: string }
  season: { name: string }
  frontendUrl: string
}

export function buildInviteMailto({ invite, kscwTeam, season, frontendUrl }: BuildMailtoArgs): string {
  const link = `${frontendUrl}/terminplanung/${invite.token}`
  const expiresDe = new Date(invite.expires_at).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const subject = `KSC Wiedikon – Spielplanung Saison ${season.name}`
  const body = [
    `Hallo ${invite.contact_name},`,
    '',
    `KSC Wiedikon lädt euch zur Spielplanung der Saison ${season.name} ein.`,
    '',
    `Unter folgendem Link könnt ihr eure Heim- und Auswärtsspieltermine gegen unser Team ${kscwTeam.name} (${kscwTeam.league}) auswählen:`,
    '',
    link,
    '',
    `Der Link ist bis ${expiresDe} gültig.`,
    '',
    `Bei Fragen antwortet einfach auf diese E-Mail.`,
    '',
    `Sportliche Grüsse`,
    `KSC Wiedikon`,
  ].join('\n')
  return `mailto:${invite.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
