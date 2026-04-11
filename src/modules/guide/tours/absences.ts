import { CalendarOff } from 'lucide-react'
import type { TourDefinition } from '../types'

export const absencesTour: TourDefinition = {
  id: 'absences',
  titleKey: 'guide:tours.absences.title',
  descriptionKey: 'guide:tours.absences.description',
  icon: CalendarOff,
  section: 'member',
  canAccess: () => true,
  route: '/absences',
  steps: [
    {
      target: '[data-tour="my-absences"]',
      titleKey: 'guide:tours.absences.steps.list.title',
      bodyKey: 'guide:tours.absences.steps.list.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="new-absence"]',
      titleKey: 'guide:tours.absences.steps.create.title',
      bodyKey: 'guide:tours.absences.steps.create.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="team-absences"]',
      titleKey: 'guide:tours.absences.steps.coachView.title',
      bodyKey: 'guide:tours.absences.steps.coachView.body',
      placement: 'bottom',
    },
  ],
}
