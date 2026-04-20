import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MessageRow } from '../api/types'
import Avatar from './Avatar'
import EditMessageInline from './EditMessageInline'
import MessageActions from './MessageActions'
import ReactionBar from './ReactionBar'
import { messagingApi } from '../api/messaging'
import { formatTimeZurich } from '../../../utils/dateHelpers'
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
  const timestamp = message.created_at ? formatTimeZurich(message.created_at) : ''

  const onDelete = async () => {
    if (!confirm(t('confirmDelete'))) return
    try { await messagingApi.delete(message.id) } catch { /* toast later */ }
  }

  // Tombstone
  if (message.deleted_at != null) {
    return (
      <div className={`flex max-w-[85%] gap-2 ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}>
        {!isOwn && <div className="w-6 shrink-0" />}
        <div className="rounded-2xl px-3 py-2 text-xs italic text-muted-foreground bg-muted">
          {t('messageDeleted')}
        </div>
      </div>
    )
  }

  const avatar = !isOwn ? (
    <Avatar
      src={message.sender_photo ?? null}
      alt={message.sender_name ?? '—'}
      size="xs"
      className="mt-0.5"
    />
  ) : null

  return (
    <div className={`group flex gap-2 max-w-[85%] ${isOwn ? 'self-end' : 'self-start'}`}>
      {avatar}
      <div className={`flex flex-col min-w-0 ${isOwn ? 'items-end' : 'items-start'}`}>
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
          isOwn={isOwn}
          onEdit={() => setEditing(true)}
          onDelete={onDelete}
          onReport={() => onReport?.(message)}
        />
      </div>
      {message.type !== 'poll' && <ReactionBar messageId={message.id} />}
      </div>
    </div>
  )
}
