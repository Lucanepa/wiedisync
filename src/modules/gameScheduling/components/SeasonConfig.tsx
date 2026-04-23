import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSchedulingSeason } from '../../../types'

interface Props {
  season: GameSchedulingSeason | null
  allSeasons: GameSchedulingSeason[]
  onCreateSeason: (name: string) => Promise<void>
  onSelectSeason: (season: GameSchedulingSeason) => void
  onStatusChange: (status: 'setup' | 'open' | 'closed') => Promise<void>
  onUpdateSeason?: (patch: Record<string, unknown>) => Promise<void>
}

export default function SeasonConfig({ season, allSeasons, onCreateSeason, onSelectSeason, onStatusChange, onUpdateSeason }: Props) {
  const { t } = useTranslation('gameScheduling')
  const [creating, setCreating] = useState(false)
  const [svrzUuid, setSvrzUuid] = useState<string>(
    typeof season?.svrz_season_uuid === 'string' ? season.svrz_season_uuid : '',
  )
  const [savingSvrz, setSavingSvrz] = useState(false)

  const seasonUuidLinked = typeof season?.svrz_season_uuid === 'string' && season.svrz_season_uuid.length > 0
  const dirty = (season?.svrz_season_uuid ?? '') !== svrzUuid

  const handleSaveSvrzUuid = async () => {
    if (!onUpdateSeason) return
    setSavingSvrz(true)
    try {
      await onUpdateSeason({ svrz_season_uuid: svrzUuid.trim() || null })
    } finally {
      setSavingSvrz(false)
    }
  }

  const getNextSeasonName = () => {
    const year = new Date().getFullYear()
    return `${year}/${(year + 1).toString().slice(-2)}`
  }

  const nextSeason = getNextSeasonName()
  const seasonExists = allSeasons.some(s => s.season === nextSeason)

  const handleCreate = async () => {
    if (seasonExists) return
    setCreating(true)
    try {
      await onCreateSeason(nextSeason)
    } finally {
      setCreating(false)
    }
  }

  const statusColors = {
    setup: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    open: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }

  const statusLabels = {
    setup: t('statusSetup'),
    open: t('statusOpen'),
    closed: t('statusClosed'),
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t('season')}</h2>

      {/* Season selector */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {allSeasons.map(s => (
          <button
            key={s.id}
            onClick={() => onSelectSeason(s)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              season?.id === s.id
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {s.season}
            <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs ${statusColors[s.status]}`}>
              {statusLabels[s.status]}
            </span>
          </button>
        ))}
      </div>

      {/* Create new season */}
      {!seasonExists && (
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? '…' : `${t('createSeason')} ${nextSeason}`}
        </button>
      )}

      {/* Status toggle */}
      {season && (
        <div className="mt-4 flex flex-wrap gap-2">
          {season.status === 'setup' && (
            <button
              onClick={() => onStatusChange('open')}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {t('openForBooking')}
            </button>
          )}
          {season.status === 'open' && (
            <button
              onClick={() => onStatusChange('closed')}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t('closeBooking')}
            </button>
          )}
          {season.status === 'closed' && (
            <button
              onClick={() => onStatusChange('setup')}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t('statusSetup')}
            </button>
          )}
        </div>
      )}

      {/* SVRZ season link — optional UUID used by invite import for the bulk-contact fallback */}
      {season && onUpdateSeason && (
        <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            SVRZ-Saison-UUID
            <span className="ml-1 text-gray-400">(optional)</span>
          </label>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Wird vom Import als Fallback für Kontakte genutzt, wenn keine per-Spiel-Kontakte gefunden werden.
            Beispiel: <code className="text-[10px]">dcafddfe-8139-4e02-baad-d3f88ec00cd0</code>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={svrzUuid}
              onChange={(e) => setSvrzUuid(e.target.value)}
              placeholder="UUID"
              className="flex-1 min-w-[240px] rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              onClick={handleSaveSvrzUuid}
              disabled={!dirty || savingSvrz}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingSvrz ? '…' : 'Speichern'}
            </button>
            {seasonUuidLinked && !dirty && (
              <span className="flex items-center text-xs text-green-600 dark:text-green-400">✓ verknüpft</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
