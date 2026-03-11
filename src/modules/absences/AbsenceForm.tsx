import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useMutation } from '../../hooks/useMutation'
import { usePB } from '../../hooks/usePB'
import Button from '../../components/ui/Button'
import { Input, Textarea, Select } from '../../components/ui/Input'
import type { Absence, Member } from '../../types'

interface AbsenceFormProps {
  open: boolean
  absence?: Absence | null
  onSave: () => void
  onCancel: () => void
}

export default function AbsenceForm({ open, absence, onSave, onCancel }: AbsenceFormProps) {
  const { t } = useTranslation('absences')
  const { user, isCoach } = useAuth()
  const { create, update, isLoading } = useMutation<Absence>('absences')
  const { data: allMembers } = usePB<Member>('members', {
    filter: 'active=true',
    sort: 'last_name',
    all: true,
    fields: 'id,first_name,last_name',
  })

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
    setAffects((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError('')

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
      approved: false,
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
        {isCoach && (
          <Select
            label={t('member')}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">{t('common:select')}</option>
            {allMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('startDate')}
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (!endDate || endDate < e.target.value) setEndDate(e.target.value)
            }}
          />
          <Input
            label={t('endDate')}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
          />
        </div>

        <Select
          label={t('reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value as Absence['reason'])}
        >
          <option value="injury">{t('reasonInjury')}</option>
          <option value="vacation">{t('reasonVacation')}</option>
          <option value="work">{t('reasonWork')}</option>
          <option value="personal">{t('reasonPersonal')}</option>
          <option value="other">{t('reasonOther')}</option>
        </Select>

        <Textarea
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
              <label key={value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={affects.includes(value)}
                  onChange={() => toggleAffect(value)}
                  className="rounded border-gray-300 dark:border-gray-600"
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
