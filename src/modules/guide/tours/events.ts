import { PartyPopper } from 'lucide-react'
import type { TourDefinition } from '../types'

export const eventsTour: TourDefinition = {
  id: 'events',
  titleKey: 'guide:tours.events.title',
  descriptionKey: 'guide:tours.events.description',
  icon: PartyPopper,
  section: 'member',
  canAccess: () => true,
  route: '/events',
  steps: [
    {
      target: '[data-tour="event-team-filter"]',
      titleKey: 'guide:tours.events.steps.eventTeamFilter.title',
      bodyKey: 'guide:tours.events.steps.eventTeamFilter.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="event-card"]',
      titleKey: 'guide:tours.events.steps.eventCard.title',
      bodyKey: 'guide:tours.events.steps.eventCard.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="event-rsvp"]',
      titleKey: 'guide:tours.events.steps.eventRsvp.title',
      bodyKey: 'guide:tours.events.steps.eventRsvp.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="multi-day"]',
      titleKey: 'guide:tours.events.steps.multiDay.title',
      bodyKey: 'guide:tours.events.steps.multiDay.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="new-event"]',
      titleKey: 'guide:tours.events.steps.newEvent.title',
      bodyKey: 'guide:tours.events.steps.newEvent.body',
      placement: 'bottom',
    },
  ],
}
