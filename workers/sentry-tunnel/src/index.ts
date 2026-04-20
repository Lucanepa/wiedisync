/**
 * Sentry Tunnel — Cloudflare Worker
 *
 * Proxies Sentry envelope requests through our own domain
 * so ad blockers don't block them.
 *
 * Frontend sends to: https://sentry-tunnel.kscw.ch/tunnel
 * Worker forwards to: https://o4511121927766016.ingest.de.sentry.io
 */

interface Env {
  SENTRY_HOST: string
  SENTRY_PROJECT_ID: string
  ALLOWED_ORIGIN: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin, env.ALLOWED_ORIGIN),
      })
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response('ok')
    }

    // Only accept POST to /tunnel
    if (url.pathname !== '/tunnel' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 })
    }

    // Each failure path returns a distinct `Bad envelope: <reason>` so
    // `wrangler tail` shows exactly which branch killed a request.
    let bodyText = ''
    try {
      const contentEncoding = request.headers.get('Content-Encoding') || ''
      let rawBody: ArrayBuffer | string

      if (contentEncoding.includes('gzip')) {
        try {
          const decompressed = new DecompressionStream('gzip')
          const reader = request.body!.pipeThrough(decompressed).getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
          const merged = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0))
          let offset = 0
          for (const c of chunks) { merged.set(c, offset); offset += c.length }
          bodyText = new TextDecoder().decode(merged)
          rawBody = bodyText
        } catch (e) {
          console.error('[sentry-tunnel] gzip-decode-failed:', e instanceof Error ? e.message : String(e))
          return new Response('Bad envelope: gzip-decode-failed', { status: 400 })
        }
      } else {
        bodyText = await request.text()
        rawBody = bodyText
      }

      if (!bodyText) {
        return new Response('Bad envelope: empty-body', { status: 400 })
      }

      // Sentry envelope: first line is JSON header with dsn
      const header = bodyText.split('\n')[0] ?? ''
      let parsed: { dsn?: unknown }
      try {
        parsed = JSON.parse(header)
      } catch (e) {
        console.error('[sentry-tunnel] header-json-invalid:', e instanceof Error ? e.message : String(e), '| header:', header.slice(0, 200))
        return new Response('Bad envelope: header-json-invalid', { status: 400 })
      }
      const dsn = parsed.dsn
      if (typeof dsn !== 'string' || !dsn) {
        console.error('[sentry-tunnel] no-dsn | header:', header.slice(0, 200))
        return new Response('Bad envelope: no-dsn', { status: 400 })
      }

      let dsnUrl: URL
      try {
        dsnUrl = new URL(dsn)
      } catch {
        console.error('[sentry-tunnel] invalid-dsn-url | dsn:', dsn.slice(0, 200))
        return new Response('Bad envelope: invalid-dsn-url', { status: 400 })
      }

      // Validate: only allow our project
      if (dsnUrl.hostname !== env.SENTRY_HOST || !dsnUrl.pathname.includes(env.SENTRY_PROJECT_ID)) {
        return new Response('Invalid DSN', { status: 403 })
      }

      const sentryUrl = `https://${env.SENTRY_HOST}/api/${env.SENTRY_PROJECT_ID}/envelope/`

      const resp = await fetch(sentryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
        body: rawBody,
      })

      return new Response(resp.body, {
        status: resp.status,
        headers: {
          ...corsHeaders(origin, env.ALLOWED_ORIGIN),
          'Content-Type': 'application/json',
        },
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.error('[sentry-tunnel] unexpected:', reason, '| body snippet:', bodyText.slice(0, 200))
      return new Response(`Bad envelope: unexpected (${reason})`, { status: 400 })
    }
  },
}

function corsHeaders(origin: string, allowed: string): Record<string, string> {
  // Only allow exact prod domain, main preview, and Cloudflare Pages preview deploys (commit-hash.wiedisync.pages.dev)
  const isAllowed = origin === allowed || origin === 'https://wiedisync.pages.dev' || /^https:\/\/[a-f0-9]+\.wiedisync\.pages\.dev$/.test(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}
