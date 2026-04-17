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

// ── Compact table skeleton ─────────────────────────────────────────────
interface ColDef {
  key: string
  label: string
  className?: string
}

function CompactTable({
  cols,
  rows,
}: {
  cols: ColDef[]
  rows: React.ReactNode[][]
}) {
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr>
          {cols.map((c) => (
            <th key={c.key} className={`py-1 pr-3 font-medium ${c.className ?? ''}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-foreground">
        {rows.map((cells, i) => (
          <tr key={i} className="border-t border-border">
            {cells.map((cell, j) => (
              <td key={j} className={`py-1 pr-3 ${cols[j]?.className ?? ''}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function NavBtn({
  type,
  id,
  label,
  onClick,
}: {
  type: BucketKey
  id: string
  label: string
  onClick: (type: BucketKey, id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(type, id)}
      className="text-primary hover:underline text-left"
    >
      {label}
    </button>
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

  const teamName = (tid: string) => cache.teams.find((x) => String(x.id) === tid)?.name ?? tid

  return (
    <>
      <div className="mb-4">
        <Field label={t('explorerFieldEmail')}>{String(m.email ?? '—')}</Field>
        <Field label={t('explorerFieldSex')}>{String(m.sex ?? '—')}</Field>
        <Field label={t('explorerFieldRole')}>{Array.isArray(m.role) ? (m.role as string[]).join(', ') : '—'}</Field>
        <Field label={t('explorerFieldActive')}>{m.kscw_membership_active ? '✓' : '—'}</Field>
      </div>

      {/* Teams table */}
      <ExplorerSectionCard title={t('explorerSectionTeams')} count={memberTeams.length} lazy={false}>
        <CompactTable
          cols={[
            { key: 'name', label: t('explorerColName') },
            { key: 'sport', label: t('explorerFieldSport') },
            { key: 'season', label: t('explorerFieldSeason') },
          ]}
          rows={memberTeams.map((tm) => [
            <NavBtn type="teams" id={String(tm.id)} label={teamLabel(tm)} onClick={onNavigate} />,
            String(tm.sport ?? '—'),
            String(tm.season ?? '—'),
          ])}
        />
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
            {s === 'participations' && renderMemberParticipationsTable(state?.data ?? [], cache, onNavigate, teamName, t)}
            {s === 'absences' && renderAbsencesTable(state?.data ?? [], t)}
            {s === 'schreibereinsaetze' && renderSchreibereinsaetzeTable(state?.data ?? [], cache, onNavigate, t)}
            {s === 'refereeExpenses' && renderRefereeExpensesTable(state?.data ?? [], t)}
          </ExplorerSectionCard>
        )
      })}
    </>
  )
}

function renderMemberParticipationsTable(
  rows: unknown[],
  cache: CacheShape,
  onNavigate: (type: BucketKey, id: string) => void,
  teamName: (tid: string) => string,
  t: TFn,
) {
  return (
    <CompactTable
      cols={[
        { key: 'activity', label: t('explorerColActivity') },
        { key: 'date', label: t('explorerFieldDate') },
        { key: 'status', label: t('explorerFieldStatus') },
      ]}
      rows={rows.map((row) => {
        const r = row as { activity_type?: string; activity_id?: unknown; status?: string }
        const rawType = String(r.activity_type ?? '')
        const bucketType = (rawType + 's') as BucketKey
        const activityId = String(r.activity_id ?? '')
        const validBuckets: BucketKey[] = ['events', 'trainings', 'games']

        let activityLabel = `#${activityId}`
        let activityDate = ''
        if (bucketType === 'events') {
          const ev = cache.events.find((e) => String(e.id) === activityId)
          if (ev) { activityLabel = eventLabel(ev); activityDate = formatShortDate(ev.start_date) }
        } else if (bucketType === 'trainings') {
          const tr = cache.trainings.find((x) => String(x.id) === activityId)
          if (tr) { activityLabel = trainingLabel(tr, teamName); activityDate = formatShortDate(tr.date) }
        } else if (bucketType === 'games') {
          const g = cache.games.find((x) => String(x.id) === activityId)
          if (g) { activityLabel = gameLabel(g, teamName); activityDate = formatShortDate(g.date) }
        }

        const activityCell = validBuckets.includes(bucketType)
          ? <NavBtn type={bucketType} id={activityId} label={activityLabel} onClick={onNavigate} />
          : <span>{activityLabel}</span>

        return [activityCell, activityDate || '—', r.status ?? '—']
      })}
    />
  )
}

function renderAbsencesTable(rows: unknown[], t: TFn) {
  return (
    <CompactTable
      cols={[
        { key: 'start', label: t('explorerFieldStartDate') },
        { key: 'end', label: t('explorerFieldEndDate') },
        { key: 'reason', label: t('explorerColReason') },
      ]}
      rows={rows.map((row) => {
        const r = row as { start_date?: string; end_date?: string; reason?: string; reason_detail?: string }
        const reason = r.reason_detail ? `${r.reason ?? ''} — ${r.reason_detail}` : (r.reason ?? '—')
        return [
          formatShortDate(r.start_date) || '—',
          formatShortDate(r.end_date) || '—',
          reason,
        ]
      })}
    />
  )
}

function renderSchreibereinsaetzeTable(
  rows: unknown[],
  cache: CacheShape,
  onNavigate: (type: BucketKey, id: string) => void,
  t: TFn,
) {
  const teamName = (tid: string) => cache.teams.find((x) => String(x.id) === tid)?.name ?? tid
  return (
    <CompactTable
      cols={[
        { key: 'date', label: t('explorerFieldDate') },
        { key: 'activity', label: t('explorerColActivity') },
        { key: 'role', label: t('explorerColRole') },
      ]}
      rows={rows.map((row) => {
        const r = row as { game?: unknown; training?: unknown; role?: string; date?: string }
        let activityCell: React.ReactNode = '—'
        let dateStr = formatShortDate(r.date) || '—'

        if (r.game) {
          const gId = String(r.game)
          const g = cache.games.find((x) => String(x.id) === gId)
          if (g) {
            activityCell = <NavBtn type="games" id={gId} label={gameLabel(g, teamName)} onClick={onNavigate} />
            if (!r.date) dateStr = formatShortDate(g.date) || '—'
          } else {
            activityCell = `#${gId}`
          }
        } else if (r.training) {
          const tId = String(r.training)
          const tr = cache.trainings.find((x) => String(x.id) === tId)
          if (tr) {
            activityCell = <NavBtn type="trainings" id={tId} label={trainingLabel(tr, teamName)} onClick={onNavigate} />
            if (!r.date) dateStr = formatShortDate(tr.date) || '—'
          } else {
            activityCell = `#${tId}`
          }
        }

        return [dateStr, activityCell, r.role ?? '—']
      })}
    />
  )
}

function renderRefereeExpensesTable(rows: unknown[], t: TFn) {
  return (
    <CompactTable
      cols={[
        { key: 'date', label: t('explorerFieldDate') },
        { key: 'amount', label: t('explorerColAmount') },
        { key: 'status', label: t('explorerFieldStatus') },
      ]}
      rows={rows.map((row) => {
        const r = row as { date?: string; amount?: number; status?: string; notes?: string }
        return [
          formatShortDate(r.date) || '—',
          r.amount != null ? String(r.amount) : '—',
          r.status ?? '—',
        ]
      })}
    />
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

      {/* Members table */}
      <ExplorerSectionCard title={t('explorerSectionMembers')} count={members.length} lazy={false}>
        <CompactTable
          cols={[
            { key: 'name', label: t('explorerColName') },
            { key: 'nr', label: t('explorerColNumber') },
          ]}
          rows={members.map((mem) => {
            const memAny = mem as unknown as { number?: number }
            return [
              <NavBtn type="members" id={String(mem.id)} label={memberLabel(mem)} onClick={onNavigate} />,
              memAny.number != null ? String(memAny.number) : '—',
            ]
          })}
        />
      </ExplorerSectionCard>

      {/* Trainings table */}
      <ExplorerSectionCard title={t('explorerBucketTrainings')} count={trainings.length} lazy={false}>
        <CompactTable
          cols={[
            { key: 'date', label: t('explorerFieldDate') },
            { key: 'time', label: t('explorerFieldTime') },
            { key: 'hall', label: t('explorerFieldHall') },
          ]}
          rows={trainings.slice(0, 50).map((tr) => {
            const trAny = tr as unknown as { id: string | number; date?: string; start_time?: string; end_time?: string; hall?: string }
            return [
              <NavBtn
                type="trainings"
                id={String(trAny.id)}
                label={formatShortDate(trAny.date ?? '') || trainingLabel(tr as never, teamName)}
                onClick={onNavigate}
              />,
              `${(trAny.start_time ?? '').slice(0, 5)} – ${(trAny.end_time ?? '').slice(0, 5)}`.trim(),
              trAny.hall ?? '—',
            ]
          })}
        />
      </ExplorerSectionCard>

      {/* Games table */}
      <ExplorerSectionCard title={t('explorerBucketGames')} count={games.length} lazy={false}>
        <CompactTable
          cols={[
            { key: 'date', label: t('explorerFieldDate') },
            { key: 'time', label: t('explorerFieldTime') },
            { key: 'home', label: t('explorerFieldHomeTeam') },
            { key: 'away', label: t('explorerFieldAwayTeam') },
            { key: 'result', label: t('explorerFieldResult') },
            { key: 'hall', label: t('explorerFieldHall') },
          ]}
          rows={games.slice(0, 50).map((g) => {
            const gAny = g as unknown as {
              id: string | number; date?: string; time?: string
              home_team?: unknown; away_team?: unknown
              home_score?: number; away_score?: number; hall?: string
            }
            const homeTeam = cache.teams.find((x) => String(x.id) === String(gAny.home_team))
            const awayTeam = cache.teams.find((x) => String(x.id) === String(gAny.away_team))
            return [
              <NavBtn type="games" id={String(gAny.id)} label={formatShortDate(gAny.date ?? '') || '—'} onClick={onNavigate} />,
              (gAny.time ?? '—').toString().slice(0, 5),
              homeTeam ? teamLabel(homeTeam) : `#${String(gAny.home_team)}`,
              awayTeam ? teamLabel(awayTeam) : `#${String(gAny.away_team)}`,
              `${gAny.home_score ?? '-'} : ${gAny.away_score ?? '-'}`,
              gAny.hall ?? '—',
            ]
          })}
        />
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

/** Render grouped participation rows as compact tables (for events, trainings, games). */
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
          <div key={status} className="mb-3">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
              {t(`explorerStatus_${status}`)} · {statusRows.length}
            </div>
            <CompactTable
              cols={[
                { key: 'member', label: t('explorerColName') },
                { key: 'note', label: t('explorerColNote') },
              ]}
              rows={statusRows.map((row) => {
                const r = row as { id?: string | number; member?: unknown; note?: string }
                const memberId = String(r.member ?? '')
                const member = cache.members.find((mem) => String(mem.id) === memberId)
                const label = member ? memberLabel(member) : `#${memberId}`
                const noteRaw = r.note ?? ''
                const note = noteRaw.length > 40 ? noteRaw.slice(0, 40) + '…' : noteRaw || '—'
                return [
                  <NavBtn type="members" id={memberId} label={label} onClick={onNavigate} />,
                  note,
                ]
              })}
            />
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
            <NavBtn type="teams" id={String(team.id)} label={teamLabel(team)} onClick={onNavigate} />
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
              : renderSchreibereinsaetzeTable(state?.data ?? [], cache, onNavigate, t)}
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
          {home ? <NavBtn type="teams" id={String(home.id)} label={teamLabel(home)} onClick={onNavigate} /> : `#${String(g.home_team)}`}
        </Field>
        <Field label={t('explorerFieldAwayTeam')}>
          {away ? <NavBtn type="teams" id={String(away.id)} label={teamLabel(away)} onClick={onNavigate} /> : `#${String(g.away_team)}`}
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
            {s === 'participations' && renderGroupedParticipations(state?.data ?? [], cache, onNavigate, t)}
            {s === 'schreibereinsaetze' && renderSchreibereinsaetzeTable(state?.data ?? [], cache, onNavigate, t)}
            {s === 'scorerDelegations' && renderScorerDelegationsTable(state?.data ?? [], cache, onNavigate, t)}
          </ExplorerSectionCard>
        )
      })}
    </>
  )
}

function renderScorerDelegationsTable(
  rows: unknown[],
  cache: CacheShape,
  onNavigate: (type: BucketKey, id: string) => void,
  t: TFn,
) {
  return (
    <CompactTable
      cols={[
        { key: 'original', label: t('explorerColOriginal') },
        { key: 'delegatedTo', label: t('explorerColDelegatedTo') },
        { key: 'date', label: t('explorerFieldDate') },
      ]}
      rows={rows.map((row) => {
        const r = row as { from_member?: unknown; to_member?: unknown; date_created?: string }
        const fromId = String(r.from_member ?? '')
        const toId = String(r.to_member ?? '')
        const fromMember = cache.members.find((m) => String(m.id) === fromId)
        const toMember = cache.members.find((m) => String(m.id) === toId)
        const fromLabel = fromMember ? memberLabel(fromMember) : `#${fromId}`
        const toLabel = toMember ? memberLabel(toMember) : `#${toId}`
        return [
          <NavBtn type="members" id={fromId} label={fromLabel} onClick={onNavigate} />,
          <NavBtn type="members" id={toId} label={toLabel} onClick={onNavigate} />,
          formatShortDate(r.date_created) || '—',
        ]
      })}
    />
  )
}
