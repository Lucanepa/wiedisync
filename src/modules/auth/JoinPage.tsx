import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../hooks/useTheme'
import pb from '../../pb'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/FormField'

interface InviteInfo {
  team_name: string
  role: 'player' | 'guest'
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const { theme } = useTheme()
  const { t } = useTranslation(['join', 'teams', 'auth', 'common'])
  const navigate = useNavigate()

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [inviteError, setInviteError] = useState(false)
  const [loadingInfo, setLoadingInfo] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)
  const [claimedEmail, setClaimedEmail] = useState('')

  useEffect(() => {
    if (!token) {
      setInviteError(true)
      setLoadingInfo(false)
      return
    }
    pb.send('/api/team-invites/info/' + token, { method: 'GET' })
      .then((res: InviteInfo) => {
        setInviteInfo(res)
      })
      .catch(() => {
        setInviteError(true)
      })
      .finally(() => {
        setLoadingInfo(false)
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    try {
      const res = await pb.send('/api/team-invites/claim', {
        method: 'POST',
        body: { token, first_name: firstName, last_name: lastName, email: email.trim().toLowerCase() },
      })
      setClaimedEmail(res.email ?? email.trim().toLowerCase())
      setSuccess(true)
      try {
        await pb.collection('members').requestPasswordReset(res.email ?? email.trim().toLowerCase())
      } catch {
        // Non-critical — ignore errors
      }
    } catch {
      setSubmitError(t('join:error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img
            src={theme === 'light' ? '/wiedisync_blau.png' : '/wiedisync_weiss.png'}
            alt="KSC Wiedikon"
            className="h-16 w-auto"
          />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg sm:p-8 dark:bg-gray-800">
          {loadingInfo ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              {t('common:loading')}
            </p>
          ) : inviteError ? (
            <div className="space-y-3 text-center">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('join:error')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('join:invalidLink')}
              </p>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('join:success')}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('join:successDesc', { teamName: inviteInfo?.team_name })}
                </p>
                {claimedEmail && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    {claimedEmail}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  {t('join:passwordLater')}
                </p>
              </div>
              <Button onClick={() => navigate('/login', { replace: true })} className="w-full">
                {t('join:goToLogin')}
              </Button>
            </div>
          ) : inviteInfo ? (
            <div className="space-y-5">
              {/* Header: team name + role badge */}
              <div className="text-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('join:title', { teamName: inviteInfo.team_name })}
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">KSC Wiedikon</p>
                <span className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  inviteInfo.role === 'player'
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'bg-gold-100 text-gold-800 dark:bg-gold-400/20 dark:text-gold-300'
                }`}>
                  {t('join:joiningAs', {
                    role: inviteInfo.role === 'player' ? t('teams:player') : t('teams:guest'),
                  })}
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="text"
                    label={t('auth:firstName')}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                  />
                  <FormInput
                    type="text"
                    label={t('auth:lastName')}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </div>

                <FormInput
                  type="email"
                  label={t('auth:email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                />

                {submitError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                )}

                <Button type="submit" loading={submitting} className="w-full">
                  {t('join:joinTeam')}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
