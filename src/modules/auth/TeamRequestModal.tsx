import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { useAuth } from '../../hooks/useAuth'
import { useCollection } from '../../lib/query'
import type { Team } from '../../types'
import { createRecord } from '../../lib/api'

interface TeamRequestModalProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
  currentTeamIds: string[]
}

interface TeamRequest {
  id: string
  collectionId: string
  collectionName: string
  member: string
  team: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  expand?: { team?: Team }
}

export default function TeamRequestModal({ open, onClose, onComplete, currentTeamIds }: TeamRequestModalProps) {
  const { t } = useTranslation('auth')
  const { user } = useAuth()
  const [selectedTeam, setSelectedTeam] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Fetch all active teams
  const { data: allTeamsRaw } = useCollection<Team>('teams', {
    filter: { active: { _eq: true } },
    sort: ['name'],
    limit: 50,
  })
  const allTeams = allTeamsRaw ?? []

  // Fetch existing pending requests for this user
  const { data: pendingRequestsRaw } = useCollection<TeamRequest>('team_requests', {
    filter: user ? { _and: [{ member: { _eq: user.id } }, { status: { _eq: 'pending' } }] } : { id: { _eq: -1 } },
    limit: 50,
  })
  const pendingRequests = pendingRequestsRaw ?? []

  const pendingTeamIds = useMemo(
    () => pendingRequests.map((r) => r.team),
    [pendingRequests],
  )

  // Filter out teams user is already on or has pending requests for
  const availableTeams = useMemo(
    () => allTeams.filter((t) => !currentTeamIds.includes(t.id) && !pendingTeamIds.includes(t.id)),
    [allTeams, currentTeamIds, pendingTeamIds],
  )

  async function handleSubmit() {
    if (!selectedTeam || !user) return
    setSubmitting(true)
    setError('')

    try {
      await createRecord('team_requests', {
        member: user.id,
        team: selectedTeam,
        status: 'pending',
      })
      setSelectedTeam('')
      onComplete()
    } catch {
      setError(t('teamRequestError'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setSelectedTeam('')
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('addTeamTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('addTeamDescription')}</p>

        {availableTeams.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('noTeamsAvailable')}</p>
        ) : (
          <SearchableSelect
            label={t('selectTeam')}
            placeholder={t('selectTeamPlaceholder')}
            value={selectedTeam}
            onChange={setSelectedTeam}
            options={availableTeams.map((t) => ({
              value: t.id,
              label: t.full_name || t.name,
            }))}
          />
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            {t('common:cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedTeam || submitting}
            loading={submitting}
          >
            {t('sendRequest')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
