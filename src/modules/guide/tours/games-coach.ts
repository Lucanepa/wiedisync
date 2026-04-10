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
      titleKey: 'guide:tours.gamesCoach.steps.viewToggle.title',
      bodyKey: 'guide:tours.gamesCoach.steps.viewToggle.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="team-tabs"]',
      titleKey: 'guide:tours.gamesCoach.steps.teamTabs.title',
      bodyKey: 'guide:tours.gamesCoach.steps.teamTabs.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="spielplanung-game-card"]',
      titleKey: 'guide:tours.gamesCoach.steps.spielplanungGameCard.title',
      bodyKey: 'guide:tours.gamesCoach.steps.spielplanungGameCard.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="edit-result"]',
      titleKey: 'guide:tours.gamesCoach.steps.editResult.title',
      bodyKey: 'guide:tours.gamesCoach.steps.editResult.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="absence-overlay"]',
      titleKey: 'guide:tours.gamesCoach.steps.absenceOverlay.title',
      bodyKey: 'guide:tours.gamesCoach.steps.absenceOverlay.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="spielplanung-filters"]',
      titleKey: 'guide:tours.gamesCoach.steps.spielplanungFilters.title',
      bodyKey: 'guide:tours.gamesCoach.steps.spielplanungFilters.body',
      placement: 'bottom',
    },
  ],
}
