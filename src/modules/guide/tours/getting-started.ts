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
      titleKey: 'guide:tours.gettingStarted.steps.navSidebar.title',
      bodyKey: 'guide:tours.gettingStarted.steps.navSidebar.body',
      placement: 'right',
    },
    {
      target: '[data-tour="dashboard-appointments"]',
      titleKey: 'guide:tours.gettingStarted.steps.dashboardAppointments.title',
      bodyKey: 'guide:tours.gettingStarted.steps.dashboardAppointments.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="notification-bell"]',
      titleKey: 'guide:tours.gettingStarted.steps.notificationBell.title',
      bodyKey: 'guide:tours.gettingStarted.steps.notificationBell.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="nav-profile"]',
      titleKey: 'guide:tours.gettingStarted.steps.navProfile.title',
      bodyKey: 'guide:tours.gettingStarted.steps.navProfile.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="nav-settings"]',
      titleKey: 'guide:tours.gettingStarted.steps.navSettings.title',
      bodyKey: 'guide:tours.gettingStarted.steps.navSettings.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="nav-guide"]',
      titleKey: 'guide:tours.gettingStarted.steps.navGuide.title',
      bodyKey: 'guide:tours.gettingStarted.steps.navGuide.body',
      placement: 'bottom',
    },
  ],
}
