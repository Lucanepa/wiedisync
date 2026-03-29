/**
 * Push local schema snapshot to a remote Directus instance (2-step: diff then apply).
 * Usage: node directus/scripts/schema-push.mjs
 *
 * Env vars:
 *   DIRECTUS_URL   — Target Directus URL (REQUIRED — no default, to prevent accidental pushes)
 *   DIRECTUS_TOKEN — Admin token
 *   DIRECTUS_EMAIL / DIRECTUS_PASSWORD — Alternative: login credentials
 *   SCHEMA_DRY_RUN — Set to "true" to only show the diff without applying
 */

const DIRECTUS_URL = (process.env.DIRECTUS_URL || '').replace(/\/$/, '');
if (!DIRECTUS_URL) {
  console.error('DIRECTUS_URL is required. Set it to the target Directus instance URL.');
  console.error('Example: DIRECTUS_URL=https://directus.kscw.ch npm run schema:push');
  process.exit(1);
}

const SYNC_DIR = new URL('../sync/', import.meta.url).pathname;
const DRY_RUN = process.env.SCHEMA_DRY_RUN === 'true';

async function getToken() {
  if (process.env.DIRECTUS_TOKEN) return process.env.DIRECTUS_TOKEN;

  const email = process.env.DIRECTUS_EMAIL || 'admin@kscw.ch';
  const password = process.env.DIRECTUS_PASSWORD;
  if (!password) {
    console.error('Set DIRECTUS_TOKEN or DIRECTUS_PASSWORD');
    process.exit(1);
  }

  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    console.error('Login failed:', res.status, await res.text());
    process.exit(1);
  }
  const { data } = await res.json();
  return data.access_token;
}

async function main() {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const snapshotPath = path.join(SYNC_DIR, 'snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    console.error('No local snapshot found. Run schema:pull first.');
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  const token = await getToken();

  // Step 1: Get diff
  console.log(`Diffing local snapshot against ${DIRECTUS_URL} ...`);
  const diffRes = await fetch(`${DIRECTUS_URL}/schema/diff?force=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });

  if (diffRes.status === 204) {
    console.log('No differences — schemas are already identical. Nothing to apply.');
    return;
  }

  if (!diffRes.ok) {
    console.error('Schema diff failed:', diffRes.status, await diffRes.text());
    process.exit(1);
  }

  const { data: diff } = await diffRes.json();

  const collectionsToCreate = diff.collections?.filter((c) => c.diff?.[0]?.kind === 'N').length || 0;
  const collectionsToUpdate = diff.collections?.filter((c) => c.diff?.[0]?.kind === 'E').length || 0;
  const collectionsToDelete = diff.collections?.filter((c) => c.diff?.[0]?.kind === 'D').length || 0;
  const fieldsChanged = diff.fields?.length || 0;
  const relationsChanged = diff.relations?.length || 0;

  console.log(`\nDiff summary:`);
  console.log(`  Collections: +${collectionsToCreate} ~${collectionsToUpdate} -${collectionsToDelete}`);
  console.log(`  Fields changed: ${fieldsChanged}`);
  console.log(`  Relations changed: ${relationsChanged}`);

  if (DRY_RUN) {
    console.log('\nDry run — full diff:');
    console.log(JSON.stringify(diff, null, 2));
    console.log('\nDry run complete. Set SCHEMA_DRY_RUN=false or remove it to apply.');
    return;
  }

  // Step 2: Apply diff
  console.log(`\nApplying schema changes to ${DIRECTUS_URL} ...`);
  const applyRes = await fetch(`${DIRECTUS_URL}/schema/apply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(diff),
  });

  if (applyRes.status === 204) {
    console.log('Schema applied successfully.');
    return;
  }

  if (!applyRes.ok) {
    console.error('Schema apply failed:', applyRes.status, await applyRes.text());
    process.exit(1);
  }

  console.log('Schema applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
