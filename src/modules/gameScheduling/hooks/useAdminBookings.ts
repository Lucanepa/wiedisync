import { useState, useEffect, useCallback } from 'react'
import pb from '../../../pb'
import type { GameSchedulingBooking, GameSchedulingOpponent, GameSchedulingSlot } from '../../../types'

export interface ExpandedBooking extends GameSchedulingBooking {
  expand?: {
    opponent?: GameSchedulingOpponent
    slot?: GameSchedulingSlot
  }
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
        pb.collection('game_scheduling_bookings').getFullList<ExpandedBooking>({
          filter: `season = "${seasonId}"`,
          expand: 'opponent,slot',
          sort: '-created',
        }),
        pb.collection('game_scheduling_opponents').getFullList<GameSchedulingOpponent>({
          filter: `season = "${seasonId}"`,
          sort: '-created',
        }),
        pb.collection('game_scheduling_slots').getFullList<GameSchedulingSlot>({
          filter: `season = "${seasonId}"`,
          sort: '+date',
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
    await pb.send('/api/terminplanung/admin/confirm-away', {
      method: 'POST',
      body: { booking_id: bookingId, proposal_number: proposalNumber, admin_notes: adminNotes || '' },
    })
    await fetchAll()
  }, [fetchAll])

  const blockSlot = useCallback(async (slotId: string, action: 'block' | 'unblock') => {
    await pb.send('/api/terminplanung/admin/block-slot', {
      method: 'POST',
      body: { slot_id: slotId, action },
    })
    await fetchAll()
  }, [fetchAll])

  const generateSlots = useCallback(async (seasonIdParam: string) => {
    const resp = await pb.send('/api/terminplanung/admin/generate-slots', {
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
