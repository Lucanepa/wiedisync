export default {
  title: 'Trainings',
  subtitle: 'Trainingsübersicht mit Aaweseheitskontrolle',

  // Tabs
  tabTrainings: 'Trainings',
  tabCoachDashboard: 'Trainer Dashboard',

  // Training card
  attendance: 'Aaweseheit',
  cancelled: 'Abgseit',

  // Attendance sheet
  attendanceTitle: 'Aaweseheit — {{date}}',
  attendanceTitleShort: 'Aaweseheit',
  noPlayers: 'Käni Spieler',
  noPlayersAssigned: 'Dem Team sind no käni Spieler zuewise worde.',

  // Coach dashboard
  seasonLabel: 'Saison',
  noDataAvailable: 'Käni Date verfüegbar',
  noDataDescription: 'Käni Aaweseheitsdate vorhande.',

  // Table headers
  playerCol: 'Spieler',
  numberCol: '#',
  trainingsCol: 'Trainings',
  presentCol: 'Aawesend',
  absentCol: 'Abwesend',
  rateCol: 'Quote',
  trendCol: 'Trend',

  // Filter
  showPast: 'Ältere Trainings aazeige',
  hidePast: 'Ältere Trainings usblände',

  // Empty states
  noTrainings: 'Käni Trainings',
  noTrainingsDescription: 'Käni Trainings für d usgwählte Filter gfunde.',

  // CRUD
  newTraining: 'Neus Training',
  newSingleTraining: 'Einzels Training',
  newRecurringTraining: 'Wiederkehrendes Trainigs',
  editTraining: 'Training bearbeite',
  deleteTraining: 'Training lösche',
  deleteConfirm: 'Bisch sicher, dass du das Training lösche wotsch?',
  cancelTraining: 'Training absäge',
  trainingCancelled: 'Training abgseit',
  cancelReason: 'Grund vo de Absag',

  // Recurring
  recurringTitle: 'Wiederkehrendi Trainings erstelle',
  selectSlot: 'Halleslot wähle',
  dateRange: 'Zitraum',
  generatePreview: 'Vorschau Date',
  generate: 'Erstelle',
  trainingsGenerated: '{{count}} Trainings erstellt',
  trainingsSkipped: '{{count}} übersprunge (scho vorhande)',
  respondBy: 'Antwort bis',
  respondByHint: 'Erinnering 1 Tag vorher',
  respondByTime: 'Aamäldefrischt Uhrzit',
  respondByHours: 'Stunde',
  respondByDays: 'Täg',
  respondByWeeks: 'Wuche',
  respondByMonths: 'Monet',
  respondByBefore: 'vorher',
  participation: 'Teilnahm',
  minParticipants: 'Min. Teilnehmer',
  maxParticipants: 'Max. Teilnehmer',
  untilSeasonEnd: 'Unbefristet',
  slotFrom: 'ab',
  slotUntil: 'bis',

  // Recurring edit
  editRecurringTitle: 'Wiederkehrends Training bearbeite',
  editRecurringDescription: 'Das Training ghört zu enere wiederkehrende Serie. Was wotsch bearbeite?',
  editThisOnly: 'Nur das Training',
  editSameDay: 'Alli Trainings am gliiche Wuchetag',
  editAllRecurring: 'Alli wiederkehrende Trainings',
  cancelEdit: 'Abbräche',

  // Slot mode
  slotDetected: 'Halleslot erkennt',
  claimedSlot: 'Beanspruchte Slot',
  regularSlot: 'Reguläre Slot',
  noSlotForDay: 'Käs Halleslot a dem Tag',
  useSlot: 'Halleslot verwände',
  enterManually: 'Manuell iigäh',
  autoCancelOnMin: 'Automatisch absäge',
  autoCancelOnMinHint: 'Training wird bi Frischtablauf automatisch abgseit, wenn weniger Zusage als s Minimum vorliged',
} as const
