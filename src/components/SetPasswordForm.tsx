import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { kscwApi } from '../lib/api'
import { FormInput } from '@/components/FormField'
import { Button } from '@/components/ui/button'

interface SetPasswordFormProps {
  title: string
  description?: string
  onSuccess: () => void
}

export function SetPasswordForm({ title, description, onSuccess }: SetPasswordFormProps) {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
        body: { password, passwordConfirm },
      })
      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
      </div>

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

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" loading={loading}>
        {loading ? t('settingPassword') : t('setPasswordButton')}
      </Button>
    </form>
  )
}
