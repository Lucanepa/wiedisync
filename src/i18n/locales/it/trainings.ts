export default {
  title: 'Allenamenti',
  subtitle: 'Panoramica allenamenti con monitoraggio presenze',

  // Tabs
  tabTrainings: 'Allenamenti',
  tabCoachDashboard: 'Dashboard allenatore',

  // Training card
  attendance: 'Presenze',
  cancelled: 'Annullato',

  // Attendance sheet
  attendanceTitle: 'Presenze — {{date}}',
  attendanceTitleShort: 'Presenze',
  noPlayers: 'Nessun giocatore',
  noPlayersAssigned: 'Nessun giocatore è stato ancora assegnato a questa squadra.',

  // Coach dashboard
  seasonLabel: 'Stagione',
  noDataAvailable: 'Nessun dato disponibile',
  noDataDescription: 'Nessun dato di presenze da visualizzare.',

  // Table headers
  playerCol: 'Giocatore',
  numberCol: '#',
  trainingsCol: 'Allenamenti',
  presentCol: 'Presente',
  absentCol: 'Assente',
  rateCol: 'Tasso',
  trendCol: 'Tendenza',

  // Empty states
  noTrainings: 'Nessun allenamento',
  noTrainingsDescription: 'Nessun allenamento trovato per i filtri selezionati.',

  // CRUD
  newTraining: 'Nuovo allenamento',
  editTraining: 'Modifica allenamento',
  deleteTraining: 'Elimina allenamento',
  deleteConfirm: 'Sei sicuro di voler eliminare questo allenamento?',
  cancelTraining: 'Annulla allenamento',
  cancelReason: 'Motivo annullamento',

  // Recurring
  recurringTitle: 'Genera allenamenti ricorrenti',
  selectSlot: 'Seleziona fascia palestra',
  dateRange: 'Intervallo date',
  generatePreview: 'Anteprima date',
  generate: 'Genera',
  trainingsGenerated: '{{count}} allenamenti generati',
  trainingsSkipped: '{{count}} saltati (già esistenti)',
  respondBy: 'Rispondi entro',
  respondByHint: 'Promemoria 1 giorno prima',
  respondByHours: 'ore',
  respondByDays: 'giorni',
  respondByWeeks: 'settimane',
  respondByMonths: 'mesi',
  respondByBefore: 'prima',
  participation: 'Partecipazione',
  minParticipants: 'Min. partecipanti',
  maxParticipants: 'Max. partecipanti',
  untilSeasonEnd: 'A tempo indeterminato',
  slotFrom: 'da',
  slotUntil: 'fino a',

  // Recurring edit
  editRecurringTitle: 'Modifica allenamento ricorrente',
  editRecurringDescription: 'Questo allenamento fa parte di una serie ricorrente. Cosa vuoi modificare?',
  editThisOnly: 'Solo questo allenamento',
  editSameDay: 'Tutti gli allenamenti dello stesso giorno della settimana',
  editAllRecurring: 'Tutti gli allenamenti ricorrenti',
  cancelEdit: 'Annulla',

  // Slot mode
  slotDetected: 'Fascia palestra rilevata',
  claimedSlot: 'Fascia richiesta',
  regularSlot: 'Fascia regolare',
  noSlotForDay: 'Nessuna fascia palestra per questo giorno',
  useSlot: 'Usa fascia palestra',
  enterManually: 'Inserisci manualmente',
} as const
