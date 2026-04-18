import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, MessageSquareOff } from 'lucide-react'
import SwitchToggle from '@/components/SwitchToggle'
import { useAuth } from '../../../hooks/useAuth'
import { messagingApi } from '../api/messaging'
import { messagingFeatureEnabled } from '../../../utils/messagingFeatureFlag'

export default function MessagingSettingsCard() {
  const { t } = useTranslation('messaging')
  const { user } = useAuth()
  const [teamChat, setTeamChat] = useState<boolean>(user?.communications_team_chat_enabled === true)
  const [dm,       setDm]       = useState<boolean>(user?.communications_dm_enabled === true)
  const [busy, setBusy] = useState(false)

  if (!messagingFeatureEnabled() || !user) return null

  const onChangeTeamChat = async (next: boolean) => {
    const prev = teamChat
    setTeamChat(next); setBusy(true)
    try { await messagingApi.updateSettings({ team_chat_enabled: next }) }
    catch { setTeamChat(prev) }
    finally { setBusy(false) }
  }
  const onChangeDm = async (next: boolean) => {
    const prev = dm
    setDm(next); setBusy(true)
    try { await messagingApi.updateSettings({ dm_enabled: next }) }
    catch { setDm(prev) }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('settingsCardTitle')}</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('settingsCardDescription')}</p>
      <div className="mt-3 space-y-3">
        <label className="flex items-center justify-between rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mr-3">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settingsTeamChatLabel')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('settingsTeamChatHint')}</div>
          </div>
          <SwitchToggle
            enabled={teamChat}
            onChange={() => onChangeTeamChat(!teamChat)}
            ariaLabel={t('settingsTeamChatLabel')}
            iconOff={<MessageSquareOff className="h-4 w-4" />}
            iconOn={<MessageSquare className="h-4 w-4" />}
          />
        </label>
        <label className="flex items-center justify-between rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mr-3">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settingsDmLabel')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('settingsDmHint')}</div>
          </div>
          <SwitchToggle
            enabled={dm}
            onChange={() => onChangeDm(!dm)}
            ariaLabel={t('settingsDmLabel')}
            iconOff={<MessageSquareOff className="h-4 w-4" />}
            iconOn={<MessageSquare className="h-4 w-4" />}
          />
        </label>
      </div>
      {busy && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">…</div>}
    </div>
  )
}
