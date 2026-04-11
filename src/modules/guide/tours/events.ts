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
      titleKey: 'guide:tours.events.steps.list.title',
      bodyKey: 'guide:tours.events.steps.list.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="event-rsvp"]',
      titleKey: 'guide:tours.events.steps.rsvp.title',
      bodyKey: 'guide:tours.events.steps.rsvp.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="event-card"]',
      titleKey: 'guide:tours.events.steps.details.title',
      bodyKey: 'guide:tours.events.steps.details.body',
      placement: 'bottom',
    },
  ],
}
