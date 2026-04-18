import { describe, it, expect, vi, beforeEach } from 'vitest'
import { messagingApi } from '../api/messaging'

// Mock kscwApi so we can assert the URLs and bodies emitted.
vi.mock('../../../lib/api', () => ({
  kscwApi: vi.fn(async () => undefined),
}))

import { kscwApi } from '../../../lib/api'

describe('messagingApi', () => {
  beforeEach(() => { vi.mocked(kscwApi).mockClear() })

  it('has the expected method names (contract surface)', () => {
    const expected = [
      'listConversations','listMessages','createDm','markRead','toggleMute','clearConversation',
      'send','edit','delete',
      'react',
      'acceptRequest','declineRequest','block','unblock',
      'createReport','listReports','resolveReport',
      'updateSettings','recordConsent','exportData',
    ] as const
    for (const k of expected) {
      expect(messagingApi).toHaveProperty(k)
      expect(typeof (messagingApi as any)[k]).toBe('function')
    }
  })

  it('createDm passes body as a plain object (not pre-stringified)', async () => {
    await messagingApi.createDm({ recipient: 'mbr-1' })
    expect(kscwApi).toHaveBeenCalledWith(
      '/messaging/conversations/dm',
      expect.objectContaining({ method: 'POST', body: { recipient: 'mbr-1' } }),
    )
  })

  it('send passes body as a plain object', async () => {
    await messagingApi.send({ conversation: 'conv-1', type: 'text', body: 'hi' })
    expect(kscwApi).toHaveBeenCalledWith(
      '/messaging/messages',
      expect.objectContaining({
        method: 'POST',
        body: { conversation: 'conv-1', type: 'text', body: 'hi' },
      }),
    )
  })

  it('react passes body as a plain object', async () => {
    await messagingApi.react('msg-1', { emoji: '👍' })
    expect(kscwApi).toHaveBeenCalledWith(
      '/messaging/messages/msg-1/reactions',
      expect.objectContaining({ method: 'POST', body: { emoji: '👍' } }),
    )
  })

  it('delete uses DELETE method', async () => {
    await messagingApi.delete('msg-1')
    expect(kscwApi).toHaveBeenCalledWith(
      '/messaging/messages/msg-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
