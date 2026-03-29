import { useTranslation } from 'react-i18next'
import TeamChip from '../../../components/TeamChip'
import { getTeamColor } from '../../../utils/teamColors'
import ConflictBadge from './ConflictBadge'
import type { PositionedSlot } from '../utils/timeGrid'

/** Training icon SVG — occupies most of the slot as a watermark */
const TrainingIcon = () => (
  <svg className="absolute inset-0 m-auto h-[60%] w-[60%] opacity-15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.05 10.966a5 2.5 0 0 1-8.1 0" />
    <path d="m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04" />
    <path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z" />
    <path d="M9.194 6.57a5 2.5 0 0 0 5.61 0" />
  </svg>
)

/** Trophy/cup SVG — occupies most of the slot as a watermark */
const GameIcon = () => (
  <svg className="absolute inset-0 m-auto h-[60%] w-[60%] opacity-15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4V2h10v2h3a1 1 0 011 1v3c0 2.21-1.79 4-4 4h-.54A5.98 5.98 0 0113 14.92V17h3v2h1v2H7v-2h1v-2h3v-2.08A5.98 5.98 0 017.54 12H7c-2.21 0-4-1.79-4-4V5a1 1 0 011-1h3zm0 2H5v2c0 1.1.9 2 2 2h.2A6.03 6.03 0 017 8V6zm10 0v2c0 .7-.08 1.38-.2 2H17c1.1 0 2-.9 2-2V6h-2z" />
  </svg>
)

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
  coachTeamIds?: string[]
  compact?: boolean
  isBoosted?: boolean
  /** Number of hall columns this slot spans (default 1) */
  hallSpan?: number
  onClick: () => void
}

export default function SlotBlock({ positioned, teamName, hasConflict, isAdmin, isCoach = false, coachTeamIds = [], compact = false, isBoosted = false, hallSpan = 1, onClick }: SlotBlockProps) {
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
  const isManuallyFree = !isVirtual && !slot.team?.length

  // Resolve claiming team name for color
  const claimRecord = isClaimed && slot._virtual?.claimRecord
    ? slot._virtual.claimRecord as Record<string, unknown>
    : undefined
  const claimedByTeam = claimRecord?.claimed_by_team
  const claimTeamName = (claimedByTeam != null && typeof claimedByTeam === 'object' ? (claimedByTeam as { name: string }).name : undefined) || teamName

  const color = isHallClosure
    ? CLOSURE_COLOR
    : (isFreed || isManuallyFree)
      ? FREED_COLOR
      : isClaimed
        ? getTeamColor(claimTeamName)
        : isHallEvent
          ? { bg: '#e0f2fe', text: '#0c4a6e', border: '#7dd3fc' }
          : getTeamColor(teamName)

  // Freed/claimed/manually-free slots are clickable for coaches; own-team real slots too
  const isOwnTeamSlot = isCoach && slot.team?.length && slot.team.some(t => coachTeamIds.includes(t))
  const clickable = isVirtual || isAdmin || ((isFreed || isClaimed || isManuallyFree) && isCoach) || (isOwnTeamSlot && !isVirtual)

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
        {slot.slot_type === 'training' && <TrainingIcon />}
        {slot.slot_type === 'game' && <GameIcon />}
        <span className={`relative truncate font-semibold ${isCancelled && !isFreed ? 'line-through' : ''}`}>
          {(isFreed || isManuallyFree) ? t('slotFreed') : isClaimed ? t('slotClaimed') : teamName || slot.label || typeLabels[slot.slot_type]}
        </span>
        {compactShowType && (
          <div className={`relative truncate opacity-80 ${isCancelled && !isFreed ? 'line-through' : ''}`}>
            {isFreed || isClaimed ? (teamName || '') : typeLabels[slot.slot_type]}
          </div>
        )}
        {compactShowTime && (
          <div className="relative opacity-70">
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
        {slot.slot_type === 'training' && <TrainingIcon />}
        {slot.slot_type === 'game' && <GameIcon />}
        {(isFreed || isManuallyFree) ? (
          <>
            <div className="relative flex items-center gap-1">
              <span className="font-bold uppercase">{t('slotFreed')}</span>
            </div>
            {showTime && (
              <div className="relative mt-0.5 opacity-80">
                <div>{slot.start_time} -</div>
                <div>{slot.end_time}</div>
              </div>
            )}
            {showDetails && slot.label && (
              <div className="relative mt-0.5 truncate text-[10px] opacity-70">{slot.label}</div>
            )}
          </>
        ) : isClaimed ? (
          <>
            <div className="relative flex items-center gap-1">
              <span className="truncate font-medium">{t('slotClaimed')}</span>
            </div>
            {showTime && (
              <div className="relative mt-0.5 opacity-80">
                <div>{slot.start_time} -</div>
                <div>{slot.end_time}</div>
              </div>
            )}
            {showDetails && teamName && (
              <div className="relative mt-0.5 truncate text-[10px] opacity-70">{teamName}</div>
            )}
          </>
        ) : (
          <>
            <div className="relative flex items-center gap-1">
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
              <div className={`relative mt-0.5 opacity-80 ${isCancelled ? 'line-through' : ''}`}>
                <div>{slot.start_time} -</div>
                <div>{slot.end_time}</div>
              </div>
            )}
            {showDetails && slot.label && teamName && (
              <div className={`relative mt-0.5 truncate font-medium ${isCancelled ? 'line-through text-gray-500' : ''}`}>
                {slot.label}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
