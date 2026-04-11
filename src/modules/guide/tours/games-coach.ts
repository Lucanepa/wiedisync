import { CalendarDays } from 'lucide-react'
import type { TourDefinition } from '../types'

export const gamesCoachTour: TourDefinition = {
  id: 'games-coach',
  titleKey: 'guide:tours.gamesCoach.title',
  descriptionKey: 'guide:tours.gamesCoach.description',
  icon: CalendarDays,
  section: 'coach',
  canAccess: (a) => a.isCoach || a.isAdmin,
  route: '/admin/spielplanung',
  steps: [
    {
      target: '[data-tour="view-toggle"]',
      titleKey: 'guide:tours.gamesCoach.steps.overview.title',
      bodyKey: 'guide:tours.gamesCoach.steps.overview.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="spielplanung-game-card"]',
      titleKey: 'guide:tours.gamesCoach.steps.lineup.title',
      bodyKey: 'guide:tours.gamesCoach.steps.lineup.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="edit-result"]',
      titleKey: 'guide:tours.gamesCoach.steps.scorer.title',
      bodyKey: 'guide:tours.gamesCoach.steps.scorer.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="absence-overlay"]',
      titleKey: 'guide:tours.gamesCoach.steps.notes.title',
      bodyKey: 'guide:tours.gamesCoach.steps.notes.body',
      placement: 'bottom',
    },
  ],
}
