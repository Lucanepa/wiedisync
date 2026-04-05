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

    try {
      // Session Replay may send gzip-compressed envelopes
      const contentEncoding = request.headers.get('Content-Encoding') || ''
      let bodyText: string
      let rawBody: ArrayBuffer | string

      if (contentEncoding.includes('gzip')) {
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
      } else {
        bodyText = await request.text()
        rawBody = bodyText
      }

      // Sentry envelope: first line is JSON header with dsn
      const header = bodyText.split('\n')[0]
      const { dsn } = JSON.parse(header)
      const dsnUrl = new URL(dsn)

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
    } catch {
      return new Response('Bad envelope', { status: 400 })
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
