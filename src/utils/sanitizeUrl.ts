/**
 * Sanitize a URL to prevent javascript: protocol XSS attacks.
 * Returns the URL only if it uses https:, empty string otherwise.
 *
 * 2026-05-12 audit #16: rejects http: (HSTS downgrade for admin-entered URLs).
 * App is served over HTTPS-only on prod + dev (CF Pages enforces); accepting
 * plain http: for outbound links surprises users who expect every link they
 * click to honor the same transport guarantees.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return url
  } catch {
    /* invalid URL */
  }
  return ''
}

/**
 * Allow https absolute URLs and same-origin relative paths starting with "/".
 * Rejects http:, javascript:, data:, vbscript:, mailto:, etc.
 */
export function isSafeAppLink(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
