import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover'
import GameChip from './GameChip'
import type { Game } from '../../types'

interface DayOverflowPopoverProps {
  games: Game[]
  teamNames: string[] // parallel array to games, same length
  count: number
  onGameClick?: (game: Game) => void
}

export default function DayOverflowPopover({
  games,
  teamNames,
  count,
  onGameClick,
}: DayOverflowPopoverProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const handleGameClick = (game: Game) => {
    setOpen(false)
    onGameClick?.(game)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left text-[10px] text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
        >
          {t('spielplanung:overflow.more', '+{{count}} more', { count })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 space-y-1 p-2" side="right" align="start">
        {games.map((game, i) => (
          <GameChip
            key={game.id}
            game={game}
            teamName={teamNames[i] ?? '?'}
            onClick={handleGameClick}
          />
        ))}
      </PopoverContent>
    </Popover>
  )
}
