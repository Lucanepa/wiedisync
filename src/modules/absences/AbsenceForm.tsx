import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { useMutation } from '../../hooks/useMutation'
import { useCollection } from '../../lib/query'
import { Button } from '@/components/ui/button'
import { FormTextarea } from '@/components/FormField'
import DatePicker from '@/components/ui/DatePicker'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { Checkbox } from '@/components/ui/checkbox'
import AffectsMultiSelect from '@/components/AffectsMultiSelect'
import type { Absence, Member } from '../../types'
import { memberName } from '../../utils/relations'

interface AbsenceFormProps {
  open: boolean
  absence?: Absence | null
  onSave: () => void
  onCancel: () => void
}

export default function AbsenceForm({ open, absence, onSave, onCancel }: AbsenceFormProps) {
  const { t } = useTranslation('absences')
  const { user } = useAuth()
  const { effectiveIsAdmin } = useAdminMode()
  const { create, update, isLoading } = useMutation<Absence>('absences')
  // Admins: fetch all active members so they can create absences on behalf of others
  const { data: allMembersRaw } = useCollection<Member>('members', {
    filter: { kscw_membership_active: { _eq: true } },
    sort: ['last_name'],
    all: true,
    fields: ['id', 'first_name', 'last_name'],
    enabled: effectiveIsAdmin,
  })
  const visibleMembers = allMembersRaw ?? []

  const [memberId, setMemberId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState<Absence['reason']>('other')
  const [reasonDetail, setReasonDetail] = useState('')
  const [affects, setAffects] = useState<string[]>(['all'])
  const [indefinite, setIndefinite] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (absence) {
      setMemberId(absence.member)
      setStartDate(absence.start_date.split(' ')[0])
      setEndDate(absence.indefinite ? '' : absence.end_date.split(' ')[0])
      setReason(absence.reason)
      setReasonDetail(absence.reason_detail)
      setAffects(absence.affects ?? ['all'])
      setIndefinite(absence.indefinite ?? false)
    } else {
      setMemberId(user?.id ?? '')
      setStartDate('')
      setEndDate('')
      setReason('other')
      setReasonDetail('')
      setAffects(['all'])
      setIndefinite(false)
    }
    setValidationError('')
  }, [absence, user, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError('')

    if (effectiveIsAdmin && !memberId) {
      setValidationError(t('memberRequired'))
      return
    }
    if (!startDate) {
      setValidationError(t('startDateRequired'))
      return
    }
    if (!indefinite && !endDate) {
      setValidationError(t('endDateRequired'))
      return
    }
    if (!indefinite && endDate < startDate) {
      setValidationError(t('endAfterStart'))
      return
    }

    const data = {
      member: memberId || user?.id,
      start_date: startDate,
      end_date: indefinite ? '2099-12-31' : endDate,
      reason,
      reason_detail: reasonDetail,
      affects,
      type: 'standard' as const,
      indefinite,
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
        {effectiveIsAdmin && (
          <SearchableSelect
            label={t('member')}
            placeholder={t('common:select')}
            value={memberId}
            onChange={setMemberId}
            options={visibleMembers.map((m) => ({ value: m.id, label: memberName(m) || '—' }))}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker
            label={t('startDate')}
            value={startDate}
            onChange={(v) => {
              setStartDate(v)
              if (!indefinite && (!endDate || endDate < v)) setEndDate(v)
            }}
          />
          {!indefinite && (
            <DatePicker
              label={t('endDate')}
              value={endDate}
              onChange={setEndDate}
              min={startDate}
            />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <Checkbox
            checked={indefinite}
            onCheckedChange={(checked) => setIndefinite(checked === true)}
          />
          {t('indefinite')}
          <span className="text-gray-400 dark:text-gray-500">({t('indefiniteHint')})</span>
        </label>

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

        <AffectsMultiSelect
          label={t('affects')}
          selected={affects}
          onChange={setAffects}
        />

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
