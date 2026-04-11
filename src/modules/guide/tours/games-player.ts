import { Trophy } from 'lucide-react'
import type { TourDefinition } from '../types'

export const gamesPlayerTour: TourDefinition = {
  id: 'games-player',
  titleKey: 'guide:tours.gamesPlayer.title',
  descriptionKey: 'guide:tours.gamesPlayer.description',
  icon: Trophy,
  section: 'member',
  canAccess: () => true,
  route: '/games',
  steps: [
    {
      target: '[data-tour="team-filter"]',
      titleKey: 'guide:tours.gamesPlayer.steps.list.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.list.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-rsvp"]',
      titleKey: 'guide:tours.gamesPlayer.steps.rsvp.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.rsvp.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-results"]',
      titleKey: 'guide:tours.gamesPlayer.steps.result.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.result.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-card"]',
      titleKey: 'guide:tours.gamesPlayer.steps.details.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.details.body',
      placement: 'bottom',
    },
  ],
}
