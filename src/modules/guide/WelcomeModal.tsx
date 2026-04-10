import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'

interface WelcomeModalProps {
  open: boolean
  onStart: () => void
  onSkip: () => void
}

export function WelcomeModal({ open, onStart, onSkip }: WelcomeModalProps) {
  const { t } = useTranslation('guide')

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onSkip() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('welcome.title')}</DialogTitle>
          <DialogDescription>{t('welcome.body')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={onSkip}>
            {t('welcome.skip')}
          </Button>
          <Button onClick={onStart}>
            {t('welcome.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
