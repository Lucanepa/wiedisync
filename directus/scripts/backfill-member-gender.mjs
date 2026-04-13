/**
 * Backfill members.sex from sv_vm_check.gender
 *
 * Matching strategy (in priority order):
 * 1. license_nr → association_id (exact)
 * 2. email match (case-insensitive)
 * 3. first_name + last_name (case-insensitive, exact)
 *
 * Run: DIRECTUS_URL=https://directus-dev.kscw.ch DIRECTUS_TOKEN=xxx node backfill-member-gender.mjs
 *      (or set ADMIN_EMAIL + ADMIN_PASSWORD instead of DIRECTUS_TOKEN)
 *
 * Add --dry-run to preview without writing.
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus-dev.kscw.ch';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_TOKEN;
const DIRECTUS_EMAIL = process.env.ADMIN_EMAIL || 'admin@kscw.ch';
const DIRECTUS_PASSWORD = process.env.ADMIN_PASSWORD;
const DRY_RUN = process.argv.includes('--dry-run');

if (!DIRECTUS_TOKEN && !DIRECTUS_PASSWORD) {
  console.error('Set DIRECTUS_TOKEN or ADMIN_PASSWORD');
  process.exit(1);
}

const GENDER_MAP = { male: 'm', female: 'f', m: 'm', f: 'f' };

async function getToken() {
  if (DIRECTUS_TOKEN) return DIRECTUS_TOKEN;
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DIRECTUS_EMAIL, password: DIRECTUS_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  return (await res.json()).data.access_token;
}

async function fetchAll(token, collection, fields) {
  const items = [];
  let page = 1;
  while (true) {
    const url = `${DIRECTUS_URL}/items/${collection}?fields=${fields.join(',')}&limit=250&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Fetch ${collection} page ${page}: ${res.status}`);
    const { data } = await res.json();
    if (!data || data.length === 0) break;
    items.push(...data);
    page++;
  }
  return items;
}

async function main() {
  const token = await getToken();
  console.log(`Target: ${DIRECTUS_URL}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // 1. Ensure sex field exists on members
  console.log('Checking if members.sex field exists...');
  const fieldsRes = await fetch(`${DIRECTUS_URL}/fields/members/sex`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (fieldsRes.status === 403 || fieldsRes.status === 404) {
    console.log('Creating members.sex field...');
    if (!DRY_RUN) {
      const createRes = await fetch(`${DIRECTUS_URL}/fields/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: 'sex',
          type: 'string',
          meta: {
            interface: 'select-dropdown',
            display: 'labels',
            options: {
              choices: [
                { text: 'Male', value: 'm' },
                { text: 'Female', value: 'f' },
              ],
            },
            width: 'half',
          },
          schema: {
            data_type: 'varchar',
            max_length: 10,
            is_nullable: true,
          },
        }),
      });
      if (!createRes.ok) {
        const text = await createRes.text();
        console.error(`Failed to create field: ${createRes.status} ${text.slice(0, 300)}`);
        process.exit(1);
      }
      console.log('  ✓ Field created\n');
    } else {
      console.log('  (would create field)\n');
    }
  } else {
    console.log('  ✓ Field already exists\n');
  }

  // 2. Fetch all data
  const [members, vmChecks] = await Promise.all([
    fetchAll(token, 'members', ['id', 'first_name', 'last_name', 'email', 'phone', 'license_nr', 'sex', 'vm_email']),
    fetchAll(token, 'sv_vm_check', ['id', 'association_id', 'first_name', 'last_name', 'email', 'gender']),
  ]);
  console.log(`Members: ${members.length}, VM checks: ${vmChecks.length}\n`);

  // 3. Build VM lookup indexes
  const vmByAssocId = new Map();
  const vmByEmail = new Map();    // lowercase email → vm record
  const vmByName = new Map();     // "first|last" lowercase → vm record (only if unique)
  const nameCollisions = new Set();

  for (const vm of vmChecks) {
    if (vm.association_id) vmByAssocId.set(String(vm.association_id), vm);
    if (vm.email) vmByEmail.set(vm.email.toLowerCase(), vm);

    const nameKey = `${(vm.first_name || '').toLowerCase()}|${(vm.last_name || '').toLowerCase()}`;
    if (nameKey !== '|') {
      if (vmByName.has(nameKey)) {
        nameCollisions.add(nameKey); // ambiguous — multiple VM records with same name
      } else {
        vmByName.set(nameKey, vm);
      }
    }
  }
  // Remove ambiguous name matches
  for (const key of nameCollisions) vmByName.delete(key);

  // 4. Match and build updates
  const updates = [];
  const stats = { byLicence: 0, byEmail: 0, byName: 0, skippedAlreadySet: 0, noMatch: 0, noGender: 0 };

  for (const member of members) {
    // Skip if already has a value
    if (member.sex) {
      stats.skippedAlreadySet++;
      continue;
    }

    let vm = null;
    let matchType = '';

    // Priority 1: license_nr → association_id
    if (member.license_nr) {
      vm = vmByAssocId.get(String(member.license_nr));
      if (vm) matchType = 'licence';
    }

    // Priority 2: email match (check both email and vm_email)
    if (!vm && member.email) {
      vm = vmByEmail.get(member.email.toLowerCase());
      if (vm) matchType = 'email';
    }
    if (!vm && member.vm_email) {
      vm = vmByEmail.get(member.vm_email.toLowerCase());
      if (vm) matchType = 'vm_email';
    }

    // Priority 3: first + last name (only if unambiguous)
    if (!vm && member.first_name && member.last_name) {
      const nameKey = `${member.first_name.toLowerCase()}|${member.last_name.toLowerCase()}`;
      vm = vmByName.get(nameKey);
      if (vm) matchType = 'name';
    }

    if (!vm) {
      stats.noMatch++;
      continue;
    }

    const gender = GENDER_MAP[vm.gender];
    if (!gender) {
      stats.noGender++;
      continue;
    }

    updates.push({ id: member.id, sex: gender });
    if (matchType === 'licence') stats.byLicence++;
    else if (matchType === 'email' || matchType === 'vm_email') stats.byEmail++;
    else if (matchType === 'name') stats.byName++;

    console.log(`  ${member.first_name} ${member.last_name} → ${gender} (${matchType})`);
  }

  console.log(`\nMatch summary:`);
  console.log(`  By licence_nr:  ${stats.byLicence}`);
  console.log(`  By email:       ${stats.byEmail}`);
  console.log(`  By name:        ${stats.byName}`);
  console.log(`  Already set:    ${stats.skippedAlreadySet}`);
  console.log(`  No match:       ${stats.noMatch}`);
  console.log(`  No gender in VM: ${stats.noGender}`);
  console.log(`  Total to update: ${updates.length}`);

  if (DRY_RUN || updates.length === 0) {
    if (DRY_RUN) console.log('\n(Dry run — no changes written)');
    return;
  }

  // 5. Batch update
  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const res = await fetch(`${DIRECTUS_URL}/items/members`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      updated += batch.length;
    } else {
      const text = await res.text();
      console.error(`  Batch error: ${res.status} ${text.slice(0, 200)}`);
    }
  }
  console.log(`\n✓ Updated ${updated} members`);
}

main().catch(e => { console.error('✗ Fatal:', e.message); process.exit(1); });
