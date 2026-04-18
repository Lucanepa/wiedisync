import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../hooks/useAuth'
import { useConversation } from '../hooks/useConversation'
import ConversationThread from './ConversationThread'
import MessageComposer from './MessageComposer'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ConversationSummary } from '../api/types'

type Props = {
  conversation: ConversationSummary
  onMarkRead: (id: string) => void
  onToggleMute: (id: string) => void
  /** Optional content rendered above the thread (e.g. pending-request banner). */
  header?: ReactNode
  /** Disable the composer (e.g. declined request, opted out). */
  composerDisabled?: boolean
  /** Custom title shown in the compact header bar. Falls back to i18n threadTitle. */
  title?: string
}

export default function ThreadView({ conversation, onMarkRead, onToggleMute, header, composerDisabled, title }: Props) {
  const { t } = useTranslation('messaging')
  const { user } = useAuth()
  const { messages, isLoading, send, sendError } = useConversation(conversation.id)

  useEffect(() => {
    if (conversation.id && conversation.unread_count > 0) onMarkRead(conversation.id)
  }, [conversation.id, conversation.unread_count, onMarkRead])

  return (
    <div className="flex flex-col h-full min-h-[60vh] md:min-h-[500px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="font-semibold text-sm truncate">{title ?? t('threadTitle')}</h3>
        <Button
          variant="ghost" size="sm"
          onClick={() => onToggleMute(conversation.id)}
          aria-label={conversation.muted ? t('unmute') : t('mute')}
          title={conversation.muted ? t('unmute') : t('mute')}
        >
          {conversation.muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </Button>
      </div>
      {header}
      <ConversationThread
        messages={messages}
        currentMemberId={user?.id ?? null}
        isLoading={isLoading}
      />
      <MessageComposer onSend={send} disabled={composerDisabled} />
      {sendError && (
        <div className="text-xs text-destructive px-3 pb-2">{t('failedToSend')}</div>
      )}
    </div>
  )
}
