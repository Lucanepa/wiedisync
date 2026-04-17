// src/modules/admin/components/ExplorerDetail.tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { API_URL } from '../../../lib/api'
import type { BucketKey, CacheShape } from './explorerHelpers'
import {
  memberLabel, teamLabel, eventLabel, trainingLabel, gameLabel,
} from './explorerHelpers'
import ExplorerSectionCard from './ExplorerSectionCard'
import EntityLink from './EntityLink'
import { useRelatedEntities, type SectionKey } from '../hooks/useRelatedEntities'

interface Props {
  cache: CacheShape
  type: BucketKey | null
  id: string | null
  navStack: Array<{ t: BucketKey; id: string }>
  onSelect: (type: BucketKey, id: string) => void
  onBack?: () => void
}

export default function ExplorerDetail({ cache, type, id, navStack, onSelect, onBack }: Props) {
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

      {/* Breadcrumb */}
      {navStack.length > 1 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {navStack.map((seg, i) => {
            const isLast = i === navStack.length - 1
            const label = crumbLabel(seg.t, seg.id, cache)
            return (
              <span key={`${seg.t}-${seg.id}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="opacity-50">›</span>}
                {isLast ? (
                  <strong className="text-foreground">{label}</strong>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(seg.t, seg.id)}
                    className="underline-offset-2 hover:underline"
                  >
                    {label}
                  </button>
                )}
              </span>
            )
          })}
        </nav>
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
      {type === 'members' && renderMember(entity as never, cache, onSelect, related, t)}
      {type === 'teams' && renderTeam(entity as never, cache, onSelect, t)}
      {type === 'events' && renderEvent(entity as never, cache, onSelect, related, t)}
      {type === 'trainings' && renderTraining(entity as never, cache, onSelect, related, t)}
      {type === 'games' && renderGame(entity as never, cache, onSelect, related, t)}
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

function crumbLabel(t: BucketKey, id: string, cache: CacheShape): string {
  const arr = cache[t] as Array<{ id: string | number }>
  const e = arr.find((x) => String(x.id) === id)
  if (!e) return `#${id}`
  return titleFor(t, e as unknown as Record<string, unknown>, cache)
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

// ── Member ────────────────────────────────────────────────────────────
function renderMember(
  m: Record<string, unknown> & { id: string | number; teams?: unknown },
  cache: CacheShape,
  onSelect: Props['onSelect'],
  related: ReturnType<typeof useRelatedEntities>,
  t: TFn,
) {
  const junctions = Array.isArray(m.teams) ? m.teams : []
  const memberTeams = junctions
    .map((j: unknown) => {
      const tid = String((j as { team?: { id?: unknown } | string | number })?.team
        ? (typeof (j as { team: unknown }).team === 'object'
            ? (j as { team: { id?: unknown } }).team?.id
            : (j as { team: unknown }).team)
        : (j as { id?: unknown })?.id ?? j)
      return cache.teams.find((x) => String(x.id) === tid) ?? null
    })
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
            <EntityLink key={tm.id} type="teams" id={String(tm.id)} label={teamLabel(tm)} onClick={onSelect} />
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
              {(state?.data ?? []).map((row, idx) => {
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
  onSelect: Props['onSelect'],
  t: TFn,
) {
  const members = cache.members.filter((m) => {
    const ts = Array.isArray((m as unknown as { teams?: unknown[] }).teams)
      ? (m as unknown as { teams: unknown[] }).teams
      : []
    return ts.some((j: unknown) => {
      const tid = String((j as { team?: { id?: unknown } | string | number })?.team
        ? (typeof (j as { team: unknown }).team === 'object'
            ? (j as { team: { id?: unknown } }).team?.id
            : (j as { team: unknown }).team)
        : (j as { id?: unknown })?.id ?? j)
      return tid === String(tm.id)
    })
  })
  const trainings = cache.trainings.filter((tr) => String((tr as unknown as { team?: unknown }).team) === String(tm.id))
  const games = cache.games.filter((g) =>
    String((g as unknown as { home_team?: unknown }).home_team) === String(tm.id) ||
    String((g as unknown as { away_team?: unknown }).away_team) === String(tm.id),
  )

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
            <EntityLink key={m.id} type="members" id={String(m.id)} label={memberLabel(m)} onClick={onSelect} />
          ))}
        </div>
      </ExplorerSectionCard>

      <ExplorerSectionCard title={t('explorerBucketTrainings')} count={trainings.length} lazy={false}>
        <ul className="space-y-1 text-xs">
          {trainings.slice(0, 50).map((tr) => {
            const trAny = tr as unknown as { id: string | number; date?: string; start_time?: string }
            return (
              <li key={trAny.id}>
                <EntityLink
                  type="trainings"
                  id={String(trAny.id)}
                  label={`${trAny.date ?? '—'} ${trAny.start_time ?? ''}`.trim()}
                  onClick={onSelect}
                />
              </li>
            )
          })}
        </ul>
      </ExplorerSectionCard>

      <ExplorerSectionCard title={t('explorerBucketGames')} count={games.length} lazy={false}>
        <ul className="space-y-1 text-xs">
          {games.slice(0, 50).map((g) => {
            const gAny = g as unknown as { id: string | number; date?: string; home_team?: string; away_team?: string }
            return (
              <li key={gAny.id}>
                <EntityLink
                  type="games"
                  id={String(gAny.id)}
                  label={`${gAny.date ?? '—'} · ${gAny.home_team ?? '?'} vs ${gAny.away_team ?? '?'}`}
                  onClick={onSelect}
                />
              </li>
            )
          })}
        </ul>
      </ExplorerSectionCard>
    </>
  )
}

// ── Event ─────────────────────────────────────────────────────────────
function renderEvent(
  e: Record<string, unknown> & { id: string | number },
  _cache: CacheShape,
  _onSelect: Props['onSelect'],
  related: ReturnType<typeof useRelatedEntities>,
  t: TFn,
) {
  const state = related.get('events', String(e.id), 'participations')
  return (
    <>
      <div className="mb-4">
        <Field label={t('explorerFieldStartDate')}>{String(e.start_date ?? '—')}</Field>
        <Field label={t('explorerFieldEndDate')}>{String(e.end_date ?? '—')}</Field>
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
        <ul className="space-y-1 text-xs">
          {(state?.data ?? []).map((row, idx) => {
            const r = row as { id?: string | number; member?: unknown; status?: string }
            return (
              <li key={r.id ?? idx} className="rounded border border-border bg-background px-2 py-1">
                #{String(r.member ?? '?')} · {r.status ?? '?'}
              </li>
            )
          })}
        </ul>
      </ExplorerSectionCard>
    </>
  )
}

// ── Training ──────────────────────────────────────────────────────────
function renderTraining(
  tr: Record<string, unknown> & { id: string | number },
  cache: CacheShape,
  onSelect: Props['onSelect'],
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
            <EntityLink type="teams" id={String(team.id)} label={teamLabel(team)} onClick={onSelect} />
          </Field>
        )}
        <Field label={t('explorerFieldDate')}>{String(tr.date ?? '—')}</Field>
        <Field label={t('explorerFieldTime')}>{`${String(tr.start_time ?? '')} – ${String(tr.end_time ?? '')}`}</Field>
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
  onSelect: Props['onSelect'],
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
          {home ? <EntityLink type="teams" id={String(home.id)} label={teamLabel(home)} onClick={onSelect} /> : `#${String(g.home_team)}`}
        </Field>
        <Field label={t('explorerFieldAwayTeam')}>
          {away ? <EntityLink type="teams" id={String(away.id)} label={teamLabel(away)} onClick={onSelect} /> : `#${String(g.away_team)}`}
        </Field>
        <Field label={t('explorerFieldDate')}>{String(g.date ?? '—')}</Field>
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
          </ExplorerSectionCard>
        )
      })}
    </>
  )
}
