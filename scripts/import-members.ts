/**
 * Import members from Excel into PocketBase.
 *
 * - Deduplicates by (first_name + last_name + email)
 * - Creates new auth records with random password for new members
 * - Creates member_teams entries for current season
 * - Parses licences from comma-separated column
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/import-members.ts /path/to/members.xlsx   # preview
 *   npx tsx scripts/import-members.ts /path/to/members.xlsx              # write
 */

import PocketBase from 'pocketbase'
import readXlsxFile from 'read-excel-file/node'
import crypto from 'crypto'

const PB_URL = process.env.PB_URL || 'https://api.kscw.ch'
const PB_EMAIL = process.env.PB_EMAIL || ''
const PB_PASSWORD = process.env.PB_PASSWORD || ''
const DRY_RUN = !!process.env.DRY_RUN
const SEASON = '2025/26'

// Excel team name → PB team name (for cases where stripping VB/BB prefix isn't enough)
// Excel team name → PB team name
// BB men use "Herren X HY" convention where X=team name, HY=league (irrelevant for mapping)
const TEAM_NAME_MAP: Record<string, string> = {
  'BB H1': 'Herren 1 H1',
  'BB H2': 'Herren 2 H3',
  'BB H3': 'Herren 3 (Unicorns) H4',
  'BB Lions': 'Lions D1',
  'BB Rhinos': 'Rhinos D3',
  'BB D-Classics': 'Damen D-Classics 1LR',
  'BB H-Classics': 'H-Classics 1LR',
}

const VALID_LICENCES = new Set([
  'scorer_vb', 'referee_vb', 'otr1_bb', 'otr2_bb', 'otn_bb', 'referee_bb',
])

interface ExcelRow {
  last_name: string
  first_name: string
  phone: string
  email: string
  teams: string
  licence: string
  licence_number: number | string
}

function randomPassword(): string {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16)
}

function normalizeStr(s: string): string {
  return (s || '').trim().toLowerCase()
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-members.ts <path-to-xlsx>')
    process.exit(1)
  }

  // Read Excel
  const rawRows = await readXlsxFile(filePath)
  const headers = rawRows[0].map((h) => String(h).trim())
  const rows: ExcelRow[] = rawRows.slice(1).map((row) => {
    const obj: Record<string, any> = {}
    headers.forEach((h, i) => (obj[h] = row[i]))
    return obj as ExcelRow
  })
  console.log(`Read ${rows.length} rows from ${filePath}`)

  // Auth
  const pb = new PocketBase(PB_URL)
  await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
  console.log(`Authenticated as admin. DRY_RUN=${DRY_RUN}\n`)

  // Fetch existing members
  const existingMembers = await pb.collection('members').getFullList({
    fields: 'id,first_name,last_name,email,licences,license_nr',
    sort: '+last_name,+first_name',
  })
  console.log(`Existing members in PB: ${existingMembers.length}`)

  // Build dedup index: "firstname|lastname|email" → member record
  const memberIndex = new Map<string, typeof existingMembers[0]>()
  for (const m of existingMembers) {
    const key = `${normalizeStr(m.first_name)}|${normalizeStr(m.last_name)}|${normalizeStr(m.email)}`
    memberIndex.set(key, m)
  }

  // Fetch teams and build name→id map
  const teams = await pb.collection('teams').getFullList({ fields: 'id,name,sport' })
  const teamByName = new Map<string, string>()
  for (const t of teams) {
    teamByName.set(t.name, t.id)
  }

  // Fetch existing member_teams for this season (to avoid duplicate entries)
  const existingMT = await pb.collection('member_teams').getFullList({
    filter: `season="${SEASON}"`,
    fields: 'id,member,team',
  })
  const mtIndex = new Set(existingMT.map((mt) => `${mt.member}|${mt.team}`))
  console.log(`Existing member_teams for ${SEASON}: ${existingMT.length}\n`)

  // Stats
  let created = 0
  let skipped = 0
  let teamsAssigned = 0
  let teamsSkippedExisting = 0
  let licencesUpdated = 0
  const unmatchedTeams = new Set<string>()

  for (const row of rows) {
    const firstName = (row.first_name || '').trim()
    const lastName = (row.last_name || '').trim()
    const email = (row.email || '').trim()

    if (!firstName || !lastName || !email) {
      console.log(`  SKIP (missing data): ${lastName}, ${firstName} <${email}>`)
      skipped++
      continue
    }

    const dedupKey = `${normalizeStr(firstName)}|${normalizeStr(lastName)}|${normalizeStr(email)}`

    // Parse licences
    const rowLicences = (row.licence || '')
      .split(',')
      .map((l) => l.trim())
      .filter((l) => VALID_LICENCES.has(l))

    // Parse licence number
    const licenceNr = row.licence_number ? String(row.licence_number).trim() : ''

    // Parse teams
    const rowTeams = (row.teams || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    let memberId: string

    const existing = memberIndex.get(dedupKey)
    if (existing) {
      memberId = existing.id
      console.log(`  EXISTS: ${firstName} ${lastName} <${email}> → ${memberId}`)

      // Build update payload for existing member
      const updates: Record<string, any> = {}

      // Update licences if Excel has licences that PB doesn't
      const currentLicences: string[] = existing.licences ?? []
      const mergedLicences = [...new Set([...currentLicences, ...rowLicences])]
      if (mergedLicences.length > currentLicences.length) {
        console.log(`    LICENCE UPDATE: [${currentLicences.join(',')}] → [${mergedLicences.join(',')}]`)
        updates.licences = mergedLicences
        licencesUpdated++
      }

      // Backfill license_nr if missing in PB but present in Excel
      if (licenceNr && !existing.license_nr) {
        console.log(`    LICENSE_NR BACKFILL: → ${licenceNr}`)
        updates.license_nr = licenceNr
      }

      if (Object.keys(updates).length > 0 && !DRY_RUN) {
        await pb.collection('members').update(memberId, updates)
      }

      skipped++
    } else {
      // Create new member
      const password = randomPassword()
      const data = {
        email,
        password,
        passwordConfirm: password,
        first_name: firstName,
        last_name: lastName,
        phone: (row.phone || '').trim(),
        role: ['user'],
        kscw_membership_active: true,
        coach_approved_team: true,
        language: 'german',
        licences: rowLicences,
        license_nr: licenceNr,
      }

      console.log(`  CREATE: ${firstName} ${lastName} <${email}> licences=[${rowLicences.join(',')}]`)

      if (!DRY_RUN) {
        try {
          const record = await pb.collection('members').create(data)
          memberId = record.id
          // Add to index so subsequent rows with same person don't create duplicates
          memberIndex.set(dedupKey, record)
        } catch (err: any) {
          console.error(`    ERROR creating ${firstName} ${lastName}: ${err.message || err}`)
          if (err.response?.data) console.error('    Details:', JSON.stringify(err.response.data))
          continue
        }
      } else {
        memberId = 'DRY_RUN_ID'
      }

      created++
    }

    // Assign teams
    for (const excelTeam of rowTeams) {
      // Resolve PB team name
      let pbTeamName: string
      if (TEAM_NAME_MAP[excelTeam]) {
        pbTeamName = TEAM_NAME_MAP[excelTeam]
      } else {
        // Strip "VB " or "BB " prefix
        pbTeamName = excelTeam.replace(/^(VB|BB)\s+/, '')
      }

      const teamId = teamByName.get(pbTeamName)
      if (!teamId) {
        unmatchedTeams.add(excelTeam)
        console.log(`    TEAM NOT FOUND: "${excelTeam}" (tried "${pbTeamName}")`)
        continue
      }

      const mtKey = `${memberId}|${teamId}`
      if (mtIndex.has(mtKey)) {
        teamsSkippedExisting++
        continue
      }

      console.log(`    TEAM ASSIGN: ${excelTeam} → ${pbTeamName} (${teamId})`)
      if (!DRY_RUN) {
        try {
          await pb.collection('member_teams').create({
            member: memberId,
            team: teamId,
            season: SEASON,
          })
          mtIndex.add(mtKey)
        } catch (err: any) {
          console.error(`    ERROR assigning team: ${err.message || err}`)
        }
      }
      teamsAssigned++
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`${DRY_RUN ? 'DRY RUN — ' : ''}Summary:`)
  console.log(`  Members created:  ${created}`)
  console.log(`  Members skipped (existing): ${skipped}`)
  console.log(`  Licences updated: ${licencesUpdated}`)
  console.log(`  Team assignments: ${teamsAssigned}`)
  console.log(`  Team assignments skipped (existing): ${teamsSkippedExisting}`)
  if (unmatchedTeams.size > 0) {
    console.log(`  Unmatched teams:  ${[...unmatchedTeams].sort().join(', ')}`)
  }
}

main().catch(console.error)
