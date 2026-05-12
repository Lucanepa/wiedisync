import { useState, useEffect } from 'react'
import { fetchAllItems } from '../lib/api'
import { relId } from '../utils/relations'

interface Result {
  teamEventIds: string[]
  invitedEventIds: string[]
  isLoading: boolean
  error: Error | null
}

/**
 * Resolve which events the current user can see via team membership + direct
 * invite, returned as flat ID arrays. Frontend code then filters events with
 * `{ id: { _in: [...] } }` instead of walking `events.teams.teams_id` —
 * avoiding the deep-M2M-filter trap where the policy and the frontend both
 * traverse the same alias and Directus silently returns []. Same pattern as
 * useMultiTeamMembers / useTeamAbsences.
 */
export function useUserVisibleEventIds(
  teamIds: string[],
  userId: string | undefined,
  enabled = true,
): Result {
  const [teamEventIds, setTeamEventIds] = useState<string[]>([])
  const [invitedEventIds, setInvitedEventIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const teamKey = teamIds.map(String).filter(Boolean).sort().join(',')
  const key = `${enabled ? '1' : '0'}|${teamKey}|${userId ?? ''}`

  useEffect(() => {
    if (!enabled) {
      setTeamEventIds([])
      setInvitedEventIds([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const [teamJunctions, memberJunctions] = await Promise.all([
          teamIds.length > 0
            ? fetchAllItems<{ events_id: string | number }>('events_teams', {
                filter: { teams_id: { _in: teamIds } },
                fields: ['events_id'],
              })
            : Promise.resolve([]),
          userId
            ? fetchAllItems<{ events_id: string | number }>('events_members', {
                filter: { members_id: { _eq: userId } },
                fields: ['events_id'],
              })
            : Promise.resolve([]),
        ])
        if (cancelled) return
        setTeamEventIds([...new Set(teamJunctions.map(j => relId(j.events_id)).filter(Boolean))])
        setInvitedEventIds([...new Set(memberJunctions.map(j => relId(j.events_id)).filter(Boolean))])
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { teamEventIds, invitedEventIds, isLoading, error }
}
