import type { Game } from '../../../types'
import type { GamePlayerStats } from './useGameAttendanceStats'

interface Props {
  memberId: string
  stats: GamePlayerStats[]
  gamesById: Map<string, Game>
}

/** Stub — full implementation lands in Task 10. */
export default function GameAttendanceDrilldown(_: Props) {
  return null
}
