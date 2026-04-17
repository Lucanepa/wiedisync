// src/modules/admin/components/EntityLink.tsx
import type { BucketKey } from './explorerHelpers'

interface Props {
  type: BucketKey
  id: string
  label: string
  onClick: (type: BucketKey, id: string) => void
  /** Background color (CSS color string). Falls back to shadcn `muted`. */
  color?: string
  /** Text color. Falls back to shadcn `foreground`. */
  textColor?: string
}

/** Pill-shaped clickable entity link. Chips for teams, pills for everything else. */
export default function EntityLink({ type, id, label, onClick, color, textColor }: Props) {
  const useCustom = Boolean(color || textColor)
  return (
    <button
      type="button"
      onClick={() => onClick(type, id)}
      className={
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ' +
        (useCustom ? '' : 'bg-muted text-foreground')
      }
      style={useCustom ? { backgroundColor: color, color: textColor } : undefined}
    >
      {label}
    </button>
  )
}
