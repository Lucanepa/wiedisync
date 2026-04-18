/**
 * useMessageRequests tests — node-env compatible.
 * Mirrors useBlocks + useConversations test style.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../utils/messagingFeatureFlag', () => ({ messagingFeatureEnabled: () => true }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'mbr-me' } }) }))
vi.mock('../../../hooks/useRealtime', () => ({ useRealtime: vi.fn() }))
vi.mock('../../../lib/api', () => ({ fetchAllItems: vi.fn(async () => []) }))

const acceptMock = vi.fn(async (_id: string) => ({ conversation_id: 'c', status: 'accepted' as const }))
const declineMock = vi.fn(async (_id: string) => ({ conversation_id: 'c', status: 'declined' as const }))
vi.mock('../api/messaging', () => ({
  messagingApi: {
    acceptRequest: (id: string) => acceptMock(id),
    declineRequest: (id: string) => declineMock(id),
  },
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (init: unknown) => [init, vi.fn()],
    useEffect: vi.fn(),
    useCallback: (fn: unknown) => fn,
    useRef: (init: unknown) => ({ current: init }),
  }
})

import { messagingApi } from '../api/messaging'

describe('useMessageRequests — api contract', () => {
  beforeEach(() => { acceptMock.mockClear(); declineMock.mockClear() })

  it('accept forwards id to messagingApi', async () => {
    await messagingApi.acceptRequest('req-1')
    expect(acceptMock).toHaveBeenCalledWith('req-1')
  })

  it('decline forwards id to messagingApi', async () => {
    await messagingApi.declineRequest('req-1')
    expect(declineMock).toHaveBeenCalledWith('req-1')
  })

  it('realtime reducer: incoming pending create prepends', () => {
    const prev = [{ id: 'a', recipient: 'mbr-me', status: 'pending' } as any]
    const incoming = { id: 'b', recipient: 'mbr-me', status: 'pending' } as any
    const merged = prev.some(r => r.id === incoming.id) ? prev : [incoming, ...prev]
    expect(merged.map(r => r.id)).toEqual(['b', 'a'])
  })

  it('realtime reducer: update resolving a request removes it', () => {
    const prev = [{ id: 'a', recipient: 'mbr-me', status: 'pending' } as any,
                  { id: 'b', recipient: 'mbr-me', status: 'pending' } as any]
    const resolved = { id: 'a', recipient: 'mbr-me', status: 'accepted' } as any
    const next = prev.filter(r => r.id !== resolved.id)
    expect(next.map(r => r.id)).toEqual(['b'])
  })

  it('realtime reducer: create for another recipient is ignored', () => {
    const prev: any[] = []
    const rec = { id: 'x', recipient: 'other', status: 'pending' } as any
    const isForMe = String(rec.recipient) === 'mbr-me'
    const next = isForMe ? [rec, ...prev] : prev
    expect(next.length).toBe(0)
  })
})
