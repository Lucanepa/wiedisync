// src/modules/admin/components/ExplorerTree.tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Users, Trophy, Calendar, Dumbbell, Target } from 'lucide-react'
import type { BucketKey, CacheShape, ExplorerEntity } from './explorerHelpers'
import {
  memberLabel, teamLabel, eventLabel, trainingLabel, gameLabel,
  highlightMatch,
} from './explorerHelpers'
import { rankEntities } from '../hooks/useExplorerSearch'

interface Props {
  cache: CacheShape
  selectedType: BucketKey | null
  selectedId: string | null
  query: string
  onSelect: (type: BucketKey, id: string) => void
}

const BUCKET_ICONS = {
  members: Users,
  teams: Trophy,
  events: Calendar,
  trainings: Dumbbell,
  games: Target,
} as const

const BUCKETS: BucketKey[] = ['members', 'teams', 'events', 'trainings', 'games']

export default function ExplorerTree({ cache, selectedType, selectedId, query, onSelect }: Props) {
  const { t } = useTranslation('admin')
  const [expanded, setExpanded] = useState<Record<BucketKey, boolean>>({
    members: false,
    teams: false,
    events: false,
    trainings: false,
    games: false,
  })

  const teamName = useMemo(() => {
    const map = new Map<string, string>()
    cache.teams.forEach((tm) => map.set(String(tm.id), teamLabel(tm)))
    return (id: string) => map.get(id) ?? id
  }, [cache.teams])

  const allEntities: ExplorerEntity[] = useMemo(
    () => [
      ...cache.members.map((m) => ({
        type: 'members' as const,
        id: String(m.id),
        label: memberLabel(m),
        sublabel: m.email ?? undefined,
      })),
      ...cache.teams.map((tm) => ({
        type: 'teams' as const,
        id: String(tm.id),
        label: teamLabel(tm),
        sublabel: tm.full_name,
      })),
      ...cache.events.map((e) => ({
        type: 'events' as const,
        id: String(e.id),
        label: eventLabel(e),
        sublabel: e.start_date ?? undefined,
      })),
      ...cache.trainings.map((tr) => ({
        type: 'trainings' as const,
        id: String(tr.id),
        label: trainingLabel(tr, teamName),
      })),
      ...cache.games.map((g) => ({
        type: 'games' as const,
        id: String(g.id),
        label: gameLabel(g, teamName),
      })),
    ],
    [cache, teamName],
  )

  const matched = useMemo(() => {
    if (!query) return allEntities
    return rankEntities(allEntities, query, 500)
  }, [allEntities, query])

  const groups = useMemo(() => {
    const g: Record<BucketKey, ExplorerEntity[]> = {
      members: [], teams: [], events: [], trainings: [], games: [],
    }
    matched.forEach((e) => g[e.type].push(e))
    return g
  }, [matched])

  const labelFor: Record<BucketKey, string> = {
    members: t('explorerBucketMembers'),
    teams: t('explorerBucketTeams'),
    events: t('explorerBucketEvents'),
    trainings: t('explorerBucketTrainings'),
    games: t('explorerBucketGames'),
  }

  return (
    <nav className="h-full overflow-y-auto px-2 py-2 text-sm">
      {BUCKETS.map((b) => {
        const Icon = BUCKET_ICONS[b]
        const items = groups[b]
        const isExpanded = expanded[b] || !!query
        return (
          <div key={b} className="mb-1">
            <button
              type="button"
              onClick={() => setExpanded((e) => ({ ...e, [b]: !e[b] }))}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 font-semibold text-foreground hover:bg-muted"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Icon className="h-4 w-4" />
              <span>{labelFor[b]}</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">{items.length}</span>
            </button>
            {isExpanded && (
              <ul className="mt-0.5">
                {items.slice(0, 200).map((e) => {
                  const isActive = selectedType === e.type && selectedId === e.id
                  return (
                    <li key={`${e.type}-${e.id}`}>
                      <button
                        type="button"
                        onClick={() => onSelect(e.type, e.id)}
                        className={
                          'flex w-full rounded-md px-2 py-1 pl-7 text-left ' +
                          (isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted')
                        }
                      >
                        {highlightMatch(e.label, query).map((seg, i) =>
                          seg.match ? (
                            <mark
                              key={i}
                              className="rounded-sm bg-yellow-200 px-0.5 text-yellow-900 dark:bg-yellow-800/40 dark:text-yellow-200"
                            >
                              {seg.text}
                            </mark>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          ),
                        )}
                      </button>
                    </li>
                  )
                })}
                {items.length > 200 && (
                  <li className="px-2 py-1 pl-7 text-xs text-muted-foreground">
                    … {items.length - 200} more (narrow the search)
                  </li>
                )}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}
