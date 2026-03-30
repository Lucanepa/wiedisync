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
      const body = await request.text()
      // Sentry envelope: first line is JSON header with dsn
      const header = body.split('\n')[0]
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
        body,
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
  const isAllowed = origin === allowed || origin.endsWith('.pages.dev')
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}
