import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { InfraHealth } from '../../../hooks/useInfraHealth'
import { countItems } from '../../../lib/api'

interface KpiData {
  totalMembers: number
  newMembersThisMonth: number
  totalTeams: number
  vbTeams: number
  bbTeams: number
  pendingApprovals: number
}

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white/10 p-3 animate-pulse">
      <div className="h-3 bg-white/20 rounded w-16 mb-2" />
      <div className="h-7 bg-white/20 rounded w-10 mb-1" />
      <div className="h-3 bg-white/15 rounded w-20" />
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  highlight?: boolean
  highlightColor?: 'gold' | 'red' | 'amber'
  icon?: string
}

function KpiCard({ label, value, subtitle, highlight, highlightColor = 'gold', icon }: KpiCardProps) {
  const highlightClasses = {
    gold: 'bg-gold-500/30 ring-1 ring-gold-400',
    red: 'bg-red-500/20 ring-1 ring-red-400',
    amber: 'bg-amber-500/20 ring-1 ring-amber-400',
  }

  return (
    <div
      className={`rounded-xl p-3 transition-colors ${
        highlight ? highlightClasses[highlightColor] : 'bg-white/10 hover:bg-white/15'
      }`}
    >
      <p className="text-xs font-medium text-white/70 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white leading-none">
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-white/60 mt-1 truncate">{subtitle}</p>
      )}
    </div>
  )
}

export default function KpiStrip({ infraHealth: infra }: { infraHealth: InfraHealth }) {
  const { t } = useTranslation('admin')
  const [data, setData] = useState<KpiData | null>(null)

  // Fetch KPI counts once on mount — empty deps to avoid re-fetch loop
  useEffect(() => {
    async function fetchKpis() {
      try {
        const now = new Date()
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01 00:00:00`

        const [totalMembers, newMembersThisMonth, totalTeams, vbTeams, bbTeams, pendingApprovals] =
          await Promise.all([
            countItems('members'),
            countItems('members', { date_created: { _gte: firstOfMonth } }),
            countItems('teams'),
            countItems('teams', { sport: { _eq: 'volleyball' } }),
            countItems('teams', { sport: { _eq: 'basketball' } }),
            countItems('members', { _and: [{ coach_approved_team: { _eq: false } }, { requested_team: { _nnull: true } }] }),
          ])

        setData({
          totalMembers,
          newMembersThisMonth,
          totalTeams,
          vbTeams,
          bbTeams,
          pendingApprovals,
        })
      } catch {
        // Silently fail — KPI strip is non-critical
      }
    }

    fetchKpis()
  }, []) // empty deps — intentional single fetch on mount

  // Derive health/sync status from hook (no useEffect needed, no re-fetch loop)
  const apiHealthy = infra.services.some(s => s.name === 'Directus' && s.status === 'ok')
  const syncStale = infra.syncs.some(s => s.isStale)

  const isLoading = data === null

  return (
    <div className="sticky top-0 z-20 bg-gradient-to-r from-brand-600 to-brand-700 shadow-md">
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              {/* 1. Total members */}
              <KpiCard
                label={t('kpiMembers')}
                value={data.totalMembers}
                subtitle={
                  data.newMembersThisMonth > 0
                    ? t('kpiThisMonth', { count: data.newMembersThisMonth })
                    : undefined
                }
              />

              {/* 2. Total teams */}
              <KpiCard
                label={t('kpiTeams')}
                value={data.totalTeams}
                subtitle={`${t('kpiVb')} ${data.vbTeams} · ${t('kpiBb')} ${data.bbTeams}`}
              />

              {/* 3. Pending approvals */}
              <KpiCard
                label={t('kpiPending')}
                value={data.pendingApprovals}
                highlight={data.pendingApprovals > 0}
                highlightColor="gold"
              />

              {/* 4. API health */}
              <KpiCard
                label={t('kpiHealth')}
                value={apiHealthy ? t('kpiOk') : '✗'}
                icon={apiHealthy ? '✓' : undefined}
                subtitle={apiHealthy ? 'API' : 'API down'}
                highlight={!apiHealthy}
                highlightColor="red"
              />

              {/* 5. Sync status */}
              <KpiCard
                label={t('kpiSync')}
                value={syncStale ? '!' : t('kpiOk')}
                icon={syncStale ? undefined : '✓'}
                subtitle={syncStale ? t('kpiStale') : undefined}
                highlight={syncStale}
                highlightColor="amber"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
