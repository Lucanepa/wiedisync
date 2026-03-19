import { useState, useEffect } from 'react'
import type { Hall, LocationResult } from '../types'
import { usePB } from './usePB'

function hallToLocationResult(hall: Hall): LocationResult {
  return {
    name: hall.name,
    address: hall.address,
    city: hall.city,
    lat: null,
    lon: null,
    source: 'pocketbase',
  }
}

export function useHallSearch(query: string) {
  const { data: halls } = usePB<Hall>('halls', { all: true, sort: 'name' })
  const [results, setResults] = useState<LocationResult[]>([])

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([])
      return
    }
    const q = query.toLowerCase()
    const filtered = halls
      .filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map(hallToLocationResult)
    setResults(filtered)
  }, [query, halls])

  return { results }
}
