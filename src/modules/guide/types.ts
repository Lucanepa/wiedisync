import type { LucideIcon } from 'lucide-react'
import type { AuthContextValue } from '../../hooks/useAuth'

export type RolePredicate = (auth: AuthContextValue) => boolean

export interface TourStep {
  target: string
  titleKey: string
  bodyKey: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  spotlightClicks?: boolean
}

export interface TourDefinition {
  id: string
  titleKey: string
  descriptionKey: string
  icon: LucideIcon
  section: 'basics' | 'member' | 'coach' | 'admin'
  canAccess: RolePredicate
  route: string
  steps: TourStep[]
}

export interface TourState {
  completed: string[]
  dismissed: string[]
  firstVisitDone: boolean
}

export const TOUR_STORAGE_KEY = 'wiedisync_tours'

export const DEFAULT_TOUR_STATE: TourState = {
  completed: [],
  dismissed: [],
  firstVisitDone: false,
}
