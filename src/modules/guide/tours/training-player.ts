import { Dumbbell } from 'lucide-react'
import type { TourDefinition } from '../types'

export const trainingPlayerTour: TourDefinition = {
  id: 'training-player',
  titleKey: 'guide:tours.trainingPlayer.title',
  descriptionKey: 'guide:tours.trainingPlayer.description',
  icon: Dumbbell,
  section: 'member',
  canAccess: () => true,
  route: '/trainings',
  steps: [
    {
      target: '[data-tour="team-filter"]',
      titleKey: 'guide:tours.trainingPlayer.steps.list.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.list.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="rsvp-buttons"]',
      titleKey: 'guide:tours.trainingPlayer.steps.rsvpButtons.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.rsvpButtons.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="training-note"]',
      titleKey: 'guide:tours.trainingPlayer.steps.absence.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.absence.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="participation-dots"]',
      titleKey: 'guide:tours.trainingPlayer.steps.stats.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.stats.body',
      placement: 'bottom',
    },
  ],
}
