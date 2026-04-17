#!/usr/bin/env node
// Integration assertions for KSCW Messaging Plan 01 (schema & foundation)
// Intentionally dependency-light: plain fetch + pg.

import pg from 'pg'

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

async function testTriggers() {
  console.log('\n[triggers] verifying Postgres triggers exist...')
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
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
  } finally {
    await client.end()
  }
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
  await testCollections()
  await testMemberFields()
  await testTriggers()
  await testSentinelMember()
  await testEndpointSkeleton()
  console.log(`\n${failures.length === 0 ? '✅ ALL PASSED' : `❌ ${failures.length} FAILURES`}`)
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
