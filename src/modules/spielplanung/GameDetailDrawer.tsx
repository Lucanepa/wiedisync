import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, Home as HomeIcon, Pencil, Plane, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'
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
  /** When set, the "Edit" button appears for manual games in the caller's scope. */
  onEdit?: (game: Game) => void
  /** When set, the "Delete" button appears for manual games in the caller's scope. */
  onDelete?: (game: Game) => Promise<void> | void
  /** True if the current user can edit this specific game's manual fields. */
  canEdit?: boolean
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

export default function GameDetailDrawer({
  game,
  onClose,
  onEdit,
  onDelete,
  canEdit,
}: GameDetailDrawerProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!game) return null

  const team = asObj<Team>(game.kscw_team)
  const teamName = team?.name ?? '—'
  const isHome = game.type === 'home'
  const opponent = opponentName(game)
  const date = formatDate(parseDate(game.date), 'EEE, d MMM yyyy')
  const time = game.time ? formatTime(game.time) : ''
  const badge = sourceBadge(game.source)
  const isManual = game.source === 'manual'
  const showEdit = isManual && canEdit && onEdit
  const showDelete = isManual && canEdit && onDelete

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatSvrzClipboard(game!))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // no-op — clipboard may be unavailable
    }
  }

  async function handleDeleteConfirm() {
    if (!onDelete || !game) return
    setDeleting(true)
    try {
      await onDelete(game)
      setConfirmingDelete(false)
      onClose()
    } finally {
      setDeleting(false)
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

        {!isManual && (
          <p className="mt-4 px-4 text-xs text-muted-foreground italic">
            {t('spielplanung:drawer.svrzReadOnlyHint', 'Official details come from SVRZ. Edit those on Volleymanager.')}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 px-4">
          {showEdit && (
            <button
              type="button"
              onClick={() => { onEdit!(game!); onClose() }}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gold-400 px-3 py-2 text-sm font-semibold text-brand-900 transition-colors hover:bg-gold-500"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {t('spielplanung:drawer.edit', 'Edit')}
            </button>
          )}
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
          {showDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-background px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t('spielplanung:drawer.delete', 'Delete')}
            </button>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={confirmingDelete} onOpenChange={(open) => !deleting && setConfirmingDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('spielplanung:drawer.deleteConfirmTitle', 'Delete manual game?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('spielplanung:drawer.deleteConfirmBody', 'This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('spielplanung:drawer.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t('spielplanung:drawer.confirmDelete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
