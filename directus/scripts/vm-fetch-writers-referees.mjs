/**
 * Fetch writers & referees from VM with proper propertyRenderConfiguration
 */

import { writeFileSync } from 'fs';

const VM_BASE = 'https://volleymanager.volleyball.ch';
const VM_USERNAME = process.env.VM_USERNAME;
const VM_PASSWORD = process.env.VM_PASSWORD;
if (!VM_USERNAME || !VM_PASSWORD) {
  console.error('Missing VM_USERNAME or VM_PASSWORD environment variables');
  process.exit(1);
}
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

class CookieJar {
  constructor() { this.cookies = {}; }
  update(r) { for (const h of r.headers.getSetCookie?.() ?? []) { const m = h.match(/^([^=]+)=([^;]*)/); if (m) this.cookies[m[1]] = m[2]; } }
  set(n, v) { this.cookies[n] = v; }
  header() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); }
}

async function follow(url, jar, init = {}, max = 10) {
  let u = url, i2 = init;
  for (let i = 0; i < max; i++) {
    const r = await fetch(u, { ...i2, headers: { 'User-Agent': UA, Cookie: jar.header(), ...(i2.headers ?? {}) }, redirect: 'manual' });
    jar.update(r);
    const body = await r.text();
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400 && loc) { u = loc.startsWith('http') ? loc : `${VM_BASE}${loc}`; i2 = {}; continue; }
    return { response: r, body };
  }
  throw new Error(`Too many redirects: ${url}`);
}

async function login() {
  const jar = new CookieJar();
  jar.set('language', 'de');
  const { body: html } = await follow(`${VM_BASE}/login`, jar);
  const fields = {};
  for (const m of html.matchAll(/name="([^"]+)"[^>]*value="([^"]*?)"/g)) fields[m[1]] = m[2];
  fields['__authentication[Neos][Flow][Security][Authentication][Token][UsernamePassword][username]'] = VM_USERNAME;
  fields['__authentication[Neos][Flow][Security][Authentication][Token][UsernamePassword][password]'] = VM_PASSWORD;
  await follow(`${VM_BASE}/sportmanager.security/authentication/authenticate`, jar, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString(),
  });
  await follow(`${VM_BASE}/`, jar);
  // Get CSRF from writer index page
  const { body: idx } = await follow(`${VM_BASE}/sportmanager.indoorvolleyball/indoorwriter/index`, jar, {
    headers: { Accept: 'text/html', Referer: `${VM_BASE}/` },
  });
  const csrf = idx.match(/data-csrf-token="([^"]+)"/)?.[1] || '';
  const wuid = idx.match(/data-window-unique-id="([^"]+)"/)?.[1] || '';
  console.log('✓ Logged in, CSRF:', csrf.slice(0, 20) + '...');
  return { jar, csrf, wuid };
}

async function apiSearch(jar, csrf, wuid, resourcePath, label, properties, referer) {
  console.log(`\n=== ${label} ===`);

  const params = new URLSearchParams();
  // searchConfiguration
  params.set('searchConfiguration[offset]', '0');
  params.set('searchConfiguration[limit]', '200');
  params.set('searchConfiguration[textSearchOperator]', 'AND');
  // propertyRenderConfiguration — the exact column property names
  properties.forEach((prop, i) => {
    params.set(`propertyRenderConfiguration[${i}]`, prop);
  });
  params.set('__csrfToken', csrf);

  const headers = {
    'User-Agent': UA,
    'Content-Type': 'text/plain;charset=UTF-8',
    Accept: '*/*',
    'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8',
    Origin: VM_BASE,
    Referer: `${VM_BASE}${referer}`,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    Cookie: jar.header(),
  };
  if (wuid) headers['Window-Unique-Id'] = wuid;

  const url = `${VM_BASE}${resourcePath}/search`;
  console.log(`  POST ${url}`);
  console.log(`  Properties: ${properties.join(', ')}`);

  try {
    const r = await fetch(url, { method: 'POST', headers, body: params.toString() });
    const text = await r.text();
    console.log(`  Status: ${r.status}, Length: ${text.length}`);

    if (r.ok && (text.startsWith('{') || text.startsWith('['))) {
      const json = JSON.parse(text);
      console.log(`  Total: ${json.totalItemsCount ?? '?'}, Items: ${json.items?.length ?? '?'}`);
      if (json.items?.[0]) {
        console.log(`  First item keys: ${Object.keys(json.items[0]).join(', ')}`);
        // Print first 3 items
        for (let i = 0; i < Math.min(3, json.items.length); i++) {
          const item = json.items[i];
          console.log(`  [${i}]: ${JSON.stringify(item).slice(0, 500)}`);
        }
      }
      const safeName = label.replace(/[^a-z0-9]/gi, '_');
      writeFileSync(`/tmp/vm_full_${safeName}.json`, JSON.stringify(json, null, 2));
      console.log(`  → Saved to /tmp/vm_full_${safeName}.json`);
      return json;
    } else {
      // Show error details
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      console.log(`  Error: ${titleMatch?.[1]?.trim() || 'unknown'}`);
      console.log(`  Body (200 chars): ${text.replace(/<[^>]+>/g, '').trim().slice(0, 200)}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
  return null;
}

async function main() {
  const { jar, csrf, wuid } = await login();

  // Indoor Writers — from IndoorWriterList.getColumnConfiguration
  const writerProps = [
    'person.associationId',
    'person.lastName',
    'person.firstName',
    'person.birthday',
    'person.gender',
    'person.nationality.countryName',
    'currentLicense.regionalAssociation.shortName',
    'person.correspondenceLanguage',
    'person.primaryEmailAddress.emailAddress',
    'person.primaryPhoneNumber.normalizedLocalNumber',
    'person.primaryPostalAddress.additionToAddress',
    'person.primaryPostalAddress.combinedAddress',
    'person.primaryPostalAddress.postalCode',
    'person.primaryPostalAddress.city',
    'person.primaryPostalAddress.country.countryName',
  ];

  const writers = await apiSearch(jar, csrf, wuid,
    '/api/sportmanager.indoorvolleyball/api%5cindoorwriter',
    'Indoor Writers',
    writerProps,
    '/sportmanager.indoorvolleyball/indoorwriter/index',
  );

  // Club Referees — from ClubRefereeList.getColumnConfiguration
  const refereeProps = [
    'indoorAssociationReferee.indoorReferee.person.associationId',
    'indoorAssociationReferee.indoorReferee.person.firstName',
    'indoorAssociationReferee.indoorReferee.person.lastName',
    'indoorAssociationReferee.indoorReferee.person.primaryEmailAddress.emailAddress',
    'indoorAssociationReferee.indoorReferee.person.primaryPhoneNumber.normalizedLocalNumber',
    'indoorAssociationReferee.managingAssociation.shortName',
    'indoorAssociationReferee.managingAssociation.__identity',
    'indoorAssociationReferee.managingAssociation.identifier',
    'convocationPreferredWorkload.minimumNumberOfGames',
    'convocationPreferredWorkload.maximumNumberOfGames',
    'convocationFreeRangeMaxNumberOfGames',
    'indoorAssociationReferee.indoorReferee.activeSeasonalRefereeData.officiatesForClubs.*.shortName',
    'refereeMandateAllocations.*.allocatedRefereeMandates',
    'refereeMandateAllocations',
    'refereeMandateAllocations.*.club.__identity',
    'indoorAssociationReferee.indoorReferee.activeSeasonalRefereeData.officiatesForClubs.*.name',
    'indoorAssociationReferee.indoorReferee.activeSeasonalRefereeData.officiatesForClubs.*.identifier',
    'indoorAssociationReferee.indoorReferee.activeSeasonalRefereeData.officiatesForClubs.*.regionalAssociation',
  ];

  const referees = await apiSearch(jar, csrf, wuid,
    '/api/sportmanager.indoorvolleyball/api%5cclubreferee',
    'Club Referees',
    refereeProps,
    '/sportmanager.indoorvolleyball/clubreferee/index',
  );

  // Also try indoor players with proper properties (from IndoorPlayerList)
  // Let me also extract those from the bundle
  const playerProps = [
    'person.associationId',
    'person.lastName',
    'person.firstName',
    'person.birthday',
    'person.gender',
    'person.nationality.countryName',
    'currentLicense.licenseCategory.name',
    'currentLicense.regionalAssociation.shortName',
    'person.correspondenceLanguage',
    'person.primaryEmailAddress.emailAddress',
    'person.primaryPhoneNumber.normalizedLocalNumber',
    'person.primaryPostalAddress.combinedAddress',
    'person.primaryPostalAddress.postalCode',
    'person.primaryPostalAddress.city',
  ];

  const players = await apiSearch(jar, csrf, wuid,
    '/api/sportmanager.indoorvolleyball/api%5cindoorplayer',
    'Indoor Players (with properties)',
    playerProps,
    '/sportmanager.indoorvolleyball/indoorplayer/index',
  );

  // Summary
  console.log('\n\n========== SUMMARY ==========');
  if (writers) {
    console.log(`Writers: ${writers.totalItemsCount} total, ${writers.items?.length} fetched`);
    for (const w of (writers.items || []).slice(0, 5)) {
      const p = w.person || {};
      console.log(`  ${p.firstName} ${p.lastName} (ID:${p.associationId}, ${p.gender}, email:${p.primaryEmailAddress?.emailAddress || '-'})`);
    }
  }
  if (referees) {
    console.log(`\nReferees: ${referees.totalItemsCount} total, ${referees.items?.length} fetched`);
    for (const r of (referees.items || []).slice(0, 5)) {
      const iar = r.indoorAssociationReferee || {};
      const ir = iar.indoorReferee || {};
      const p = ir.person || {};
      console.log(`  ${p.firstName} ${p.lastName} (ID:${p.associationId}, assoc:${iar.managingAssociation?.shortName || '-'})`);
    }
  }
  if (players) {
    console.log(`\nPlayers: ${players.totalItemsCount} total, ${players.items?.length} fetched`);
    for (const pl of (players.items || []).slice(0, 5)) {
      const p = pl.person || {};
      const lic = pl.currentLicense || {};
      console.log(`  ${p.firstName} ${p.lastName} (ID:${p.associationId}, license:${lic.licenseCategory?.name || '-'})`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message); console.error(e.stack); });
