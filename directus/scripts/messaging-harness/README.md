# Messaging Integration Test Harness

Run against `directus-dev` to verify schema, triggers, and endpoint skeleton across Plans 01–06 of the messaging system.

## Requirements

- `DIRECTUS_DEV_TOKEN` — a Superuser static token for `directus-dev.kscw.ch`. Find it on your own user row:
  ```bash
  ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d directus_kscw_dev -t -c \"SELECT token FROM directus_users WHERE email = 'luca.canepa@gmail.com';\"" | tr -d ' \n'
  ```
  The `DIRECTUS_ADMIN_TOKEN` in the container `.env` does NOT work for the `/items/*` API — use a real user's token.
- `DIRECTUS_DEV_DB_URL` — Postgres connection string for the Supabase-hosted dev DB:
  ```
  postgres://supabase_admin:<DB_PASSWORD>@<host>:5432/directus_kscw_dev
  ```
  Reach the DB directly via:
  ```bash
  ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d directus_kscw_dev"
  ```
- `MESSAGING_SYSTEM_MEMBER_ID` — set once Plan 01 Task 11 (sentinel) completes.

## Usage

```bash
cd directus/scripts/messaging-harness
npm install   # first time only — installs pg locally
cd ../../..
DIRECTUS_DEV_TOKEN=xxx \
DIRECTUS_DEV_DB_URL=postgres://... \
MESSAGING_SYSTEM_MEMBER_ID=<uuid> \
node directus/scripts/messaging-harness/messaging-int.mjs
```

Exit 0 = all assertions passed. Exit 1 = one or more failed.

## What it asserts

- All 7 new collections exist (`conversations`, `conversation_members`, `messages`, `message_reactions`, `blocks`, `message_requests`, `reports`).
- All 7 new fields on `members` (see spec §3).
- All 5 Postgres triggers exist (spec §3 Triggers 1, 2, 3/4 merged, 6, + sentinel-protect). Spec Trigger 5 is enforced via FK `ON DELETE` rules, not a trigger.
- Sentinel system-user member exists at `MESSAGING_SYSTEM_MEMBER_ID`.
- All endpoint skeleton routes return `501` (Plan 01) or the correct status code (later plans).
