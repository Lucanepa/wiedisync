/**
 * Compare local schema snapshot against a remote Directus instance.
 * Usage: node directus/scripts/schema-diff.mjs
 *
 * Env vars:
 *   DIRECTUS_URL   — Target Directus URL (default: https://directus-dev.kscw.ch)
 *   DIRECTUS_TOKEN — Admin token
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
  const fs = await import('node:fs');
  const path = await import('node:path');

  const snapshotPath = path.join(SYNC_DIR, 'snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    console.error('No local snapshot found. Run schema:pull first.');
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  const token = await getToken();

  console.log(`Comparing local snapshot against ${DIRECTUS_URL} ...`);
  const res = await fetch(`${DIRECTUS_URL}/schema/diff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });

  if (res.status === 204) {
    console.log('No differences — schemas are identical.');
    return;
  }

  if (!res.ok) {
    const body = await res.text();
    // Directus returns 204 for no diff, 200 for diff, 4xx/5xx for errors
    if (res.status === 400 && body.includes('different versions')) {
      console.warn('Version mismatch. Retry with force=true ...');
      const retry = await fetch(`${DIRECTUS_URL}/schema/diff?force=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(snapshot),
      });
      if (retry.status === 204) {
        console.log('No differences — schemas are identical.');
        return;
      }
      if (!retry.ok) {
        console.error('Schema diff failed:', retry.status, await retry.text());
        process.exit(1);
      }
      const { data } = await retry.json();
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    console.error('Schema diff failed:', res.status, body);
    process.exit(1);
  }

  const { data } = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
