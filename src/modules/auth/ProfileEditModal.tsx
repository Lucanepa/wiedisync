import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { FormInput, FormField } from '@/components/FormField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DatePicker from '@/components/ui/DatePicker'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '../../hooks/useAuth'
import { getFileUrl } from '../../utils/pbFile'
import { coercePositions, getPositionI18nKey, getSelectablePositions } from '../../utils/memberPositions'
import { pbLangToI18n } from '../../utils/languageMap'
import { LANGUAGES, type PbLanguage } from '../../i18n/languageConfig'
import deFlag from '../../assets/flags/de.svg'
import gbFlag from '../../assets/flags/gb.svg'
import frFlag from '../../assets/flags/fr.svg'
import itFlag from '../../assets/flags/it.svg'
import chFlag from '../../assets/flags/ch.svg'

const flagMap: Record<string, string> = { de: deFlag, gb: gbFlag, fr: frFlag, it: itFlag, ch: chFlag }
import { Checkbox } from '@/components/ui/checkbox'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import type { LicenceType, MemberPosition } from '../../types'

const VB_LICENCES: { key: LicenceType; i18n: string }[] = [
  { key: 'scorer_vb', i18n: 'licenceScorer' },
  { key: 'referee_vb', i18n: 'licenceReferee' },
]

const BB_LICENCES: { key: LicenceType; i18n: string }[] = [
  { key: 'otr1_bb', i18n: 'licenceOTR1' },
  { key: 'otr2_bb', i18n: 'licenceOTR2' },
  { key: 'otn_bb', i18n: 'licenceOTN' },
  { key: 'referee_bb', i18n: 'licenceRefereeBB' },
]

interface ProfileEditModalProps {
  open: boolean
  onClose: () => void
  onboarding?: boolean
}

export default function ProfileEditModal({ open, onClose, onboarding }: ProfileEditModalProps) {
  const { user, primarySport } = useAuth()
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
  const [language, setLanguage] = useState<PbLanguage>('german')
  const [websiteVisible, setWebsiteVisible] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<MemberPosition[]>([])
  const [selectedLicences, setSelectedLicences] = useState<LicenceType[]>([])
  const [positionDropdownOpen, setPositionDropdownOpen] = useState(false)
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
      setWebsiteVisible(user.website_visible ?? true)
      setBirthdateVisibility((user.birthdate_visibility as 'full' | 'year_only' | 'hidden') || 'hidden')
      setLanguage((user.language as PbLanguage) || 'german')
      setSelectedPositions(coercePositions(user.position))
      setSelectedLicences((user.licences ?? []) as LicenceType[])
      setPositionDropdownOpen(false)
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

  function handleLanguageChange(val: PbLanguage) {
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
        const myTeams = await pb.collection('member_teams').getFullList({
          filter: `member="${user.id}"`,
        })
        const teamIds = myTeams.map((mt) => mt.team)
        if (teamIds.length > 0) {
          const teamFilter = teamIds.map((id) => `team="${id}"`).join(' || ')
          const teammates = await pb.collection('member_teams').getFullList({
            filter: `(${teamFilter}) && member!="${user.id}"`,
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

      const payload: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        number,
        hide_phone: hidePhone,
        birthdate_visibility: birthdateVisibility,
        website_visible: websiteVisible,
        language,
        position: selectedPositions.length > 0 ? selectedPositions : ['other'],
        licences: selectedLicences,
      }
      if (birthdate) {
        payload.birthdate = birthdate
      }

      // Use FormData only when uploading a photo, otherwise plain object
      if (photoFile) {
        const formData = new FormData()
        for (const [key, value] of Object.entries(payload)) {
          if (Array.isArray(value)) {
            formData.append(key, JSON.stringify(value))
          } else {
            formData.append(key, String(value))
          }
        }
        formData.append('photo', photoFile)
        await pb.collection('members').update(user.id, formData)
      } else {
        await pb.collection('members').update(user.id, payload)
      }
      logActivity('update', 'members', user.id, { first_name: firstName, last_name: lastName, email, phone, language, position: selectedPositions, licences: selectedLicences })
      // Persist language to localStorage
      localStorage.setItem('wiedisync-lang', pbLangToI18n(language))
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
  // In onboarding mode, data is pre-populated if the member was imported from Clubdesk
  const hasExistingData = onboarding && !!user.first_name

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={onboarding ? t('onboardingTitle') : t('editProfile')}
      size="lg"
      hideClose={false}
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
          <Select value={language} onValueChange={(v) => handleLanguageChange(v as PbLanguage)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.pbValue} value={lang.pbValue}>
                  <span className="flex items-center gap-2">
                    <img src={flagMap[lang.flag]} alt="" className="w-5 h-[15px] rounded-[2px]" />
                    {lang.nativeName}
                  </span>
                </SelectItem>
              ))}
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
          <div className="space-y-2">
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
            <div className="flex items-center gap-2">
              <Switch
                checked={websiteVisible}
                onCheckedChange={setWebsiteVisible}
                id="website-visible"
              />
              <label htmlFor="website-visible" className="cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                {t('websiteVisible')}
              </label>
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-500 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500"
              >
                i
              </button>
            </div>
          </div>
        </div>

        {/* Website visibility info modal */}
        <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title={t('websiteVisible')} size="sm">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('websiteVisibleInfo')}</p>
          <div className="mt-4 flex justify-end">
            <Button type="button" size="sm" onClick={() => setInfoOpen(false)}>OK</Button>
          </div>
        </Modal>

        <div className="grid grid-cols-1 gap-4">
          <FormInput
            label={`${t('firstName')}${onboarding ? ' *' : ''}`}
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <FormInput
            label={`${t('lastName')}${onboarding ? ' *' : ''}`}
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <FormInput
          label={`${t('email')}${onboarding ? ' *' : ''}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <FormInput
          label={t('phone')}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4">
          <FormInput
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

        {/* Position (checkbox dropdown) */}
        <FormField label={t('position')}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPositionDropdownOpen(!positionDropdownOpen)}
              className="flex min-h-[44px] w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-brand-500"
            >
              <span className={selectedPositions.length === 0 ? 'text-gray-400' : ''}>
                {selectedPositions.length > 0
                  ? selectedPositions.map((p) => (getPositionI18nKey(p) ? tt(getPositionI18nKey(p)!) : p)).join(', ')
                  : '—'}
              </span>
              <svg className={`h-4 w-4 text-gray-400 transition-transform ${positionDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {positionDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPositionDropdownOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  {getSelectablePositions(
                    primarySport === 'both' ? undefined : primarySport,
                    selectedPositions,
                  ).map((p) => {
                    const active = selectedPositions.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setSelectedPositions((prev) =>
                            active ? prev.filter((pos) => pos !== p) : [...prev, p],
                          )
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Checkbox checked={active} tabIndex={-1} className="pointer-events-none" />
                        {getPositionI18nKey(p) ? tt(getPositionI18nKey(p)!) : p}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </FormField>

        {/* Licences (toggle switches) */}
        <FormField label={t('licences')}>
          <div className="space-y-3">
            {(primarySport === 'basketball' ? BB_LICENCES : primarySport === 'volleyball' ? VB_LICENCES : [...VB_LICENCES, ...BB_LICENCES]).map((lic) => {
              const active = selectedLicences.includes(lic.key)
              return (
                <label key={lic.key} className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={active}
                    onCheckedChange={() => {
                      setSelectedLicences((prev) =>
                        active ? prev.filter((l) => l !== lic.key) : [...prev, lic.key],
                      )
                    }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tt(lic.i18n)}</span>
                </label>
              )
            })}
          </div>
        </FormField>

        {/* Privacy — hidden in onboarding */}
        {!onboarding && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800">
            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('privacySection')}
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Switch checked={hidePhone} onCheckedChange={setHidePhone} />
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
        {!onboarding && user.license_nr && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('managedByCoach')}
            </p>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span>{t('licenseNr')}: {user.license_nr}</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {onboarding ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              {t('skipForNow')}
            </Button>
          ) : (
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
