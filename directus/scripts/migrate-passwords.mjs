/**
 * Migrate PB bcrypt password hashes to Directus users.
 *
 * Writes bcrypt hashes directly to PostgreSQL (bypassing Directus API
 * which would re-hash them). Directus accepts $2a$ bcrypt hashes natively.
 *
 * Usage:
 *   cat pb-hashes.txt | node scripts/migrate-passwords.mjs
 *
 * Hash file format (one per line): email|$2a$10$...
 *
 * Requires: PGPASSWORD, or uses defaults for dev.
 */

import { readFileSync } from 'fs'
import pg from 'pg'
const { Client } = pg

const DB_HOST = process.env.DB_HOST || '127.0.0.1'
const DB_PORT = process.env.DB_PORT || '5432'
const DB_NAME = process.env.DB_NAME
if (!DB_NAME) { console.error('Missing DB_NAME env var'); process.exit(1) }
const DB_USER = process.env.DB_USER
if (!DB_USER) { console.error('Missing DB_USER env var'); process.exit(1) }
const DB_PASS = process.env.DB_PASS
if (!DB_PASS) { console.error('Missing DB_PASS env var'); process.exit(1) }

async function main() {
  const file = process.argv[2]
  let input
  if (file) {
    input = readFileSync(file, 'utf-8')
  } else {
    input = readFileSync('/dev/stdin', 'utf-8')
  }

  const lines = input.trim().split('\n').filter(l => l.includes('|'))
  console.log(`📋 ${lines.length} password hashes to migrate\n`)

  const db = new Client({
    host: DB_HOST, port: Number(DB_PORT),
    database: DB_NAME, user: DB_USER, password: DB_PASS,
  })
  await db.connect()
  console.log('✓ Connected to PostgreSQL\n')

  let updated = 0, notFound = 0, errors = 0

  for (const line of lines) {
    const sep = line.indexOf('|')
    const email = line.slice(0, sep).trim().toLowerCase()
    const hash = line.slice(sep + 1).trim()
    if (!email || !hash) continue

    try {
      const result = await db.query(
        'UPDATE directus_users SET password = $1 WHERE LOWER(email) = $2',
        [hash, email],
      )
      if (result.rowCount > 0) {
        updated++
      } else {
        notFound++
      }
    } catch (err) {
      console.log(`  ✗ ${email}: ${err.message}`)
      errors++
    }
  }

  await db.end()

  console.log(`\n═══ Password Migration ═══`)
  console.log(`  Updated:   ${updated}`)
  console.log(`  Not found: ${notFound}`)
  console.log(`  Errors:    ${errors}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
