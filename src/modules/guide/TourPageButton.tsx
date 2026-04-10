import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CircleHelp } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover'
import { useTour } from './useTour'

/**
 * A small "?" icon button that appears next to page titles.
 * Filters available tours by current route and lets users start them.
 */
export function TourPageButton() {
  const { availableTours, startTour } = useTour()
  const { t: tRaw } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const matchingTours = useMemo(
    () => availableTours.filter((t) => t.route === location.pathname),
    [availableTours, location.pathname],
  )

  if (matchingTours.length === 0) return null

  if (matchingTours.length === 1) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => startTour(matchingTours[0].id)}
        aria-label="Start tour"
        className="h-8 w-8 shrink-0"
      >
        <CircleHelp className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Available tours"
          className="h-8 w-8 shrink-0"
        >
          <CircleHelp className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {matchingTours.map((tour) => (
          <button
            key={tour.id}
            onClick={() => {
              setOpen(false)
              startTour(tour.id)
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <tour.icon className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">{tRaw(tour.titleKey)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
