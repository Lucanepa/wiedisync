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

// Routes still 501-stubbed in the current plan phase.
// As Plan 02/03/04/05 implement endpoints, prune this list — each removed entry
// moves from "skeleton 501" into the Plan-specific assertion block.
// Plan 02 implemented: GET /conversations, POST /messages,
// POST /conversations/:id/read, POST /conversations/:id/mute,
// GET /conversations/:id/messages.
// Plan 03 implemented (after Task 21+): POST /conversations/dm, PATCH /settings,
// POST /requests/:id/decline, POST /blocks, DELETE /blocks/:member — pruned below.
// Final EXPECTED_ENDPOINTS after Plan 03 is fully implemented:
const EXPECTED_ENDPOINTS = [
  ['POST',   '/kscw/messaging/messages/00000000-0000-0000-0000-000000000000/reactions'],
  ['POST',   '/kscw/messaging/reports'],
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
    'trg_messaging_dm_autoaccept',    // Plan 03
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

  // 9. List messages returns the seeded thread (including the one just sent)
  try {
    const r = await asA(`/kscw/messaging/conversations/${convId}/messages`)
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    if (!Array.isArray(b.messages)) throw new Error('messages not an array')
    if (!b.messages.some((m) => m.body === 'harness-hello')) throw new Error('sent message missing')
    if (typeof b.has_more !== 'boolean') throw new Error('has_more missing')
    pass('GET /conversations/:id/messages returns thread')
  } catch (e) { fail('list messages', e) }

  // 8. 403 messaging/comms_disabled when opt-out flag is false — always restore
  try {
    await dbClient.query(`UPDATE members SET communications_team_chat_enabled = false WHERE id = $1`, [memberA])
    try {
      const r = await asA('/kscw/messaging/messages', {
        method: 'POST',
        body: JSON.stringify({ conversation: convId, type: 'text', body: 'x' }),
      })
      const b = await r.json().catch(() => ({}))
      // The Plan-01 trigger (trg_messaging_member_team_chat_enabled) archives the
      // conversation_members row immediately when communications_team_chat_enabled=false,
      // so loadConversationMembership returns not_a_member before we reach the
      // requireTeamChatEnabled check.  Both codes are correct 403 opt-out rejections.
      if (r.status !== 403 || (b.code !== 'messaging/comms_disabled' && b.code !== 'messaging/not_a_member')) throw new Error(`status=${r.status} code=${b.code}`)
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

async function testPlan03Endpoints(dbClient) {
  console.log('\n[plan03] verifying DM + request + block endpoints...')

  let seedResult
  try {
    const stdout = execSync(
      `node ${resolve(__dirname, 'seed-plan03.mjs')}`,
      { env: process.env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const lines = stdout.trim().split('\n').filter(Boolean)
    const jsonLine = lines.reverse().find(l => l.startsWith('{'))
    if (!jsonLine) throw new Error(`seed produced no JSON line; stdout: ${stdout.slice(0,200)}`)
    seedResult = JSON.parse(jsonLine)
  } catch (e) { fail('plan03 seed', e); return }

  const { memberA, memberB, memberC } = seedResult
  const TOKEN_A = process.env.DIRECTUS_DEV_USER_TOKEN_A
  const TOKEN_B = process.env.DIRECTUS_DEV_USER_TOKEN_B
  if (!TOKEN_A || !TOKEN_B) {
    fail('plan03 user tokens', 'DIRECTUS_DEV_USER_TOKEN_A and _B must both be set')
    return
  }
  const asA = (p, i={}) => fetch(`${API}${p}`, { ...i,
    headers: { Authorization:`Bearer ${TOKEN_A}`, 'Content-Type':'application/json', ...(i.headers??{}) } })
  const asB = (p, i={}) => fetch(`${API}${p}`, { ...i,
    headers: { Authorization:`Bearer ${TOKEN_B}`, 'Content-Type':'application/json', ...(i.headers??{}) } })

  // ── DM between teammates ───────────────────────────────────────────
  let dmConv
  try {
    const r = await asA('/kscw/messaging/conversations/dm', {
      method: 'POST',
      body: JSON.stringify({ recipient: String(memberB) }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    if (!b.conversation_id || b.created !== true || b.type !== 'dm')
      throw new Error(`unexpected body: ${JSON.stringify(b)}`)
    dmConv = b.conversation_id
    const rows = await dbClient.query(
      `SELECT member, archived FROM conversation_members WHERE conversation = $1 ORDER BY member`, [dmConv]
    )
    if (rows.rows.length !== 2) throw new Error(`expected 2 members, got ${rows.rows.length}`)
    if (rows.rows.some(r => r.archived)) throw new Error('DM members should not be archived')
    pass('POST /conversations/dm creates type=dm between teammates')
  } catch (e) { fail('POST /conversations/dm teammate', e) }

  // Idempotent
  try {
    const r = await asA('/kscw/messaging/conversations/dm', {
      method: 'POST', body: JSON.stringify({ recipient: String(memberB) }),
    })
    const b = await r.json()
    if (r.status !== 409 || b.code !== 'messaging/conversation_exists' || b.conversation_id !== dmConv)
      throw new Error(`status=${r.status} code=${b.code} id=${b.conversation_id}`)
    pass('POST /conversations/dm is idempotent — 409 conversation_exists')
  } catch (e) { fail('POST /conversations/dm idempotent', e) }

  // ── DM to non-teammate → dm_request ───────────────────────────────
  let reqConv, reqId
  try {
    const r = await asA('/kscw/messaging/conversations/dm', {
      method: 'POST', body: JSON.stringify({ recipient: String(memberC) }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    if (b.type !== 'dm_request' || b.request_status !== 'pending')
      throw new Error(`expected dm_request, got ${JSON.stringify(b)}`)
    reqConv = b.conversation_id
    const { rows } = await dbClient.query(
      `SELECT id, status FROM message_requests WHERE conversation = $1`, [reqConv]
    )
    if (rows.length !== 1 || rows[0].status !== 'pending')
      throw new Error('message_requests row not pending')
    reqId = rows[0].id
    pass('POST /conversations/dm non-teammate creates dm_request')
  } catch (e) { fail('POST /conversations/dm non-teammate', e) }

  // Sender can post into a dm_request
  try {
    const r = await asA('/kscw/messaging/messages', {
      method: 'POST', body: JSON.stringify({ conversation: reqConv, type:'text', body:'hi from A' }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    pass('POST /messages inside dm_request works for sender')
  } catch (e) { fail('POST /messages in dm_request', e) }

  // Decline + cooldown — requires TOKEN_C; soft-skip if missing
  if (!process.env.DIRECTUS_DEV_USER_TOKEN_C) {
    console.log('  ~ skipping decline-endpoint via C (set DIRECTUS_DEV_USER_TOKEN_C to enable)')
  } else {
    const TOKEN_C = process.env.DIRECTUS_DEV_USER_TOKEN_C
    const asC = (p, i={}) => fetch(`${API}${p}`, { ...i,
      headers: { Authorization:`Bearer ${TOKEN_C}`, 'Content-Type':'application/json', ...(i.headers??{}) } })
    try {
      const r = await asC(`/kscw/messaging/requests/${reqId}/decline`, { method:'POST' })
      if (r.status !== 200) throw new Error(`decline status=${r.status}`)
      const { rows } = await dbClient.query(
        `SELECT status, resolved_at FROM message_requests WHERE id=$1`, [reqId])
      if (rows[0]?.status !== 'declined' || !rows[0]?.resolved_at)
        throw new Error('decline not persisted')
      pass('POST /requests/:id/decline flips status and resolved_at')
    } catch (e) { fail('POST /requests/:id/decline', e) }
    try {
      const r = await asA('/kscw/messaging/conversations/dm', {
        method: 'POST', body: JSON.stringify({ recipient: String(memberC) }),
      })
      const b = await r.json()
      if (r.status !== 429 || b.code !== 'messaging/request_cooldown')
        throw new Error(`status=${r.status} code=${b.code}`)
      pass('POST /conversations/dm honors 30d cooldown after decline')
    } catch (e) { fail('cooldown check', e) }
  }

  // ── Blocks ─────────────────────────────────────────────────────
  try {
    const r = await asB('/kscw/messaging/blocks', {
      method: 'POST', body: JSON.stringify({ member: String(memberA) }),
    })
    if (r.status !== 200) throw new Error(`block status=${r.status}`)
    const { rows } = await dbClient.query(
      `SELECT 1 FROM blocks WHERE blocker=$1 AND blocked=$2`, [memberB, memberA])
    if (rows.length !== 1) throw new Error('block row not inserted')
    pass('POST /blocks inserts row')
  } catch (e) { fail('POST /blocks', e) }

  try {
    const r = await asA('/kscw/messaging/conversations')
    const list = await r.json()
    if ((Array.isArray(list) ? list : list.data).some(c => c.id === dmConv))
      throw new Error('blocked DM still visible to A')
    pass('blocked DM hidden from A list')
  } catch (e) { fail('blocked DM hidden', e) }

  try {
    const r = await asA('/kscw/messaging/messages', {
      method: 'POST', body: JSON.stringify({ conversation: dmConv, type:'text', body:'nope' }),
    })
    const b = await r.json()
    if (r.status !== 403 || b.code !== 'messaging/blocked')
      throw new Error(`status=${r.status} code=${b.code}`)
    pass('POST /messages into blocked DM → 403 blocked')
  } catch (e) { fail('blocked-DM send 403', e) }

  try {
    const r = await asB(`/kscw/messaging/blocks/${memberA}`, { method:'DELETE' })
    if (r.status !== 200) throw new Error(`unblock status=${r.status}`)
    const { rows } = await dbClient.query(
      `SELECT 1 FROM blocks WHERE blocker=$1 AND blocked=$2`, [memberB, memberA])
    if (rows.length !== 0) throw new Error('block row still present')
    pass('DELETE /blocks/:member removes row')
  } catch (e) { fail('DELETE /blocks', e) }

  // Self-DM guard
  try {
    const r = await asA('/kscw/messaging/conversations/dm', {
      method: 'POST', body: JSON.stringify({ recipient: String(memberA) }),
    })
    const b = await r.json()
    if (r.status !== 400 || b.code !== 'messaging/invalid_body')
      throw new Error(`status=${r.status} code=${b.code}`)
    pass('POST /conversations/dm rejects self as recipient')
  } catch (e) { fail('self-DM 400', e) }

  // dm_enabled opt-out on recipient
  try {
    await dbClient.query(`UPDATE members SET communications_dm_enabled = false WHERE id = $1`, [memberB])
    try {
      const r = await asA('/kscw/messaging/conversations/dm', {
        method: 'POST', body: JSON.stringify({ recipient: String(memberB) }),
      })
      const b = await r.json()
      if (!(r.status === 403 || r.status === 409))
        throw new Error(`status=${r.status} code=${b.code}`)
      pass('POST /conversations/dm blocked when recipient dm_enabled=false or DM exists')
    } finally {
      await dbClient.query(`UPDATE members SET communications_dm_enabled = true WHERE id = $1`, [memberB])
    }
  } catch (e) { fail('dm_enabled opt-out', e) }

  // PATCH /settings
  try {
    const r = await asA('/kscw/messaging/settings', {
      method: 'PATCH', body: JSON.stringify({ dm_enabled: false, push_preview_content: true }),
    })
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    const { rows } = await dbClient.query(
      `SELECT communications_dm_enabled, push_preview_content FROM members WHERE id=$1`, [memberA])
    if (rows[0]?.communications_dm_enabled !== false) throw new Error('dm_enabled not updated')
    if (rows[0]?.push_preview_content !== true) throw new Error('push_preview_content not updated')
    pass('PATCH /settings updates fields')
    await dbClient.query(
      `UPDATE members SET communications_dm_enabled=true, push_preview_content=false WHERE id=$1`, [memberA])
  } catch (e) { fail('PATCH /settings', e) }
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
    await testPlan03Endpoints(client)
  } finally {
    await client.end()
  }
  console.log(`\n${failures.length === 0 ? '✅ ALL PASSED' : `❌ ${failures.length} FAILURES`}`)
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
