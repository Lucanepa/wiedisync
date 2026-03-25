import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import { useTeams } from '../../hooks/useTeams'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { downloadICal } from '../../utils/icalGenerator'
import type { CalendarEntry } from '../../types/calendar'

import pb from '../../pb'

const PB_URL = pb.baseUrl

type ICalMode = 'subscribe' | 'download'

interface ICalModalProps {
  open: boolean
  mode: ICalMode
  onClose: () => void
  /** Current visible entries (used for download mode) */
  entries: CalendarEntry[]
}

type SourceCategory = 'trainings' | 'games' | 'events'

/** Map each checkbox to the iCal API source values */
const categoryToSources: Record<SourceCategory, string[]> = {
  trainings: ['trainings'],
  games: ['games-home', 'games-away'],
  events: ['events'],
}

function categoryMatchesEntry(categories: SourceCategory[], entry: CalendarEntry): boolean {
  for (const cat of categories) {
    if (cat === 'games' && entry.type === 'game') return true
    if (cat === 'trainings' && entry.type === 'training') return true
    if (cat === 'events' && entry.type === 'event') return true
  }
  return false
}

export default function ICalModal({ open, mode, onClose, entries }: ICalModalProps) {
  const { t } = useTranslation('calendar')
  const { data: teams } = useTeams()
  const { memberTeamIds, coachTeamIds } = useAuth()
  const { effectiveIsAdmin } = useAdminMode()

  const [selectedCategories, setSelectedCategories] = useState<SourceCategory[]>([
    'trainings',
    'games',
    'events',
  ])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])

  const title = mode === 'subscribe' ? t('icalSubscribeTitle') : t('icalDownloadTitle')

  const categoryOptions: { value: SourceCategory; label: string }[] = [
    { value: 'trainings', label: t('sourceTrainings') },
    { value: 'games', label: t('sourceGames') },
    { value: 'events', label: t('sourceEvents') },
  ]

  // Only show user's own teams (member + coach), unless admin
  const userTeamIds = useMemo(() => {
    const set = new Set([...memberTeamIds, ...coachTeamIds])
    return [...set]
  }, [memberTeamIds, coachTeamIds])

  const visibleTeams = useMemo(() => {
    if (effectiveIsAdmin) return teams
    return teams.filter((t) => userTeamIds.includes(t.id))
  }, [teams, effectiveIsAdmin, userTeamIds])

  function toggleCategory(cat: SourceCategory) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

  function handleConfirm() {
    // Build combined sources from selected categories
    const sources = selectedCategories.flatMap((cat) => categoryToSources[cat])

    if (mode === 'subscribe') {
      const params = new URLSearchParams()
      if (sources.length > 0) {
        params.set('source', sources.join(','))
      }
      if (selectedTeamIds.length > 0) {
        params.set('team', selectedTeamIds.join(','))
      }
      const icalUrl = `${PB_URL}/api/ical?${params.toString()}`
      const webcalUrl = icalUrl.replace(/^https?:/, 'webcal:')
      window.open(webcalUrl, '_self')
    } else {
      // Download: filter current entries client-side
      let filtered = entries
      if (selectedCategories.length < 3) {
        filtered = entries.filter((e) => categoryMatchesEntry(selectedCategories, e))
      }
      if (selectedTeamIds.length > 0) {
        filtered = filtered.filter((e) => {
          // Games: check source.kscw_team; Trainings: check source.team
          const src = e.source as Record<string, unknown>
          const teamId = (src.kscw_team ?? src.team ?? '') as string
          return !teamId || selectedTeamIds.includes(teamId)
        })
      }
      downloadICal(filtered, 'wiedisync-kalender.ics')
    }
    onClose()
  }

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        {/* Category selection (checkboxes) */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('icalFilterLabel')}
          </p>
          <div className="space-y-1">
            {categoryOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 sm:min-h-0 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(opt.value)}
                  onChange={() => toggleCategory(opt.value)}
                  className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Team filter — only user's own teams (admins see all) */}
        {visibleTeams.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('icalTeamFilter')}
            </p>
            {(() => {
              const vbTeams = visibleTeams.filter((t) => t.sport === 'volleyball')
              const bbTeams = visibleTeams.filter((t) => t.sport === 'basketball')
              const hasBoth = vbTeams.length > 0 && bbTeams.length > 0

              const renderChips = (list: typeof visibleTeams) =>
                list.map((team) => {
                  const isSelected = selectedTeamIds.includes(team.id)
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeam(team.id)}
                      className={`min-h-[44px] rounded-full border px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:py-1 sm:text-xs ${
                        isSelected
                          ? 'border-brand-200 bg-brand-100 text-brand-800 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {team.name}
                    </button>
                  )
                })

              if (!hasBoth) {
                return <div className="flex flex-wrap gap-2">{renderChips(visibleTeams)}</div>
              }

              return (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      🏐 Volleyball
                    </p>
                    <div className="flex flex-wrap gap-2">{renderChips(vbTeams)}</div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      🏀 Basketball
                    </p>
                    <div className="flex flex-wrap gap-2">{renderChips(bbTeams)}</div>
                  </div>
                </div>
              )
            })()}
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('icalTeamHint')}</p>
          </div>
        )}

        {/* Confirm button */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedCategories.length === 0}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50"
        >
          {mode === 'subscribe' ? t('subscribeICal') : t('exportICal')}
        </button>
      </div>
    </Modal>
  )
}
