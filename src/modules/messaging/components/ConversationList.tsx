import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNowStrict } from 'date-fns'
import { BellOff, Calendar } from 'lucide-react'
import type { ConversationSummary } from '../api/types'
import { useMemberDisplayNames } from '../hooks/useMemberDisplayNames'

type Props = { conversations: ConversationSummary[] }

export default function ConversationList({ conversations }: Props) {
  const { t } = useTranslation('messaging')
  const memberIds = conversations.map(c => c.other_member).filter((x): x is string => !!x)
  const names = useMemberDisplayNames(memberIds)

  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-background">
      {conversations.map((c) => {
        const displayName = c.other_member ? (names.get(c.other_member) ?? '—') : (c.title ?? '—')
        const rel = c.last_message_at
          ? formatDistanceToNowStrict(new Date(c.last_message_at), { addSuffix: true })
          : ''
        const isActivityChat = c.type === 'activity_chat'
        return (
          <li key={c.id}>
            <Link
              to={`/inbox/${c.id}`}
              className="flex items-center gap-3 px-3 py-3 hover:bg-muted focus:bg-muted focus:outline-none"
            >
              {isActivityChat && (
                <Calendar
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-label={t('activityChat.label', { defaultValue: 'Event-Chat' })}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-sm text-foreground">{displayName}</span>
                  {isActivityChat && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t('activityChat.badge', { defaultValue: 'Event' })}
                    </span>
                  )}
                  {c.muted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" aria-label={t('muted')} />}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.last_message_preview ?? t('inboxEmptyPreview')}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] text-muted-foreground">{rel}</span>
                {c.unread_count > 0 && !c.muted && (
                  <span className="rounded-full bg-primary text-primary-foreground text-[10px] leading-none px-1.5 py-0.5 min-w-[18px] text-center">
                    {c.unread_count > 99 ? '99+' : c.unread_count}
                  </span>
                )}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
