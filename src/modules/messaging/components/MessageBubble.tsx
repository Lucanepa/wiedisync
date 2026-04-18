import { useState } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { MessageRow } from '../api/types'
import EditMessageInline from './EditMessageInline'
import MessageActions from './MessageActions'
import ReactionBar from './ReactionBar'
import { messagingApi } from '../api/messaging'
import { parseWallClock } from '../../../utils/dateHelpers'
import PollMessage from './PollMessage'

type Props = {
  message: MessageRow
  isOwn: boolean
  currentMemberId: string | null
  isTeamModerator: boolean
  onReport?: (message: MessageRow) => void
}

export default function MessageBubble({ message, isOwn, currentMemberId, isTeamModerator, onReport }: Props) {
  const { t } = useTranslation('messaging')
  const [editing, setEditing] = useState(false)
  const timestamp = message.created_at ? format(parseWallClock(message.created_at), 'HH:mm') : ''

  const onDelete = async () => {
    if (!confirm(t('confirmDelete'))) return
    try { await messagingApi.delete(message.id) } catch { /* toast later */ }
  }

  // Tombstone
  if (message.deleted_at != null) {
    return (
      <div className={`flex flex-col max-w-[85%] ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
        <div className="rounded-2xl px-3 py-2 text-xs italic text-muted-foreground bg-muted">
          {t('messageDeleted')}
        </div>
      </div>
    )
  }

  return (
    <div className={`group flex flex-col max-w-[85%] ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      {!isOwn && message.sender_name && (
        <div className="text-xs text-muted-foreground mb-0.5 px-2">{message.sender_name}</div>
      )}
      <div className={`
        rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words
        ${isOwn ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'}
      `}>
        {message.type === 'poll' && message.poll ? (
          <PollMessage pollId={message.poll} />
        ) : editing && message.body != null ? (
          <EditMessageInline messageId={message.id} initialBody={message.body} onDone={() => setEditing(false)} />
        ) : (
          message.body
        )}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 px-2">
        <span>{timestamp}</span>
        {message.edited_at != null && <span className="italic">· {t('edited')}</span>}
        <MessageActions
          message={message}
          currentMemberId={currentMemberId}
          isTeamModerator={isTeamModerator}
          onEdit={() => setEditing(true)}
          onDelete={onDelete}
          onReport={() => onReport?.(message)}
        />
      </div>
      {message.type !== 'poll' && <ReactionBar messageId={message.id} />}
    </div>
  )
}
