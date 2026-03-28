import { useState, useEffect, useCallback } from 'react'
import type { GameSchedulingBooking, GameSchedulingOpponent, GameSchedulingSlot } from '../../../types'
import { fetchAllItems, kscwApi } from '../../../lib/api'

export type ExpandedBooking = GameSchedulingBooking & {
  opponent: GameSchedulingOpponent | string
  slot: GameSchedulingSlot | string
}

export function useAdminBookings(seasonId: string | undefined) {
  const [bookings, setBookings] = useState<ExpandedBooking[]>([])
  const [opponents, setOpponents] = useState<GameSchedulingOpponent[]>([])
  const [slots, setSlots] = useState<GameSchedulingSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!seasonId) return
    setIsLoading(true)
    try {
      const [bks, opps, sls] = await Promise.all([
        fetchAllItems<ExpandedBooking>('game_scheduling_bookings', {
          filter: { season: { _eq: seasonId } },
          fields: ['*', 'opponent.*', 'slot.*'],
          sort: ['-created'],
        }),
        fetchAllItems<GameSchedulingOpponent>('game_scheduling_opponents', {
          filter: { season: { _eq: seasonId } },
          sort: ['-created'],
        }),
        fetchAllItems<GameSchedulingSlot>('game_scheduling_slots', {
          filter: { season: { _eq: seasonId } },
          sort: ['date'],
        }),
      ])
      setBookings(bks)
      setOpponents(opps)
      setSlots(sls)
    } catch (err) {
      console.error('Failed to fetch admin bookings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [seasonId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const confirmAwayProposal = useCallback(async (bookingId: string, proposalNumber: number, adminNotes?: string) => {
    await kscwApi('/terminplanung/admin/confirm-away', {
      method: 'POST',
      body: { booking_id: bookingId, proposal_number: proposalNumber, admin_notes: adminNotes || '' },
    })
    await fetchAll()
  }, [fetchAll])

  const blockSlot = useCallback(async (slotId: string, action: 'block' | 'unblock') => {
    await kscwApi('/terminplanung/admin/block-slot', {
      method: 'POST',
      body: { slot_id: slotId, action },
    })
    await fetchAll()
  }, [fetchAll])

  const generateSlots = useCallback(async (seasonIdParam: string) => {
    const resp = await kscwApi('/terminplanung/admin/generate-slots', {
      method: 'POST',
      body: { season_id: seasonIdParam },
    })
    await fetchAll()
    return resp as { total_created: number }
  }, [fetchAll])

  return {
    bookings,
    opponents,
    slots,
    isLoading,
    confirmAwayProposal,
    blockSlot,
    generateSlots,
    refetch: fetchAll,
  }
}
