/**
 * Pull schema snapshot from a Directus instance.
 * Usage: node directus/scripts/schema-pull.mjs
 *
 * Env vars:
 *   DIRECTUS_URL   — Directus base URL (default: https://directus-dev.kscw.ch)
 *   DIRECTUS_TOKEN — Admin static token or login token
 *   DIRECTUS_EMAIL / DIRECTUS_PASSWORD — Alternative: login credentials
 */

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'https://directus-dev.kscw.ch').replace(/\/$/, '');
const SYNC_DIR = new URL('../sync/', import.meta.url).pathname;

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
  const token = await getToken();

  console.log(`Pulling schema from ${DIRECTUS_URL} ...`);
  const res = await fetch(`${DIRECTUS_URL}/schema/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error('Schema snapshot failed:', res.status, await res.text());
    process.exit(1);
  }

  const { data } = await res.json();

  const fs = await import('node:fs');
  const path = await import('node:path');

  // Write full snapshot
  const snapshotPath = path.join(SYNC_DIR, 'snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Snapshot saved to ${snapshotPath}`);

  // Write per-collection files for easier review
  const collectionsDir = path.join(SYNC_DIR, 'collections');
  fs.mkdirSync(collectionsDir, { recursive: true });

  // Clear old collection files
  for (const f of fs.readdirSync(collectionsDir)) {
    fs.unlinkSync(path.join(collectionsDir, f));
  }

  for (const collection of data.collections || []) {
    const name = collection.collection;
    const fields = (data.fields || []).filter((f) => f.collection === name);
    const relations = (data.relations || []).filter(
      (r) => r.collection === name || r.related_collection === name,
    );
    const collectionData = { collection, fields, relations };
    const filePath = path.join(collectionsDir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(collectionData, null, 2) + '\n');
  }

  console.log(`Per-collection files written to ${collectionsDir}/`);
  console.log(`Collections: ${(data.collections || []).length}, Fields: ${(data.fields || []).length}, Relations: ${(data.relations || []).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
