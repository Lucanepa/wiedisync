#!/usr/bin/env node
/**
 * smoke-test.mjs — Post-deploy permission smoke test.
 *
 * Logs in as a non-admin Member and exercises the same critical reads that
 * `loadTeamContext` + the home page kick off. Asserts no 403/400/500. The
 * point is to catch the silent-Promise.all-failure pattern — when a single
 * collection lacks its KSCW Member read row, the whole `loadTeamContext`
 * resolves empty and the user sees nothing, but no UI surface breaks
 * loudly.
 *
 * Required env vars (loaded from `.env.test` if present):
 *   SMOKE_TEST_URL       Directus base URL (https://directus-dev.kscw.ch)
 *   SMOKE_TEST_EMAIL     test member email
 *   SMOKE_TEST_PASSWORD  test member password
 *
 * Usage:
 *   node directus/scripts/smoke-test.mjs
 *   node directus/scripts/smoke-test.mjs --url=https://directus.kscw.ch --email=… --password=…
 *
 * Exits 0 on success, non-zero on any 4xx or 5xx encountered.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Lightweight .env.test loader ──────────────────────────────────
function loadDotEnv(path) {
  try {
    const text = readFileSync(path, 'utf-8')
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
      }
    }
  } catch { /* missing file is fine */ }
}
loadDotEnv(join(__dirname, '../../.env.test'))
loadDotEnv(join(__dirname, '../../.env.local'))

// ── Args ──────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=') || true] })
)

const URL = args.url || process.env.SMOKE_TEST_URL || 'https://directus-dev.kscw.ch'
const EMAIL = args.email || process.env.SMOKE_TEST_EMAIL || process.env.TEST_USER_EMAIL
const PASSWORD = args.password || process.env.SMOKE_TEST_PASSWORD || process.env.TEST_USER_PASSWORD
// Prefer a long-lived Member token if available (e.g. DIRECTUS_DEV_USER_TOKEN_MEMBER
// in .env.local). Skips the login round-trip + dodges stale email/password
// creds in .env.test.
const PRESET_TOKEN = args.token || process.env.SMOKE_TEST_TOKEN || process.env.DIRECTUS_DEV_USER_TOKEN_MEMBER

if (!PRESET_TOKEN && (!EMAIL || !PASSWORD)) {
  console.error(`Missing creds. Set SMOKE_TEST_TOKEN (preferred) or SMOKE_TEST_EMAIL + SMOKE_TEST_PASSWORD.`)
  process.exit(1)
}

let token = null
const failures = []
const checks = []

async function api(method, path, body) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* */ }
  return { status: res.status, ok: res.ok, json, text }
}

async function check(label, fn) {
  process.stdout.write(`  ${label} … `)
  try {
    const result = await fn()
    if (result?.status && (result.status >= 400)) {
      console.log(`✗ ${result.status}`)
      failures.push({ label, status: result.status, body: (result.text || '').slice(0, 200) })
      checks.push({ label, ok: false, status: result.status })
      return result
    }
    console.log(`✓`)
    checks.push({ label, ok: true, status: result?.status })
    return result
  } catch (err) {
    console.log(`✗ ${err.message}`)
    failures.push({ label, error: err.message })
    checks.push({ label, ok: false, error: err.message })
  }
}

async function main() {
  console.log(`[smoke] Target: ${URL}`)
  console.log(`[smoke] Auth:   ${PRESET_TOKEN ? 'preset token' : EMAIL}\n`)

  if (PRESET_TOKEN) {
    token = PRESET_TOKEN
  } else {
    await check('login', async () => {
      const r = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
      if (r.ok) token = r.json?.data?.access_token
      return r
    })
    if (!token) {
      console.error(`\n[smoke] ✗ Login failed — cannot continue.`)
      process.exit(2)
    }
  }

  // 2. Resolve self
  const me = await check('users/me', () => api('GET', '/users/me?fields=id,role'))

  const memberRow = await check('members/self', async () => {
    const r = await api('GET', `/items/members?filter[user][_eq]=${me.json.data.id}&fields=id,first_name,role`)
    return r
  })
  const memberId = memberRow?.json?.data?.[0]?.id

  // 3. The reads that loadTeamContext + Layout fire on every page load.
  // If any of these returns 4xx for a Member role, the silent Promise.all
  // failure pattern is back.
  await check('member_teams (own)', () => api('GET', `/items/member_teams?filter[member][_eq]=${memberId}&fields=team.id,team.name,guest_level`))
  await check('teams (active)', () => api('GET', '/items/teams?filter[active][_eq]=true&limit=10'))
  await check('games (10)', () => api('GET', '/items/games?limit=10&fields=id,date,kscw_team'))
  await check('trainings (my-teams)', () => api('GET', '/items/trainings?limit=10&fields=id,date,team'))
  await check('events (visible)', () => api('GET', '/items/events?limit=10&fields=id,title,event_type'))
  await check('participations (own)', () => api('GET', `/items/participations?filter[member][_eq]=${memberId}&limit=10`))
  await check('absences (own)', () => api('GET', `/items/absences?filter[member][_eq]=${memberId}&limit=10`))
  await check('notifications (own)', () => api('GET', `/items/notifications?filter[member][_eq]=${memberId}&limit=10`))
  await check('blocks (own)', () => api('GET', `/items/blocks?filter[blocker][user][_eq]=${me.json.data.id}&limit=10`))
  await check('spielplaner_assignments (own)', () => api('GET', `/items/spielplaner_assignments?filter[member][_eq]=${memberId}&limit=10`))
  // sv_vm_check has no `member` FK — link is via email/association_id.
  // Row filter intentionally NOT applied (Directus 11 SQL-gen bug, see
  // setup-permissions.mjs). We just check the collection responds; the
  // narrow field whitelist limits exposure.
  await check('sv_vm_check (read)', () => api('GET', `/items/sv_vm_check?limit=1&fields=id,association_id`))
  await check('tasks (own)', () => api('GET', `/items/tasks?limit=10`))
  await check('feedback (own)', () => api('GET', `/items/feedback?limit=10`))
  await check('announcements (published)', () => api('GET', '/items/announcements?limit=10'))
  await check('user_logs (own)', () => api('GET', `/items/user_logs?limit=10`))

  // 4. Custom endpoint sanity
  await check('kscw/web-push/vapid-public-key', () => api('GET', '/kscw/web-push/vapid-public-key'))

  // 5. Result
  console.log('\n' + '─'.repeat(50))
  console.log(`[smoke] ${checks.filter(c => c.ok).length}/${checks.length} passed`)
  if (failures.length) {
    console.log(`[smoke] FAIL — ${failures.length} failure(s):`)
    for (const f of failures) console.log(`  • ${f.label}: ${f.status || ''} ${f.error || ''} ${f.body || ''}`)
    process.exit(3)
  }
  console.log(`[smoke] ✓ All checks passed.`)
}

main().catch(err => {
  console.error(`[smoke] ✗ Fatal: ${err.message}`)
  process.exit(1)
})
