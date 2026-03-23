export default {
  title: 'Absenzen',
  subtitle: 'Zentrale Absenzverwaltung',

  // Tabs
  tabMyAbsences: 'Meine Absenzen',
  tabTeamAbsences: 'Team Absenzen',

  // Actions
  newAbsence: 'Neue Absenz',

  // Form
  member: 'Mitglied',
  startDate: 'Von',
  endDate: 'Bis',
  reason: 'Grund',
  detailsOptional: 'Details (optional)',
  detailsPlaceholder: 'Zusätzliche Informationen...',
  affects: 'Betrifft',

  // Reason options
  reasonInjury: 'Verletzung',
  reasonVacation: 'Ferien',
  reasonWork: 'Arbeit',
  reasonPersonal: 'Persönlich',
  reasonOther: 'Sonstiges',

  // Affects options
  affectsTrainings: 'Trainings',
  affectsGames: 'Spiele',
  affectsEvents: 'Events',
  affectsAll: 'Alles',

  // Validation
  startDateRequired: 'Startdatum ist erforderlich',
  endDateRequired: 'Enddatum ist erforderlich',
  endAfterStart: 'Enddatum muss nach dem Startdatum sein',
  reasonRequired: 'Bitte wähle einen Grund',
  memberRequired: 'Bitte wähle ein Mitglied',
  errorSaving: 'Fehler beim Speichern der Absenz',

  // Modal titles
  newAbsenceTitle: 'Neue Absenz',
  editAbsenceTitle: 'Absenz bearbeiten',

  // Delete dialog
  deleteTitle: 'Absenz löschen',
  deleteMessage: 'Bist du sicher, dass du diese Absenz löschen willst?',

  // Empty states
  noAbsences: 'Keine Absenzen',
  noAbsencesDescription: 'Keine Absenzen gefunden.',
  noTeamAbsences: 'Keine Absenzen',
  noTeamAbsencesDescription: 'Keine gemeldeten Absenzen in diesem Zeitraum.',

  // Team absence view
  fromTo: 'Von',
  until: 'Bis',

  // Import
  importAbsences: 'Importieren',
  importTitle: 'Absenzen importieren',
  importDescription: 'Lade eine CSV- oder Excel-Datei mit mehreren Absenzen hoch.',
  importDownloadTemplate: 'Vorlage herunterladen',
  importPreview: 'Vorschau',
  importValidRows: '{{valid}} gültig von {{total}}',
  importButton: 'Importieren ({{count}})',
  importSuccess: '{{count}} Absenzen erfolgreich importiert',
  importPartialSuccess: '{{created}} importiert, {{failed}} fehlgeschlagen',
  importNoValidRows: 'Keine gültigen Zeilen gefunden',
  importInvalidReason: 'Ungültiger Grund: "{{value}}"',
  importInvalidDate: 'Ungültiges Datumsformat',
  importParseError: 'Datei konnte nicht gelesen werden',

  // Indefinite
  indefinite: 'Unbefristet',
  indefiniteHint: 'kein Enddatum',

  // Weekly unavailability
  tabWeeklyUnavailability: 'Wöchentliche Abwesenheit',
  newWeekly: 'Neue Wöchentliche',
  newWeeklyTitle: 'Neue wöchentliche Abwesenheit',
  editWeeklyTitle: 'Wöchentliche Abwesenheit bearbeiten',
  daysOfWeek: 'Wochentage',
  noteOptional: 'Notiz (optional)',
  notePlaceholder: 'Zusätzliche Informationen...',
  atLeastOneDay: 'Mindestens ein Tag wählen',
  noWeeklyAbsences: 'Keine wöchentlichen Abwesenheiten',
  noWeeklyAbsencesDescription: 'Richte regelmässige wöchentliche Abwesenheiten ein.',
  deleteWeeklyTitle: 'Wöchentliche Abwesenheit löschen',
  deleteWeeklyMessage: 'Bist du sicher, dass du diese wöchentliche Abwesenheit löschen willst?',

  // Day abbreviations
  dayMon: 'Mo',
  dayTue: 'Di',
  dayWed: 'Mi',
  dayThu: 'Do',
  dayFri: 'Fr',
  daySat: 'Sa',
  daySun: 'So',
} as const
