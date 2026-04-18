import type {
  ConversationType,
  MessageType,
  MessageRequestStatus,
  ReportReason,
  ConsentDecision,
} from '../../../types'

export type CreateDmBody = { recipient: string }

export type SendMessageBody = {
  conversation: string
  type: MessageType
  body?: string
  poll?: string
}

export type ReactionBody = { emoji: string }

export type ReportBody = {
  reported_member: string
  message?: string
  conversation?: string
  reason: ReportReason
  note?: string
}

export type BlockBody = { member: string }

export type SettingsBody = Partial<{
  team_chat_enabled: boolean
  dm_enabled: boolean
  push_preview_content: boolean
}>

export type ConsentBody = { decision: ConsentDecision | 'later' }

export type ConversationSummary = {
  id: string
  type: ConversationType
  team: string | null
  title: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  muted: boolean
  request_status: MessageRequestStatus | null
  /** For DM / dm_request: the other participant's member id. null for team conversations. */
  other_member: string | null
}

export type MessagingError = { code: string; message: string; details?: unknown }

export type MessageRow = {
  id: string
  conversation: string
  sender: string
  type: MessageType
  body: string | null
  poll: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  /** Resolved at read-time, not stored. Denormalized for UI. */
  sender_name?: string
}

export type ListMessagesResponse = {
  messages: MessageRow[]
  /** true if more older messages exist (use `before=<oldest.created_at>` to page) */
  has_more: boolean
}

export type CreateDmResponse = {
  conversation_id: string
  created: boolean
  type: 'dm' | 'dm_request'
  request_status: 'pending' | 'accepted' | 'declined' | null
}

export type BlockRow = {
  id: string
  blocker: string
  blocked: string
  created_at: string
}

export type MessageRequestRow = {
  id: string
  conversation: string
  sender: string
  recipient: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  resolved_at: string | null
}

export type ReactionRow = {
  id: string
  message: string
  member: string
  emoji: string
  created_at: string
}

export type ReactionToggleResponse = { added: boolean; emoji: string }

export type ReportRow = {
  id: string
  reporter: string | null
  reported_member: string | null
  message: string | null
  conversation: string | null
  reason: 'harassment' | 'spam' | 'inappropriate' | 'other' | 'moderator_delete'
  note: string | null
  message_snapshot: string | null
  status: 'open' | 'resolved' | 'dismissed'
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  reporter_name?: string | null
  reported_name?: string | null
}

export type CreatePollBody = {
  conversation: string
  question: string
  options: string[]
  mode: 'single' | 'multi'
  deadline?: string
  anonymous?: boolean
}
