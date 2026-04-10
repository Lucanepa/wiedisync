import { ClipboardCheck } from 'lucide-react'
import type { TourDefinition } from '../types'

export const scorerPlayerTour: TourDefinition = {
  id: 'scorer-player',
  titleKey: 'guide:tours.scorerPlayer.title',
  descriptionKey: 'guide:tours.scorerPlayer.description',
  icon: ClipboardCheck,
  section: 'member',
  canAccess: () => true,
  route: '/scorer',
  steps: [
    {
      target: '[data-tour="assignment-list"]',
      titleKey: 'guide:tours.scorerPlayer.steps.assignmentList.title',
      bodyKey: 'guide:tours.scorerPlayer.steps.assignmentList.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="scorer-filters"]',
      titleKey: 'guide:tours.scorerPlayer.steps.scorerFilters.title',
      bodyKey: 'guide:tours.scorerPlayer.steps.scorerFilters.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="delegation"]',
      titleKey: 'guide:tours.scorerPlayer.steps.delegation.title',
      bodyKey: 'guide:tours.scorerPlayer.steps.delegation.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="ical-export"]',
      titleKey: 'guide:tours.scorerPlayer.steps.icalExport.title',
      bodyKey: 'guide:tours.scorerPlayer.steps.icalExport.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="open-slots"]',
      titleKey: 'guide:tours.scorerPlayer.steps.openSlots.title',
      bodyKey: 'guide:tours.scorerPlayer.steps.openSlots.body',
      placement: 'bottom',
    },
  ],
}
