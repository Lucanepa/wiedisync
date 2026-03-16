import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { FormInput, FormField } from '@/components/FormField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DatePicker from '@/components/ui/DatePicker'
import { useAuth } from '../../hooks/useAuth'
import { getFileUrl } from '../../utils/pbFile'
import { coercePositions, getPositionI18nKey } from '../../utils/memberPositions'
import { pbLangToI18n } from '../../utils/languageMap'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import type { LicenceType } from '../../types'

const LICENCE_LABELS: Record<LicenceType, string> = {
  scorer_vb: 'licenceScorer',
  referee_vb: 'licenceReferee',
  otr1_bb: 'licenceOTR1',
  otr2_bb: 'licenceOTR2',
  otn_bb: 'licenceOTN',
  referee_bb: 'licenceRefereeBB',
}

interface ProfileEditModalProps {
  open: boolean
  onClose: () => void
  onboarding?: boolean
}

export default function ProfileEditModal({ open, onClose, onboarding }: ProfileEditModalProps) {
  const { user, clubId } = useAuth()
  const { t, i18n } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const { t: tt } = useTranslation('teams')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [number, setNumber] = useState<number>(0)
  const [birthdate, setBirthdate] = useState('')
  const [hidePhone, setHidePhone] = useState(false)
  const [birthdateVisibility, setBirthdateVisibility] = useState<'full' | 'year_only' | 'hidden'>('full')
  const [language, setLanguage] = useState<'german' | 'english'>('german')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    if (user && open) {
      setFirstName(user.first_name ?? '')
      setLastName(user.last_name ?? '')
      setEmail(user.email ?? '')
      setPhone(user.phone ?? '')
      setNumber(user.number ?? 0)
      setBirthdate(user.birthdate ? user.birthdate.slice(0, 10) : '')
      setHidePhone(user.hide_phone ?? false)
      setBirthdateVisibility((user.birthdate_visibility as 'full' | 'year_only' | 'hidden') || 'full')
      setLanguage((user.language as 'german' | 'english') || 'german')
      setPhotoFile(null)
      setPhotoPreview(null)
      setError('')
      setResetSent(false)
      setResetLoading(false)
    }
  }, [user, open])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError(t('fileTooLarge'))
      return
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError(t('invalidImageType'))
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function handleLanguageChange(val: 'german' | 'english') {
    setLanguage(val)
    // Immediately preview the chosen language in the UI
    i18n.changeLanguage(pbLangToI18n(val))
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    setResetLoading(true)
    try {
      await pb.collection('members').requestPasswordReset(user.email)
      setResetSent(true)
    } catch {
      setError(t('errorSaving'))
    } finally {
      setResetLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setLoading(true)

    try {
      // Check for duplicate number in the same team(s)
      if (number > 0 && number !== user.number) {
        const clubPrefix = clubId ? `club="${clubId}" && ` : ''
        const myTeams = await pb.collection('member_teams').getFullList({
          filter: `${clubPrefix}member="${user.id}"`,
        })
        const teamIds = myTeams.map((mt) => mt.team)
        if (teamIds.length > 0) {
          const teamFilter = teamIds.map((id) => `team="${id}"`).join(' || ')
          const teammates = await pb.collection('member_teams').getFullList({
            filter: `${clubPrefix}(${teamFilter}) && member!="${user.id}"`,
            expand: 'member',
          })
          const conflict = teammates.find(
            (mt) => (mt.expand as { member?: { number?: number } })?.member?.number === number
          )
          if (conflict) {
            const conflictName = (conflict.expand as { member?: { name?: string } })?.member?.name ?? '?'
            setError(t('numberTaken', { name: conflictName }))
            setLoading(false)
            return
          }
        }
      }

      const formData = new FormData()
      formData.append('first_name', firstName)
      formData.append('last_name', lastName)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('number', String(number))
      formData.append('hide_phone', String(hidePhone))
      formData.append('birthdate_visibility', birthdateVisibility)
      formData.append('language', language)
      if (birthdate) {
        formData.append('birthdate', birthdate)
      }
      if (photoFile) {
        formData.append('photo', photoFile)
      }

      await pb.collection('members').update(user.id, formData)
      logActivity('update', 'members', user.id, { first_name: firstName, last_name: lastName, email, phone, language })
      // Persist language to localStorage
      localStorage.setItem('kscw-lang', pbLangToI18n(language))
      await pb.collection('members').authRefresh()
      onClose()
    } catch {
      setError(t('errorSaving'))
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
  const currentPhoto = photoPreview
    ?? (user.photo ? getFileUrl('members', user.id, user.photo) : null)
  const positions = coercePositions(user.position)

  // In onboarding mode, data is pre-populated if the member was imported from Clubdesk
  const hasExistingData = onboarding && !!user.first_name

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={onboarding ? t('onboardingTitle') : t('editProfile')}
      size="lg"
      hideClose={onboarding}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Onboarding subtitle */}
        {onboarding && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('onboardingSubtitle')}
          </p>
        )}

        {/* Clubdesk notice */}
        {hasExistingData && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {t('clubdeskNotice')}
          </div>
        )}

        {/* Language selector */}
        <FormField label={`${t('language')}${onboarding ? ' *' : ''}`}>
          <Select value={language} onValueChange={(v) => handleLanguageChange(v as 'german' | 'english')}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="german">{t('languageGerman')}</SelectItem>
              <SelectItem value="english">{t('languageEnglish')}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {/* Photo */}
        <div className="flex items-center gap-4">
          {currentPhoto ? (
            <img
              src={currentPhoto}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {initials}
            </div>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('changePhoto')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Input
            label={`${t('firstName')}${onboarding ? ' *' : ''}`}
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label={`${t('lastName')}${onboarding ? ' *' : ''}`}
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <Input
          label={`${t('email')}${onboarding ? ' *' : ''}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label={t('phone')}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4">
          <Input
            label={t('number')}
            type="number"
            min={0}
            max={99}
            value={number || ''}
            onChange={(e) => setNumber(parseInt(e.target.value) || 0)}
            placeholder="#"
          />
          <DatePicker
            label={t('birthdate')}
            value={birthdate}
            onChange={setBirthdate}
          />
        </div>

        {/* Privacy — hidden in onboarding */}
        {!onboarding && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800">
            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('privacySection')}
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidePhone}
                  onChange={(e) => setHidePhone(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-500 dark:bg-gray-700"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('hidePhone')}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('hidePhoneHint')}</p>
                </div>
              </label>
              <FormField label={t('birthdateVisibility')}>
                <Select value={birthdateVisibility} onValueChange={(v) => setBirthdateVisibility(v as 'full' | 'year_only' | 'hidden')}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">{t('birthdateVisibilityFull')}</SelectItem>
                    <SelectItem value="year_only">{t('birthdateVisibilityYearOnly')}</SelectItem>
                    <SelectItem value="hidden">{t('birthdateVisibilityHidden')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>
        )}

        {/* Change Password — hidden in onboarding */}
        {!onboarding && (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('changePassword')}
            </span>
            {resetSent ? (
              <span className="text-sm text-green-600 dark:text-green-400">
                {t('resetLinkSent')}
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePasswordReset}
                loading={resetLoading}
              >
                {resetLoading ? tc('saving') : t('sendResetLink')}
              </Button>
            )}
          </div>
        )}

        {/* Read-only fields — hidden in onboarding */}
        {!onboarding && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('managedByCoach')}
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
              {user.license_nr && <span>{t('licenseNr')}: {user.license_nr}</span>}
              <span>
                {t('position')}: {positions.length > 0
                  ? positions.map((p) => (getPositionI18nKey(p) ? tt(getPositionI18nKey(p)!) : p)).join(', ')
                  : '—'}
              </span>
            </div>
            {user.licences?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.licences.map((l) => (
                  <span key={l} className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    {tt(LICENCE_LABELS[l as LicenceType])}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {!onboarding && (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              {tc('cancel')}
            </Button>
          )}
          <Button
            type="submit"
            loading={loading}
          >
            {loading ? tc('saving') : onboarding ? t('completeProfile') : tc('save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
