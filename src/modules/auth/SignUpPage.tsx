import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { usePB } from '../../hooks/usePB'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import Button from '../../components/ui/Button'
import PrivacyNotice from '../../components/PrivacyNotice'
import { Input, Select } from '../../components/ui/Input'
import type { Team } from '../../types'

type Step = 'email' | 'claim' | 'register'

export default function SignUpPage() {
  const { login, user, isApproved } = useAuth()
  const { theme } = useTheme()
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<'german' | 'english'>('german')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedSport, setSelectedSport] = useState<'volleyball' | 'basketball'>('volleyball')
  const [isGuest, setIsGuest] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const { data: teams } = usePB<Team>('teams', {
    filter: 'active=true',
    sort: 'name',
    all: true,
  })

  const filteredTeams = teams.filter((t) => t.sport === selectedSport)

  useEffect(() => {
    if (user && isApproved) navigate('/', { replace: true })
    if (user && !isApproved) navigate('/pending', { replace: true })
  }, [user, isApproved, navigate])

  // Step 1: Check if email exists
  async function handleEmailCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await pb.send('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      if (res.exists) {
        // Email found — send password reset
        await pb.collection('members').requestPasswordReset(email.trim().toLowerCase())
        setStep('claim')
        setResetSent(true)
      } else {
        // New member — show full registration form
        setStep('register')
      }
    } catch {
      setError(t('registrationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Register new member
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError(t('passwordMismatch'))
      return
    }

    if (!selectedTeam) {
      setError(t('teamRequired'))
      return
    }

    setLoading(true)
    try {
      const newMember = await pb.collection('members').create({
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`,
        email: email.trim().toLowerCase(),
        emailVisibility: true,
        password,
        passwordConfirm,
        role: ['user'],
        active: true,
        approved: false,
        requested_team: selectedTeam,
        is_guest: isGuest,
        member_active: true,
        language: selectedLanguage,
      })
      await login(email.trim().toLowerCase(), password)
      logActivity('create', 'members', newMember.id, { first_name: firstName, last_name: lastName, requested_team: selectedTeam })
      navigate('/pending', { replace: true })
    } catch {
      setError(t('registrationFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img
            src={theme === 'light' ? '/kscw_blau.png' : '/kscw_weiss.png'}
            alt="KSC Wiedikon"
            className="h-16 w-auto"
          />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg sm:p-8 dark:bg-gray-800">
          <h1 className="mb-6 text-center text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('createAccount')}
          </h1>

          {/* Step 1: Email check */}
          {step === 'email' && (
            <form onSubmit={handleEmailCheck} className="space-y-4">
              <Input
                type="email"
                label={t('email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t('emailPlaceholder')}
              />

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? t('checkingEmail') : t('continue')}
              </Button>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                {t('alreadyHaveAccount')}{' '}
                <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400">
                  {t('signIn')}
                </Link>
              </p>
            </form>
          )}

          {/* Step 2: Account claim (email exists) */}
          {step === 'claim' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('accountExists')}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('accountExistsDescription')}
                </p>
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {email}
                </p>
              </div>

              {resetSent && (
                <div className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  {t('resetLinkSent')}
                </div>
              )}

              <div className="space-y-2">
                <Link
                  to="/login"
                  className="block w-full rounded-lg bg-brand-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-600"
                >
                  {t('signIn')}
                </Link>
                <Button variant="secondary" onClick={() => { setStep('email'); setError(''); setResetSent(false) }} className="w-full">
                  {t('tryDifferentEmail')}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: New member registration */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Email (read-only) */}
              <div>
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    label={t('email')}
                    value={email}
                    readOnly
                    className="bg-gray-50 dark:bg-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setError('') }}
                    className="mt-6 shrink-0 text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400"
                  >
                    {t('change')}
                  </button>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('language')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['german', 'english'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLanguage(lang)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedLanguage === lang
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t(lang === 'german' ? 'languageGerman' : 'languageEnglish')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="text"
                  label={t('firstName')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                />
                <Input
                  type="text"
                  label={t('lastName')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>

              {/* Sport toggle */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tc('sport')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['volleyball', 'basketball'] as const).map((sport) => (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => { setSelectedSport(sport); setSelectedTeam('') }}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedSport === sport
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {tc(sport)}
                    </button>
                  ))}
                </div>
              </div>

              <Select
                label={t('selectTeam')}
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                required
              >
                <option value="">{t('selectTeamPlaceholder')}</option>
                {filteredTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}{team.league ? ` — ${team.league}` : ''}
                  </option>
                ))}
              </Select>

              {/* Guest checkbox */}
              <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-700">
                <input
                  type="checkbox"
                  checked={isGuest}
                  onChange={(e) => setIsGuest(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t('isGuest')}
                  </span>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t('guestExplanation')}
                  </p>
                </div>
              </label>

              <Input
                type="password"
                label={t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder={t('passwordPlaceholder')}
              />

              <Input
                type="password"
                label={t('confirmPassword')}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? t('creatingAccount') : t('signUp')}
              </Button>
            </form>
          )}
        </div>
      </div>
      <PrivacyNotice />
    </div>
  )
}
