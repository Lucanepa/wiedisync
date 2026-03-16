import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useAdminMode } from '../hooks/useAdminMode'
import SwitchToggle from '@/components/SwitchToggle'
import { Shield, ShieldCheck } from 'lucide-react'

interface AdminToggleProps {
  size?: 'sm' | 'md'
}

export default function AdminToggle({ size = 'sm' }: AdminToggleProps) {
  const { isAdmin } = useAuth()
  const { isAdminMode, toggleAdminMode } = useAdminMode()
  const { t } = useTranslation('nav')

  if (!isAdmin) return null

  return (
    <SwitchToggle
      enabled={isAdminMode}
      onChange={toggleAdminMode}
      size={size}
      ariaLabel={isAdminMode ? t('memberMode') : t('adminMode')}
      iconOff={<Shield />}
      iconOn={<ShieldCheck />}
    />
  )
}
