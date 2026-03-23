import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CarpoolOfferFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { seats_available: number; departure_time: string; departure_location: string; notes?: string }) => void
}

export default function CarpoolOfferForm({ open, onClose, onSubmit }: CarpoolOfferFormProps) {
  const { t } = useTranslation('carpool')
  const [seats, setSeats] = useState(4)
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!time || !location) return
    onSubmit({
      seats_available: seats,
      departure_time: time,
      departure_location: location,
      notes: notes || undefined,
    })
    // Reset form
    setSeats(4)
    setTime('')
    setLocation('')
    setNotes('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('offerRide')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="carpool-seats">{t('seats')}</Label>
            <Input
              id="carpool-seats"
              type="number"
              min={1}
              max={8}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="carpool-time">{t('departureTime')}</Label>
            <Input
              id="carpool-time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="carpool-location">{t('departureLocation')}</Label>
            <Input
              id="carpool-location"
              type="text"
              required
              placeholder={t('departureLocationPlaceholder')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="carpool-notes">{t('notes')}</Label>
            <Textarea
              id="carpool-notes"
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common:cancel', 'Cancel')}
            </Button>
            <Button type="submit">
              {t('offerRide')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
