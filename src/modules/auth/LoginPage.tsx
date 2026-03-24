import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import pb from '../../pb'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/FormField'
import { Switch } from '@/components/ui/switch'
import { OtpInput } from '../../components/OtpInput'
import { SetPasswordForm } from '../../components/SetPasswordForm'

const TURNSTILE_SITE_KEY = '0x4AAAAAACoYmx3xiDfRbmv9'

type Mode = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-set-password'

export default function LoginPage() {
  const { login, user } = useAuth()
  const { theme } = useTheme()
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { email?: string; accountExists?: boolean } | null

  // Persist redirect state to sessionStorage so it survives page refresh
  const [email, setEmail] = useState(() => {
    if (locationState?.email) {
      sessionStorage.setItem('login-redirect-email', locationState.email)
      return locationState.email
    }
    return sessionStorage.getItem('login-redirect-email') ?? ''
  })
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAccountExists, setShowAccountExists] = useState(() => {
    if (locationState?.accountExists) {
      sessionStorage.setItem('login-redirect-exists', 'true')
      return true
    }
    const stored = sessionStorage.getItem('login-redirect-exists') === 'true'
    if (stored) sessionStorage.removeItem('login-redirect-exists')
    return stored
  })
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<TurnstileInstance>(null)

  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem('wiedisync-remember-me') !== 'false',
  )

  // OTP forgot-password flow state
  const [mode, setMode] = useState<Mode>('login')
  const [otpId, setOtpId] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false)

  useEffect(() => {
    // Don't redirect when user is setting password after OTP
    if (mode === 'forgot-set-password') return
    if (user) navigate('/', { replace: true })
  }, [user, navigate, mode])

  function resetToLogin() {
    setMode('login')
    setOtpId('')
    setOtpError('')
    setOtpLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setShowAccountExists(false)
    localStorage.setItem('wiedisync-remember-me', String(rememberMe))
    try {
      await login(email, password, turnstileToken)
      sessionStorage.removeItem('login-redirect-email')
      sessionStorage.removeItem('login-redirect-exists')
      navigate('/', { replace: true })
    } catch {
      setError(t('invalidCredentials'))
      turnstileRef.current?.reset()
      setTurnstileToken('')
    } finally {
      setLoading(false)
    }
  }

  async function requestOtp(targetEmail: string) {
    setOtpLoading(true)
    setError('')
    setOtpError('')
    try {
      const result = await pb.collection('members').requestOTP(targetEmail.trim().toLowerCase())
      setOtpId(result.otpId)
      setEmail(targetEmail.trim().toLowerCase())
      setMode('forgot-otp')
    } catch {
      // Generic error — don't reveal if email exists
      setError(t('otpRequestFailed'))
    } finally {
      setOtpLoading(false)
    }
  }

  function handleForgotPasswordClick() {
    setError('')
    setPasswordResetSuccess(false)
    if (email.trim()) {
      requestOtp(email)
    } else {
      setMode('forgot-email')
    }
  }

  async function handleOtpComplete(code: string) {
    setOtpError('')
    setOtpLoading(true)
    try {
      await pb.collection('members').authWithOTP(otpId, code)
      setMode('forgot-set-password')
    } catch {
      setOtpError(t('otpInvalid'))
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleOtpResend() {
    setOtpError('')
    try {
      const result = await pb.collection('members').requestOTP(email.trim().toLowerCase())
      setOtpId(result.otpId)
    } catch {
      setOtpError(t('otpRequestFailed'))
    }
  }

  function handlePasswordSetSuccess() {
    pb.authStore.clear()
    setPasswordResetSuccess(true)
    resetToLogin()
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

          {/* ── LOGIN MODE ── */}
          {mode === 'login' && (
            <>
              <h1 className="mb-6 text-center text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('signIn')}
              </h1>

              {showAccountExists && (
                <div className="mb-4 rounded-lg bg-blue-50 p-3 text-center text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                  {t('accountAlreadyExists')}
                </div>
              )}

              {passwordResetSuccess && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  {t('passwordResetSuccess')}
                </div>
              )}

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

                <div>
                  <FormInput
                    type="password"
                    label={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder={t('passwordPlaceholder')}
                  />
                  <div className="mt-1 text-right">
                    <button
                      type="button"
                      onClick={handleForgotPasswordClick}
                      disabled={otpLoading}
                      className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      {otpLoading ? t('sendingOtp') : t('forgotPassword')}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={rememberMe} onCheckedChange={setRememberMe} id="remember-me" />
                  <label htmlFor="remember-me" className="text-sm text-gray-600 dark:text-gray-400">
                    {t('rememberMe')}
                  </label>
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken('')}
                  options={{ theme: 'auto', size: 'invisible' }}
                />

                <Button type="submit" loading={loading} className="w-full">
                  {loading ? t('signingIn') : t('signIn')}
                </Button>

              </form>
            </>
          )}

          {/* ── FORGOT EMAIL MODE ── */}
          {mode === 'forgot-email' && (
            <>
              <h1 className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('resetPasswordOtp')}
              </h1>
              <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('resetPasswordOtpEmailDescription')}
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (email.trim()) requestOtp(email)
                }}
                className="space-y-4"
              >
                <FormInput
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

                <Button type="submit" loading={otpLoading} className="w-full">
                  {otpLoading ? t('sendingOtp') : t('sendOtp')}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={resetToLogin}
                  className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  {t('backToLogin')}
                </button>
              </div>
            </>
          )}

          {/* ── FORGOT OTP MODE ── */}
          {mode === 'forgot-otp' && (
            <>
              <h1 className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('resetPasswordOtp')}
              </h1>
              <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('resetPasswordOtpDescription')}
              </p>

              <OtpInput
                email={email}
                onComplete={handleOtpComplete}
                onResend={handleOtpResend}
                loading={otpLoading}
                error={otpError}
              />

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={resetToLogin}
                  className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  {t('backToLogin')}
                </button>
              </div>
            </>
          )}

          {/* ── FORGOT SET PASSWORD MODE ── */}
          {mode === 'forgot-set-password' && (
            <>
              <SetPasswordForm
                title={t('resetPasswordOtp')}
                description={t('resetPasswordOtpSetDescription')}
                onSuccess={handlePasswordSetSuccess}
              />

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={resetToLogin}
                  className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  {t('backToLogin')}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
