import { useState, useEffect, useCallback } from 'react'
import pb from '../../../pb'
import type { GameSchedulingSeason } from '../../../types'

export function useGameSchedulingSeason() {
  const [season, setSeason] = useState<GameSchedulingSeason | null>(null)
  const [allSeasons, setAllSeasons] = useState<GameSchedulingSeason[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSeasons = useCallback(async () => {
    setIsLoading(true)
    try {
      const records = await pb.collection('game_scheduling_seasons').getFullList<GameSchedulingSeason>({
        sort: '-created',
      })
      setAllSeasons(records)
      // Auto-select the open one, or the most recent
      const open = records.find(s => s.status === 'open')
      setSeason(open || records[0] || null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchSeasons() }, [fetchSeasons])

  const createSeason = useCallback(async (seasonName: string) => {
    const record = await pb.collection('game_scheduling_seasons').create<GameSchedulingSeason>({
      season: seasonName,
      status: 'setup',
      spielsamstage: [],
      team_slot_config: {},
      notes: '',
    })
    await fetchSeasons()
    return record
  }, [fetchSeasons])

  const updateSeason = useCallback(async (id: string, data: Partial<GameSchedulingSeason>) => {
    const record = await pb.collection('game_scheduling_seasons').update<GameSchedulingSeason>(id, data)
    await fetchSeasons()
    return record
  }, [fetchSeasons])

  return {
    season,
    allSeasons,
    isLoading,
    error,
    setSeason,
    createSeason,
    updateSeason,
    refetch: fetchSeasons,
  }
}
