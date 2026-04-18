#!/usr/bin/env node
/**
 * 009-messaging-permissions.mjs
 *
 * Plan 01 — Directus RBAC for messaging collections.
 *
 * Directus 11 permission model: Roles → Policies → Permissions.
 * Permissions are assigned to POLICIES, not directly to roles.
 * This script finds the "KSCW Member" and "KSCW Admin" policies by name
 * and adds the messaging collection permissions to each.
 *
 * What it does:
 *   - Grants READ on all 7 messaging collections to the "KSCW Member" policy
 *     (member role is attached to this policy)
 *   - Grants full CRUD on all 7 messaging collections to the "KSCW Admin" policy
 *     (Administrator role is attached to this policy; admin_access=true anyway)
 *
 * Idempotent: for each (policy, collection, action) tuple, any existing permission
 * is deleted before a fresh one is inserted — so re-running is safe.
 *
 * Row-level filters (e.g. "member can only read conversations they belong to") are NOT
 * set here. That tightening is Plan 02 scope. For now, collection-level READ for Member
 * is the skeleton; writes go through /kscw/messaging/* custom endpoints.
 *
 * Usage:
 *   DIRECTUS_URL=https://directus-dev.kscw.ch \
 *   DIRECTUS_TOKEN=<admin-token> \
 *   node directus/scripts/009-messaging-permissions.mjs
 */

const URL = process.env.DIRECTUS_URL
const TOKEN = process.env.DIRECTUS_TOKEN
if (!URL || !TOKEN) { console.error('Missing DIRECTUS_URL / DIRECTUS_TOKEN'); process.exit(2) }

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`)
  // 204 No Content (e.g. DELETE) returns an empty body — don't attempt JSON parse
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function getPolicyIdByName(name) {
  const { data } = await api(`/policies?filter[name][_eq]=${encodeURIComponent(name)}&fields=id,name&limit=1`)
  if (!data?.[0]) throw new Error(`Policy "${name}" not found`)
  return data[0].id
}

async function upsertPermission({ policy, collection, action, permissions, fields }) {
  // Delete any existing permission for this (policy, collection, action) so the script is idempotent.
  const { data: existing } = await api(
    `/permissions?filter[policy][_eq]=${policy}&filter[collection][_eq]=${collection}&filter[action][_eq]=${action}&limit=-1`
  )
  for (const p of existing ?? []) {
    await api(`/permissions/${p.id}`, { method: 'DELETE' })
  }
  await api(`/permissions`, {
    method: 'POST',
    body: JSON.stringify({ policy, collection, action, permissions: permissions ?? {}, fields: fields ?? ['*'] }),
  })
}

async function main() {
  const POLICIES = {
    // "KSCW Member" policy — attached to the Member role (and inherited by Team Responsible, Vorstand, Sport Admin)
    member: await getPolicyIdByName('KSCW Member'),
    // "KSCW Admin" policy — attached to Superuser role (admin_access=true); Administrator has its own built-in bypass
    admin: await getPolicyIdByName('KSCW Admin'),
  }

  console.log(`Member policy: ${POLICIES.member}`)
  console.log(`Admin  policy: ${POLICIES.admin}`)

  const COLLECTIONS = [
    'conversations', 'conversation_members', 'messages', 'message_reactions',
    'blocks', 'message_requests', 'reports',
  ]

  // MEMBER policy: collection-level READ only.
  // Members interact with messaging data exclusively through /kscw/messaging/* endpoints
  // (which use admin-scoped accountability and enforce row-level visibility server-side).
  // Direct writes to collections are intentionally NOT granted here.
  // Row-level read filters (e.g. only see conversations you're a member of) are Plan 02 scope.
  console.log('\nApplying Member READ permissions...')
  for (const c of COLLECTIONS) {
    await upsertPermission({ policy: POLICIES.member, collection: c, action: 'read', permissions: {}, fields: ['*'] })
    console.log(`  ✓ member READ ${c}`)
  }

  // ADMIN policy: full CRUD.
  // KSCW Admin policy has admin_access=true, so these permissions are technically redundant,
  // but we register them explicitly for auditability when reviewing directus_permissions.
  console.log('\nApplying Admin CRUD permissions...')
  for (const c of COLLECTIONS) {
    for (const action of ['create', 'read', 'update', 'delete']) {
      await upsertPermission({ policy: POLICIES.admin, collection: c, action, permissions: {}, fields: ['*'] })
    }
    console.log(`  ✓ admin CRUD ${c}`)
  }

  console.log('\nMessaging RBAC applied.')
}

main().catch((e) => { console.error(e); process.exit(1) })
