import { useState, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { decode } from '@toon-format/toon'
import pb from '../../../pb'
import type { Game, Member, Team, MemberTeam, LicenceType } from '../../../types'
import Button from '../../../components/ui/Button'
import { Upload, AlertTriangle, Check, X, Minus } from 'lucide-react'

interface BbScorerImportPanelProps {
  members: Member[]
  teams: Team[]
  memberTeams: MemberTeam[]
  onImportComplete: () => void
}

interface ToonMatch {
  Tag: string
  Datum: string
  Zeit: string
  SpielNr: string
  Team: string
  OTR1: string
  OTR2: string
  OTR3: string
}

type MatchStatus = 'found' | 'not_found' | 'ambiguous' | 'empty' | 'licence_warn'

interface ProcessedRow {
  raw: ToonMatch
  gameId: string | null
  gameMatch: MatchStatus
  dutyTeamId: string | null
  dutyTeamMatch: MatchStatus
  anschreiberId: string | null
  anschreiberMatch: MatchStatus
  anschreiberLicenceWarn: boolean
  zeitnehmerId: string | null
  zeitnehmerMatch: MatchStatus
  zeitnehmerLicenceWarn: boolean
  official24sId: string | null
  official24sMatch: MatchStatus
  official24sLicenceWarn: boolean
}

interface MemberLookup {
  // Global maps (all BB members)
  byFullName: Map<string, Member>
  byFirstName: Map<string, Member | 'ambiguous'>
  // Per-team maps: teamId → { byFullName, byFirstName }
  byTeam: Map<string, { byFullName: Map<string, Member>; byFirstName: Map<string, Member | 'ambiguous'> }>
}

function buildMemberLookup(members: Member[], memberTeams: MemberTeam[], bbTeamIds: Set<string>): MemberLookup {
  // Build team → member IDs mapping
  const teamToMembers = new Map<string, Set<string>>()
  const bbMemberIds = new Set<string>()
  for (const mt of memberTeams) {
    if (bbTeamIds.has(mt.team)) {
      bbMemberIds.add(mt.member)
      if (!teamToMembers.has(mt.team)) teamToMembers.set(mt.team, new Set())
      teamToMembers.get(mt.team)!.add(mt.member)
    }
  }

  const byFullName = new Map<string, Member>()
  const byFirstName = new Map<string, Member | 'ambiguous'>()

  // Per-team maps
  const byTeam = new Map<string, { byFullName: Map<string, Member>; byFirstName: Map<string, Member | 'ambiguous'> }>()

  for (const m of members) {
    if (!bbMemberIds.has(m.id) && bbMemberIds.size > 0) continue

    const firstLast = `${m.first_name} ${m.last_name}`.toLowerCase().trim()
    const lastFirst = `${m.last_name} ${m.first_name}`.toLowerCase().trim()
    const firstOnly = m.first_name.toLowerCase().trim()

    // Global maps
    byFullName.set(firstLast, m)
    byFullName.set(lastFirst, m)
    if (byFirstName.has(firstOnly)) {
      byFirstName.set(firstOnly, 'ambiguous')
    } else {
      byFirstName.set(firstOnly, m)
    }

    // Per-team maps
    for (const [teamId, memberIds] of teamToMembers) {
      if (!memberIds.has(m.id)) continue
      if (!byTeam.has(teamId)) byTeam.set(teamId, { byFullName: new Map(), byFirstName: new Map() })
      const tm = byTeam.get(teamId)!
      tm.byFullName.set(firstLast, m)
      tm.byFullName.set(lastFirst, m)
      if (tm.byFirstName.has(firstOnly)) {
        tm.byFirstName.set(firstOnly, 'ambiguous')
      } else {
        tm.byFirstName.set(firstOnly, m)
      }
    }
  }

  return { byFullName, byFirstName, byTeam }
}

function buildTeamShortNameMap(teams: Team[]) {
  const map = new Map<string, Team>()
  for (const t of teams) {
    if (t.sport !== 'basketball') continue
    const lower = t.name.toLowerCase()
    map.set(lower, t)

    // Strip "KSC Wiedikon " prefix
    const prefix = 'ksc wiedikon '
    if (lower.startsWith(prefix)) {
      const short = lower.slice(prefix.length)
      map.set(short, t)
      // Also first word only: "rhinos d3" → "rhinos"
      const firstWord = short.split(/\s/)[0]
      if (firstWord && !map.has(firstWord)) {
        map.set(firstWord, t)
      }
    }

    // Handle parenthetical: "Unicorns (H3)" → "unicorns"
    const parenMatch = lower.match(/^ksc wiedikon (.+?)\s*\(/)
    if (parenMatch) {
      const base = parenMatch[1].trim()
      if (!map.has(base)) map.set(base, t)
    }
  }
  return map
}

function matchMember(
  name: string,
  lookup: MemberLookup,
  dutyTeamId?: string | null,
): { id: string | null; status: MatchStatus } {
  const trimmed = name.trim()
  if (!trimmed) return { id: null, status: 'empty' }

  const lower = trimmed.toLowerCase()

  // 1. Try full name match globally (handles "first last" and "last first")
  const fullMatch = lookup.byFullName.get(lower)
  if (fullMatch) return { id: fullMatch.id, status: 'found' }

  // 2. If we have a duty team, try first-name match scoped to that team
  //    This resolves "Gioia" when there's only one Gioia on the Lions
  if (dutyTeamId) {
    const teamMap = lookup.byTeam.get(dutyTeamId)
    if (teamMap) {
      // Try full name within team first
      const teamFull = teamMap.byFullName.get(lower)
      if (teamFull) return { id: teamFull.id, status: 'found' }

      // Try first-name-only within team
      const teamFirst = teamMap.byFirstName.get(lower)
      if (teamFirst && teamFirst !== 'ambiguous') return { id: teamFirst.id, status: 'found' }
      if (teamFirst === 'ambiguous') return { id: null, status: 'ambiguous' }
    }
  }

  // 3. Fall back to global first-name match
  const firstMatch = lookup.byFirstName.get(lower)
  if (firstMatch === 'ambiguous') return { id: null, status: 'ambiguous' }
  if (firstMatch) return { id: firstMatch.id, status: 'found' }

  return { id: null, status: 'not_found' }
}

function hasLicence(member: Member | undefined, required: LicenceType | LicenceType[]): boolean {
  if (!member) return false
  const licences = Array.isArray(required) ? required : [required]
  return licences.some((l) => member.licences?.includes(l))
}

const statusIcon = (status: MatchStatus, warn: boolean) => {
  if (warn) return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
  switch (status) {
    case 'found': return <Check className="h-3.5 w-3.5 text-green-500" />
    case 'not_found': return <X className="h-3.5 w-3.5 text-red-500" />
    case 'ambiguous': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
    case 'empty': return <Minus className="h-3.5 w-3.5 text-gray-400" />
    case 'licence_warn': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
  }
}

const statusBg = (status: MatchStatus, warn: boolean) => {
  if (warn) return 'bg-yellow-50 dark:bg-yellow-900/20'
  switch (status) {
    case 'found': return ''
    case 'not_found': return 'bg-red-50 dark:bg-red-900/20'
    case 'ambiguous': return 'bg-yellow-50 dark:bg-yellow-900/20'
    case 'empty': return 'bg-gray-50 dark:bg-gray-800'
    case 'licence_warn': return 'bg-yellow-50 dark:bg-yellow-900/20'
  }
}

export default function BbScorerImportPanel({ members, teams, memberTeams, onImportComplete }: BbScorerImportPanelProps) {
  const { t } = useTranslation('scorer')
  const fileRef = useRef<HTMLInputElement>(null)
  const [toonText, setToonText] = useState('')
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ updated: number; skipped: number; errors: number } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const bbTeamIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of teams) {
      if (t.sport === 'basketball') ids.add(t.id)
    }
    return ids
  }, [teams])

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>()
    for (const m of members) map.set(m.id, m)
    return map
  }, [members])

  const teamShortNameMap = useMemo(() => buildTeamShortNameMap(teams), [teams])
  const memberLookup = useMemo(() => buildMemberLookup(members, memberTeams, bbTeamIds), [members, memberTeams, bbTeamIds])

  const processData = useCallback(async (text: string) => {
    setParseError(null)
    setResult(null)

    // Parse TOON
    let parsed: unknown
    try {
      parsed = decode(text)
    } catch {
      setParseError('Failed to parse TOON data')
      setProcessedRows([])
      return
    }

    // Extract matches array
    const data = parsed as Record<string, unknown>
    const matches = data.matches as ToonMatch[] | undefined
    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      setParseError(t('bbImportNoRows'))
      setProcessedRows([])
      return
    }

    // Fetch all BB games for matching
    let allGames: Game[] = []
    try {
      allGames = await pb.collection('games').getFullList<Game>({
        filter: 'source = "basketplan"',
        fields: 'id,game_id,bb_anschreiber,bb_zeitnehmer,bb_24s_official,bb_duty_team,duty_confirmed',
      })
    } catch {
      setParseError('Failed to load games from database')
      return
    }

    const gamesByGameId = new Map<string, Game>()
    for (const g of allGames) {
      gamesByGameId.set(g.game_id, g)
    }

    // Process each row
    const rows: ProcessedRow[] = matches.map((raw) => {
      const spielNr = String(raw.SpielNr).trim()
      const gameKey = `bb_${spielNr}`
      const game = gamesByGameId.get(gameKey)

      // Duty team — resolve first so we can scope member matching
      const teamName = String(raw.Team ?? '').trim().toLowerCase()
      const dutyTeam = teamName ? teamShortNameMap.get(teamName) : undefined
      const dutyTeamId = dutyTeam?.id ?? null

      // OTR1 = Anschreiber (scoped to duty team)
      const otr1 = matchMember(String(raw.OTR1 ?? ''), memberLookup, dutyTeamId)
      const otr1Member = otr1.id ? memberMap.get(otr1.id) : undefined
      const otr1LicWarn = otr1.status === 'found' && !hasLicence(otr1Member, 'otr1_bb')

      // OTR2 = Zeitnehmer (scoped to duty team)
      const otr2 = matchMember(String(raw.OTR2 ?? ''), memberLookup, dutyTeamId)
      const otr2Member = otr2.id ? memberMap.get(otr2.id) : undefined
      const otr2LicWarn = otr2.status === 'found' && !hasLicence(otr2Member, 'otr1_bb')

      // OTR3 = 24s Official (scoped to duty team)
      const otr3Raw = String(raw.OTR3 ?? '').trim()
      const no24s = otr3Raw.toLowerCase().includes('keine 24s')
      const otr3 = no24s
        ? { id: null, status: 'empty' as MatchStatus }
        : matchMember(otr3Raw, memberLookup, dutyTeamId)
      const otr3Member = otr3.id ? memberMap.get(otr3.id) : undefined
      const otr3LicWarn = otr3.status === 'found' && !hasLicence(otr3Member, ['otr2_bb', 'otn_bb'] as LicenceType[])

      return {
        raw,
        gameId: game?.id ?? null,
        gameMatch: game ? 'found' : 'not_found',
        dutyTeamId: dutyTeam?.id ?? null,
        dutyTeamMatch: teamName ? (dutyTeam ? 'found' : 'not_found') : 'empty',
        anschreiberId: otr1.id,
        anschreiberMatch: otr1.status,
        anschreiberLicenceWarn: otr1LicWarn,
        zeitnehmerId: otr2.id,
        zeitnehmerMatch: otr2.status,
        zeitnehmerLicenceWarn: otr2LicWarn,
        official24sId: otr3.id,
        official24sMatch: otr3.status,
        official24sLicenceWarn: otr3LicWarn,
      }
    })

    setProcessedRows(rows)
  }, [teamShortNameMap, memberLookup, memberMap, t])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setToonText(text)
    processData(text)
  }

  const handlePaste = () => {
    if (toonText.trim()) processData(toonText)
  }

  const importableRows = processedRows.filter((r) => r.gameId)
  const unmatchedGames = processedRows.filter((r) => r.gameMatch === 'not_found').length
  const unmatchedPersons = processedRows.filter(
    (r) => r.anschreiberMatch === 'not_found' || r.zeitnehmerMatch === 'not_found' || r.official24sMatch === 'not_found',
  ).length

  const handleImport = async () => {
    setImporting(true)
    setResult(null)
    let updated = 0
    let skipped = 0
    let errors = 0

    for (const row of importableRows) {
      try {
        const fields: Partial<Game> = {}
        if (row.dutyTeamId) fields.bb_duty_team = row.dutyTeamId
        if (row.anschreiberId) fields.bb_anschreiber = row.anschreiberId
        if (row.zeitnehmerId) fields.bb_zeitnehmer = row.zeitnehmerId
        if (row.official24sId) fields.bb_24s_official = row.official24sId

        // Auto-confirm if both anschreiber and zeitnehmer are assigned
        const nextAnschreiber = row.anschreiberId
        const nextZeitnehmer = row.zeitnehmerId
        if (nextAnschreiber && nextZeitnehmer) fields.duty_confirmed = true

        if (Object.keys(fields).length === 0) {
          skipped++
          continue
        }

        await pb.collection('games').update(row.gameId!, fields)
        updated++
      } catch {
        errors++
      }
    }

    setResult({ updated, skipped, errors })
    setImporting(false)
    onImportComplete()
  }

  const handleReset = () => {
    setToonText('')
    setProcessedRows([])
    setResult(null)
    setParseError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{t('bbImportTitle')}</h2>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t('bbImportDescription')}</p>

      {/* Input: textarea + file upload */}
      {processedRows.length === 0 && !result && (
        <div className="space-y-3">
          <textarea
            value={toonText}
            onChange={(e) => setToonText(e.target.value)}
            placeholder={t('bbImportPaste')}
            rows={6}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handlePaste} disabled={!toonText.trim()} size="sm">
              {t('bbImportButton')}
            </Button>
            <span className="text-sm text-gray-400">oder</span>
            <input
              ref={fileRef}
              type="file"
              accept=".toon,.txt"
              onChange={handleFileChange}
              className="text-sm text-gray-700 dark:text-gray-300"
            />
          </div>
        </div>
      )}

      {parseError && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {parseError}
        </div>
      )}

      {/* Preview table */}
      {processedRows.length > 0 && !result && (
        <div className="mt-3 space-y-3">
          {/* Summary */}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {t('bbImportSummary', { matched: importableRows.length, total: processedRows.length })}
            </span>
            {unmatchedGames > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {t('bbImportUnmatchedGames', { count: unmatchedGames })}
              </span>
            )}
            {unmatchedPersons > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {t('bbImportUnmatchedPersons', { count: unmatchedPersons })}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="max-h-96 overflow-auto rounded-md border border-gray-200 dark:border-gray-600">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-2 py-1.5 text-left text-gray-700 dark:text-gray-300">Datum</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 dark:text-gray-300">SpielNr</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 dark:text-gray-300">Team</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 dark:text-gray-300">OTR1</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 dark:text-gray-300">OTR2</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 dark:text-gray-300">OTR3</th>
                </tr>
              </thead>
              <tbody>
                {processedRows.map((row, i) => (
                  <tr key={i} className={`border-t border-gray-100 dark:border-gray-600 ${row.gameMatch === 'not_found' ? 'opacity-50' : ''}`}>
                    <td className="whitespace-nowrap px-2 py-1 text-gray-900 dark:text-gray-100">
                      <span className="flex items-center gap-1">
                        {statusIcon(row.gameMatch, false)}
                        {row.raw.Tag} {row.raw.Datum}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-gray-500 dark:text-gray-400">{row.raw.SpielNr}</td>
                    <td className={`px-2 py-1 ${statusBg(row.dutyTeamMatch, false)}`}>
                      <span className="flex items-center gap-1">
                        {statusIcon(row.dutyTeamMatch, false)}
                        <span className="text-gray-900 dark:text-gray-100">{row.raw.Team}</span>
                      </span>
                    </td>
                    <td className={`px-2 py-1 ${statusBg(row.anschreiberMatch, row.anschreiberLicenceWarn)}`}>
                      <span className="flex items-center gap-1">
                        {statusIcon(row.anschreiberMatch, row.anschreiberLicenceWarn)}
                        <span className="text-gray-900 dark:text-gray-100">{row.raw.OTR1 || '—'}</span>
                      </span>
                    </td>
                    <td className={`px-2 py-1 ${statusBg(row.zeitnehmerMatch, row.zeitnehmerLicenceWarn)}`}>
                      <span className="flex items-center gap-1">
                        {statusIcon(row.zeitnehmerMatch, row.zeitnehmerLicenceWarn)}
                        <span className="text-gray-900 dark:text-gray-100">{row.raw.OTR2 || '—'}</span>
                      </span>
                    </td>
                    <td className={`px-2 py-1 ${statusBg(row.official24sMatch, row.official24sLicenceWarn)}`}>
                      <span className="flex items-center gap-1">
                        {statusIcon(row.official24sMatch, row.official24sLicenceWarn)}
                        <span className="text-gray-900 dark:text-gray-100">{row.raw.OTR3 || '—'}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={importing || importableRows.length === 0}
              size="sm"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {importing ? '...' : t('bbImportConfirm', { count: importableRows.length })}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              {t('cancelAction')}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-3 space-y-3">
          <div className={`rounded-md p-3 text-sm ${result.errors > 0 ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
            {t('bbImportSuccess', result)}
          </div>
          <Button variant="secondary" size="sm" onClick={handleReset}>
            {t('cancelAction')}
          </Button>
        </div>
      )}
    </div>
  )
}
