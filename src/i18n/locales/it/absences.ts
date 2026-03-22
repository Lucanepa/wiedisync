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
  noTeamAbsences: 'Nessuna assenza',
  noTeamAbsencesDescription: 'Nessuna assenza segnalata in questo periodo.',

  // Team absence view
  fromTo: 'Da',
  until: 'A',
} as const
