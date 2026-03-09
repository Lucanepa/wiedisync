/**
 * Fetch & sync KSC Wiedikon basketball game data from basketplan.ch
 *
 * Usage:
 *   npx tsx scripts/fetch-basketplan.ts              # fetch + write JSON
 *   npx tsx scripts/fetch-basketplan.ts --sync        # fetch + sync to PocketBase
 *   npx tsx scripts/fetch-basketplan.ts --setup-teams  # create BB teams in PocketBase
 *   npx tsx scripts/fetch-basketplan.ts --dry-run      # fetch + show what would sync (no writes)
 */

import { createHash } from 'crypto'
import { writeFileSync } from 'fs'
import PocketBase from 'pocketbase'

const BASE = 'https://www.basketplan.ch'
const CLUB_ID = 166
const USERNAME = 'Ksc Wiedikon'
const PASSWORD = '1224'

const PB_URL = process.env.PB_URL ?? 'https://kscw-api.lucanepa.com'
const PB_EMAIL = process.env.PB_EMAIL ?? 'admin@kscw.ch'
const PB_PASSWORD = process.env.PB_PASSWORD ?? 'REDACTED_ROTATE_ME'

const args = process.argv.slice(2)
const MODE = args.includes('--sync') ? 'sync'
  : args.includes('--setup-teams') ? 'setup-teams'
  : args.includes('--dry-run') ? 'dry-run'
  : 'json'

// Teams with 0 games this season → created as inactive
const INACTIVE_BP_TEAM_IDS = new Set(['7444', '7263', '6724']) // DU10, Lions D3, MU8

// Hall name mapping: basketplan location → PB hall name
const HALL_MAP: Record<string, string> = {
  'Kantonsschule Wiedikon 2fach': 'KWI A', // BB games span A+B, we assign to A (virtual slot logic handles spanning)
  'Kantonsschule Wiedikon 1fach': 'KWI C',
}

// ── Basketplan types ─────────────────────────────────────────────────

interface BPGame {
  id: string
  gameNumber: string
  date: string
  time: string
  homeTeam: string
  homeTeamId: string
  homeClub: string
  guestTeam: string
  guestTeamId: string
  guestClub: string
  location: string
  locationCity: string
  locationAddress: string
  league: string
  season: string
  category: string
  status: 'upcoming' | 'played' | 'postponed' | 'cancelled'
  scoreHome: number | null
  scoreGuest: number | null
  referee1: string
  referee2: string
  isHome: boolean
}

interface BPTeam {
  id: string
  name: string
  shortName: string
  category: string
  sex: string
  league: string
  leagueId: string
  season: string
}

// ── Cookie-based session fetch ───────────────────────────────────────

let sessionCookie = ''

async function fetchWithSession(url: string, options?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'Cookie': sessionCookie,
    'User-Agent': 'KSCW-Sync/1.0',
    ...(options?.headers as Record<string, string> || {}),
  }
  const res = await fetch(url, { ...options, headers, redirect: 'manual' })
  const setCookie = res.headers.getSetCookie?.() || []
  for (const c of setCookie) {
    const name = c.split('=')[0]
    const value = c.split(';')[0]
    if (sessionCookie.includes(name + '=')) {
      sessionCookie = sessionCookie.replace(new RegExp(`${name}=[^;]*`), value)
    } else {
      sessionCookie = sessionCookie ? `${sessionCookie}; ${value}` : value
    }
  }
  return res
}

async function bpLogin(): Promise<void> {
  console.log('Logging in to basketplan.ch...')
  const initRes = await fetchWithSession(`${BASE}/`)
  if (initRes.status >= 300 && initRes.status < 400) {
    const loc = initRes.headers.get('location')
    if (loc) await fetchWithSession(loc.startsWith('http') ? loc : `${BASE}${loc}`)
  } else {
    await initRes.text()
  }
  const md5Pass = createHash('md5').update(PASSWORD).digest('hex')
  const authRes = await fetchWithSession(`${BASE}/authenticate.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `j_username=${encodeURIComponent(USERNAME)}&j_password=${md5Pass}&p_password=`,
  })
  let location = authRes.headers.get('location')
  while (location) {
    const url = location.startsWith('http') ? location : `${BASE}${location}`
    const r = await fetchWithSession(url)
    location = r.headers.get('location')
    if (!location) await r.text()
  }
  console.log('Login successful.')
}

async function fetchTeamXml(teamId: string): Promise<string> {
  const url = `${BASE}/findTeamById.do?teamId=${teamId}&clubId=${CLUB_ID}&federationId=10&xmlView=true`
  let res = await fetchWithSession(url)
  let location = res.headers.get('location')
  while (location) {
    const u = location.startsWith('http') ? location : `${BASE}${location}`
    res = await fetchWithSession(u)
    location = res.headers.get('location')
  }
  return await res.text()
}

async function fetchClubPage(): Promise<string> {
  const url = `${BASE}/findClubById.do?clubId=${CLUB_ID}`
  let res = await fetchWithSession(url)
  let location = res.headers.get('location')
  while (location) {
    const u = location.startsWith('http') ? location : `${BASE}${location}`
    res = await fetchWithSession(u)
    location = res.headers.get('location')
  }
  return await res.text()
}

// ── XML parsing ──────────────────────────────────────────────────────

function getAttr(xml: string, attr: string): string {
  const re = new RegExp(`${attr}="([^"]*)"`)
  return xml.match(re)?.[1] ?? ''
}

function parseGames(teamXml: string, teamIds: Set<string>): BPGame[] {
  const games: BPGame[] = []
  const gameBlocks = teamXml.split('<GameVO ').slice(1)

  for (const block of gameBlocks) {
    const fullBlock = block.split('</GameVO>')[0] || block
    const id = getAttr(fullBlock, ' id')
    if (!id) continue

    const gameNumber = getAttr(fullBlock, 'gameNumber')
    const yearMonthDay = getAttr(fullBlock, 'yearMonthDay')
    const timeOfDay = getAttr(fullBlock, 'timeOfDay')
    const withdrawn = getAttr(fullBlock, 'withdrawn') === 'true'

    const homeBlock = fullBlock.match(/<homeTeam\s[^>]*\/>|<homeTeam\s[\s\S]*?<\/homeTeam>/)?.[0] || ''
    const homeTeamName = getAttr(homeBlock, ' name')
    const homeTeamId = getAttr(homeBlock, ' id')
    const homeClub = getAttr(homeBlock, 'clubShortName') || getAttr(homeBlock, 'clubName')

    const guestBlock = fullBlock.match(/<guestTeam\s[^>]*\/>|<guestTeam\s[\s\S]*?<\/guestTeam>/)?.[0] || ''
    const guestTeamName = getAttr(guestBlock, ' name')
    const guestTeamId = getAttr(guestBlock, ' id')
    const guestClub = getAttr(guestBlock, 'clubShortName') || getAttr(guestBlock, 'clubName')

    const locBlock = fullBlock.match(/<location\s[^>]*\/>|<location\s[\s\S]*?<\/location>/)?.[0] || ''
    const locName = getAttr(locBlock, ' name') || getAttr(locBlock, 'shortName')
    const locCity = getAttr(locBlock, 'city')
    const locAddr = getAttr(locBlock, 'line1')

    const lhBlock = fullBlock.match(/<leagueHolding\s[\s\S]*?<\/leagueHolding>/)?.[0] || ''
    const leagueBlock = lhBlock.match(/<league\s[\s\S]*?<\/league>/)?.[0] || ''
    const leagueName = getAttr(leagueBlock, 'shortName') || getAttr(lhBlock, 'fullName')
    const seasonBlock = lhBlock.match(/<season\s[^>]*\/>|<season\s[\s\S]*?<\/season>/)?.[0] || ''
    const seasonName = getAttr(seasonBlock, ' name')
    const catBlock = lhBlock.match(/<playerCategory\s[^>]*\/>|<playerCategory\s[\s\S]*?<\/playerCategory>/)?.[0] || ''
    const category = getAttr(catBlock, 'shortName') || getAttr(catBlock, 'shortLabel')

    const resultBlock = fullBlock.match(/<result\s[^>]*\/?>/)?.[0] || ''
    const scoreHome = resultBlock ? getAttr(resultBlock, 'homeTeamScore') : ''
    const scoreGuest = resultBlock ? getAttr(resultBlock, 'guestTeamScore') : ''

    const ref1 = getAttr(fullBlock, 'referee1Name')
    const ref2 = getAttr(fullBlock, 'referee2Name')

    const rescheduleRequested = getAttr(fullBlock, 'rescheduleRequested') === 'true'
    const hasScore = scoreHome !== '' && scoreGuest !== ''
    let status: BPGame['status'] = 'upcoming'
    if (withdrawn) status = 'cancelled'
    else if (rescheduleRequested) status = 'postponed'
    else if (hasScore) status = 'played'

    games.push({
      id, gameNumber,
      date: yearMonthDay, time: timeOfDay,
      homeTeam: homeTeamName, homeTeamId, homeClub,
      guestTeam: guestTeamName, guestTeamId, guestClub,
      location: locName, locationCity: locCity, locationAddress: locAddr,
      league: leagueName.trim(), season: seasonName, category, status,
      scoreHome: scoreHome ? parseInt(scoreHome) : null,
      scoreGuest: scoreGuest ? parseInt(scoreGuest) : null,
      referee1: ref1, referee2: ref2,
      isHome: teamIds.has(homeTeamId),
    })
  }
  return games
}

function parseTeamInfo(teamXml: string): BPTeam | null {
  const editBlock = teamXml.match(/<editTeamForm\s[^>]*\/>|<editTeamForm\s[\s\S]*?<\/editTeamForm>/)?.[0] || ''
  const teamId = getAttr(editBlock, 'teamId')
  const teamName = getAttr(editBlock, ' name')
  if (!teamId) return null

  const teamBlock = teamXml.match(new RegExp(`<(?:homeTeam|guestTeam)\\s[^>]*id="${teamId}"[\\s\\S]*?(?:\\/>|<\\/(?:homeTeam|guestTeam)>)`))?.[0] || ''
  const name = getAttr(teamBlock, ' name') || teamName
  const catBlock = teamBlock.match(/<playerCategory\s[^>]*\/?>/)?.[0] || ''
  const category = getAttr(catBlock, 'shortName') || getAttr(catBlock, 'shortLabel')
  const sex = getAttr(editBlock, 'sex')

  const lhBlock = teamXml.match(/<leagueHolding\s[\s\S]*?<\/leagueHolding>/)?.[0] || ''
  const leagueBlock = lhBlock.match(/<league\s[\s\S]*?<\/league>/)?.[0] || ''
  const leagueName = getAttr(leagueBlock, 'shortName') || getAttr(lhBlock, 'fullName')
  const leagueId = getAttr(leagueBlock, ' id')
  const seasonBlock = lhBlock.match(/<season\s[^>]*\/?>/)?.[0] || ''
  const seasonName = getAttr(seasonBlock, ' name')

  return {
    id: teamId,
    name: name || `Team ${teamId}`,
    shortName: getAttr(teamBlock, 'clubShortName') || 'KSC Wiedikon',
    category,
    sex: sex === 'M' ? 'Herren' : sex === 'F' ? 'Damen' : 'Mixed',
    league: leagueName.trim(),
    leagueId,
    season: seasonName,
  }
}

function processTeamXml(
  xml: string, teamId: string, teamIdSet: Set<string>,
  allTeams: BPTeam[], allGames: BPGame[], seenGameIds: Set<string>,
) {
  const team = parseTeamInfo(xml)
  if (team) {
    allTeams.push(team)
    console.log(`  → ${team.name} (${team.category}, ${team.league})`)
  }
  const games = parseGames(xml, teamIdSet)
  let newCount = 0
  for (const g of games) {
    if (!seenGameIds.has(g.id)) {
      seenGameIds.add(g.id)
      allGames.push(g)
      newCount++
    }
  }
  console.log(`  → ${games.length} games (${newCount} new)`)
}

// ── Basketplan data fetching ─────────────────────────────────────────

async function fetchAllData() {
  await bpLogin()

  console.log('Fetching club page...')
  const clubHtml = await fetchClubPage()
  const teamIdMatches = clubHtml.matchAll(/findTeamById\.do\?teamId=(\d+)/g)
  const teamIds = [...new Set([...teamIdMatches].map(m => m[1]))]
  console.log(`Found ${teamIds.length} teams: ${teamIds.join(', ')}`)

  const teamIdSet = new Set(teamIds)
  const allTeams: BPTeam[] = []
  const allGames: BPGame[] = []
  const seenGameIds = new Set<string>()

  for (const teamId of teamIds) {
    console.log(`Fetching team ${teamId}...`)
    try {
      const xml = await fetchTeamXml(teamId)
      if (!xml || xml.includes('showLogin.do')) {
        console.warn(`  Session expired, re-logging in...`)
        await bpLogin()
        const retryXml = await fetchTeamXml(teamId)
        if (!retryXml || retryXml.includes('showLogin.do')) {
          console.warn(`  Still no data for team ${teamId}, skipping.`)
          continue
        }
        processTeamXml(retryXml, teamId, teamIdSet, allTeams, allGames, seenGameIds)
      } else {
        processTeamXml(xml, teamId, teamIdSet, allTeams, allGames, seenGameIds)
      }
    } catch (err) {
      console.error(`  Error fetching team ${teamId}:`, err)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  allGames.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return { allTeams, allGames }
}

// ── PocketBase sync ──────────────────────────────────────────────────

async function setupTeams(pb: PocketBase, bpTeams: BPTeam[]) {
  console.log('\n=== Setting up basketball teams in PocketBase ===')

  // Ensure bp_team_id field exists on teams collection
  try {
    const col = await pb.collections.getOne('teams')
    const hasField = col.fields?.some((f: { name: string }) => f.name === 'bp_team_id')
    if (!hasField) {
      console.log('Adding bp_team_id field to teams collection...')
      await pb.collections.update('teams', {
        fields: [
          ...col.fields,
          { name: 'bp_team_id', type: 'text' },
        ],
      })
      console.log('Field added.')
    }
  } catch (err) {
    console.error('Could not update teams schema:', err)
  }

  // Derive short display name from basketplan full name
  function shortName(bpName: string): string {
    return bpName.replace(/^KSC Wiedikon\s*/, '')
  }

  for (const t of bpTeams) {
    const name = shortName(t.name)
    const isActive = !INACTIVE_BP_TEAM_IDS.has(t.id)

    // Check if team already exists
    try {
      const existing = await pb.collection('teams').getFirstListItem(`bp_team_id="${t.id}"`)
      console.log(`  [exists] ${name} (${existing.id})`)
      await pb.collection('teams').update(existing.id, {
        name,
        full_name: t.name,
        league: t.league,
        season: t.season,
        active: isActive,
      })
      continue
    } catch { /* not found, create */ }

    try {
      const record = await pb.collection('teams').create({
        name,
        full_name: t.name,
        sport: 'basketball',
        bp_team_id: t.id,
        league: t.league,
        season: t.season,
        active: isActive,
      })
      console.log(`  [created] ${name} (${record.id})${isActive ? '' : ' [inactive]'}`)
    } catch (err) {
      console.error(`  [error] ${name}:`, err)
    }
  }
}

async function syncGames(pb: PocketBase, bpGames: BPGame[]) {
  console.log('\n=== Syncing basketball games to PocketBase ===')

  // Build bp_team_id → PB team ID lookup
  const pbTeams = await pb.collection('teams').getFullList({ filter: 'sport="basketball"' })
  const bpToPbTeam = new Map<string, string>()
  for (const pt of pbTeams) {
    if (pt.bp_team_id) bpToPbTeam.set(pt.bp_team_id, pt.id)
  }

  // Build hall name → PB hall ID lookup
  const pbHalls = await pb.collection('halls').getFullList()
  const hallByName = new Map<string, string>()
  for (const h of pbHalls) hallByName.set(h.name, h.id)

  const statusMap: Record<string, string> = {
    upcoming: 'scheduled',
    played: 'completed',
    postponed: 'postponed',
    cancelled: 'postponed',
  }

  let created = 0, updated = 0, skipped = 0

  for (const g of bpGames) {
    const svGameId = `bp-${g.id}`
    const kscwTeamBpId = g.isHome ? g.homeTeamId : g.guestTeamId
    const pbTeamId = bpToPbTeam.get(kscwTeamBpId)

    if (!pbTeamId) {
      skipped++
      continue
    }

    // Resolve hall for home games
    let hallId = ''
    if (g.isHome && g.location) {
      const mappedHallName = HALL_MAP[g.location]
      if (mappedHallName) hallId = hallByName.get(mappedHallName) || ''
    }

    const awayHallJson = !g.isHome && g.location
      ? { name: g.location, address: g.locationAddress, city: g.locationCity }
      : null

    const referees = [g.referee1, g.referee2].filter(Boolean).map(name => ({ name }))

    const gameData: Record<string, unknown> = {
      sv_game_id: svGameId,
      source: 'basketplan',
      kscw_team: pbTeamId,
      home_team: g.homeTeam,
      away_team: g.guestTeam,
      date: g.date,
      time: `${g.date} ${g.time}:00`,
      type: g.isHome ? 'home' : 'away',
      status: statusMap[g.status] || 'scheduled',
      home_score: g.scoreHome ?? 0,
      away_score: g.scoreGuest ?? 0,
      league: g.league,
      season: g.season,
      referees_json: referees,
    }

    if (hallId) gameData.hall = hallId
    if (awayHallJson) gameData.away_hall_json = awayHallJson

    if (MODE === 'dry-run') {
      console.log(`  [dry-run] ${g.date} ${g.time} ${g.homeTeam} vs ${g.guestTeam} → ${g.status}`)
      continue
    }

    try {
      const existing = await pb.collection('games').getFirstListItem(`sv_game_id="${svGameId}"`)
      await pb.collection('games').update(existing.id, gameData)
      updated++
    } catch {
      try {
        await pb.collection('games').create(gameData)
        created++
      } catch (err) {
        console.error(`  [error] ${svGameId}:`, err)
        skipped++
      }
    }
  }

  console.log(`\nSync complete: ${created} created, ${updated} updated, ${skipped} skipped`)
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { allTeams, allGames } = await fetchAllData()

  const output = {
    club: 'KSC Wiedikon',
    clubId: CLUB_ID,
    fetchedAt: new Date().toISOString(),
    teams: allTeams,
    games: allGames,
    summary: {
      totalTeams: allTeams.length,
      totalGames: allGames.length,
      upcoming: allGames.filter(g => g.status === 'upcoming').length,
      played: allGames.filter(g => g.status === 'played').length,
      postponed: allGames.filter(g => g.status === 'postponed').length,
    },
  }

  const outPath = 'scripts/basketplan-data.json'
  writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${outPath}`)
  console.log(`  Teams: ${output.summary.totalTeams}`)
  console.log(`  Games: ${output.summary.totalGames} (${output.summary.upcoming} upcoming, ${output.summary.played} played, ${output.summary.postponed} postponed)`)

  // PocketBase operations
  if (MODE === 'setup-teams' || MODE === 'sync' || MODE === 'dry-run') {
    const pb = new PocketBase(PB_URL)
    await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
    console.log(`\nAuthenticated to PocketBase at ${PB_URL}`)

    if (MODE === 'setup-teams') {
      await setupTeams(pb, allTeams)
    } else {
      await syncGames(pb, allGames)
    }
  }

  if (MODE === 'json' || MODE === 'dry-run') {
    const upcoming = allGames.filter(g => g.status === 'upcoming' && g.date >= new Date().toISOString().slice(0, 10))
    if (upcoming.length > 0) {
      console.log('\nNext 10 upcoming games:')
      for (const g of upcoming.slice(0, 10)) {
        const vs = g.isHome ? `vs ${g.guestTeam}` : `@ ${g.homeTeam}`
        console.log(`  ${g.date} ${g.time} — ${g.isHome ? g.homeTeam : g.guestTeam} ${vs} (${g.location}, ${g.locationCity})`)
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
