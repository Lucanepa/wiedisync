import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kscwApi } from '../lib/api'

// ── Interfaces ─────────────────────────────────────────────────────

export interface BugfixIssue {
  hash: string
  message: string
  count: number
  first_seen: string
  last_seen: string
  level: string
  source: 'frontend' | 'backend'
  fix_status: string | null
  fix_started_at: string | null
  pr_url: string | null
  annotation: { status: string; note: string | null } | null
  expanded: {
    stack: string
    breadcrumbs: string[]
    page: string
    userAgent: string
    user?: { role: string; sport: string }
    status?: number
    collection?: string
    responseBody?: string
  }
}

export interface BugfixJob {
  error_hash: string
  status: 'fixing' | 'pr_ready' | 'deployed_dev' | 'deployed_prod' | 'failed' | 'reverted' | 'dismissed'
  pr_url: string | null
  pr_branch: string | null
  fix_summary: string | null
  public_summary: string | null
  date_created: string
}

export interface PublicStatus {
  date: string
  summary: string
  status: string
}

// ── Raw API response shape ────────────────────────────────────────

interface RawBugfixIssue {
  hash: string
  count: number
  latest_ts: string
  date: string
  level: string
  event: string
  endpoint: string | null
  error: string | null
  stack: string | null
  breadcrumbs: string[] | null
  page: string | null
  userAgent: string | null
  status: number | null
  collection: string | null
  responseBody: string | null
  job: {
    status: string
    pr_number: number | null
    pr_url: string | null
    fix_summary: string | null
    public_summary: string | null
    date_created: string
  } | null
  annotation: { status: string; note: string | null; resolved_commit: string | null } | null
}

function mapIssue(raw: RawBugfixIssue): BugfixIssue {
  return {
    hash: raw.hash,
    message: raw.error || raw.event || 'Unknown error',
    count: raw.count,
    first_seen: raw.date, // date of the JSONL log file
    last_seen: raw.latest_ts,
    level: raw.level,
    source: raw.endpoint ? 'backend' : 'frontend',
    fix_status: raw.job?.status ?? null,
    fix_started_at: raw.job?.date_created ?? null,
    pr_url: raw.job?.pr_url ?? null,
    annotation: raw.annotation ? { status: raw.annotation.status, note: raw.annotation.note } : null,
    expanded: {
      stack: raw.stack ?? '',
      breadcrumbs: raw.breadcrumbs ?? [],
      page: raw.page ?? '',
      userAgent: raw.userAgent ?? '',
      user: undefined,
      status: raw.status ?? undefined,
      collection: raw.collection ?? undefined,
      responseBody: raw.responseBody ?? undefined,
    },
  }
}

// ── Hooks ──────────────────────────────────────────────────────────

export function useBugfixIssues() {
  return useQuery({
    queryKey: ['bugfixes', 'issues'],
    queryFn: async () => {
      const res = await kscwApi<{ data: RawBugfixIssue[] }>('/bugfixes/issues')
      return res.data.map(mapIssue)
    },
  })
}

export function useBugfixStatus(hash: string | null, startedAt: string | null) {
  return useQuery({
    queryKey: ['bugfixes', 'status', hash],
    queryFn: async () => {
      const res = await kscwApi<{ data: BugfixJob }>(`/bugfixes/status/${hash}`)
      return res.data
    },
    enabled: !!hash,
    refetchInterval: () => {
      if (!startedAt) return false
      const elapsed = Date.now() - new Date(startedAt).getTime()
      if (elapsed < 2 * 60_000) return 15_000 // first 2 min: 15s
      if (elapsed < 12 * 60_000) return 30_000 // 2-12 min: 30s
      return false // stop after 12 min
    },
  })
}

export function useTriggerFix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (error_hash: string) =>
      kscwApi('/bugfixes/fix', { method: 'POST', body: { error_hash } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bugfixes'] }),
  })
}

export function useDeployFix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hash, target }: { hash: string; target: string }) =>
      kscwApi(`/bugfixes/deploy/${hash}`, { method: 'POST', body: { target } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bugfixes'] }),
  })
}

export function useDismissFix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hash: string) =>
      kscwApi(`/bugfixes/dismiss/${hash}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bugfixes'] }),
  })
}

export function useReopenFix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hash: string) =>
      kscwApi(`/bugfixes/reopen/${hash}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bugfixes'] }),
  })
}

export function usePublicStatus() {
  return useQuery({
    queryKey: ['bugfixes', 'public'],
    queryFn: () => kscwApi<{ data: PublicStatus[] }>('/bugfixes/public'),
    staleTime: 5 * 60_000,
  })
}
