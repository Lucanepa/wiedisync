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
      titleKey: 'guide:tours.trainingPlayer.steps.teamFilter.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.teamFilter.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="training-card"]',
      titleKey: 'guide:tours.trainingPlayer.steps.trainingCard.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.trainingCard.body',
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
      titleKey: 'guide:tours.trainingPlayer.steps.trainingNote.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.trainingNote.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="older-trainings"]',
      titleKey: 'guide:tours.trainingPlayer.steps.olderTrainings.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.olderTrainings.body',
      placement: 'top',
    },
    {
      target: '[data-tour="participation-dots"]',
      titleKey: 'guide:tours.trainingPlayer.steps.participationDots.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.participationDots.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="coach-present"]',
      titleKey: 'guide:tours.trainingPlayer.steps.coachPresent.title',
      bodyKey: 'guide:tours.trainingPlayer.steps.coachPresent.body',
      placement: 'bottom',
    },
  ],
}
