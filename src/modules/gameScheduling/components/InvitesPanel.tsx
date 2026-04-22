import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { kscwApi } from '../../../lib/api'
import type { Team } from '../../../types'
import { useInvites } from '../hooks/useInvites'
import InviteRow from './InviteRow'
import InvitesDrawer from './InvitesDrawer'

interface Props {
  teams: Team[]
  seasonId: string | number
  seasonName: string
}

export default function InvitesPanel({ teams, seasonId, seasonName }: Props) {
  const { t } = useTranslation('gameScheduling')
  const [selectedTeamId, setSelectedTeamId] = useState<string | number | null>(teams[0]?.id ?? null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const selectedTeam = useMemo(() => teams.find((t) => String(t.id) === String(selectedTeamId)) ?? null, [teams, selectedTeamId])
  const api = useInvites(selectedTeamId, seasonId)
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wiedisync.kscw.ch'

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      await kscwApi('/admin/terminplanung/svrz-sync', {
        method: 'POST',
        body: { season_name: seasonName },
      })
      toast.success(t('svrzSyncStarted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>{t('invites')}</CardTitle>
          <Button size="sm" variant="outline" onClick={handleSyncNow} disabled={syncing}>
            {t('syncSvrzNow')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Team selector */}
          <div className="flex flex-wrap gap-1">
            {teams.map((tm) => (
              <Button
                key={tm.id}
                size="sm"
                variant={String(tm.id) === String(selectedTeamId) ? 'default' : 'outline'}
                onClick={() => setSelectedTeamId(tm.id)}
              >
                {tm.name} <span className="ml-1 text-xs opacity-70">({tm.league || '—'})</span>
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedTeam ? `${selectedTeam.name} (${selectedTeam.league || '—'})` : '—'} · {api.invites.length} {t('invites')}
            </span>
            <Button onClick={() => setDrawerOpen(true)} disabled={!selectedTeam}>
              {t('manageInvites')}
            </Button>
          </div>

          {api.isLoading ? (
            <div className="py-6 text-center text-sm text-gray-500">Laden…</div>
          ) : api.invites.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
              {t('noInvitesYet')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-400">
                    <th className="py-2 pr-3">{t('inviteTeam')}</th>
                    <th className="py-2 pr-3">{t('inviteEmail')}</th>
                    <th className="py-2 pr-3">{t('inviteStatus')}</th>
                    <th className="py-2 pr-3">{t('inviteSource')}</th>
                    <th className="py-2 pr-3">{t('inviteCreated')}</th>
                    <th className="py-2">{t('inviteActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {api.invites.map((inv) => (
                    <InviteRow
                      key={inv.id}
                      invite={inv}
                      kscwTeam={{ name: selectedTeam?.name ?? '', league: selectedTeam?.league ?? '' }}
                      season={{ name: seasonName }}
                      frontendUrl={frontendUrl}
                      onReissue={api.reissue}
                      onRevoke={api.revoke}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvitesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        kscwTeam={selectedTeam ? { id: selectedTeam.id, name: selectedTeam.name, league: selectedTeam.league || '' } : null}
        api={api}
      />
    </>
  )
}
