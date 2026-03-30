import { useState, type FormEvent } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../hooks/useTheme'
import { kscwApi } from '../../lib/api'
import { FormInput } from '@/components/FormField'
import { Button } from '@/components/ui/button'

export default function SetPasswordPage() {
  const { t } = useTranslation('auth')
  const { theme } = useTheme()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('passwordTooShort'))
      return
    }
    if (password !== passwordConfirm) {
      setError(t('passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await kscwApi('/set-password', {
        method: 'POST',
        body: { password, token },
      })
      setSuccess(true)
    } catch {
      setError(t('resetError'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{t('resetError')}</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    )
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
          {success ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-green-600 dark:text-green-400">{t('resetSuccess')}</p>
              <Link to="/login" className="inline-block text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400">
                {t('backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h1 className="text-center text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('resetPasswordTitle')}
              </h1>

              <FormInput
                label={t('newPassword')}
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />

              <FormInput
                label={t('confirmPassword')}
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? t('resettingPassword') : t('resetPasswordButton')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
