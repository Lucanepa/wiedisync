import { kscwApi } from '../../../lib/api'
import type {
  BlockBody, ConsentBody, ConversationSummary, CreateDmBody, CreateDmResponse,
  ExportBundle, ListMessagesResponse, MessageRow, ReactionBody, ReactionToggleResponse,
  ReportBody, ReportRow, SendMessageBody, SettingsBody, CreatePollBody,
} from './types'

export const messagingApi = {
  // Conversations
  listConversations: () =>
    kscwApi<ConversationSummary[]>('/messaging/conversations'),

  createDm: (body: CreateDmBody) =>
    kscwApi<CreateDmResponse>('/messaging/conversations/dm', { method: 'POST', body }),

  listMessages: (conversationId: string, opts?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (opts?.before) qs.set('before', opts.before)
    if (opts?.limit) qs.set('limit', String(opts.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return kscwApi<ListMessagesResponse>(`/messaging/conversations/${conversationId}/messages${suffix}`)
  },

  markRead: (conversationId: string) =>
    kscwApi<{ last_read_at: string }>(
      `/messaging/conversations/${conversationId}/read`,
      { method: 'POST' },
    ),

  toggleMute: (conversationId: string) =>
    kscwApi<{ muted: boolean }>(
      `/messaging/conversations/${conversationId}/mute`,
      { method: 'POST' },
    ),

  // Messages
  send: (body: SendMessageBody) =>
    kscwApi<MessageRow>('/messaging/messages', { method: 'POST', body }),

  edit: (id: string, body: { body: string }) =>
    kscwApi<{ id: string; body: string; edited_at: string }>(
      `/messaging/messages/${id}`, { method: 'PATCH', body }),

  delete: (id: string) =>
    kscwApi<{ id: string; deleted_at: string; moderator_delete: boolean }>(
      `/messaging/messages/${id}`, { method: 'DELETE' }),

  // Reactions
  react: (messageId: string, body: ReactionBody) =>
    kscwApi<ReactionToggleResponse>(`/messaging/messages/${messageId}/reactions`, { method: 'POST', body }),

  // Requests & blocks (Plan 03 fills)
  acceptRequest: (id: string) =>
    kscwApi<{ conversation_id: string; status: 'accepted' }>(
      `/messaging/requests/${id}/accept`, { method: 'POST' }),
  declineRequest: (id: string) =>
    kscwApi<{ conversation_id: string; status: 'declined' }>(
      `/messaging/requests/${id}/decline`, { method: 'POST' }),
  block: (body: BlockBody) =>
    kscwApi<{ blocked: string; created: boolean }>('/messaging/blocks', { method: 'POST', body }),
  unblock: (memberId: string) =>
    kscwApi<{ unblocked: string; removed: boolean }>(`/messaging/blocks/${memberId}`, { method: 'DELETE' }),

  // Moderation (Plan 04)
  createReport: (body: ReportBody) =>
    kscwApi<{ id: string }>('/messaging/reports', { method: 'POST', body }),

  listReports: (params?: { status?: 'open' | 'resolved' | 'dismissed' }) => {
    const qs = params?.status ? `?status=${params.status}` : ''
    return kscwApi<{ reports: ReportRow[] }>(`/messaging/reports${qs}`)
  },

  resolveReport: (id: string, body: { status: 'resolved' | 'dismissed'; delete_message?: boolean; ban?: boolean }) =>
    kscwApi<{ id: string; status: 'resolved' | 'dismissed'; delete_message: boolean; ban: boolean }>(
      `/messaging/reports/${id}`, { method: 'PATCH', body }),

  // Polls (Plan 04)
  createPoll: (body: CreatePollBody) =>
    kscwApi<{ poll_id: number; message_id: string }>('/messaging/polls', { method: 'POST', body }),

  // Settings (Plan 05)
  updateSettings: (body: SettingsBody) =>
    kscwApi<{ updated: string[] }>('/messaging/settings', { method: 'PATCH', body }),
  recordConsent: (body: ConsentBody) =>
    kscwApi<{ decision: ConsentBody['decision']; consent_prompted_at: string }>(
      '/messaging/settings/consent', { method: 'POST', body }),

  clearConversation: (conversationId: string) =>
    kscwApi<{ cleared: number }>(
      `/messaging/conversations/${conversationId}/clear`, { method: 'POST' }),

  exportData: () =>
    kscwApi<ExportBundle>('/messaging/export', { method: 'POST' }),
}
