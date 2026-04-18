#!/usr/bin/env node
// Integration assertions for KSCW Messaging Plans 01 & 02 (schema, foundation, team-chat endpoints)
// Intentionally dependency-light: plain fetch + pg.

import pg from 'pg'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const API = 'https://directus-dev.kscw.ch'
const TOKEN = process.env.DIRECTUS_DEV_TOKEN
const DB_URL = process.env.DIRECTUS_DEV_DB_URL

if (!TOKEN || !DB_URL) {
  console.error('Missing DIRECTUS_DEV_TOKEN or DIRECTUS_DEV_DB_URL env vars')
  process.exit(2)
}

const failures = []
const pass = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg, err) => {
  failures.push({ msg, err: String(err?.message ?? err ?? '') })
  console.error(`  ✗ ${msg} — ${err?.message ?? err ?? ''}`)
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok && !init.allowError) {
    const body = await res.text()
    throw new Error(`${path} → ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

const EXPECTED_COLLECTIONS = [
  'conversations',
  'conversation_members',
  'messages',
  'message_reactions',
  'blocks',
  'message_requests',
  'reports',
]

const EXPECTED_MEMBER_FIELDS = [
  'communications_team_chat_enabled',
  'communications_dm_enabled',
  'communications_banned',
  'push_preview_content',
  'last_online_at',
  'consent_decision',
  'consent_prompted_at',
]

const EXPECTED_ENDPOINTS = [
  ['GET',    '/kscw/messaging/conversations'],
  ['POST',   '/kscw/messaging/conversations/dm'],
  ['POST',   '/kscw/messaging/messages'],
  ['POST',   '/kscw/messaging/messages/00000000-0000-0000-0000-000000000000/reactions'],
  ['POST',   '/kscw/messaging/reports'],
  ['PATCH',  '/kscw/messaging/settings'],
  ['POST',   '/kscw/messaging/settings/consent'],
  ['POST',   '/kscw/messaging/export'],
]

async function testCollections() {
  console.log('\n[collections] verifying new collections exist...')
  for (const c of EXPECTED_COLLECTIONS) {
    try {
      const res = await api(`/collections/${c}`)
      const body = await res.json()
      if (body?.data?.collection === c) pass(`${c} exists`)
      else fail(`${c} exists`, 'collection metadata unexpected')
    } catch (e) { fail(`${c} exists`, e) }
  }
}

async function testMemberFields() {
  console.log('\n[members] verifying new fields on members...')
  const res = await api('/fields/members')
  const body = await res.json()
  const fields = new Set(body.data.map((f) => f.field))
  for (const f of EXPECTED_MEMBER_FIELDS) {
    if (fields.has(f)) pass(`members.${f}`)
    else fail(`members.${f}`, 'field missing')
  }
}

async function testEndpointSkeleton() {
  console.log('\n[endpoints] verifying /kscw/messaging/* routes respond 501...')
  for (const [method, path] of EXPECTED_ENDPOINTS) {
    try {
      const res = await api(path, { method, allowError: true, body: method === 'GET' ? undefined : '{}' })
      if (res.status === 501) pass(`${method} ${path} → 501`)
      else fail(`${method} ${path}`, `expected 501, got ${res.status}`)
    } catch (e) { fail(`${method} ${path}`, e) }
  }
}

async function testTriggers(client) {
  console.log('\n[triggers] verifying Postgres triggers exist...')
  const expectedTriggers = [
    'trg_messaging_teams_members_insert',
    'trg_messaging_teams_members_delete',
    'trg_messaging_member_team_chat_enabled',
    'trg_messaging_teams_insert',
    'trg_messaging_protect_sentinel',
  ]
  const { rows } = await client.query(
    `SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = ANY($1::text[])`,
    [expectedTriggers]
  )
  const found = new Set(rows.map((r) => r.trigger_name))
  for (const t of expectedTriggers) {
    if (found.has(t)) pass(t)
    else fail(t, 'trigger missing')
  }
}

async function testPlan02Endpoints(dbClient) {
  console.log('\n[plan02] verifying team-chat endpoints...')

  let seedResult
  try {
    const stdout = execSync(`node ${resolve(__dirname, 'seed-plan02.mjs')}`, {
      env: process.env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    })
    const lines = stdout.trim().split('\n').filter(Boolean)
    const jsonLine = lines.reverse().find(l => l.startsWith('{'))
    if (!jsonLine) throw new Error(`seed produced no JSON line; stdout was: ${stdout.slice(0, 200)}`)
    seedResult = JSON.parse(jsonLine)
  } catch (e) {
    fail('plan02 seed', e)
    return
  }
  const { convId, memberA } = seedResult

  const TOKEN_A = process.env.DIRECTUS_DEV_USER_TOKEN_A
  if (!TOKEN_A) {
    fail('plan02 user token', 'DIRECTUS_DEV_USER_TOKEN_A not set — mint a static token in Directus admin for the test member A')
    return
  }

  const asA = (path, init = {}) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN_A}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })

  // 1. List conversations — test conv must appear with type='team'
  try {
    const r = await asA('/kscw/messaging/conversations')
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    if (!Array.isArray(b?.data ?? b)) throw new Error('response is not an array')
    const list = Array.isArray(b) ? b : b.data
    if (!list.some((c) => c.id === convId && c.type === 'team')) throw new Error('test conv not in list')
    pass('GET /conversations returns test conv')
  } catch (e) { fail('GET /conversations', e) }

  // 2. Send message — verify DB row
  let sentId
  try {
    const r = await asA('/kscw/messaging/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation: convId, type: 'text', body: 'harness-hello' }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    sentId = b.id
    if (!sentId) throw new Error('no id returned')
    const dbRow = await dbClient.query(`SELECT sender, body, deleted_at FROM messages WHERE id = $1`, [sentId])
    if (dbRow.rows[0]?.body !== 'harness-hello') throw new Error('message row missing or body mismatch')
    if (String(dbRow.rows[0]?.sender) !== String(memberA)) throw new Error('sender mismatch')
    pass('POST /messages persists row')
  } catch (e) { fail('POST /messages', e) }

  // 3. Mark read — verify last_read_at bumped within 10s
  try {
    const r = await asA(`/kscw/messaging/conversations/${convId}/read`, { method: 'POST' })
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    const dbRow = await dbClient.query(
      `SELECT last_read_at FROM conversation_members WHERE conversation = $1 AND member = $2`,
      [convId, memberA]
    )
    const ts = dbRow.rows[0]?.last_read_at
    if (!ts || Date.now() - new Date(ts).getTime() > 10_000) throw new Error('last_read_at not bumped')
    pass('POST /conversations/:id/read bumps last_read_at')
  } catch (e) { fail('POST /conversations/:id/read', e) }

  // 4. Toggle mute — first call → true, second call → false
  try {
    const r1 = await asA(`/kscw/messaging/conversations/${convId}/mute`, { method: 'POST' })
    const b1 = await r1.json()
    if (r1.status !== 200 || b1.muted !== true) throw new Error(`first toggle status=${r1.status} muted=${b1.muted}`)
    const r2 = await asA(`/kscw/messaging/conversations/${convId}/mute`, { method: 'POST' })
    const b2 = await r2.json()
    if (r2.status !== 200 || b2.muted !== false) throw new Error(`second toggle status=${r2.status} muted=${b2.muted}`)
    pass('POST /conversations/:id/mute toggles')
  } catch (e) { fail('POST /conversations/:id/mute', e) }

  // 5. Unread = 0 after mark-read for own message
  try {
    const r = await asA('/kscw/messaging/conversations')
    const list = await r.json()
    const mine = (Array.isArray(list) ? list : list.data).find((c) => c.id === convId)
    if (!mine) throw new Error('test conv missing')
    if (mine.unread_count !== 0) throw new Error(`expected 0 unread, got ${mine.unread_count}`)
    pass('unread_count = 0 after mark-read')
  } catch (e) { fail('unread_count zeroed', e) }

  // 6. 403 on non-member conversation (treat not-found and not-member identically)
  try {
    const fakeConv = '00000000-0000-0000-0000-000000000000'
    const r = await asA('/kscw/messaging/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation: fakeConv, type: 'text', body: 'x' }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 403 || b.code !== 'messaging/not_a_member') throw new Error(`status=${r.status} code=${b.code}`)
    pass('POST /messages 403 not_a_member for non-member conv')
  } catch (e) { fail('non-member 403', e) }

  // 7. 400 on empty body
  try {
    const r = await asA('/kscw/messaging/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation: convId, type: 'text', body: '' }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 400 || b.code !== 'messaging/invalid_body') throw new Error(`status=${r.status} code=${b.code}`)
    pass('POST /messages 400 invalid_body for empty body')
  } catch (e) { fail('empty body 400', e) }

  // 8. 403 messaging/comms_disabled when opt-out flag is false — always restore
  try {
    await dbClient.query(`UPDATE members SET communications_team_chat_enabled = false WHERE id = $1`, [memberA])
    try {
      const r = await asA('/kscw/messaging/messages', {
        method: 'POST',
        body: JSON.stringify({ conversation: convId, type: 'text', body: 'x' }),
      })
      const b = await r.json().catch(() => ({}))
      if (r.status !== 403 || b.code !== 'messaging/comms_disabled') throw new Error(`status=${r.status} code=${b.code}`)
      pass('POST /messages 403 comms_disabled when opted out')
    } finally {
      try {
        await dbClient.query(`UPDATE members SET communications_team_chat_enabled = true WHERE id = $1`, [memberA])
      } catch (restoreErr) {
        fail('opt-out 403 flag restore', restoreErr)
      }
    }
  } catch (e) { fail('opt-out 403', e) }
}

async function testSentinelMember() {
  console.log('\n[sentinel] verifying sentinel member row exists...')
  const id = process.env.MESSAGING_SYSTEM_MEMBER_ID
  if (!id) { fail('MESSAGING_SYSTEM_MEMBER_ID env var', 'not set'); return }
  try {
    const res = await api(`/items/members/${id}`)
    const body = await res.json()
    if (body?.data?.email === 'system@kscw.ch') pass(`members[${id}] is system sentinel`)
    else fail(`members[${id}]`, 'not the system sentinel')
  } catch (e) { fail('sentinel member', e) }
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    await testCollections()
    await testMemberFields()
    await testTriggers(client)
    await testSentinelMember()
    await testEndpointSkeleton()
    await testPlan02Endpoints(client)
  } finally {
    await client.end()
  }
  console.log(`\n${failures.length === 0 ? '✅ ALL PASSED' : `❌ ${failures.length} FAILURES`}`)
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
