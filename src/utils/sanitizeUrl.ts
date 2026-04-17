/**
 * Sanitize a URL to prevent javascript: protocol XSS attacks.
 * Returns the URL if it uses http: or https:, empty string otherwise.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url
  } catch {
    /* invalid URL */
  }
  return ''
}

/**
 * Allow http(s) absolute URLs and same-origin relative paths starting with "/".
 * Rejects javascript:, data:, vbscript:, mailto:, etc.
 */
export function isSafeAppLink(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
