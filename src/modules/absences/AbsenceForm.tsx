import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { useMutation } from '../../hooks/useMutation'
import { usePB } from '../../hooks/usePB'
import { Button } from '@/components/ui/button'
import { FormTextarea } from '@/components/FormField'
import DatePicker from '@/components/ui/DatePicker'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { Checkbox } from '@/components/ui/checkbox'
import type { Absence, Member, MemberTeam } from '../../types'

interface AbsenceFormProps {
  open: boolean
  absence?: Absence | null
  onSave: () => void
  onCancel: () => void
}

export default function AbsenceForm({ open, absence, onSave, onCancel }: AbsenceFormProps) {
  const { t } = useTranslation('absences')
  const { user, coachTeamIds } = useAuth()
  const { effectiveIsCoach, effectiveIsAdmin } = useAdminMode()
  const { create, update, isLoading } = useMutation<Absence>('absences')
  // Admins: fetch all active members directly
  const { data: allMembers } = usePB<Member>('members', {
    filter: 'kscw_membership_active=true',
    sort: 'last_name',
    all: true,
    fields: 'id,first_name,last_name,name',
    enabled: effectiveIsAdmin,
  })

  // Coaches: fetch team members via member_teams with expanded member data
  const { data: memberTeams, error: memberTeamsError } = usePB<MemberTeam & { expand?: { member?: Member } }>('member_teams', {
    filter: coachTeamIds.map((id) => `team="${id}"`).join(' || '),
    expand: 'member',
    all: true,
    enabled: effectiveIsCoach && !effectiveIsAdmin && coachTeamIds.length > 0,
  })

  // Build visible members: admins see all, coaches see their team members
  const visibleMembers = useMemo(() => {
    if (effectiveIsAdmin) return allMembers
    // Deduplicate members (same member on multiple teams)
    const seen = new Set<string>()
    const members: Member[] = []
    for (const mt of memberTeams) {
      const m = mt.expand?.member
      if (m && !seen.has(m.id)) {
        seen.add(m.id)
        members.push(m)
      }
    }
    return members.sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''))
  }, [allMembers, memberTeams, effectiveIsAdmin])

  const [memberId, setMemberId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState<Absence['reason']>('other')
  const [reasonDetail, setReasonDetail] = useState('')
  const [affects, setAffects] = useState<string[]>(['all'])
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (absence) {
      setMemberId(absence.member)
      setStartDate(absence.start_date.split(' ')[0])
      setEndDate(absence.end_date.split(' ')[0])
      setReason(absence.reason)
      setReasonDetail(absence.reason_detail)
      setAffects(absence.affects ?? ['all'])
    } else {
      setMemberId(user?.id ?? '')
      setStartDate('')
      setEndDate('')
      setReason('other')
      setReasonDetail('')
      setAffects(['all'])
    }
    setValidationError('')
  }, [absence, user, open])

  function toggleAffect(value: string) {
    if (value === 'all') {
      setAffects(['all'])
    } else {
      setAffects((prev) => {
        const without = prev.filter((a) => a !== 'all')
        const toggled = without.includes(value)
          ? without.filter((a) => a !== value)
          : [...without, value]
        // both selected = all; none selected = all
        if (toggled.length === 0 || (toggled.includes('trainings') && toggled.includes('games'))) {
          return ['all']
        }
        return toggled
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError('')

    if (effectiveIsCoach && !memberId) {
      setValidationError(t('memberRequired'))
      return
    }
    if (!startDate) {
      setValidationError(t('startDateRequired'))
      return
    }
    if (!endDate) {
      setValidationError(t('endDateRequired'))
      return
    }
    if (endDate < startDate) {
      setValidationError(t('endAfterStart'))
      return
    }

    const data = {
      member: memberId || user?.id,
      start_date: startDate,
      end_date: endDate,
      reason,
      reason_detail: reasonDetail,
      affects,
    }

    try {
      if (absence) {
        await update(absence.id, data)
      } else {
        await create(data)
      }
      onSave()
    } catch {
      setValidationError(t('errorSaving'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={absence ? t('editAbsenceTitle') : t('newAbsenceTitle')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {effectiveIsCoach && (
          <SearchableSelect
            label={t('member')}
            placeholder={t('common:select')}
            value={memberId}
            onChange={setMemberId}
            options={visibleMembers.map((m) => ({ value: m.id, label: m.name || `${m.first_name} ${m.last_name}` }))}
            error={memberTeamsError ? t('common:errorLoading') : undefined}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker
            label={t('startDate')}
            value={startDate}
            onChange={(v) => {
              setStartDate(v)
              if (!endDate || endDate < v) setEndDate(v)
            }}
          />
          <DatePicker
            label={t('endDate')}
            value={endDate}
            onChange={setEndDate}
            min={startDate}
          />
        </div>

        <SearchableSelect
          label={t('reason')}
          value={reason}
          onChange={(v) => setReason(v as Absence['reason'])}
          options={[
            { value: 'injury', label: t('reasonInjury') },
            { value: 'vacation', label: t('reasonVacation') },
            { value: 'work', label: t('reasonWork') },
            { value: 'personal', label: t('reasonPersonal') },
            { value: 'other', label: t('reasonOther') },
          ]}
        />

        <FormTextarea
          label={t('detailsOptional')}
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          rows={2}
          placeholder={t('detailsPlaceholder')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('affects')}</label>
          <div className="mt-2 flex gap-4">
            {(['trainings', 'games', 'all'] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <Checkbox
                  checked={affects.includes(value)}
                  onCheckedChange={() => toggleAffect(value)}
                />
                {value === 'trainings' ? t('affectsTrainings') : value === 'games' ? t('affectsGames') : t('affectsAll')}
              </label>
            ))}
          </div>
        </div>

        {validationError && (
          <p className="text-sm text-red-600">{validationError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {isLoading ? t('common:saving') : t('common:save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
