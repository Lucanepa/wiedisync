export default {
  title: 'Trainings',
  subtitle: 'Trainingsübersicht mit Anwesenheitskontrolle',

  // Tabs
  tabTrainings: 'Trainings',
  tabCoachDashboard: 'Trainer Dashboard',

  // Training card
  attendance: 'Anwesenheit',
  cancelled: 'Abgesagt',

  // Attendance sheet
  attendanceTitle: 'Anwesenheit — {{date}}',
  attendanceTitleShort: 'Anwesenheit',
  noPlayers: 'Keine Spieler',
  noPlayersAssigned: 'Diesem Team wurden noch keine Spieler zugewiesen.',

  // Coach dashboard
  seasonLabel: 'Saison',
  noDataAvailable: 'Keine Daten verfügbar',
  noDataDescription: 'Keine Anwesenheitsdaten vorhanden.',

  // Table headers
  playerCol: 'Spieler',
  numberCol: '#',
  trainingsCol: 'Trainings',
  presentCol: 'Anwesend',
  absentCol: 'Abwesend',
  rateCol: 'Quote',
  trendCol: 'Trend',

  // Filter
  showPast: 'Ältere Trainings anzeigen',

  // Empty states
  noTrainings: 'Keine Trainings',
  noTrainingsDescription: 'Keine Trainings für die ausgewählten Filter gefunden.',

  // CRUD
  newTraining: 'Neues Training',
  newSingleTraining: 'Einzelnes Training',
  newRecurringTraining: 'Wiederkehrende Trainings',
  editTraining: 'Training bearbeiten',
  deleteTraining: 'Training löschen',
  deleteConfirm: 'Bist du sicher, dass du dieses Training löschen willst?',
  cancelTraining: 'Training absagen',
  trainingCancelled: 'Training abgesagt',
  cancelReason: 'Grund der Absage',

  // Recurring
  recurringTitle: 'Wiederkehrende Trainings erstellen',
  selectSlot: 'Hallenslot wählen',
  dateRange: 'Zeitraum',
  generatePreview: 'Vorschau Daten',
  generate: 'Erstellen',
  trainingsGenerated: '{{count}} Trainings erstellt',
  trainingsSkipped: '{{count}} übersprungen (bereits vorhanden)',
  respondBy: 'Antwort bis',
  respondByHint: 'Erinnerung 1 Tag vorher',
  respondByTime: 'Anmeldefrist Uhrzeit',
  respondByHours: 'Stunden',
  respondByDays: 'Tage',
  respondByWeeks: 'Wochen',
  respondByMonths: 'Monate',
  respondByBefore: 'vorher',
  participation: 'Teilnahme',
  minParticipants: 'Min. Teilnehmer',
  maxParticipants: 'Max. Teilnehmer',
  untilSeasonEnd: 'Unbefristet',
  slotFrom: 'ab',
  slotUntil: 'bis',

  // Recurring edit
  editRecurringTitle: 'Wiederkehrendes Training bearbeiten',
  editRecurringDescription: 'Dieses Training gehört zu einer wiederkehrenden Serie. Was möchtest du bearbeiten?',
  editThisOnly: 'Nur dieses Training',
  editSameDay: 'Alle Trainings am gleichen Wochentag',
  editAllRecurring: 'Alle wiederkehrenden Trainings',
  cancelEdit: 'Abbrechen',

  // Slot mode
  slotDetected: 'Hallenslot erkannt',
  claimedSlot: 'Beanspruchter Slot',
  regularSlot: 'Regulärer Slot',
  noSlotForDay: 'Kein Hallenslot an diesem Tag',
  useSlot: 'Hallenslot verwenden',
  enterManually: 'Manuell eingeben',
} as const
