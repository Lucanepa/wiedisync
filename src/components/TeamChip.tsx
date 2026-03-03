import { getTeamColor } from '../utils/teamColors'

interface TeamChipProps {
  team: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

export default function TeamChip({ team, size = 'md', className = '' }: TeamChipProps) {
  const color = getTeamColor(team)

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${
        size === 'xs' ? 'px-1.5 py-0 text-[10px]' : size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${className}`}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.border,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {team}
    </span>
  )
}
