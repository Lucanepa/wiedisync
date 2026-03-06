import { useTranslation } from 'react-i18next'
import TeamChip from '../../../components/TeamChip'
import { getTeamColor } from '../../../utils/teamColors'
import ConflictBadge from './ConflictBadge'
import type { PositionedSlot } from '../utils/timeGrid'

const FREED_COLOR = { bg: '#a7f3d0', text: '#064e3b', border: '#10b981' }
const CLOSURE_COLOR = { bg: '#1f2937', text: '#f87171', border: '#991b1b' }
const CLOSURE_PATTERN = /geschlossen|gesperrt|closed/i

const typeLabels: Record<string, string> = {
  training: 'Training',
  game: 'Spiel',
  event: 'Event',
  away: 'Auswärts',
  other: '',
}

interface SlotBlockProps {
  positioned: PositionedSlot
  teamName: string
  hasConflict: boolean
  isAdmin: boolean
  isCoach?: boolean
  compact?: boolean
  isBoosted?: boolean
  /** Number of hall columns this slot spans (default 1) */
  hallSpan?: number
  onClick: () => void
}

export default function SlotBlock({ positioned, teamName, hasConflict, isAdmin, isCoach = false, compact = false, isBoosted = false, hallSpan = 1, onClick }: SlotBlockProps) {
  const { t } = useTranslation('hallenplan')
  const { slot, top, height, left, width: baseWidth } = positioned
  // When spanning multiple hall columns, multiply the width
  const width = baseWidth * hallSpan
  const isVirtual = !!slot._virtual
  const isAway = !!slot._virtual?.isAway
  const isCancelled = !!slot._virtual?.isCancelled
  const isHallEvent = slot._virtual?.source === 'hall_event'
  const isHallClosure = isHallEvent && CLOSURE_PATTERN.test(slot.label || '')
  const isFreed = !!slot._virtual?.isFreed
  const isClaimed = !!slot._virtual?.isClaimed
  // A real slot with no team = manually created "free" slot
  const isManuallyFree = !isVirtual && !slot.team

  // Resolve claiming team name for color
  const claimExpand = isClaimed && slot._virtual?.claimRecord
    ? (slot._virtual.claimRecord as unknown as { expand?: { claimed_by_team?: { name: string } } }).expand
    : undefined
  const claimTeamName = claimExpand?.claimed_by_team?.name || teamName

  const color = isHallClosure
    ? CLOSURE_COLOR
    : (isFreed || isManuallyFree)
      ? FREED_COLOR
      : isClaimed
        ? getTeamColor(claimTeamName)
        : isHallEvent
          ? { bg: '#e0f2fe', text: '#0c4a6e', border: '#7dd3fc' }
          : getTeamColor(teamName)

  // Freed/claimed/manually-free slots are clickable for coaches too
  const clickable = isVirtual || isAdmin || ((isFreed || isClaimed || isManuallyFree) && isCoach)

  // Virtual slots get dashed border; claimed slots get dotted border
  const borderStyle = isClaimed ? 'border-dotted' : isVirtual ? 'border-dashed' : ''

  const bgOpacity = (isFreed || isManuallyFree) ? 'cc' : isAway ? '66' : isCancelled ? '88' : 'e6'

  // Games render above other slots when overlapping in the same hall
  // Boosted slots go to z-40 (above everything)
  const isGame = slot.slot_type === 'game'
  const zClass = isBoosted ? 'z-40' : isGame ? 'z-30' : 'z-20'

  // Game slots get gold border and pulse animation
  const gameGoldBorder = isGame && !isFreed && !isClaimed ? '#FFC832' : undefined
  const gamePulseClass = isGame && !isFreed && !isClaimed && !isCancelled ? 'animate-game-pulse' : ''

  const awayStripes = isAway
    ? {
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${color.border}33 4px, ${color.border}33 8px)`,
      }
    : undefined

  // Compact mode: colored box with team name + type label inside
  if (compact) {
    const compactShowType = height >= 24 && slot.slot_type !== 'training'
    const compactShowTime = height >= 36

    return (
      <div
        className={`absolute ${zClass} overflow-hidden rounded-sm ${isGame && !isFreed && !isClaimed ? 'border' : 'border-l-2'} ${borderStyle} px-0.5 py-px text-[9px] leading-tight shadow-sm ${gamePulseClass} ${
          clickable ? 'cursor-pointer hover:brightness-95' : ''
        }`}
        style={{
          top,
          height: Math.max(height - 1, 4),
          left: `${left}%`,
          width: `calc(${width}% - 1px)`,
          backgroundColor: color.bg + bgOpacity,
          color: color.text,
          borderColor: gameGoldBorder || color.border,
          ...awayStripes,
        }}
        onClick={clickable ? (e) => { e.stopPropagation(); onClick() } : undefined}
        title={`${teamName || slot.label} — ${slot.start_time}–${slot.end_time}${slot.label ? ` — ${slot.label}` : ''}`}
      >
        {hasConflict && <ConflictBadge />}
        <span className={`truncate font-semibold ${isCancelled && !isFreed ? 'line-through' : ''}`}>
          {(isFreed || isManuallyFree) ? t('slotFreed') : isClaimed ? t('slotClaimed') : teamName || slot.label || typeLabels[slot.slot_type]}
        </span>
        {compactShowType && (
          <div className={`truncate opacity-80 ${isCancelled && !isFreed ? 'line-through' : ''}`}>
            {isFreed || isClaimed ? (teamName || '') : typeLabels[slot.slot_type]}
          </div>
        )}
        {compactShowTime && (
          <div className="opacity-70">
            <div>{slot.start_time} -</div>
            <div>{slot.end_time}</div>
          </div>
        )}
      </div>
    )
  }

  // Full mode
  const showDetails = height >= 48
  const showTime = height >= 36

  return (
    <div
      className={`absolute ${zClass} overflow-hidden rounded-md ${isGame && !isFreed && !isClaimed ? 'border-2' : 'border-l-4'} ${borderStyle} px-1.5 py-0.5 text-xs leading-tight shadow-sm transition-all ${gamePulseClass} ${
        clickable ? 'cursor-pointer hover:brightness-95' : ''
      }`}
      style={{
        top,
        height: height - 2,
        left: `${left}%`,
        width: `calc(${width}% - 2px)`,
        backgroundColor: color.bg + bgOpacity,
        color: color.text,
        borderColor: gameGoldBorder || color.border,
        ...awayStripes,
      }}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick() } : undefined}
      title={`${teamName || slot.label} — ${slot.start_time}–${slot.end_time}${slot.label ? ` — ${slot.label}` : ''}`}
    >
      <div className="relative">
        {hasConflict && <ConflictBadge />}
        {/* Freed indicator (hand/grab icon) */}
        {isFreed && (
          <span
            className="absolute -right-0.5 -top-0.5 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white"
            title={t('slotFreed')}
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </span>
        )}
        {/* Auto indicator for regular virtual slots */}
        {isVirtual && !isFreed && !isClaimed && (
          <span
            className="absolute -right-0.5 -top-0.5 z-30 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80"
            title="Auto"
          >
            <svg className="h-2.5 w-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </span>
        )}
        {(isFreed || isManuallyFree) ? (
          <>
            <div className="flex items-center gap-1">
              <span className="font-bold uppercase">{t('slotFreed')}</span>
            </div>
            {showTime && (
              <div className="mt-0.5 opacity-80">
                <div>{slot.start_time} -</div>
                <div>{slot.end_time}</div>
              </div>
            )}
            {showDetails && slot.label && (
              <div className="mt-0.5 truncate text-[10px] opacity-70">{slot.label}</div>
            )}
          </>
        ) : isClaimed ? (
          <>
            <div className="flex items-center gap-1">
              <span className="truncate font-medium">{t('slotClaimed')}</span>
            </div>
            {showTime && (
              <div className="mt-0.5 opacity-80">
                <div>{slot.start_time} -</div>
                <div>{slot.end_time}</div>
              </div>
            )}
            {showDetails && teamName && (
              <div className="mt-0.5 truncate text-[10px] opacity-70">{teamName}</div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              {teamName ? (
                <TeamChip team={teamName} size="sm" />
              ) : (
                showDetails && <span className="truncate font-medium">{slot.label}</span>
              )}
              {showDetails && slot.slot_type !== 'training' && teamName && (
                <span className={`opacity-80 ${isCancelled ? 'line-through' : ''}`}>
                  {typeLabels[slot.slot_type]}
                </span>
              )}
            </div>
            {showTime && (
              <div className={`mt-0.5 opacity-80 ${isCancelled ? 'line-through' : ''}`}>
                <div>{slot.start_time} -</div>
                <div>{slot.end_time}</div>
              </div>
            )}
            {showDetails && slot.label && teamName && (
              <div className={`mt-0.5 truncate font-medium ${isCancelled ? 'line-through text-gray-500' : ''}`}>
                {slot.label}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
