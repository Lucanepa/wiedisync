import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { kscwApi } from '../../../lib/api'
import type { GameSchedulingSeason } from '../../../types'
import { formatSeasonShort } from '../utils/formatSeason'

interface Props {
  season: GameSchedulingSeason | null
  allSeasons: GameSchedulingSeason[]
  onCreateSeason: (name: string) => Promise<void>
  onSelectSeason: (season: GameSchedulingSeason) => void
  onStatusChange: (status: 'setup' | 'open' | 'closed') => Promise<void>
  onUpdateSeason?: (patch: Record<string, unknown>) => Promise<void>
  onAfterArchive?: () => Promise<void> | void
}

interface ArchiveResult {
  success: true
  season: string
  teams_archived: number
  invites_expired: number
}

interface SvrzSeasonOption {
  uuid: string
  name: string
}

export default function SeasonConfig({
  season,
  allSeasons,
  onCreateSeason,
  onSelectSeason,
  onStatusChange,
  onUpdateSeason,
  onAfterArchive,
}: Props) {
  const { t } = useTranslation('gameScheduling')
  const [creating, setCreating] = useState(false)
  const [svrzOptions, setSvrzOptions] = useState<SvrzSeasonOption[]>([])
  const [savingSvrz, setSavingSvrz] = useState(false)

  const currentSvrzUuid = typeof season?.svrz_season_uuid === 'string' ? season.svrz_season_uuid : ''

  useEffect(() => {
    if (!onUpdateSeason) return
    kscwApi<{ data: SvrzSeasonOption[] }>('/admin/terminplanung/svrz-available-seasons')
      .then((resp) => setSvrzOptions(resp.data ?? []))
      .catch(() => setSvrzOptions([]))
  }, [onUpdateSeason])

  const handleSvrzSelect = async (uuid: string) => {
    if (!onUpdateSeason) return
    setSavingSvrz(true)
    try {
      await onUpdateSeason({ svrz_season_uuid: uuid || null })
    } finally {
      setSavingSvrz(false)
    }
  }

  const getNextSeasonName = () => {
    const year = new Date().getFullYear()
    return `${year}/${(year + 1).toString().slice(-2)}`
  }

  const nextSeason = getNextSeasonName()
  const seasonExists = allSeasons.some((s) => s.season === nextSeason)

  const handleCreate = async () => {
    if (seasonExists) return
    setCreating(true)
    try {
      await onCreateSeason(nextSeason)
    } finally {
      setCreating(false)
    }
  }

  const statusColors: Record<string, string> = {
    setup: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    open: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    archived: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  }

  const statusLabels: Record<string, string> = {
    setup: t('statusSetup'),
    open: t('statusOpen'),
    closed: t('statusClosed'),
    archived: t('statusArchived'),
  }

  const [archiving, setArchiving] = useState(false)
  const handleArchive = async () => {
    if (!season) return
    if (!window.confirm(t('archiveSeasonConfirm', { season: formatSeasonShort(season.season) }))) return
    setArchiving(true)
    try {
      const resp = await kscwApi<ArchiveResult>(`/admin/terminplanung/archive-season/${season.id}`, { method: 'POST' })
      toast.success(
        t('archiveSeasonSuccess', {
          season: formatSeasonShort(resp.season),
          teams: resp.teams_archived,
          invites: resp.invites_expired,
        }),
      )
      if (onAfterArchive) await onAfterArchive()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t('season')}</h2>

      {/* Season selector */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {allSeasons.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectSeason(s)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              season?.id === s.id
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {formatSeasonShort(s.season)}
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
            <>
              <button
                onClick={() => onStatusChange('setup')}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('statusSetup')}
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-600 dark:hover:bg-slate-500"
                title={t('archiveSeasonHint') || ''}
              >
                {archiving ? '…' : t('archiveSeason')}
              </button>
            </>
          )}
          {(season.status as string) === 'archived' && (
            <span className="text-sm text-gray-500 italic dark:text-gray-400">{t('archiveSeasonDone')}</span>
          )}
        </div>
      )}

      {/* SVRZ season link — dropdown populated from synced svrz_spielplaner_contacts */}
      {season && onUpdateSeason && (
        <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('svrzSeasonLabel')} <span className="ml-1 text-gray-400">{t('svrzSeasonOptional')}</span>
          </label>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t('svrzSeasonHelp')}</p>

          {svrzOptions.length === 0 ? (
            <p className="mt-2 text-xs italic text-amber-600 dark:text-amber-400">{t('svrzSeasonEmpty')}</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={currentSvrzUuid}
                onChange={(e) => handleSvrzSelect(e.target.value)}
                disabled={savingSvrz}
                className="min-w-[200px] rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">{t('svrzSeasonNone')}</option>
                {svrzOptions.map((opt) => (
                  <option key={opt.uuid} value={opt.uuid}>
                    {formatSeasonShort(opt.name)}
                  </option>
                ))}
              </select>
              {savingSvrz && <span className="text-xs text-gray-500">…</span>}
              {!savingSvrz && currentSvrzUuid && (
                <span className="text-xs text-green-600 dark:text-green-400">{t('svrzSeasonLinked')}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
