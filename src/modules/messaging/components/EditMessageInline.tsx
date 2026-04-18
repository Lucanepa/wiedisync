import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { messagingApi } from '../api/messaging'

type Props = {
  messageId: string
  initialBody: string
  onDone: () => void
}

export default function EditMessageInline({ messageId, initialBody, onDone }: Props) {
  const { t } = useTranslation('messaging')
  const [value, setValue] = useState(initialBody)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await messagingApi.edit(messageId, { body: trimmed })
      onDone()
    } catch { /* toast later */ }
    finally { setBusy(false) }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') { e.preventDefault(); onDone() }
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
        rows={2}
        disabled={busy}
        className="w-full min-h-[44px] max-h-40 resize-none rounded-md border border-input bg-background text-foreground text-sm p-2 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={t('editMessage')}
      />
      <div className="flex gap-1 self-end">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={busy} aria-label={t('cancel')}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={save} disabled={busy || value.trim().length === 0} aria-label={t('save')}>
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
