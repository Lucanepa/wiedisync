import { gettingStartedTour } from './getting-started'
import { trainingPlayerTour } from './training-player'
import { trainingCoachTour } from './training-coach'
import { gamesPlayerTour } from './games-player'
import { gamesCoachTour } from './games-coach'
import { eventsTour } from './events'
import { absencesTour } from './absences'
import { scorerPlayerTour } from './scorer-player'
import { scorerAdminTour } from './scorer-admin'
import { hallenplanCoachTour } from './hallenplan-coach'
import type { TourDefinition } from '../types'

export const tourRegistry: TourDefinition[] = [
  gettingStartedTour,
  trainingPlayerTour,
  trainingCoachTour,
  gamesPlayerTour,
  gamesCoachTour,
  eventsTour,
  absencesTour,
  scorerPlayerTour,
  scorerAdminTour,
  hallenplanCoachTour,
]
