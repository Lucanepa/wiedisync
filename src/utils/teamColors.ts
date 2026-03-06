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
  // Basketball: light brown
  Basketball: { bg: '#a0845c', text: '#ffffff', border: '#8b6f47' },
  // Other (KWI, Lehrer TV, TV Wiedikon): grey
  Other: { bg: '#6b7280', text: '#ffffff', border: '#4b5563' },
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
