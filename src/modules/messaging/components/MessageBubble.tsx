import { format } from 'date-fns'
import type { MessageRow } from '../api/types'

type Props = {
  message: MessageRow
  isOwn: boolean
}

export default function MessageBubble({ message, isOwn }: Props) {
  const timestamp = message.created_at
    ? format(new Date(message.created_at), 'HH:mm')
    : ''

  return (
    <div className={`flex flex-col max-w-[85%] ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      {!isOwn && message.sender_name && (
        <div className="text-xs text-muted-foreground mb-0.5 px-2">
          {message.sender_name}
        </div>
      )}
      <div
        className={`
          rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words
          ${isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'}
        `}
      >
        {message.body}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5 px-2">
        {timestamp}
      </div>
    </div>
  )
}
