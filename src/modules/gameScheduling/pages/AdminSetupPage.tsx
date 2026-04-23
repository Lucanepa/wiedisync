import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../../hooks/useAuth'
import { kscwApi } from '../../../lib/api'
import { useGameSchedulingSeason } from '../hooks/useGameSchedulingSeason'
import { useAdminBookings } from '../hooks/useAdminBookings'
import { useTeams } from '../../../hooks/useTeams'
import LoadingSpinner from '../../../components/LoadingSpinner'
import SeasonConfig from '../components/SeasonConfig'
import SpielsamstageEditor from '../components/SpielsamstageEditor'
import SlotGenerationPanel from '../components/SlotGenerationPanel'
import TeamSlotConfigPanel from '../components/TeamSlotConfigPanel'
import ExcelImportPanel from '../components/ExcelImportPanel'
import InvitesPanel from '../components/InvitesPanel'
import type { SpielsamstagConfig, TeamSlotConfig } from '../../../types'

export default function AdminSetupPage() {
  const { t } = useTranslation('gameScheduling')
  const { hasAdminAccessToSport } = useAuth()
  const { season, allSeasons, isLoading, createSeason, updateSeason, setSeason, refetch: refetchSeasons } = useGameSchedulingSeason()
  const { generateSlots } = useAdminBookings(season?.id)
  const { data: teams } = useTeams()
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<{ total_created: number } | null>(null)

  if (!hasAdminAccessToSport('volleyball')) {
    return <Navigate to="/" replace />
  }

  if (isLoading) return <LoadingSpinner />

  const handleCreateSeason = async (name: string) => {
    await createSeason(name)
  }

  const handleUpdateSpielsamstage = async (spielsamstage: SpielsamstagConfig[]) => {
    if (!season) return
    await updateSeason(season.id, { spielsamstage } as Record<string, unknown>)
  }

  const handleUpdateTeamConfig = async (config: TeamSlotConfig) => {
    if (!season) return
    await updateSeason(season.id, { team_slot_config: config } as Record<string, unknown>)
  }

  const handleStatusChange = async (status: 'setup' | 'open' | 'closed') => {
    if (!season) return
    await updateSeason(season.id, { status } as Record<string, unknown>)
    // When opening a season for booking, kick off an SVRZ sync in the
    // background so games + contacts for the current season land in Directus
    // without the admin having to click a second button. The sync runs
    // detached server-side (~9 min) and is idempotent.
    if (status === 'open') {
      try {
        await kscwApi('/admin/terminplanung/svrz-sync', { method: 'POST', body: {} })
        toast.success(t('svrzSyncStarted'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const handleGenerate = async () => {
    if (!season) return
    setGenerating(true)
    setGenResult(null)
    try {
      const result = await generateSlots(season.id)
      setGenResult(result)
    } catch (err) {
      console.error('Slot generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  const volleyballTeams = (teams || []).filter(t => t.sport === 'volleyball' && t.active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">
          {t('setupTitle')}
        </h1>
      </div>

      {/* Season Config */}
      <SeasonConfig
        season={season}
        allSeasons={allSeasons}
        onCreateSeason={handleCreateSeason}
        onSelectSeason={setSeason}
        onStatusChange={handleStatusChange}
        onUpdateSeason={async (patch) => {
          if (season) await updateSeason(season.id, patch)
        }}
        onAfterArchive={refetchSeasons}
      />

      {season && (
        <>
          {/* Spielsamstage Editor */}
          <SpielsamstageEditor
            spielsamstage={season.spielsamstage || []}
            onUpdate={handleUpdateSpielsamstage}
          />

          {/* Team Slot Configuration */}
          <TeamSlotConfigPanel
            teams={volleyballTeams}
            config={season.team_slot_config || {}}
            onUpdate={handleUpdateTeamConfig}
          />

          {/* Excel Import */}
          <ExcelImportPanel />

          {/* Slot Generation */}
          <SlotGenerationPanel
            seasonStatus={season.status}
            generating={generating}
            genResult={genResult}
            onGenerate={handleGenerate}
          />

          {/* Invites (admin-issued per-verein links) */}
          {season.status === 'open' && (
            <InvitesPanel
              teams={volleyballTeams}
              seasonId={season.id}
              seasonName={season.season || ''}
            />
          )}
        </>
      )}
    </div>
  )
}
