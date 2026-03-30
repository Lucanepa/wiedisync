import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Upload, CalendarClock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { useCollection } from '../../lib/query'
import { useMutation } from '../../hooks/useMutation'
import { useRealtime } from '../../hooks/useRealtime'
import { relId } from '../../utils/relations'
import TeamFilter from '../../components/TeamFilter'
import EmptyState from '../../components/EmptyState'
import ConfirmDialog from '@/components/ConfirmDialog'
import AbsenceCard from './AbsenceCard'
import AbsenceForm from './AbsenceForm'
import AbsenceImportModal from './AbsenceImportModal'
import TeamAbsenceView from './TeamAbsenceView'
import WeeklyUnavailabilityCard from './WeeklyUnavailabilityCard'
import WeeklyUnavailabilityForm from './WeeklyUnavailabilityForm'
import { Button } from '@/components/ui/button'
import TabBar from '../../components/TabBar'
import type { Absence, Team } from '../../types'

export default function AbsencesPage() {
  const { t } = useTranslation('absences')
  const { user, isCoach, memberTeamIds, coachTeamIds } = useAuth()
  const { effectiveIsAdmin, effectiveIsCoach } = useAdminMode()
  const [activeTab, setActiveTab] = useState<'mine' | 'team' | 'weekly'>('mine')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [weeklyFormOpen, setWeeklyFormOpen] = useState(false)
  const [editingWeekly, setEditingWeekly] = useState<Absence | null>(null)

  // Fetch all active teams (needed to resolve "Alle" selection to actual IDs)
  const { data: allTeamsRaw } = useCollection<Team>('teams', { filter: { active: { _eq: true } }, sort: ['name'], limit: 50 })
  const allTeams = allTeamsRaw ?? []

  // Only show all teams when admin mode is active; otherwise scope to own teams
  const visibleTeamIds = useMemo(() => {
    if (effectiveIsAdmin) return undefined // admins in admin mode see all teams
    return [...new Set([...memberTeamIds, ...coachTeamIds])]
  }, [effectiveIsAdmin, memberTeamIds, coachTeamIds])

  // Resolve effective team IDs for TeamAbsenceView
  const effectiveTeamIds = useMemo(() => {
    if (selectedTeam) return [selectedTeam]
    // "Alle" selected — use visible teams or all teams
    if (visibleTeamIds) return visibleTeamIds
    return allTeams.map((t) => t.id)
  }, [selectedTeam, visibleTeamIds, allTeams])

  // Standard absences (exclude weekly)
  const { data: myAbsencesRaw, refetch } = useCollection<Absence>('absences', {
    filter: user ? { _and: [{ member: { _eq: user.id } }, { _or: [{ type: { _null: true } }, { type: { _neq: 'weekly' } }] }] } : { id: { _eq: -1 } },
    sort: ['-start_date'],
    limit: 50,
    fields: ['*', 'member.*'],
  })
  const myAbsences = myAbsencesRaw ?? []

  // Weekly unavailabilities
  const { data: myWeeklyRaw, refetch: refetchWeekly } = useCollection<Absence>('absences', {
    filter: user ? { _and: [{ member: { _eq: user.id } }, { type: { _eq: 'weekly' } }] } : { id: { _eq: -1 } },
    sort: ['-start_date'],
    limit: 50,
    fields: ['*', 'member.*'],
  })
  const myWeekly = myWeeklyRaw ?? []

  const { remove } = useMutation<Absence>('absences')

  useRealtime('absences', () => {
    refetch()
    refetchWeekly()
  })

  async function handleDelete() {
    if (!deletingId) return
    await remove(deletingId)
    setDeletingId(null)
    refetch()
    refetchWeekly()
  }

  function handleEdit(absence: Absence) {
    setEditingAbsence(absence)
    setFormOpen(true)
  }

  function handleFormSave() {
    setFormOpen(false)
    setEditingAbsence(null)
    refetch()
  }

  function handleWeeklyEdit(absence: Absence) {
    setEditingWeekly(absence)
    setWeeklyFormOpen(true)
  }

  function handleWeeklyFormSave() {
    setWeeklyFormOpen(false)
    setEditingWeekly(null)
    refetchWeekly()
  }

  const hasTeams = memberTeamIds.length > 0 || coachTeamIds.length > 0 || effectiveIsAdmin
  const showMineContent = activeTab === 'mine' || !hasTeams

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {activeTab !== 'weekly' && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('importAbsences')}
            </Button>
          )}
          {activeTab === 'weekly' ? (
            <Button
              onClick={() => {
                setEditingWeekly(null)
                setWeeklyFormOpen(true)
              }}
            >
              {t('newWeekly')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditingAbsence(null)
                setFormOpen(true)
              }}
            >
              {t('newAbsence')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {hasTeams && (
        <div className="mt-6">
          <TabBar
            tabs={[
              { key: 'mine' as const, label: t('tabMyAbsences') },
              { key: 'team' as const, label: t('tabTeamAbsences') },
              { key: 'weekly' as const, label: t('tabWeeklyUnavailability') },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>
      )}

      {/* Content */}
      {showMineContent ? (
        <div className="mt-6">
          {myAbsences.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-10 w-10" />}
              title={t('noAbsences')}
              description={t('noAbsencesDescription')}
            />
          ) : (
            <div className="space-y-3">
              {myAbsences.map((a) => (
                <AbsenceCard
                  key={a.id}
                  absence={a}
                  onEdit={handleEdit}
                  onDelete={setDeletingId}
                  canEdit={relId(a.member) === String(user?.id) || isCoach || effectiveIsCoach}
                />
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'team' ? (
        <div className="mt-6">
          <TeamFilter selected={selectedTeam} onChange={setSelectedTeam} limitToTeamIds={visibleTeamIds} />
          <div className="mt-4">
            <TeamAbsenceView teamIds={effectiveTeamIds} />
          </div>
        </div>
      ) : activeTab === 'weekly' ? (
        <div className="mt-6">
          {myWeekly.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-10 w-10" />}
              title={t('noWeeklyAbsences')}
              description={t('noWeeklyAbsencesDescription')}
            />
          ) : (
            <div className="space-y-3">
              {myWeekly.map((a) => (
                <WeeklyUnavailabilityCard
                  key={a.id}
                  absence={a}
                  onEdit={handleWeeklyEdit}
                  onDelete={setDeletingId}
                  canEdit={relId(a.member) === String(user?.id) || isCoach || effectiveIsCoach}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <AbsenceForm
        open={formOpen}
        absence={editingAbsence}
        onSave={handleFormSave}
        onCancel={() => {
          setFormOpen(false)
          setEditingAbsence(null)
        }}
      />

      <WeeklyUnavailabilityForm
        open={weeklyFormOpen}
        absence={editingWeekly}
        onSave={handleWeeklyFormSave}
        onCancel={() => {
          setWeeklyFormOpen(false)
          setEditingWeekly(null)
        }}
      />

      <AbsenceImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => {
          setImportOpen(false)
          refetch()
        }}
      />

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title={activeTab === 'weekly' ? t('deleteWeeklyTitle') : t('deleteTitle')}
        message={activeTab === 'weekly' ? t('deleteWeeklyMessage') : t('deleteMessage')}
        confirmLabel={t('common:delete')}
        danger
      />
    </div>
  )
}
