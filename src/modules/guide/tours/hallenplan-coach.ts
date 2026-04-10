import { LayoutGrid } from 'lucide-react'
import type { TourDefinition } from '../types'

export const hallenplanCoachTour: TourDefinition = {
  id: 'hallenplan-coach',
  titleKey: 'guide:tours.hallenplanCoach.title',
  descriptionKey: 'guide:tours.hallenplanCoach.description',
  icon: LayoutGrid,
  section: 'admin',
  canAccess: (a) => a.isCoach || a.isAdmin,
  route: '/admin/hallenplan',
  steps: [
    {
      target: '[data-tour="week-nav"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.weekNav.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.weekNav.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="sport-filter"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.sportFilter.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.sportFilter.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="day-columns"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.dayColumns.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.dayColumns.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="slot-types"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.slotTypes.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.slotTypes.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="claim-slot"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.claimSlot.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.claimSlot.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="closures"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.closures.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.closures.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="virtual-slots"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.virtualSlots.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.virtualSlots.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="all-halls"]',
      titleKey: 'guide:tours.hallenplanCoach.steps.allHalls.title',
      bodyKey: 'guide:tours.hallenplanCoach.steps.allHalls.body',
      placement: 'bottom',
    },
  ],
}
