import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useConversations } from '../hooks/useConversations'
import { useMessageRequests } from '../hooks/useMessageRequests'
import ConversationList from '../components/ConversationList'
import InboxEmptyState from '../components/InboxEmptyState'
import { messagingFeatureEnabled } from '../../../utils/messagingFeatureFlag'

export default function InboxPage() {
  const { t } = useTranslation('messaging')
  const { conversations } = useConversations()
  const { requests } = useMessageRequests()

  if (!messagingFeatureEnabled()) return <Navigate to="/" replace />

  // Only DMs + dm_requests in the Inbox — team chats still live on team pages
  const inbox = conversations.filter(c => c.type === 'dm' || c.type === 'dm_request')
  const pendingRequests = inbox.filter(c => c.type === 'dm_request' && c.request_status === 'pending')
  const dms = inbox.filter(c => c.type === 'dm')

  const hasAnything = pendingRequests.length > 0 || dms.length > 0 || requests.length > 0

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold text-foreground mb-4">{t('inboxTitle')}</h1>
      {!hasAnything && <InboxEmptyState />}

      {pendingRequests.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {t('requestsSectionTitle')}
          </h2>
          <ConversationList conversations={pendingRequests} />
        </section>
      )}

      {dms.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {t('dmsSectionTitle')}
          </h2>
          <ConversationList conversations={dms} />
        </section>
      )}
    </div>
  )
}
