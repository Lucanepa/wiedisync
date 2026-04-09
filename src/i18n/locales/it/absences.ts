export default {
  title: 'Assenze',
  subtitle: 'Gestione centralizzata delle assenze',

  // Tabs
  tabMyAbsences: 'Le mie assenze',
  tabTeamAbsences: 'Assenze della squadra',

  // Actions
  newAbsence: 'Nuova assenza',

  // Form
  member: 'Membro',
  startDate: 'Da',
  endDate: 'A',
  reason: 'Motivo',
  detailsOptional: 'Dettagli (facoltativo)',
  detailsPlaceholder: 'Informazioni aggiuntive...',
  affects: 'Riguarda',

  // Reason options
  reasonInjury: 'Infortunio',
  reasonVacation: 'Vacanza',
  reasonWork: 'Lavoro',
  reasonPersonal: 'Personale',
  reasonOther: 'Altro',

  // Affects options
  affectsTrainings: 'Allenamenti',
  affectsGames: 'Partite',
  affectsEvents: 'Eventi',
  affectsAll: 'Tutto',

  // Validation
  startDateRequired: 'La data di inizio è obbligatoria',
  endDateRequired: 'La data di fine è obbligatoria',
  endAfterStart: 'La data di fine deve essere successiva a quella di inizio',
  reasonRequired: 'Seleziona un motivo',
  memberRequired: 'Seleziona un membro',
  errorSaving: 'Errore durante il salvataggio dell\'assenza',

  // Modal titles
  newAbsenceTitle: 'Nuova assenza',
  editAbsenceTitle: 'Modifica assenza',

  // Delete dialog
  deleteTitle: 'Elimina assenza',
  deleteMessage: 'Sei sicuro di voler eliminare questa assenza?',

  // Empty states
  noAbsences: 'Nessuna assenza',
  noAbsencesDescription: 'Nessuna assenza trovata.',
  noUpcomingAbsences: 'Nessuna assenza attuale.',
  showOlderAbsences: 'Mostra assenze passate ({{count}})',
  noTeamAbsences: 'Nessuna assenza',
  noTeamAbsencesDescription: 'Nessuna assenza segnalata in questo periodo.',

  // Team absence view
  fromTo: 'Da',
  until: 'A',

  // Import
  importAbsences: 'Importare',
  importTitle: 'Importa assenze',
  importDescription: 'Carica un file CSV o Excel con piu assenze.',
  importDownloadTemplate: 'Scarica modello',
  importPreview: 'Anteprima',
  importValidRows: '{{valid}} valide su {{total}}',
  importButton: 'Importa ({{count}})',
  importSuccess: '{{count}} assenze importate con successo',
  importPartialSuccess: '{{created}} importate, {{failed}} fallite',
  importNoValidRows: 'Nessuna riga valida trovata',
  importInvalidReason: 'Motivo non valido: "{{value}}"',
  importInvalidDate: 'Formato data non valido',
  importParseError: 'Impossibile leggere il file',

  // Indefinite
  indefinite: 'Indefinito',
  indefiniteHint: 'nessuna data di fine',

  // Weekly unavailability
  tabWeeklyUnavailability: 'Indisponibilità settimanale',
  newWeekly: 'Nuova settimanale',
  newWeeklyTitle: 'Nuova indisponibilità settimanale',
  editWeeklyTitle: 'Modifica indisponibilità settimanale',
  daysOfWeek: 'Giorni della settimana',
  noteOptional: 'Nota (facoltativo)',
  notePlaceholder: 'Informazioni aggiuntive...',
  atLeastOneDay: 'Seleziona almeno un giorno',
  noWeeklyAbsences: 'Nessuna indisponibilità settimanale',
  noWeeklyAbsencesDescription: 'Configura indisponibilità settimanali ricorrenti.',
  deleteWeeklyTitle: 'Elimina indisponibilità settimanale',
  deleteWeeklyMessage: 'Sei sicuro di voler eliminare questa indisponibilità settimanale?',

  // Day abbreviations
  dayMon: 'Lun',
  dayTue: 'Mar',
  dayWed: 'Mer',
  dayThu: 'Gio',
  dayFri: 'Ven',
  daySat: 'Sab',
  daySun: 'Dom',
} as const
