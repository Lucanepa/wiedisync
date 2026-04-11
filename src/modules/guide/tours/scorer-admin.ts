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
      titleKey: 'guide:tours.scorerAdmin.steps.overview.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.overview.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="manual-assign"]',
      titleKey: 'guide:tours.scorerAdmin.steps.assign.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.assign.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="team-summary"]',
      titleKey: 'guide:tours.scorerAdmin.steps.history.title',
      bodyKey: 'guide:tours.scorerAdmin.steps.history.body',
      placement: 'bottom',
    },
  ],
}
