import { kscwApi } from '../../../lib/api'
import type {
  BlockBody,
  ConsentBody,
  ConversationSummary,
  CreateDmBody,
  ReactionBody,
  ReportBody,
  SendMessageBody,
  SettingsBody,
} from './types'

// All functions hit /kscw/messaging/*. Plan 01: they'll 501 until Plans 02-05 fill
// the endpoints. The signatures below are the contract.

export const messagingApi = {
  // Conversations
  listConversations: () =>
    kscwApi<ConversationSummary[]>('/messaging/conversations'),

  createDm: (body: CreateDmBody) =>
    kscwApi<{ conversation_id: string; created: boolean }>('/messaging/conversations/dm', {
      method: 'POST', body: JSON.stringify(body),
    }),

  markRead: (conversationId: string) =>
    kscwApi<void>(`/messaging/conversations/${conversationId}/read`, { method: 'POST' }),

  toggleMute: (conversationId: string) =>
    kscwApi<{ muted: boolean }>(`/messaging/conversations/${conversationId}/mute`, { method: 'POST' }),

  clearConversation: (conversationId: string) =>
    kscwApi<void>(`/messaging/conversations/${conversationId}/clear`, { method: 'POST' }),

  // Messages
  send: (body: SendMessageBody) =>
    kscwApi<{ id: string }>('/messaging/messages', { method: 'POST', body: JSON.stringify(body) }),

  edit: (id: string, body: { body: string }) =>
    kscwApi<void>(`/messaging/messages/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    kscwApi<void>(`/messaging/messages/${id}`, { method: 'DELETE' }),

  // Reactions
  react: (messageId: string, body: ReactionBody) =>
    kscwApi<{ added: boolean }>(`/messaging/messages/${messageId}/reactions`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  // Requests & blocks
  acceptRequest: (id: string) =>
    kscwApi<void>(`/messaging/requests/${id}/accept`, { method: 'POST' }),

  declineRequest: (id: string) =>
    kscwApi<void>(`/messaging/requests/${id}/decline`, { method: 'POST' }),

  block: (body: BlockBody) =>
    kscwApi<void>('/messaging/blocks', { method: 'POST', body: JSON.stringify(body) }),

  unblock: (memberId: string) =>
    kscwApi<void>(`/messaging/blocks/${memberId}`, { method: 'DELETE' }),

  // Moderation
  createReport: (body: ReportBody) =>
    kscwApi<{ id: string }>('/messaging/reports', { method: 'POST', body: JSON.stringify(body) }),

  listReports: () =>
    kscwApi<unknown[]>('/messaging/reports'),

  resolveReport: (id: string, body: { status: 'resolved' | 'dismissed'; delete_message?: boolean }) =>
    kscwApi<void>(`/messaging/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Settings
  updateSettings: (body: SettingsBody) =>
    kscwApi<void>('/messaging/settings', { method: 'PATCH', body: JSON.stringify(body) }),

  recordConsent: (body: ConsentBody) =>
    kscwApi<void>('/messaging/settings/consent', { method: 'POST', body: JSON.stringify(body) }),

  exportData: () =>
    kscwApi<{ url: string; expires_at: string }>('/messaging/export', { method: 'POST' }),
}
