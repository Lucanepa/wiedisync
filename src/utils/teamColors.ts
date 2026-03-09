export const teamColors: Record<string, { bg: string; text: string; border: string }> = {
  // Herren VB: shades of blue, brown, green
  H1: { bg: '#1d4ed8', text: '#ffffff', border: '#1e40af' },
  H2: { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  H3: { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' },
  'HU20': { bg: '#0ea5e9', text: '#ffffff', border: '#0284c7' },
  'HU23': { bg: '#38bdf8', text: '#ffffff', border: '#0ea5e9' },
  Legends: { bg: '#92400e', text: '#ffffff', border: '#78350f' },
  // Damen VB: shades of red, yellow, orange
  D1: { bg: '#dc2626', text: '#ffffff', border: '#b91c1c' },
  D2: { bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
  D3: { bg: '#d97706', text: '#ffffff', border: '#b45309' },
  D4: { bg: '#ca8a04', text: '#ffffff', border: '#a16207' },
  'DU23': { bg: '#e11d48', text: '#ffffff', border: '#be123c' },
  // Basketball Herren
  'BB-H1': { bg: '#c2410c', text: '#ffffff', border: '#9a3412' },
  'BB-H3': { bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
  // Basketball Damen
  'BB-D1': { bg: '#a21caf', text: '#ffffff', border: '#86198f' },
  'BB-D3': { bg: '#c026d3', text: '#ffffff', border: '#a21caf' },
  // Basketball Jugend
  'BB-HU16': { bg: '#0d9488', text: '#ffffff', border: '#0f766e' },
  'BB-HU14': { bg: '#14b8a6', text: '#ffffff', border: '#0d9488' },
  'BB-DU16': { bg: '#f472b6', text: '#ffffff', border: '#ec4899' },
  'BB-DU14': { bg: '#e879f9', text: '#ffffff', border: '#d946ef' },
  'BB-DU12': { bg: '#fb923c', text: '#ffffff', border: '#f97316' },
  'BB-DU10': { bg: '#fbbf24', text: '#1f2937', border: '#f59e0b' },
  'BB-MU8': { bg: '#a3e635', text: '#1f2937', border: '#84cc16' },
  // Basketball Lions / Rhinos
  'BB-Lions D1': { bg: '#7c3aed', text: '#ffffff', border: '#6d28d9' },
  'BB-Lions D3': { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' },
  'BB-Rhinos D1': { bg: '#059669', text: '#ffffff', border: '#047857' },
  'BB-Rhinos D3': { bg: '#10b981', text: '#ffffff', border: '#059669' },
  // Other (KWI, Lehrer TV, TV Wiedikon): grey
  Other: { bg: '#6b7280', text: '#ffffff', border: '#4b5563' },
}

/** Maps team short names to their sport. Keys without 'BB-' prefix are volleyball. */
export const teamSport: Record<string, 'volleyball' | 'basketball'> = {
  H1: 'volleyball', H2: 'volleyball', H3: 'volleyball',
  HU20: 'volleyball', HU23: 'volleyball', Legends: 'volleyball',
  D1: 'volleyball', D2: 'volleyball', D3: 'volleyball', D4: 'volleyball',
  DU23: 'volleyball',
  'BB-H1': 'basketball', 'BB-H3': 'basketball',
  'BB-D1': 'basketball', 'BB-D3': 'basketball',
  'BB-HU16': 'basketball', 'BB-HU14': 'basketball',
  'BB-DU16': 'basketball', 'BB-DU14': 'basketball',
  'BB-DU12': 'basketball', 'BB-DU10': 'basketball', 'BB-MU8': 'basketball',
  'BB-Lions D1': 'basketball', 'BB-Lions D3': 'basketball',
  'BB-Rhinos D1': 'basketball', 'BB-Rhinos D3': 'basketball',
}

export const svTeamIds: Record<string, string> = {
  '12747': 'H3',
  '1394': 'D4',
  '14040': 'DU23-2',
  '7563': 'HU23-1',
  '1393': 'D2',
  '541': 'H2',
  '6023': 'Legends',
  '4689': 'D3',
  '2743': 'H1',
  '1395': 'D1',
  '2301': 'DU23-1',
}

export function getTeamColor(teamName: string) {
  const key = teamName.replace(/-\d+$/, '')
  return teamColors[key] ?? { bg: '#6b7280', text: '#ffffff', border: '#4b5563' }
}
