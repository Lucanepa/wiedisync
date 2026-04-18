import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../hooks/useAuth'
import { useConversations } from '../hooks/useConversations'
import { useConversation } from '../hooks/useConversation'
import ConversationThread from './ConversationThread'
import MessageComposer from './MessageComposer'
import MessagingDisabledBanner from './MessagingDisabledBanner'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  teamId: string
}

export default function TeamMessagesTab({ teamId }: Props) {
  const { t } = useTranslation('messaging')
  const { user } = useAuth()
  const { conversations, markRead, toggleMute } = useConversations()
  const conv = useMemo(
    () => conversations.find(c => c.type === 'team' && String(c.team) === String(teamId)) ?? null,
    [conversations, teamId],
  )
  const { messages, isLoading, send, sendError } = useConversation(conv?.id ?? null)

  // Auto-mark-read on open + when new messages arrive while in view
  useEffect(() => {
    if (conv?.id && conv.unread_count > 0) void markRead(conv.id)
  }, [conv?.id, conv?.unread_count, markRead])

  const teamChatEnabled = user?.communications_team_chat_enabled === true
  if (!teamChatEnabled) {
    return <div className="p-4"><MessagingDisabledBanner /></div>
  }

  if (!conv) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[60vh] md:min-h-[500px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="font-semibold text-sm">{t('threadTitle')}</h3>
        <Button
          variant="ghost" size="sm"
          onClick={() => toggleMute(conv.id)}
          aria-label={conv.muted ? t('unmute') : t('mute')}
          title={conv.muted ? t('unmute') : t('mute')}
        >
          {conv.muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </Button>
      </div>
      <ConversationThread
        messages={messages}
        currentMemberId={user?.id ?? null}
        isLoading={isLoading}
      />
      <MessageComposer
        onSend={send}
      />
      {sendError && (
        <div className="text-xs text-destructive px-3 pb-2">{t('failedToSend')}</div>
      )}
    </div>
  )
}
