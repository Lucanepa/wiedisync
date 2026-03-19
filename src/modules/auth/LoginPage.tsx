import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/FormField'
import { Switch } from '@/components/ui/switch'

export default function LoginPage() {
  const { login, user } = useAuth()
  const { theme } = useTheme()
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(() => (location.state as { email?: string })?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem('wiedisync-remember-me') !== 'false',
  )

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    localStorage.setItem('wiedisync-remember-me', String(rememberMe))
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError(t('invalidCredentials'))
    } finally {
      setLoading(false)
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
          <h1 className="mb-6 text-center text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('signIn')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              type="email"
              label={t('email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
            />

            <FormInput
              type="password"
              label={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder={t('passwordPlaceholder')}
            />

            <div className="flex items-center gap-2">
              <Switch checked={rememberMe} onCheckedChange={setRememberMe} id="remember-me" />
              <label htmlFor="remember-me" className="text-sm text-gray-600 dark:text-gray-400">
                {t('rememberMe')}
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
