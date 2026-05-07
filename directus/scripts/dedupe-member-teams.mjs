#!/usr/bin/env node
/**
 * dedupe-member-teams.mjs — find and remove duplicate (member, team) rows in
 * member_teams, keeping the lowest-id row per pair. Run BEFORE applying
 * migration 044 (which adds the unique constraint).
 *
 * Usage:
 *   node directus/scripts/dedupe-member-teams.mjs <env>            # dry-run
 *   node directus/scripts/dedupe-member-teams.mjs <env> --apply    # delete duplicates
 *
 *   <env> ∈ { dev, prod } — selects DIRECTUS_URL automatically.
 *   DIRECTUS_DEV_TOKEN / DIRECTUS_PROD_TOKEN read from .env.local.
 */

import { readFileSync as _readFileSync } from 'node:fs'
import { fileURLToPath as _fileURLToPath } from 'node:url'
import { dirname as _dirname, join as _join } from 'node:path'

const _here = _dirname(_fileURLToPath(import.meta.url))
try {
  const envText = _readFileSync(_join(_here, '../../.env.local'), 'utf-8')
  for (const line of envText.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
} catch { /* file missing — fine */ }

const args = process.argv.slice(2)
const envName = args[0]
const apply = args.includes('--apply')
if (!envName || !['dev', 'prod'].includes(envName)) {
  console.error('Usage: node dedupe-member-teams.mjs <dev|prod> [--apply]')
  process.exit(1)
}

const DIRECTUS_URL = envName === 'prod' ? 'https://directus.kscw.ch' : 'https://directus-dev.kscw.ch'
const TOKEN = process.env.DIRECTUS_TOKEN
  || (envName === 'dev' ? process.env.DIRECTUS_DEV_TOKEN : process.env.DIRECTUS_PROD_TOKEN)
if (!TOKEN) {
  console.error(`Need DIRECTUS_${envName.toUpperCase()}_TOKEN in .env.local`)
  process.exit(1)
}

async function api(method, path, body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text).data : null
}

async function fetchAll(collection, query) {
  const out = []
  let offset = 0
  const limit = 500
  while (true) {
    const params = new URLSearchParams({
      ...query,
      limit: String(limit),
      offset: String(offset),
    })
    const page = await api('GET', `/items/${collection}?${params}`)
    out.push(...page)
    if (page.length < limit) break
    offset += limit
  }
  return out
}

console.log(`\n🔍 dedupe-member-teams → ${DIRECTUS_URL}  (apply=${apply})\n`)

const rows = await fetchAll('member_teams', {
  fields: 'id,member,team,season,guest_level,date_created',
  sort: 'id',
})
console.log(`  Total member_teams rows: ${rows.length}`)

// Group by (member, team)
const groups = new Map()
for (const r of rows) {
  if (r.member == null || r.team == null) continue
  const key = `${r.member}|${r.team}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

const dupes = [...groups.values()].filter(g => g.length > 1)
console.log(`  Duplicate (member, team) pairs: ${dupes.length}`)

if (!dupes.length) {
  console.log('\n✅ No duplicates found.\n')
  process.exit(0)
}

// Resolve member + team names for the report
const memberIds = [...new Set(dupes.flatMap(g => g.map(r => r.member)))]
const teamIds = [...new Set(dupes.flatMap(g => g.map(r => r.team)))]
const memberRows = await fetchAll('members', {
  fields: 'id,first_name,last_name',
  filter: JSON.stringify({ id: { _in: memberIds } }),
})
const teamRows = await fetchAll('teams', {
  fields: 'id,name,sport',
  filter: JSON.stringify({ id: { _in: teamIds } }),
})
const memberMap = new Map(memberRows.map(m => [String(m.id), `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()]))
const teamMap = new Map(teamRows.map(t => [String(t.id), `${t.name} (${t.sport})`]))

const toDelete = []
for (const group of dupes) {
  // Keep lowest id, delete rest. Prefer keeping the row with highest guest_level
  // first if levels differ, so a "guest=2" row doesn't get downgraded by a stale 0.
  const sorted = [...group].sort((a, b) => {
    const gl = (Number(b.guest_level) || 0) - (Number(a.guest_level) || 0)
    if (gl !== 0) return gl
    return Number(a.id) - Number(b.id)
  })
  const keep = sorted[0]
  const drop = sorted.slice(1)
  const memberName = memberMap.get(String(keep.member)) || `member#${keep.member}`
  const teamName = teamMap.get(String(keep.team)) || `team#${keep.team}`
  console.log(`  • ${memberName} @ ${teamName}`)
  console.log(`      keep id=${keep.id} (guest_level=${keep.guest_level}, season=${keep.season ?? 'null'})`)
  for (const d of drop) {
    console.log(`      drop id=${d.id} (guest_level=${d.guest_level}, season=${d.season ?? 'null'})`)
    toDelete.push(d.id)
  }
}

console.log(`\n  Total rows to delete: ${toDelete.length}`)

if (!apply) {
  console.log('\n  Dry run — pass --apply to delete.\n')
  process.exit(0)
}

// Batch delete
console.log('\n  Deleting…')
const batchSize = 50
for (let i = 0; i < toDelete.length; i += batchSize) {
  const batch = toDelete.slice(i, i + batchSize)
  await api('DELETE', '/items/member_teams', batch)
  console.log(`    deleted ${Math.min(i + batchSize, toDelete.length)}/${toDelete.length}`)
}
console.log('\n✅ Done.\n')
