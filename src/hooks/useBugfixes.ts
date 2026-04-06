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
  status: 'fixing' | 'pr_ready' | 'deployed_dev' | 'deployed_prod' | 'failed' | 'reverted'
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

// ── Hooks ──────────────────────────────────────────────────────────

export function useBugfixIssues() {
  return useQuery({
    queryKey: ['bugfixes', 'issues'],
    queryFn: async () => {
      const res = await kscwApi<{ data: BugfixIssue[] }>('/bugfixes/issues')
      return res.data
    },
  })
}

export function useBugfixStatus(hash: string | null, startedAt: string | null) {
  return useQuery({
    queryKey: ['bugfixes', 'status', hash],
    queryFn: () => kscwApi<BugfixJob>(`/bugfixes/status/${hash}`),
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

export function usePublicStatus() {
  return useQuery({
    queryKey: ['bugfixes', 'public'],
    queryFn: () => kscwApi<{ data: PublicStatus[] }>('/bugfixes/public'),
  })
}
