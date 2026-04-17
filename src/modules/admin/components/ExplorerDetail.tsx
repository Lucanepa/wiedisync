// src/modules/admin/components/ExplorerDetail.tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { API_URL } from '../../../lib/api'
import type { BucketKey, CacheShape } from './explorerHelpers'
import {
  memberLabel, teamLabel, eventLabel, trainingLabel, gameLabel,
  formatShortDate, formatShortDateTime,
} from './explorerHelpers'
import ExplorerSectionCard from './ExplorerSectionCard'
import EntityLink from './EntityLink'
import { useRelatedEntities, type SectionKey } from '../hooks/useRelatedEntities'

interface Props {
  cache: CacheShape
  type: BucketKey | null
  id: string | null
  onSelect: (type: BucketKey, id: string) => void
  onBack?: () => void
}

export default function ExplorerDetail({ cache, type, id, onSelect, onBack }: Props) {
  const onNavigate = onSelect
  const { t } = useTranslation('admin')
  const related = useRelatedEntities()

  const entity = useMemo(() => {
    if (!type || !id) return null
    switch (type) {
      case 'members': return cache.members.find((m) => String(m.id) === id) ?? null
      case 'teams': return cache.teams.find((tm) => String(tm.id) === id) ?? null
      case 'events': return cache.events.find((e) => String(e.id) === id) ?? null
      case 'trainings': return cache.trainings.find((tr) => String(tr.id) === id) ?? null
      case 'games': return cache.games.find((g) => String(g.id) === id) ?? null
    }
  }, [cache, type, id])

  if (!type || !id || !entity) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-muted-foreground">
        {t('explorerEmptyState')}
      </div>
    )
  }

  const directusUrl = `${API_URL}/admin/content/${type}/${id}`
  const title = titleFor(type, entity, cache)

  return (
    <div className="h-full overflow-y-auto px-4 py-3 md:px-6 md:py-4">
      {/* Mobile back */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
        >
          ← {t('explorerBackToTree')}
        </button>
      )}

      {/* Title + directus link */}
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{type} · #{id}</span>
        <a
          href={directusUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          {t('explorerOpenInDirectus')}
        </a>
      </div>

      {/* Fields + sections per type */}
      {type === 'members' && renderMember(entity as never, cache, onNavigate, related, t)}
      {type === 'teams' && renderTeam(entity as never, cache, onNavigate, t)}
      {type === 'events' && renderEvent(entity as never, cache, onNavigate, related, t)}
      {type === 'trainings' && renderTraining(entity as never, cache, onNavigate, related, t)}
      {type === 'games' && renderGame(entity as never, cache, onNavigate, related, t)}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-foreground">{children}</span>
    </div>
  )
}

function titleFor(type: BucketKey, entity: Record<string, unknown>, cache: CacheShape): string {
  const teamName = (tid: string) => cache.teams.find((tm) => String(tm.id) === tid)?.name ?? tid
  switch (type) {
    case 'members': return memberLabel(entity as never)
    case 'teams': return teamLabel(entity as never)
    case 'events': return eventLabel(entity as never)
    case 'trainings': return trainingLabel(entity as never, teamName)
    case 'games': return gameLabel(entity as never, teamName)
  }
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

/**
 * Render a single participation row.
 * - showMember=true: renders member name (linked) + status
 * - showActivity=true: renders activity label (linked) + status
 */
function renderParticipationRow(
  p: { id?: string | number; member?: unknown; activity_type?: string; activity_id?: unknown; status?: string },
  cache: CacheShape,
  onNavigate: (type: BucketKey, id: string) => void,
  mode: 'showMember' | 'showActivity',
) {
  const key = p.id ?? Math.random()

  if (mode === 'showMember') {
    const memberId = String(p.member ?? '')
    const member = cache.members.find((m) => String(m.id) === memberId)
    const label = member ? memberLabel(member) : `#${memberId}`
    return (
      <li key={key} className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs">
        <EntityLink type="members" id={memberId} label={label} onClick={onNavigate} />
        <span className="text-muted-foreground">· {p.status ?? '?'}</span>
      </li>
    )
  }

  // showActivity
  const rawType = String(p.activity_type ?? '')
  const bucketType = (rawType + 's') as BucketKey
  const activityId = String(p.activity_id ?? '')
  const teamName = (tid: string) => cache.teams.find((tm) => String(tm.id) === tid)?.name ?? tid

  let activityLabel = `#${activityId}`
  if (bucketType === 'events') {
    const ev = cache.events.find((e) => String(e.id) === activityId)
    if (ev) activityLabel = eventLabel(ev)
  } else if (bucketType === 'trainings') {
    const tr = cache.trainings.find((tr) => String(tr.id) === activityId)
    if (tr) activityLabel = trainingLabel(tr, teamName)
  } else if (bucketType === 'games') {
    const g = cache.games.find((g) => String(g.id) === activityId)
    if (g) activityLabel = gameLabel(g, teamName)
  }

  const validBucket: BucketKey[] = ['members', 'teams', 'events', 'trainings', 'games']
  if (!validBucket.includes(bucketType)) {
    return (
      <li key={key} className="rounded border border-border bg-background px-2 py-1 font-mono text-[11px]">
        {JSON.stringify(p)}
      </li>
    )
  }

  return (
    <li key={key} className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs">
      <EntityLink type={bucketType} id={activityId} label={activityLabel} onClick={onNavigate} />
      <span className="text-muted-foreground">· {p.status ?? '?'}</span>
    </li>
  )
}

// ── Member ────────────────────────────────────────────────────────────
function renderMember(
  m: Record<string, unknown> & { id: string | number },
  cache: CacheShape,
  onNavigate: Props['onSelect'],
  related: ReturnType<typeof useRelatedEntities>,
  t: TFn,
) {
  const teamIds = cache.memberTeams.get(String(m.id)) ?? []
  const memberTeams = teamIds
    .map((tid) => cache.teams.find((x) => String(x.id) === tid) ?? null)
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const memberSections: SectionKey[] = ['participations', 'absences', 'schreibereinsaetze', 'refereeExpenses']
  const sectionLabelKey: Record<SectionKey, string> = {
    participations: 'explorerSectionParticipations',
    absences: 'explorerSectionAbsences',
    schreibereinsaetze: 'explorerSectionSchreibereinsaetze',
    refereeExpenses: 'explorerSectionRefereeExpenses',
    scorerDelegations: 'explorerSectionScorerDelegations',
  }

  return (
    <>
      <div className="mb-4">
        <Field label={t('explorerFieldEmail')}>{String(m.email ?? '—')}</Field>
        <Field label={t('explorerFieldSex')}>{String(m.sex ?? '—')}</Field>
        <Field label={t('explorerFieldRole')}>{Array.isArray(m.role) ? (m.role as string[]).join(', ') : '—'}</Field>
        <Field label={t('explorerFieldActive')}>{m.kscw_membership_active ? '✓' : '—'}</Field>
      </div>

      <ExplorerSectionCard title={t('explorerSectionTeams')} count={memberTeams.length} lazy={false}>
        <div className="flex flex-wrap gap-1">
          {memberTeams.map((tm) => (
            <EntityLink key={tm.id} type="teams" id={String(tm.id)} label={teamLabel(tm)} onClick={onNavigate} />
          ))}
        </div>
      </ExplorerSectionCard>

      {memberSections.map((s) => {
        const state = related.get('members', String(m.id), s)
        return (
          <ExplorerSectionCard
            key={s}
            title={t(sectionLabelKey[s])}
            count={state?.data.length ?? null}
            onExpand={() => related.load('members', String(m.id), s)}
            isLoading={state?.loading}
            error={state?.error}
          >
            <ul className="space-y-1 text-xs">
              {s === 'participations'
                ? (state?.data ?? []).map((row, idx) => {
                    const r = row as { id?: string | number; member?: unknown; activity_type?: string; activity_id?: unknown; status?: string }
                    return renderParticipationRow({ ...r, id: r.id ?? idx }, cache, onNavigate, 'showActivity')
                  })
                : (state?.data ?? []).map((row, idx) => {
                    const r = row as { id?: string | number }
                    return (
                      <li key={r.id ?? idx} className="rounded border border-border bg-background px-2 py-1 font-mono text-[11px]">
                        {JSON.stringify(row)}
                      </li>
                    )
                  })}
            </ul>
          </ExplorerSectionCard>
        )
      })}
    </>
  )
}

// ── Team ──────────────────────────────────────────────────────────────
function renderTeam(
  tm: Record<string, unknown> & { id: string | number },
  cache: CacheShape,
  onNavigate: Props['onSelect'],
  t: TFn,
) {
  const tmId = String(tm.id)
  const members = cache.members.filter((m) =>
    (cache.memberTeams.get(String(m.id)) ?? []).includes(tmId),
  )
  const trainings = cache.trainings.filter((tr) => String((tr as unknown as { team?: unknown }).team) === String(tm.id))
  const games = cache.games.filter((g) =>
    String((g as unknown as { home_team?: unknown }).home_team) === String(tm.id) ||
    String((g as unknown as { away_team?: unknown }).away_team) === String(tm.id),
  )

  const teamName = (tid: string) => cache.teams.find((x) => String(x.id) === tid)?.name ?? tid

  return (
    <>
      <div className="mb-4">
        <Field label={t('explorerFieldSport')}>{String(tm.sport ?? '—')}</Field>
        <Field label={t('explorerFieldSeason')}>{String(tm.season ?? '—')}</Field>
        <Field label={t('explorerFieldActive')}>{tm.active ? '✓' : '—'}</Field>
      </div>

      <ExplorerSectionCard title={t('explorerSectionMembers')} count={members.length} lazy={false}>
        <div className="flex flex-wrap gap-1">
          {members.map((m) => (
            <EntityLink key={m.id} type="members" id={String(m.id)} label={memberLabel(m)} onClick={onNavigate} />
          ))}
        </div>
      </ExplorerSectionCard>

      <ExplorerSectionCard title={t('explorerBucketTrainings')} count={trainings.length} lazy={false}>
        <ul className="space-y-1 text-xs">
          {trainings.slice(0, 50).map((tr) => {
            const trAny = tr as unknown as { id: string | number; date?: string; start_time?: string }
            const label = `${formatShortDate(trAny.date ?? '')} ${(trAny.start_time ?? '').slice(0, 5)}`.trim()
            return (
              <li key={trAny.id}>
                <EntityLink
                  type="trainings"
                  id={String(trAny.id)}
                  label={label || trainingLabel(tr as never, teamName)}
                  onClick={onNavigate}
                />
              </li>
            )
          })}
        </ul>
      </ExplorerSectionCard>

      <ExplorerSectionCard title={t('explorerBucketGames')} count={games.length} lazy={false}>
        <ul className="space-y-1 text-xs">
          {games.slice(0, 50).map((g) => {
            const gAny = g as unknown as { id: string | number }
            return (
              <li key={gAny.id}>
                <EntityLink
                  type="games"
                  id={String(gAny.id)}
                  label={gameLabel(g as never, teamName)}
                  onClick={onNavigate}
                />
              </li>
            )
          })}
        </ul>
      </ExplorerSectionCard>
    </>
  )
}

/** Group participation rows by status. */
function byStatus(rows: unknown[]): Record<string, unknown[]> {
  const g: Record<string, unknown[]> = { confirmed: [], declined: [], tentative: [], waitlisted: [] }
  rows.forEach((r) => {
    const status = (r as { status?: string }).status ?? 'other'
    ;(g[status] ??= []).push(r)
  })
  return g
}

/** Render grouped participation rows (for events, trainings, games). */
function renderGroupedParticipations(
  rows: unknown[],
  cache: CacheShape,
  onNavigate: (type: BucketKey, id: string) => void,
  t: TFn,
) {
  const groups = byStatus(rows)
  const ORDER = ['confirmed', 'declined', 'tentative', 'waitlisted', 'other']
  return (
    <>
      {ORDER.map((status) => {
        const statusRows = groups[status] ?? []
        if (statusRows.length === 0) return null
        return (
          <div key={status} className="mb-2">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
              {t(`explorerStatus_${status}`)} · {statusRows.length}
            </div>
            <ul className="space-y-1 text-xs">
              {statusRows.map((row, idx) => {
                const r = row as { id?: string | number; member?: unknown; activity_type?: string; activity_id?: unknown; status?: string }
                return renderParticipationRow({ ...r, id: r.id ?? idx }, cache, onNavigate, 'showMember')
              })}
            </ul>
          </div>
        )
      })}
    </>
  )
}

// ── Event ─────────────────────────────────────────────────────────────
function renderEvent(
  e: Record<string, unknown> & { id: string | number },
  cache: CacheShape,
  onNavigate: Props['onSelect'],
  related: ReturnType<typeof useRelatedEntities>,
  t: TFn,
) {
  const state = related.get('events', String(e.id), 'participations')
  return (
    <>
      <div className="mb-4">
        <Field label={t('explorerFieldStartDate')}>{formatShortDateTime(e.start_date as string | null) || '—'}</Field>
        <Field label={t('explorerFieldEndDate')}>{formatShortDateTime(e.end_date as string | null) || '—'}</Field>
        <Field label={t('explorerFieldEventType')}>{String(e.event_type ?? '—')}</Field>
        <Field label={t('explorerFieldParticipationMode')}>{String(e.participation_mode ?? '—')}</Field>
      </div>
      <ExplorerSectionCard
        title={t('explorerSectionParticipations')}
        count={state?.data.length ?? null}
        onExpand={() => related.load('events', String(e.id), 'participations')}
        isLoading={state?.loading}
        error={state?.error}
      >
        {renderGroupedParticipations(state?.data ?? [], cache, onNavigate, t)}
      </ExplorerSectionCard>
    </>
  )
}

// ── Training ──────────────────────────────────────────────────────────
function renderTraining(
  tr: Record<string, unknown> & { id: string | number },
  cache: CacheShape,
  onNavigate: Props['onSelect'],
  related: ReturnType<typeof useRelatedEntities>,
  t: TFn,
) {
  const team = cache.teams.find((tm) => String(tm.id) === String(tr.team))
  const sectionKeys: SectionKey[] = ['participations', 'schreibereinsaetze']
  const sectionLabelKey: Record<SectionKey, string> = {
    participations: 'explorerSectionParticipations',
    absences: 'explorerSectionAbsences',
    schreibereinsaetze: 'explorerSectionSchreibereinsaetze',
    refereeExpenses: 'explorerSectionRefereeExpenses',
    scorerDelegations: 'explorerSectionScorerDelegations',
  }

  return (
    <>
      <div className="mb-4">
        {team && (
          <Field label={t('explorerFieldTeam')}>
            <EntityLink type="teams" id={String(team.id)} label={teamLabel(team)} onClick={onNavigate} />
          </Field>
        )}
        <Field label={t('explorerFieldDate')}>{formatShortDate(tr.date as string | null) || '—'}</Field>
        <Field label={t('explorerFieldTime')}>{`${(String(tr.start_time ?? '')).slice(0, 5)} – ${(String(tr.end_time ?? '')).slice(0, 5)}`}</Field>
        <Field label={t('explorerFieldHall')}>{String(tr.hall ?? '—')}</Field>
      </div>
      {sectionKeys.map((s) => {
        const state = related.get('trainings', String(tr.id), s)
        return (
          <ExplorerSectionCard
            key={s}
            title={t(sectionLabelKey[s])}
            count={state?.data.length ?? null}
            onExpand={() => related.load('trainings', String(tr.id), s)}
            isLoading={state?.loading}
            error={state?.error}
          >
            {s === 'participations'
              ? renderGroupedParticipations(state?.data ?? [], cache, onNavigate, t)
              : (
                <ul className="space-y-1 text-xs">
                  {(state?.data ?? []).map((row, idx) => {
                    const r = row as { id?: string | number }
                    return (
                      <li key={r.id ?? idx} className="rounded border border-border bg-background px-2 py-1 font-mono text-[11px]">
                        {JSON.stringify(row)}
                      </li>
                    )
                  })}
                </ul>
              )}
          </ExplorerSectionCard>
        )
      })}
    </>
  )
}

// ── Game ──────────────────────────────────────────────────────────────
function renderGame(
  g: Record<string, unknown> & { id: string | number },
  cache: CacheShape,
  onNavigate: Props['onSelect'],
  related: ReturnType<typeof useRelatedEntities>,
  t: TFn,
) {
  const home = cache.teams.find((tm) => String(tm.id) === String(g.home_team))
  const away = cache.teams.find((tm) => String(tm.id) === String(g.away_team))
  const sectionKeys: SectionKey[] = ['participations', 'schreibereinsaetze', 'scorerDelegations']
  const sectionLabelKey: Record<SectionKey, string> = {
    participations: 'explorerSectionParticipations',
    absences: 'explorerSectionAbsences',
    schreibereinsaetze: 'explorerSectionSchreibereinsaetze',
    refereeExpenses: 'explorerSectionRefereeExpenses',
    scorerDelegations: 'explorerSectionScorerDelegations',
  }

  return (
    <>
      <div className="mb-4">
        <Field label={t('explorerFieldHomeTeam')}>
          {home ? <EntityLink type="teams" id={String(home.id)} label={teamLabel(home)} onClick={onNavigate} /> : `#${String(g.home_team)}`}
        </Field>
        <Field label={t('explorerFieldAwayTeam')}>
          {away ? <EntityLink type="teams" id={String(away.id)} label={teamLabel(away)} onClick={onNavigate} /> : `#${String(g.away_team)}`}
        </Field>
        <Field label={t('explorerFieldDate')}>{formatShortDate(g.date as string | null) || '—'}</Field>
        <Field label={t('explorerFieldTime')}>{String(g.time ?? '—')}</Field>
        <Field label={t('explorerFieldHall')}>{String(g.hall ?? '—')}</Field>
        <Field label={t('explorerFieldResult')}>
          {`${String(g.home_score ?? '-')} : ${String(g.away_score ?? '-')}`}
        </Field>
      </div>
      {sectionKeys.map((s) => {
        const state = related.get('games', String(g.id), s)
        return (
          <ExplorerSectionCard
            key={s}
            title={t(sectionLabelKey[s])}
            count={state?.data.length ?? null}
            onExpand={() => related.load('games', String(g.id), s)}
            isLoading={state?.loading}
            error={state?.error}
          >
            {s === 'participations'
              ? renderGroupedParticipations(state?.data ?? [], cache, onNavigate, t)
              : (
                <ul className="space-y-1 text-xs">
                  {(state?.data ?? []).map((row, idx) => {
                    const r = row as { id?: string | number }
                    return (
                      <li key={r.id ?? idx} className="rounded border border-border bg-background px-2 py-1 font-mono text-[11px]">
                        {JSON.stringify(row)}
                      </li>
                    )
                  })}
                </ul>
              )}
          </ExplorerSectionCard>
        )
      })}
    </>
  )
}
