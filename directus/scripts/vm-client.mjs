/**
 * Volleymanager Auth Client
 *
 * Shared authentication primitives for volleymanager.volleyball.ch.
 * Pure module — reads no env vars; callers pass credentials explicitly.
 */

export const VM_BASE = 'https://volleymanager.volleyball.ch';
export const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

// ─── Cookie jar ──────────────────────────────────────────────────────
export class CookieJar {
  constructor() { this.cookies = {}; }
  update(r) {
    for (const h of r.headers.getSetCookie?.() ?? []) {
      const m = h.match(/^([^=]+)=([^;]*)/);
      if (m) this.cookies[m[1]] = m[2];
    }
  }
  set(n, v) { this.cookies[n] = v; }
  header() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); }
}

// ─── HTTP helpers ────────────────────────────────────────────────────
export async function follow(url, jar, init = {}, max = 10) {
  let u = url, opts = init;
  for (let i = 0; i < max; i++) {
    const r = await fetch(u, {
      ...opts,
      headers: { 'User-Agent': UA, Cookie: jar.header(), ...(opts.headers ?? {}) },
      redirect: 'manual',
    });
    jar.update(r);
    const body = await r.text();
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400 && loc) {
      u = loc.startsWith('http') ? loc : `${VM_BASE}${loc}`;
      opts = {};
      continue;
    }
    return { response: r, body };
  }
  throw new Error(`Too many redirects: ${url}`);
}

// ─── Auth ────────────────────────────────────────────────────────────
export async function vmLogin({ username, password }) {
  if (!username || !password) throw new Error('vmLogin: username and password are required');

  const jar = new CookieJar();
  jar.set('language', 'de');

  // 1. Login page → hidden fields
  const { body: html } = await follow(`${VM_BASE}/login`, jar);
  const fields = {};
  for (const m of html.matchAll(/name="([^"]+)"[^>]*value="([^"]*?)"/g))
    fields[m[1]] = m[2];
  fields['__authentication[Neos][Flow][Security][Authentication][Token][UsernamePassword][username]'] = username;
  fields['__authentication[Neos][Flow][Security][Authentication][Token][UsernamePassword][password]'] = password;

  // 2. POST credentials
  await follow(`${VM_BASE}/sportmanager.security/authentication/authenticate`, jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

  // 3. Dashboard (sets session permissions)
  await follow(`${VM_BASE}/`, jar);

  // 4. Enter the volleyball sub-app context. Without this step every indoor
  // page except /sportmanager.indoorvolleyball/game/index returns 403 — the
  // session is authenticated but has no sub-app scope. Discovered 2026-05-03.
  await follow(`${VM_BASE}/sportmanager.volleyball/main/dashboard`, jar);

  return jar;
}

// ─── CSRF extraction ─────────────────────────────────────────────────
export async function csrfFromPage(jar, pagePath) {
  const { response, body } = await follow(
    `${VM_BASE}${pagePath}`,
    jar,
    { headers: { Accept: 'text/html', Referer: `${VM_BASE}/` } },
  );
  if (!response.ok) throw new Error(`csrfFromPage ${pagePath} → HTTP ${response.status}`);
  const csrf = body.match(/data-csrf-token="([^"]+)"/)?.[1];
  const wuid = body.match(/data-window-unique-id="([^"]+)"/)?.[1] || '';
  if (!csrf) throw new Error(`CSRF token extraction failed for ${pagePath}`);
  return { csrf, wuid };
}
