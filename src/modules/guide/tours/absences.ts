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
      titleKey: 'guide:tours.absences.steps.myAbsences.title',
      bodyKey: 'guide:tours.absences.steps.myAbsences.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="new-absence"]',
      titleKey: 'guide:tours.absences.steps.newAbsence.title',
      bodyKey: 'guide:tours.absences.steps.newAbsence.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="edit-absence"]',
      titleKey: 'guide:tours.absences.steps.editAbsence.title',
      bodyKey: 'guide:tours.absences.steps.editAbsence.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="team-absences"]',
      titleKey: 'guide:tours.absences.steps.teamAbsences.title',
      bodyKey: 'guide:tours.absences.steps.teamAbsences.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="weekly-unavailability"]',
      titleKey: 'guide:tours.absences.steps.weeklyUnavailability.title',
      bodyKey: 'guide:tours.absences.steps.weeklyUnavailability.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="import-absences"]',
      titleKey: 'guide:tours.absences.steps.importAbsences.title',
      bodyKey: 'guide:tours.absences.steps.importAbsences.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="affects-teams"]',
      titleKey: 'guide:tours.absences.steps.affectsTeams.title',
      bodyKey: 'guide:tours.absences.steps.affectsTeams.body',
      placement: 'bottom',
    },
  ],
}
