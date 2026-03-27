import { useCallback } from 'react'
import { usePB } from '../../../hooks/usePB'
import { useMutation } from '../../../hooks/useMutation'
import { useAuth } from '../../../hooks/useAuth'
import { useRealtime } from '../../../hooks/useRealtime'
import type { Poll, PollVote } from '../../../types'

export function usePolls(teamId: string) {
  const { user } = useAuth()

  const { data: polls, refetch: refetchPolls, isLoading } = usePB<Poll>('polls', {
    filter: teamId ? { team: { _eq: teamId } } : { id: { _eq: -1 } },
    sort: '-created',
    all: true,
    enabled: !!teamId,
  })

  const { create: createPoll, update: updatePoll, remove: removePoll } = useMutation<Poll>('polls')

  useRealtime<Poll>('polls', (e) => {
    if (e.record.team === teamId) refetchPolls()
  })

  const addPoll = useCallback(async (data: {
    question: string
    options: string[]
    mode: 'single' | 'multi'
    deadline?: string
    anonymous?: boolean
  }) => {
    if (!user) return
    await createPoll({
      team: teamId,
      question: data.question,
      options: data.options,
      mode: data.mode,
      deadline: data.deadline || '',
      anonymous: data.anonymous || false,
      created_by: user.id,
      status: 'open',
    })
    refetchPolls()
  }, [user, teamId, createPoll, refetchPolls])

  const closePoll = useCallback(async (pollId: string) => {
    await updatePoll(pollId, { status: 'closed' })
    refetchPolls()
  }, [updatePoll, refetchPolls])

  const deletePoll = useCallback(async (pollId: string) => {
    await removePoll(pollId)
    refetchPolls()
  }, [removePoll, refetchPolls])

  return { polls, isLoading, addPoll, closePoll, deletePoll }
}

export function usePollVotes(pollId: string) {
  const { user } = useAuth()

  const { data: votes, refetch, isLoading } = usePB<PollVote>('poll_votes', {
    filter: pollId ? { poll: { _eq: pollId } } : { id: { _eq: -1 } },
    all: true,
    enabled: !!pollId,
  })

  const { create, update } = useMutation<PollVote>('poll_votes')

  useRealtime<PollVote>('poll_votes', (e) => {
    if (e.record.poll === pollId) refetch()
  })

  const myVote = votes.find(v => v.member === user?.id)

  const vote = useCallback(async (selectedOptions: number[]) => {
    if (!user) return
    if (myVote) {
      await update(myVote.id, { selected_options: selectedOptions })
    } else {
      await create({
        poll: pollId,
        member: user.id,
        selected_options: selectedOptions,
      })
    }
    refetch()
  }, [user, pollId, myVote, create, update, refetch])

  // Compute results: count votes per option index
  const getResults = () => {
    const counts: Record<number, number> = {}
    const voters: Record<number, string[]> = {}  // option index -> member IDs
    votes.forEach(v => {
      const selected = v.selected_options as number[]
      selected.forEach(idx => {
        counts[idx] = (counts[idx] || 0) + 1
        if (!voters[idx]) voters[idx] = []
        voters[idx].push(v.member)
      })
    })
    return { counts, voters, totalVotes: votes.length }
  }

  return { votes, myVote, isLoading, vote, getResults }
}
