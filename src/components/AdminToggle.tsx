import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdminMode } from '../hooks/useAdminMode'
import SwitchToggle from '@/components/SwitchToggle'
import { Shield, ShieldCheck } from 'lucide-react'

interface AdminToggleProps {
  size?: 'sm' | 'md'
  onAfterToggle?: () => void
}

export default function AdminToggle({ size = 'sm', onAfterToggle }: AdminToggleProps) {
  const { isAdmin } = useAuth()
  const { isAdminMode, toggleAdminMode } = useAdminMode()
  const { t } = useTranslation('nav')
  const location = useLocation()
  const navigate = useNavigate()

  if (!isAdmin) return null

  const handleToggle = () => {
    // If turning off admin mode while on an admin-only route, navigate home
    if (isAdminMode && location.pathname.startsWith('/admin')) {
      navigate('/', { replace: true })
      onAfterToggle?.()
    }
    toggleAdminMode()
  }

  return (
    <SwitchToggle
      enabled={isAdminMode}
      onChange={handleToggle}
      size={size}
      ariaLabel={isAdminMode ? t('memberMode') : t('adminMode')}
      iconOff={<Shield />}
      iconOn={<ShieldCheck />}
    />
  )
}
