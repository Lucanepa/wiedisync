export default {
  title: 'Absänze',
  subtitle: 'Zentrali Absänzverwautig',

  // Tabs
  tabMyAbsences: 'Mini Absänze',
  tabTeamAbsences: 'Team Absänze',

  // Actions
  newAbsence: 'Neui Absänz',

  // Form
  member: 'Mitglied',
  startDate: 'Vo',
  endDate: 'Bis',
  reason: 'Grund',
  detailsOptional: 'Details (optional)',
  detailsPlaceholder: 'Zusätzlichi Infos...',
  affects: 'Betrifft',

  // Reason options
  reasonInjury: 'Verletzung',
  reasonVacation: 'Ferie',
  reasonWork: 'Schaffe',
  reasonPersonal: 'Persönlich',
  reasonOther: 'Suscht',

  // Affects options
  affectsTrainings: 'Trainings',
  affectsGames: 'Spiel',
  affectsEvents: 'Events',
  affectsAll: 'Alles',

  // Validation
  startDateRequired: 'Startdatum bruuchts',
  endDateRequired: 'Änddatum bruuchts',
  endAfterStart: 'S Ändi muäss nochem Start sii',
  reasonRequired: 'Bitte wähl en Grund',
  memberRequired: 'Bitte wähl es Mitglied',
  errorSaving: 'Bim Speichere vo de Absänz isch öppis schief gange',

  // Modal titles
  newAbsenceTitle: 'Neui Absänz',
  editAbsenceTitle: 'Absänz bearbeite',

  // Delete dialog
  deleteTitle: 'Absänz lösche',
  deleteMessage: 'Bisch sicher, dass du die Absänz lösche wotsch?',

  // Empty states
  noAbsences: 'Käni Absänze',
  noAbsencesDescription: 'Käni Absänze gfunde.',
  noTeamAbsences: 'Käni Absänze',
  noTeamAbsencesDescription: 'Käni gmeldete Absänze i dem Zitraum.',

  // Team absence view
  fromTo: 'Vo',
  until: 'Bis',

  // Import
  importAbsences: 'Importiere',
  importTitle: 'Absänze importiere',
  importDescription: 'Lad e CSV- oder Excel-Datei mit mehrere Absänze ufe.',
  importDownloadTemplate: 'Vorlag abelade',
  importPreview: 'Vorschau',
  importValidRows: '{{valid}} gültig vo {{total}}',
  importButton: 'Importiere ({{count}})',
  importSuccess: '{{count}} Absänze erfolgriich importiert',
  importPartialSuccess: '{{created}} importiert, {{failed}} fählgschlage',
  importNoValidRows: 'Käni gültige Ziile gfunde',
  importInvalidReason: 'Ungültige Grund: "{{value}}"',
  importInvalidDate: 'Ungültigs Datumsformat',
  importParseError: 'Datei het nöd chönne gläse werde',

  // Indefinite
  indefinite: 'Unbefristet',
  indefiniteHint: 'käs Änddatum',

  // Weekly unavailability
  tabWeeklyUnavailability: 'Wöchentlichi Abweseheit',
  newWeekly: 'Neui Wöchentlichi',
  newWeeklyTitle: 'Neui wöchentlichi Abweseheit',
  editWeeklyTitle: 'Wöchentlichi Abweseheit bearbeite',
  daysOfWeek: 'Wuchetäg',
  noteOptional: 'Notiz (optional)',
  notePlaceholder: 'Zusätzlichi Infos...',
  atLeastOneDay: 'Mindestens ein Tag wähle',
  noWeeklyAbsences: 'Käni wöchentlichi Abweseheite',
  noWeeklyAbsencesDescription: 'Richt regelmässigi wöchentlichi Abweseheite ii.',
  deleteWeeklyTitle: 'Wöchentlichi Abweseheit lösche',
  deleteWeeklyMessage: 'Bisch sicher, dass du die wöchentlichi Abweseheit lösche wotsch?',

  // Day abbreviations
  dayMon: 'Mä',
  dayTue: 'Zi',
  dayWed: 'Mi',
  dayThu: 'Du',
  dayFri: 'Fr',
  daySat: 'Sa',
  daySun: 'Su',
} as const
