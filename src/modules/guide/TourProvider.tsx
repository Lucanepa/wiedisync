import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Joyride,
  ACTIONS,
  EVENTS,
  STATUS,
  type EventData,
  type Controls,
} from 'react-joyride'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { TourTooltip } from './TourTooltip'
import { WelcomeModal } from './WelcomeModal'
import { tourRegistry } from './tours'
import {
  DEFAULT_TOUR_STATE,
  TOUR_STORAGE_KEY,
  type TourDefinition,
  type TourState,
} from './types'

// ── Context ─────────────────────────────────────────────────────────

export interface TourContextValue {
  startTour: (tourId: string) => void
  skipTour: (tourId: string) => void
  completeTour: (tourId: string) => void
  isTourCompleted: (tourId: string) => boolean
  isTourDismissed: (tourId: string) => boolean
  availableTours: TourDefinition[]
  currentTour: TourDefinition | null
  resetAllTours: () => void
  tourState: TourState
}

export const TourContext = createContext<TourContextValue | null>(null)

// ── Helpers ──────────────────────────────────────────────────────────

function loadState(): TourState {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TOUR_STATE }
    return { ...DEFAULT_TOUR_STATE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_TOUR_STATE }
  }
}

function saveState(state: TourState) {
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state))
}

// ── Provider ─────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
}

export function TourProvider({ children }: Props) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const { t } = useTranslation('guide')
  const [tourState, setTourState] = useState<TourState>(loadState)
  const [currentTour, setCurrentTour] = useState<TourDefinition | null>(null)
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [showWelcome, setShowWelcome] = useState(false)
  const startRouteRef = useRef<string | null>(null)

  // Persist state changes
  useEffect(() => {
    saveState(tourState)
  }, [tourState])

  // Route-change cleanup: abort tour if user navigates away mid-tour
  useEffect(() => {
    if (!currentTour || !run) return
    if (startRouteRef.current && location.pathname !== startRouteRef.current) {
      setRun(false)
      setCurrentTour(null)
      setStepIndex(0)
      startRouteRef.current = null
    }
  }, [location.pathname, currentTour, run])

  const availableTours = useMemo(
    () => tourRegistry.filter((t) => t.canAccess(auth)),
    [auth],
  )

  const isTourCompleted = useCallback(
    (tourId: string) => tourState.completed.includes(tourId),
    [tourState.completed],
  )

  const isTourDismissed = useCallback(
    (tourId: string) => tourState.dismissed.includes(tourId),
    [tourState.dismissed],
  )

  const skipTour = useCallback((tourId: string) => {
    setRun(false)
    setCurrentTour(null)
    setStepIndex(0)
    startRouteRef.current = null
    setTourState((prev) => {
      if (prev.dismissed.includes(tourId)) return prev
      return { ...prev, dismissed: [...prev.dismissed, tourId] }
    })
  }, [])

  const completeTour = useCallback((tourId: string) => {
    setRun(false)
    setCurrentTour(null)
    setStepIndex(0)
    startRouteRef.current = null
    setTourState((prev) => ({
      ...prev,
      completed: prev.completed.includes(tourId)
        ? prev.completed
        : [...prev.completed, tourId],
      dismissed: prev.dismissed.filter((id) => id !== tourId),
    }))
  }, [])

  const startTour = useCallback(
    (tourId: string) => {
      // Abort active tour first (concurrent guard)
      if (currentTour) {
        setRun(false)
        setCurrentTour(null)
        setStepIndex(0)
        startRouteRef.current = null
      }

      const tour = tourRegistry.find((t) => t.id === tourId)
      if (!tour) return

      const launch = () => {
        setCurrentTour(tour)
        setStepIndex(0)
        startRouteRef.current = tour.route
        // Wait for render via requestAnimationFrame before starting
        requestAnimationFrame(() => {
          setRun(true)
        })
      }

      if (location.pathname !== tour.route) {
        navigate(tour.route)
        // Give the page time to mount after navigation
        requestAnimationFrame(() => {
          requestAnimationFrame(launch)
        })
      } else {
        launch()
      }
    },
    [currentTour, location.pathname, navigate],
  )

  // Show welcome modal on first visit for approved users
  useEffect(() => {
    if (auth.user && auth.isApproved && !tourState.firstVisitDone) {
      setShowWelcome(true)
    }
  }, [auth.user, auth.isApproved, tourState.firstVisitDone])

  const handleWelcomeStart = useCallback(() => {
    setTourState((prev) => ({ ...prev, firstVisitDone: true }))
    setShowWelcome(false)
    startTour('getting-started')
  }, [startTour])

  const handleWelcomeSkip = useCallback(() => {
    setTourState((prev) => ({ ...prev, firstVisitDone: true }))
    setShowWelcome(false)
  }, [])

  // Role-based auto-offer toasts
  useEffect(() => {
    if (!auth.user || !auth.isApproved || !tourState.firstVisitDone) return
    if (run || currentTour) return

    if (location.pathname === '/trainings' && auth.isCoach &&
        !tourState.completed.includes('training-coach') && !tourState.dismissed.includes('training-coach')) {
      toast(t('offer.coachTools'), {
        action: { label: t('offer.start'), onClick: () => startTour('training-coach') },
        cancel: { label: t('offer.skip'), onClick: () => setTourState(s => ({ ...s, dismissed: [...new Set([...s.dismissed, 'training-coach'])] })) },
        duration: 8000,
      })
    }

    if (location.pathname.startsWith('/admin') && (auth.isAdmin || auth.isCoach) &&
        !tourState.completed.includes('hallenplan-coach') && !tourState.dismissed.includes('hallenplan-coach') &&
        !tourState.completed.includes('scorer-admin') && !tourState.dismissed.includes('scorer-admin')) {
      toast(t('offer.adminTools'), {
        action: { label: t('offer.start'), onClick: () => startTour('hallenplan-coach') },
        cancel: { label: t('offer.skip'), onClick: () => setTourState(s => ({ ...s, dismissed: [...new Set([...s.dismissed, 'hallenplan-coach', 'scorer-admin'])] })) },
        duration: 8000,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, auth.isCoach, auth.isAdmin, tourState.firstVisitDone])

  const resetAllTours = useCallback(() => {
    setRun(false)
    setCurrentTour(null)
    setStepIndex(0)
    startRouteRef.current = null
    const fresh = { ...DEFAULT_TOUR_STATE }
    setTourState(fresh)
    saveState(fresh)
  }, [])

  // Build Joyride steps from current tour, translating title/body keys
  const joyrideSteps = useMemo(() => {
    if (!currentTour) return []
    return currentTour.steps.map((step) => ({
      target: step.target,
      title: step.titleKey,   // Will be translated in TourTooltip via t()
      content: step.bodyKey,  // Will be translated in TourTooltip via t()
      placement: step.placement ?? ('auto' as const),
      skipBeacon: true,
      blockTargetInteraction: !(step.spotlightClicks ?? false),
    }))
  }, [currentTour])

  const handleJoyrideEvent = useCallback(
    (data: EventData, _controls: Controls) => {
      const { action, index, status, type } = data

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        // Target not found: skip to next step
        setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1))
      } else if (type === EVENTS.TOUR_END) {
        if (status === STATUS.FINISHED) {
          if (currentTour) completeTour(currentTour.id)
        } else if (status === STATUS.SKIPPED) {
          if (currentTour) skipTour(currentTour.id)
        }
        setRun(false)
        setStepIndex(0)
      }
    },
    [currentTour, completeTour, skipTour],
  )

  const value = useMemo<TourContextValue>(
    () => ({
      startTour,
      skipTour,
      completeTour,
      isTourCompleted,
      isTourDismissed,
      availableTours,
      currentTour,
      resetAllTours,
      tourState,
    }),
    [
      startTour,
      skipTour,
      completeTour,
      isTourCompleted,
      isTourDismissed,
      availableTours,
      currentTour,
      resetAllTours,
      tourState,
    ],
  )

  return (
    <TourContext.Provider value={value}>
      {children}
      {currentTour && (
        <Joyride
          steps={joyrideSteps}
          run={run}
          stepIndex={stepIndex}
          continuous
          scrollToFirstStep
          tooltipComponent={TourTooltip}
          onEvent={handleJoyrideEvent}
          options={{
            buttons: ['back', 'close', 'primary', 'skip'],
            overlayClickAction: false,
            overlayColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
          }}
        />
      )}
      <WelcomeModal
        open={showWelcome}
        onStart={handleWelcomeStart}
        onSkip={handleWelcomeSkip}
      />
    </TourContext.Provider>
  )
}
