import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, Home as HomeIcon, Plane } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/sheet'
import { Badge } from '../../components/ui/badge'
import type { Game, Team } from '../../types'
import { asObj } from '../../utils/relations'
import { formatDate, parseDate } from '../../utils/dateUtils'
import { formatTime } from '../../utils/dateHelpers'
import { opponentName } from './gameChipUtils'
import { formatSvrzClipboard } from './utils/svrzClipboard'

interface GameDetailDrawerProps {
  game: Game | null
  onClose: () => void
}

function sourceBadge(source: Game['source']): { key: string; variant: 'secondary' | 'outline' } {
  switch (source) {
    case 'swiss_volley':
      return { key: 'spielplanung:drawer.sourceSVRZ', variant: 'secondary' }
    case 'basketplan':
      return { key: 'spielplanung:drawer.sourceBasketplan', variant: 'secondary' }
    default:
      return { key: 'spielplanung:drawer.sourceManual', variant: 'outline' }
  }
}

function hallDisplay(game: Game): string {
  const hall = asObj<{ name: string }>(game.hall)
  if (hall?.name) return hall.name
  if (game.away_hall_json?.name) return game.away_hall_json.name
  return '—'
}

export default function GameDetailDrawer({ game, onClose }: GameDetailDrawerProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  if (!game) return null

  const team = asObj<Team>(game.kscw_team)
  const teamName = team?.name ?? '—'
  const isHome = game.type === 'home'
  const opponent = opponentName(game)
  const date = formatDate(parseDate(game.date), 'EEE, d MMM yyyy')
  const time = game.time ? formatTime(game.time) : ''
  const badge = sourceBadge(game.source)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatSvrzClipboard(game!))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // no-op — clipboard may be unavailable
    }
  }

  return (
    <Sheet open={!!game} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{teamName}</span>
            {isHome ? (
              <HomeIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
            )}
            <span className="text-muted-foreground font-normal">{t('spielplanung:drawer.vs', 'vs')}</span>
            <span className="font-semibold">{opponent}</span>
          </SheetTitle>
          <SheetDescription>{date}{time ? ` · ${time}` : ''}</SheetDescription>
          <div className="pt-1">
            <Badge variant={badge.variant}>{t(badge.key, badge.key.split('.').pop()!)}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-4">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('spielplanung:drawer.hall', 'Hall')}</dt>
            <dd>{hallDisplay(game)}</dd>
            <dt className="text-muted-foreground">{t('spielplanung:drawer.league', 'League')}</dt>
            <dd>{game.league || '—'}</dd>
            <dt className="text-muted-foreground">{t('spielplanung:drawer.round', 'Round')}</dt>
            <dd>{game.round || '—'}</dd>
            {game.source === 'manual' && (
              <>
                <dt className="text-muted-foreground">{t('spielplanung:drawer.svrzPush', 'SVRZ push')}</dt>
                <dd className="text-amber-600 dark:text-amber-400">
                  {t('spielplanung:drawer.notInVolleymanager', 'Not yet in Volleymanager')}
                </dd>
              </>
            )}
          </dl>
        </div>

        <div className="mt-6 flex flex-col gap-2 px-4">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied
              ? t('spielplanung:drawer.copied', 'Copied!')
              : t('spielplanung:drawer.copySvrz', 'Copy SVRZ details')}
          </button>
          {/* Edit / Delete buttons arrive in Plan 03. */}
        </div>
      </SheetContent>
    </Sheet>
  )
}
