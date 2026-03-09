import { useState, useEffect, useCallback } from 'react'
import pb from '../../../pb'

export interface SlotData {
  id: string
  date: string
  start_time: string
  end_time: string
  hall_id: string
  hall_name: string
  source: string
}

export interface OpponentData {
  id: string
  club_name: string
  contact_name: string
  kscw_team_id: string
  kscw_team_name: string
  home_game: string
  away_game: string
}

export interface BookingData {
  id: string
  type: 'home_slot_pick' | 'away_proposal'
  status: 'pending' | 'confirmed' | 'rejected'
  slot: string
  proposed_datetime_1: string
  proposed_place_1: string
  proposed_datetime_2: string
  proposed_place_2: string
  proposed_datetime_3: string
  proposed_place_3: string
  confirmed_proposal: number
}

interface SlotsResponse {
  opponent: OpponentData
  slots: SlotData[]
  bookings: BookingData[]
}

export function useAvailableSlots(token: string | undefined) {
  const [data, setData] = useState<SlotsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const resp = await pb.send(`/api/terminplanung/slots/${token}`, { method: 'GET' })
      setData(resp as SlotsResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  const bookHomeSlot = useCallback(async (slotId: string) => {
    if (!token) throw new Error('No token')
    const resp = await pb.send(`/api/terminplanung/book-home/${token}`, {
      method: 'POST',
      body: { slot_id: slotId },
    })
    await fetchSlots()
    return resp
  }, [token, fetchSlots])

  const proposeAway = useCallback(async (proposals: {
    proposed_datetime_1: string
    proposed_place_1: string
    proposed_datetime_2: string
    proposed_place_2: string
    proposed_datetime_3: string
    proposed_place_3: string
  }) => {
    if (!token) throw new Error('No token')
    const resp = await pb.send(`/api/terminplanung/propose-away/${token}`, {
      method: 'POST',
      body: proposals,
    })
    await fetchSlots()
    return resp
  }, [token, fetchSlots])

  return {
    opponent: data?.opponent ?? null,
    slots: data?.slots ?? [],
    bookings: data?.bookings ?? [],
    isLoading,
    error,
    bookHomeSlot,
    proposeAway,
    refetch: fetchSlots,
  }
}
