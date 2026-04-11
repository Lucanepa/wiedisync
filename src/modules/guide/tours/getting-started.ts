import { Home } from 'lucide-react'
import type { TourDefinition } from '../types'

export const gettingStartedTour: TourDefinition = {
  id: 'getting-started',
  titleKey: 'guide:tours.gettingStarted.title',
  descriptionKey: 'guide:tours.gettingStarted.description',
  icon: Home,
  section: 'basics',
  canAccess: () => true,
  route: '/',
  steps: [
    {
      target: '[data-tour="nav-sidebar"]',
      titleKey: 'guide:tours.gettingStarted.steps.nav.title',
      bodyKey: 'guide:tours.gettingStarted.steps.nav.body',
      placement: 'auto',
    },
    {
      target: '[data-tour="dashboard-appointments"]',
      titleKey: 'guide:tours.gettingStarted.steps.home.title',
      bodyKey: 'guide:tours.gettingStarted.steps.home.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="nav-profile"]',
      titleKey: 'guide:tours.gettingStarted.steps.profile.title',
      bodyKey: 'guide:tours.gettingStarted.steps.profile.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="nav-settings"]',
      titleKey: 'guide:tours.gettingStarted.steps.language.title',
      bodyKey: 'guide:tours.gettingStarted.steps.language.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="notification-bell"]',
      titleKey: 'guide:tours.gettingStarted.steps.notifications.title',
      bodyKey: 'guide:tours.gettingStarted.steps.notifications.body',
      placement: 'bottom',
    },
  ],
}
