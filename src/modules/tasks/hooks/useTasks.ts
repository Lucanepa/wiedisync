import { useCallback } from 'react'
import { usePB } from '../../../hooks/usePB'
import { useMutation } from '../../../hooks/useMutation'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'
import type { Task, TaskTemplate } from '../../../types'

export function useTasks(activityType: 'game' | 'training' | 'event', activityId: string) {
  const { user } = useAuth()

  const { data: tasks, isLoading, refetch } = usePB<Task>('tasks', {
    filter: activityId
      ? { _and: [{ activity_type: { _eq: activityType } }, { activity_id: { _eq: activityId } }] }
      : { id: { _eq: -1 } },
    all: true,
    sort: 'sort_order',
    enabled: !!activityId,
  })

  const { create, update, remove } = useMutation<Task>('tasks')

  useRealtime<Task>('tasks', (e) => {
    if (e.record.activity_id === activityId) {
      refetch()
    }
  })

  const addTask = useCallback(
    async (label: string, category?: string, assignedTo?: string) => {
      if (!user) return
      const maxOrder = tasks.length > 0
        ? Math.max(...tasks.map((t) => t.sort_order ?? 0))
        : 0
      await create({
        activity_type: activityType,
        activity_id: activityId,
        label,
        category: category || '',
        assigned_to: assignedTo || '',
        claimed_by: '',
        completed: false,
        completed_at: '',
        sort_order: maxOrder + 1,
        created_by: user.id,
      })
      refetch()
    },
    [user, tasks, activityType, activityId, create, refetch],
  )

  const updateTask = useCallback(
    async (taskId: string, data: Record<string, unknown>) => {
      await update(taskId, data)
      refetch()
    },
    [update, refetch],
  )

  const removeTask = useCallback(
    async (taskId: string) => {
      await remove(taskId)
      refetch()
    },
    [remove, refetch],
  )

  const claimTask = useCallback(
    async (taskId: string) => {
      if (!user) return
      await update(taskId, { claimed_by: user.id })
      refetch()
    },
    [user, update, refetch],
  )

  const unclaimTask = useCallback(
    async (taskId: string) => {
      await update(taskId, { claimed_by: '' })
      refetch()
    },
    [update, refetch],
  )

  const toggleComplete = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const nowCompleted = !task.completed
      await update(taskId, {
        completed: nowCompleted,
        completed_at: nowCompleted ? new Date().toISOString() : '',
      })
      refetch()
    },
    [tasks, update, refetch],
  )

  return { tasks, isLoading, addTask, updateTask, removeTask, claimTask, unclaimTask, toggleComplete }
}

export function useTaskTemplates(teamId?: string) {
  const { user } = useAuth()

  const { data: templates, isLoading, refetch } = usePB<TaskTemplate>('task_templates', {
    filter: teamId ? { team: { _eq: teamId } } : { id: { _eq: -1 } },
    all: true,
    enabled: !!teamId,
  })

  const { create, remove } = useMutation<TaskTemplate>('task_templates')

  const createTemplate = useCallback(
    async (name: string, tasks: Array<{ label: string; category: string }>) => {
      if (!user || !teamId) return
      await create({
        name,
        team: teamId,
        tasks_json: tasks,
        created_by: user.id,
      })
      refetch()
    },
    [user, teamId, create, refetch],
  )

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      await remove(templateId)
      refetch()
    },
    [remove, refetch],
  )

  return { templates, isLoading, createTemplate, deleteTemplate }
}
