#!/usr/bin/env node
// Integration assertions for KSCW Broadcast Plan 01 / Phase B (Task B7).
//
// Pattern mirrors `messaging-int.mjs`: dependency-light, plain fetch + pg,
// accumulating-failures (we run all 13 assertions and exit non-zero only at
// the end). The companion seed `seed-broadcast.mjs` is run via execSync at
// the start so this script is one-shot for `npm test`-style invocation.
//
// Required env vars (typically supplied by .env.local):
//   - DIRECTUS_DEV_DB_URL              Postgres connection string for dev
//   - DIRECTUS_DEV_TOKEN               admin@kscw.ch static token (DB queries)
//   - DIRECTUS_DEV_USER_TOKEN_LUCA     luca.canepa@gmail.com static token —
//                                      acts as COACH_TOKEN_X (member 8, role
//                                      includes 'admin' so RBAC short-circuits
//                                      for any activity)
//   - DIRECTUS_DEV_USER_TOKEN_MEMBER   federico.felician@gmail.com static
//                                      token — acts as MEMBER_TOKEN_X (member
//                                      9, role=['user'], no team junction →
//                                      403 broadcast/not_authorized)
//
// Provisioning the two user tokens is a one-off — see broadcast section in
// README.md.

import pg from 'pg'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const API = 'https://directus-dev.kscw.ch'
const DB_URL = process.env.DIRECTUS_DEV_DB_URL
const TOKEN_COACH = process.env.DIRECTUS_DEV_USER_TOKEN_LUCA
const TOKEN_MEMBER = process.env.DIRECTUS_DEV_USER_TOKEN_MEMBER

if (!DB_URL || !TOKEN_COACH || !TOKEN_MEMBER) {
  console.error('Missing one of: DIRECTUS_DEV_DB_URL, DIRECTUS_DEV_USER_TOKEN_LUCA, DIRECTUS_DEV_USER_TOKEN_MEMBER')
  process.exit(2)
}

const failures = []
const pass = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg, err) => {
  failures.push({ msg, err: String(err?.message ?? err ?? '') })
  console.error(`  ✗ ${msg} — ${err?.message ?? err ?? ''}`)
}

const asCoach = (path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN_COACH}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
const asMember = (path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN_MEMBER}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

async function runSeed() {
  const stdout = execSync(`node ${resolve(__dirname, 'seed-broadcast.mjs')}`, {
    env: process.env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
  })
  const lines = stdout.trim().split('\n').filter(Boolean)
  const jsonLine = lines.reverse().find(l => l.startsWith('{'))
  if (!jsonLine) throw new Error(`seed produced no JSON line; stdout was: ${stdout.slice(0, 200)}`)
  return JSON.parse(jsonLine)
}

async function testBroadcast(dbClient) {
  console.log('\n[broadcast] Plan 01 / Phase B / Task B7 — integration assertions')

  let seed
  try { seed = await runSeed() }
  catch (e) { fail('broadcast seed', e); return }
  const { eventId, trainingId, rateLimitTraining } = seed
  console.log(`  · seed: training=${trainingId} ratelimit=${rateLimitTraining} event=${eventId}`)

  // ── 1. Happy path — coach POST /broadcast {confirmed} → 200 ────────────
  let happyResponse
  try {
    const r = await asCoach(`/kscw/activities/training/${trainingId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: true, push: false },
        audience: { statuses: ['confirmed'] },
        subject: 'Broadcast harness — happy path',
        message: 'Hello from the broadcast harness.',
      }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    if (b.recipientCount !== 3) throw new Error(`recipientCount=${b.recipientCount} (expected 3)`)
    // SMTP relay accepts .test addresses then bounces silently downstream, so
    // sent should equal recipientCount. If the relay ever rejects pre-queue we
    // fall back to checking sent+failed===recipientCount.
    const sent = b.delivery?.email?.sent ?? 0
    const failed = b.delivery?.email?.failed ?? 0
    if (sent + failed !== 3) throw new Error(`sent+failed=${sent + failed} (expected 3)`)
    if (sent !== 3) {
      // Soft-warn: we still pass since recipientCount matched and delivery
      // outcomes are bookkept honestly.
      console.warn(`  ! delivery.email.sent=${sent} failed=${failed} (SMTP may have rejected .test addresses; ok)`)
    }
    happyResponse = b
    pass(`(1) POST /broadcast happy path → 200 recipientCount=3 sent=${sent} failed=${failed}`)
  } catch (e) { fail('(1) happy path', e) }

  // ── 2. Preview happy ───────────────────────────────────────────────────
  try {
    const r = await asCoach(`/kscw/activities/training/${trainingId}/broadcast/preview`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: true },
        audience: { statuses: ['confirmed'] },
        subject: 'Test', message: 'Hello',
      }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    if (b.recipientCount !== 3) throw new Error(`recipientCount=${b.recipientCount} (expected 3)`)
    if (b.breakdown?.members !== 3) throw new Error(`breakdown.members=${b.breakdown?.members} (expected 3)`)
    if (!Array.isArray(b.sample) || b.sample.length === 0) throw new Error('sample empty')
    pass('(2) POST /broadcast/preview happy → 200 recipientCount=3 sample non-empty')
  } catch (e) { fail('(2) preview happy', e) }

  // ── 3. Audience expand — preview confirmed+tentative → 4 ───────────────
  try {
    const r = await asCoach(`/kscw/activities/training/${trainingId}/broadcast/preview`, {
      method: 'POST',
      body: JSON.stringify({ audience: { statuses: ['confirmed', 'tentative'] } }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    if (b.recipientCount !== 4) throw new Error(`recipientCount=${b.recipientCount} (expected 4)`)
    pass('(3) preview audience-expand confirmed+tentative → recipientCount=4')
  } catch (e) { fail('(3) audience expand', e) }

  // ── 4. Externals on event preview — includeExternals:true ──────────────
  try {
    const r = await asCoach(`/kscw/activities/event/${eventId}/broadcast/preview`, {
      method: 'POST',
      body: JSON.stringify({
        audience: { statuses: ['confirmed', 'tentative', 'invited'], includeExternals: true },
      }),
    })
    const b = await r.json()
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(b)}`)
    if (!(b.breakdown?.externals >= 1)) throw new Error(`breakdown.externals=${b.breakdown?.externals} (expected >=1)`)
    pass(`(4) event preview includeExternals → breakdown.externals=${b.breakdown.externals}`)
  } catch (e) { fail('(4) externals on event', e) }

  // ── 5. RBAC main — MEMBER_TOKEN_X /broadcast → 403 not_authorized ──────
  try {
    const r = await asMember(`/kscw/activities/training/${trainingId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: true },
        audience: { statuses: ['confirmed'] },
        subject: 'nope', message: 'nope',
      }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 403 || b.code !== 'broadcast/not_authorized')
      throw new Error(`status=${r.status} code=${b.code}`)
    pass('(5) RBAC main: MEMBER_TOKEN_X → 403 broadcast/not_authorized')
  } catch (e) { fail('(5) RBAC main', e) }

  // ── 6. RBAC preview — MEMBER_TOKEN_X /broadcast/preview → 403 ──────────
  try {
    const r = await asMember(`/kscw/activities/training/${trainingId}/broadcast/preview`, {
      method: 'POST',
      body: JSON.stringify({ audience: { statuses: ['confirmed'] } }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 403 || b.code !== 'broadcast/not_authorized')
      throw new Error(`status=${r.status} code=${b.code}`)
    pass('(6) RBAC preview: MEMBER_TOKEN_X → 403 broadcast/not_authorized')
  } catch (e) { fail('(6) RBAC preview', e) }

  // ── 7. Rate-limit — pre-seed 3 audit rows on the rate-limit training,
  //    then attempt a real send to an EMPTY audience (no real fan-out).
  //    The rate-limit gate runs BEFORE audience resolution, so no email is
  //    even attempted. We assert 429 + retryAfterSec.
  try {
    // Wipe + insert 3 fake audit rows: 50min, 30min, 10min ago. Spaced >20min
    // each so the "20 min between sends" rule wouldn't fire on its own — the
    // 429 must come from the "3 per trailing hour" cap.
    await dbClient.query(`DELETE FROM broadcasts WHERE activity_type='training' AND activity_id=$1`, [rateLimitTraining])
    for (const minutesAgo of [50, 30, 10]) {
      await dbClient.query(
        `INSERT INTO broadcasts (activity_type, activity_id, sender, channels_sent, audience_filter, recipient_count, recipient_ids, message, sent_at)
           VALUES ('training', $1, 8, '{"email":true}'::jsonb, '{}'::jsonb, 0, '{}'::jsonb, 'rate-limit test', NOW() - ($2::int * INTERVAL '1 minute'))`,
        [rateLimitTraining, minutesAgo]
      )
    }
    const r = await asCoach(`/kscw/activities/training/${rateLimitTraining}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: true },
        audience: { statuses: ['waitlist'] },     // matches nothing — DB stores 'waitlisted'
        subject: 'Rate-limit probe',
        message: 'Should never send.',
      }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 429) throw new Error(`status=${r.status} body=${JSON.stringify(b)}`)
    if (b.code !== 'broadcast/rate_limited') throw new Error(`code=${b.code}`)
    if (typeof b.details?.retryAfterSec !== 'number' || b.details.retryAfterSec <= 0)
      throw new Error(`retryAfterSec missing/non-positive: ${b.details?.retryAfterSec}`)
    pass(`(7) rate-limit: 4th broadcast in hour → 429 retryAfterSec=${b.details.retryAfterSec}`)
  } catch (e) { fail('(7) rate-limit', e) }
  finally {
    // Leave the fake audit rows in place — they age out after 60min on their
    // own and don't affect the happy-path training.
  }

  // ── 8. Validation: subject missing when channels.email=true → 400 ──────
  try {
    const r = await asCoach(`/kscw/activities/training/${trainingId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: true },
        audience: { statuses: ['confirmed'] },
        message: 'no subject here',
      }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 400 || b.code !== 'broadcast/invalid_payload' || b.details?.field !== 'subject')
      throw new Error(`status=${r.status} code=${b.code} field=${b.details?.field}`)
    pass('(8) validation: subject missing → 400 invalid_payload field=subject')
  } catch (e) { fail('(8) validation subject', e) }

  // ── 9. Validation: empty channels (all false) → 400 field=channels ─────
  try {
    const r = await asCoach(`/kscw/activities/training/${trainingId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: false, push: false, inApp: false },
        audience: { statuses: ['confirmed'] },
        message: 'no channels',
      }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 400 || b.code !== 'broadcast/invalid_payload' || b.details?.field !== 'channels')
      throw new Error(`status=${r.status} code=${b.code} field=${b.details?.field}`)
    pass('(9) validation: empty channels → 400 invalid_payload field=channels')
  } catch (e) { fail('(9) validation empty channels', e) }

  // ── 10. Validation: inApp:true → 501 broadcast/not_implemented ─────────
  try {
    const r = await asCoach(`/kscw/activities/training/${trainingId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { inApp: true },
        audience: { statuses: ['confirmed'] },
        message: 'in-app please',
      }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 501 || b.code !== 'broadcast/not_implemented')
      throw new Error(`status=${r.status} code=${b.code}`)
    pass('(10) validation: inApp:true → 501 broadcast/not_implemented')
  } catch (e) { fail('(10) validation inApp', e) }

  // ── 11. Audit row — verify the happy-path send wrote a correct row ─────
  try {
    if (!happyResponse) throw new Error('no happy-path response to verify')
    const { rows } = await dbClient.query(
      `SELECT activity_type, activity_id, recipient_count, channels_sent, delivery_results
         FROM broadcasts
        WHERE activity_type='training' AND activity_id=$1
        ORDER BY id DESC LIMIT 1`,
      [trainingId]
    )
    if (rows.length !== 1) throw new Error(`expected 1 audit row for training ${trainingId}, got ${rows.length}`)
    const row = rows[0]
    if (row.activity_type !== 'training') throw new Error(`activity_type=${row.activity_type}`)
    if (row.recipient_count !== 3) throw new Error(`recipient_count=${row.recipient_count}`)
    const channels = typeof row.channels_sent === 'string' ? JSON.parse(row.channels_sent) : row.channels_sent
    if (channels?.email !== true) throw new Error(`channels_sent.email=${channels?.email}`)
    const delivery = typeof row.delivery_results === 'string' ? JSON.parse(row.delivery_results) : row.delivery_results
    const auditSent = delivery?.email?.sent ?? -1
    if (auditSent !== happyResponse.delivery.email.sent)
      throw new Error(`audit delivery.email.sent=${auditSent} differs from response ${happyResponse.delivery.email.sent}`)
    pass(`(11) audit row: activity_type=training recipient_count=3 channels_sent.email=true delivery.email.sent=${auditSent}`)
  } catch (e) { fail('(11) audit row', e) }

  // ── 12. Activity 404 — POST /broadcast on nonexistent training ─────────
  try {
    const r = await asCoach(`/kscw/activities/training/999999/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: true },
        audience: { statuses: ['confirmed'] },
        subject: '404 probe', message: 'should not exist',
      }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 404 || b.code !== 'broadcast/not_found')
      throw new Error(`status=${r.status} code=${b.code}`)
    pass('(12) activity 404: training id=999999 → 404 broadcast/not_found')
  } catch (e) { fail('(12) activity 404', e) }

  // ── 13. Empty audience — statuses:['waitlist'] (no waitlist participants
  //    on the test training) → 200 with recipientCount=0 and email.sent=0.
  //    Use the happy-path training: but the rate-limit "20 min between sends"
  //    will trip if we hit it within 20min of assertion 1. To avoid that,
  //    we use the RATE-LIMIT training (with its 3 fake audit rows still in
  //    place from assertion 7) and DELETE them first so we have a fresh slate.
  try {
    await dbClient.query(`DELETE FROM broadcasts WHERE activity_type='training' AND activity_id=$1`, [rateLimitTraining])
    const r = await asCoach(`/kscw/activities/training/${rateLimitTraining}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        channels: { email: true },
        audience: { statuses: ['waitlist'] },     // DB stores 'waitlisted' → 0 matches
        subject: 'Empty audience probe',
        message: 'No one should receive this.',
      }),
    })
    const b = await r.json().catch(() => ({}))
    if (r.status !== 200) throw new Error(`status=${r.status} body=${JSON.stringify(b)}`)
    if (b.recipientCount !== 0) throw new Error(`recipientCount=${b.recipientCount} (expected 0)`)
    if (b.delivery?.email?.sent !== 0) throw new Error(`delivery.email.sent=${b.delivery?.email?.sent} (expected 0)`)
    if (b.delivery?.email?.failed !== 0) throw new Error(`delivery.email.failed=${b.delivery?.email?.failed} (expected 0)`)
    pass('(13) empty audience: 200 recipientCount=0 delivery.email.sent=0')
  } catch (e) { fail('(13) empty audience', e) }
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    await testBroadcast(client)
  } finally {
    await client.end()
  }
  console.log(`\n${failures.length === 0 ? '✅ ALL PASSED' : `❌ ${failures.length} FAILURES`}`)
  for (const f of failures) console.log(`  · ${f.msg}: ${f.err}`)
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
