export default {
  title: 'Schreiberdienst',
  subtitle: 'Schreiber- und Schiedsrichterzuteilungen für Heimspiele.',

  // Tabs
  tabGames: 'Spiele',
  tabOverview: 'Übersicht',

  // Labels — Volleyball
  scorer: 'Schreiber',
  scoreboard: 'Täfeler',
  scorerTaefeler: 'Schreiber/Täfeler',
  confirmed: 'Bestätigt',

  // Labels — Basketball
  bbAnschreiber: 'Anschreiber/in',
  bbZeitnehmer: 'Zeitnehmer/in',
  bb24sOfficial: '24"-Offizielle/r',
  bbDutyTeam: 'Offiziellen-Team',

  // Sport toggle
  sportVolleyball: 'Volleyball',
  sportBasketball: 'Basketball',
  officialsDuties: 'Offizielle',
  dutyTeam: 'Dienst-Team',

  // Status labels
  statusConfirmed: 'Bestätigt',
  statusAssigned: 'Zugeteilt',
  statusOpen: 'Offen',

  // Filters
  filterDate: 'Datum',
  filterDutyTeam: 'Dienst-Team',
  filterDutyType: 'Dienstart',
  filterUnassigned: 'Offene Dienste',
  filterSearchAssignee: 'Person suchen',
  filterAllTeams: 'Alle Teams',
  filterAllTypes: 'Alle Arten',
  filterAllDuties: 'Alle Dienste',
  filterAnyUnassigned: 'Offene Zuteilungen',
  searchAssigneePlaceholder: 'Name eingeben...',
  clearFilters: 'Filter zurücksetzen',

  // Empty state
  noGames: 'Keine Spiele',
  noGamesDescription: 'Keine Spiele für den ausgewählten Filter gefunden.',

  // Past games
  showOlderGames: 'Ältere Spiele anzeigen ({{count}})',
  loadMore: 'Mehr laden',
  hidePast: 'Ältere ausblenden',

  // Actions
  exportICal: 'Zum Kalender hinzufügen',
  unassigned: 'Nicht zugeteilt',
  unconfirm: 'Bestätigung aufheben',

  // Self-assign
  selfAssign: 'Ich übernehme',
  confirmSelfAssignTitle: 'Einsatz bestätigen',
  confirmSelfAssignMessage: 'Möchtest du dich als {{role}} für {{game}} am {{date}} eintragen?',
  cancelAction: 'Abbrechen',
  confirmAction: 'Bestätigen',

  // Placeholders
  selectTeam: '— Team wählen —',
  selectPerson: '— Person wählen —',

  // Overview
  overviewEmpty: 'Keine Zuteilungen gefunden.',
  dutyCount: '{{count}} Einsätze',

  // Permissions
  permissionsNotice: 'Schreiberdienst kann nur von Admins und Coaches verwaltet werden.',

  // iCal export
  scorerDutyIcal: 'Schreiberdienst: {{home}} vs {{away}}',

  // BB TOON Import
  bbImportTitle: 'BB Offiziellen importieren',
  bbImportDescription: 'TOON-Datei mit Spalten: Tag, Datum, Zeit, SpielNr, Team, OTR1, OTR2, OTR3',
  bbImportButton: 'TOON importieren',
  bbImportPaste: 'TOON einfügen oder Datei hochladen',
  bbImportParsing: 'Datei wird verarbeitet...',
  bbImportSummary: '{{matched}} von {{total}} Spielen zugeordnet',
  bbImportUnmatchedGames: '{{count}} Spiel(e) nicht gefunden',
  bbImportUnmatchedPersons: '{{count}} Person(en) nicht gefunden',
  bbImportConfirm: 'Importieren ({{count}})',
  bbImportSuccess: '{{updated}} aktualisiert, {{skipped}} übersprungen, {{errors}} Fehler',
  bbImportNoRows: 'Keine Spiele in der Datei gefunden.',
  bbImportGameNotFound: 'Spiel nicht gefunden',
  bbImportPersonNotFound: 'Nicht gefunden',
  bbImportTeamNotFound: 'Team nicht gefunden',
  bbImportAmbiguous: 'Mehrdeutig',
  bbImportLicenceWarn: 'Fehlende Lizenz',
  bbImportNo24s: 'Keine 24s',
  bbImportEmpty: 'Leer',
  bbImportAlreadyAssigned: 'Bereits zugeteilt',
} as const
