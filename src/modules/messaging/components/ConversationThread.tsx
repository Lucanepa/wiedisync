import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { MessageRow } from '../api/types'
import MessageBubble from './MessageBubble'

type Props = {
  messages: MessageRow[]
  currentMemberId: string | null
  isLoading: boolean
  isTeamModerator: boolean
  onReport?: (message: MessageRow) => void
}

export default function ConversationThread({ messages, currentMemberId, isLoading, isTeamModerator, onReport }: Props) {
  const { t } = useTranslation('messaging')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
        {t('emptyThread')}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
      {messages.map(m => (
        <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.sender === currentMemberId}
            currentMemberId={currentMemberId}
            isTeamModerator={isTeamModerator}
            onReport={onReport}
          />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
