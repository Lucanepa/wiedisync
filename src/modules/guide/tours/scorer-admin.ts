import { UserCog } from 'lucide-react'
import type { TourDefinition } from '../types'

export const scorerAdminTour: TourDefinition = {
  id: 'scorer-admin',
  titleKey: 'guide:tours.scorerAdmin.title',
  descriptionKey: 'guide:tours.scorerAdmin.description',
  icon: UserCog,
  section: 'admin',
  canAccess: (a) => a.isAdmin,
  route: '/admin/scorer-assign',
  steps: [
    {
      target: '[data-tour="season-select"]',
      titleKey: 'guide:tours.scorerAdmin.steps.seasonSelect.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.seasonSelect.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="auto-assign"]',
      titleKey: 'guide:tours.scorerAdmin.steps.autoAssign.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.autoAssign.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="team-summary"]',
      titleKey: 'guide:tours.scorerAdmin.steps.teamSummary.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.teamSummary.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="manual-assign"]',
      titleKey: 'guide:tours.scorerAdmin.steps.manualAssign.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.manualAssign.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="run-algorithm"]',
      titleKey: 'guide:tours.scorerAdmin.steps.runAlgorithm.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.runAlgorithm.body',
      placement: 'bottom',
    },
  ],
}
