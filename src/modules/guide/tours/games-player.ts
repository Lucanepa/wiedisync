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
      titleKey: 'guide:tours.gamesPlayer.steps.teamFilter.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.teamFilter.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-tabs"]',
      titleKey: 'guide:tours.gamesPlayer.steps.gameTabs.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.gameTabs.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-card"]',
      titleKey: 'guide:tours.gamesPlayer.steps.gameCard.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.gameCard.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-rsvp"]',
      titleKey: 'guide:tours.gamesPlayer.steps.gameRsvp.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.gameRsvp.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-results"]',
      titleKey: 'guide:tours.gamesPlayer.steps.gameResults.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.gameResults.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-rankings"]',
      titleKey: 'guide:tours.gamesPlayer.steps.gameRankings.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.gameRankings.body',
      placement: 'bottom',
    },
    {
      target: '[data-tour="game-scoreboard"]',
      titleKey: 'guide:tours.gamesPlayer.steps.gameScoreboard.title',
      bodyKey: 'guide:tours.gamesPlayer.steps.gameScoreboard.body',
      placement: 'bottom',
    },
  ],
}
