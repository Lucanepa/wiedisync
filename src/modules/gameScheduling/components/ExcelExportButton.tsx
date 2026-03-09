import { useTranslation } from 'react-i18next'
import type { GameSchedulingBooking, GameSchedulingOpponent, GameSchedulingSlot, Team } from '../../../types'

interface Props {
  bookings: GameSchedulingBooking[]
  opponents: GameSchedulingOpponent[]
  slots: GameSchedulingSlot[]
  teams: Team[]
}

export default function ExcelExportButton({ bookings, opponents, slots, teams }: Props) {
  const { t } = useTranslation('gameScheduling')

  const handleExport = async () => {
    // Dynamic import of xlsx to keep bundle small
    const XLSX = await import('xlsx')

    const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]))
    const oppMap = Object.fromEntries(opponents.map(o => [o.id, o]))
    const slotMap = Object.fromEntries(slots.map(s => [s.id, s]))

    const rows = bookings
      .filter(b => b.status === 'confirmed')
      .map(b => {
        const opp = oppMap[b.opponent]
        const teamName = opp ? teamMap[opp.kscw_team] || '' : ''

        if (b.type === 'home_slot_pick') {
          const slot = slotMap[b.slot]
          return {
            Datum: slot?.date?.slice(0, 10) || '',
            Zeit: slot ? `${slot.start_time} - ${slot.end_time}` : '',
            'KSCW Team': teamName,
            Gegner: opp?.club_name || '',
            Halle: slot?.hall || '',
            Typ: 'Heim',
            Kontakt: opp?.contact_email || '',
          }
        } else {
          const propNum = b.confirmed_proposal
          const dt = b[`proposed_datetime_${propNum}` as keyof typeof b] as string || ''
          const place = b[`proposed_place_${propNum}` as keyof typeof b] as string || ''
          return {
            Datum: dt.slice(0, 10),
            Zeit: dt.length > 10 ? dt.slice(11, 16) : '',
            'KSCW Team': teamName,
            Gegner: opp?.club_name || '',
            Halle: place,
            Typ: 'Auswärts',
            Kontakt: opp?.contact_email || '',
          }
        }
      })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Spielplan')
    XLSX.writeFile(wb, 'spielplan_export.xlsx')
  }

  return (
    <button
      onClick={handleExport}
      disabled={bookings.filter(b => b.status === 'confirmed').length === 0}
      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {t('downloadExcel')}
    </button>
  )
}
