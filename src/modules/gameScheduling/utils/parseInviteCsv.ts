export interface ParsedInviteRow {
  team_name: string
  contact_email: string
  contact_name: string
  line: number
  error?: string
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

export function parseInviteCsv(input: string): ParsedInviteRow[] {
  const rows: ParsedInviteRow[] = []
  const lines = input.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue
    const parts = splitCsvLine(raw).map((p) => p.trim())
    const lineNum = i + 1
    if (parts.length < 3) {
      rows.push({
        team_name: parts[0] || '',
        contact_email: parts[1] || '',
        contact_name: '',
        line: lineNum,
        error: 'missing columns: expected Verein,Email,Kontakt',
      })
      continue
    }
    rows.push({
      team_name: parts[0],
      contact_email: parts[1],
      contact_name: parts.slice(2).join(',').trim(),
      line: lineNum,
    })
  }
  return rows
}
