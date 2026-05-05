import { useTranslation } from 'react-i18next'
import type { Absence } from '../types'

/**
 * Returns the localized prefill text for the participation note when a
 * covering absence applies. Empty string when no absence.
 *
 * - Weekly absences → "Weekly unavailability" (i18n)
 * - One-off absences → translated reason (Vacation / Injury / Work / …)
 *
 * The user can still edit the note freely; this is just the default.
 */
export function useAbsenceNoteText(absence: Absence | null): string {
  const { t } = useTranslation('absences')
  if (!absence) return ''
  if (absence.type === 'weekly') return t('weeklyUnavailability')
  const map: Record<string, string> = {
    injury: t('reasonInjury'),
    vacation: t('reasonVacation'),
    work: t('reasonWork'),
    personal: t('reasonPersonal'),
    other: t('reasonOther'),
  }
  return map[absence.reason] ?? ''
}
