import { ClipboardList } from 'lucide-react'
import type { TourDefinition } from '../types'

export const trainingCoachTour: TourDefinition = {
  id: 'training-coach',
  titleKey: 'guide:tours.trainingCoach.title',
  descriptionKey: 'guide:tours.trainingCoach.description',
  icon: ClipboardList,
  section: 'coach',
  canAccess: (a) => a.isCoach,
  route: '/trainings',
  steps: [
    {
      target: '[data-tour="new-training"]',
      titleKey: 'guide:tours.trainingCoach.steps.newTraining.title',
      bodyKey: 'guide:tours.trainingCoach.steps.newTraining.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="coach-dashboard"]',
      titleKey: 'guide:tours.trainingCoach.steps.coachDashboard.title',
      bodyKey: 'guide:tours.trainingCoach.steps.coachDashboard.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="attendance-stats"]',
      titleKey: 'guide:tours.trainingCoach.steps.attendanceStats.title',
      bodyKey: 'guide:tours.trainingCoach.steps.attendanceStats.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="edit-training"]',
      titleKey: 'guide:tours.trainingCoach.steps.editTraining.title',
      bodyKey: 'guide:tours.trainingCoach.steps.editTraining.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="share-training"]',
      titleKey: 'guide:tours.trainingCoach.steps.shareTraining.title',
      bodyKey: 'guide:tours.trainingCoach.steps.shareTraining.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="recurring-setup"]',
      titleKey: 'guide:tours.trainingCoach.steps.recurringSetup.title',
      bodyKey: 'guide:tours.trainingCoach.steps.recurringSetup.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="delete-training"]',
      titleKey: 'guide:tours.trainingCoach.steps.deleteTraining.title',
      bodyKey: 'guide:tours.trainingCoach.steps.deleteTraining.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="rsvp-deadline"]',
      titleKey: 'guide:tours.trainingCoach.steps.rsvpDeadline.title',
      bodyKey: 'guide:tours.trainingCoach.steps.rsvpDeadline.body',
      placement: 'bottom',
    },
  ],
}
