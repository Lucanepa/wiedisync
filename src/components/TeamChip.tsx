import type { ReactNode } from 'react'
import { getTeamColor, trimBBTeamName } from '../utils/teamColors'

interface TeamChipProps {
  team: string
  label?: string
  icon?: ReactNode
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

export default function TeamChip({ team, label, icon, size = 'md', className = '' }: TeamChipProps) {
  const color = getTeamColor(team)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${className}`}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.border,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {icon}
      {label ?? trimBBTeamName(team)}
    </span>
  )
}
