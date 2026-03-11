export default {
  title: 'Scorer duty',
  subtitle: 'Manage scorer and scoreboard assignments for home games.',

  // Tabs
  tabGames: 'Games',
  tabOverview: 'Overview',

  // Labels — Volleyball
  scorer: 'Scorer',
  scoreboard: 'Scoreboard',
  scorerTaefeler: 'Scorer/Scoreboard',
  confirmed: 'Confirmed',

  // Labels — Basketball
  bbAnschreiber: 'Scorer (OTR1)',
  bbZeitnehmer: 'Timekeeper (OTR1)',
  bb24sOfficial: '24" Official (OTR2)',
  bbDutyTeam: 'Officials Team',

  // Sport toggle
  sportVolleyball: 'Volleyball',
  sportBasketball: 'Basketball',
  officialsDuties: 'Officials',
  dutyTeam: 'Duty Team',

  // Status labels
  statusConfirmed: 'Confirmed',
  statusAssigned: 'Assigned',
  statusOpen: 'Open',

  // Filters
  filterDate: 'Date',
  filterDutyTeam: 'Duty Team',
  filterDutyType: 'Duty Type',
  filterUnassigned: 'Unassigned Duty',
  filterSearchAssignee: 'Look for assignee',
  filterAllTeams: 'All Teams',
  filterAllTypes: 'All Types',
  filterAllDuties: 'All Duties',
  filterAnyUnassigned: 'Any unassigned',
  searchAssigneePlaceholder: 'Search assignees...',
  clearFilters: 'Clear Filters',

  // Empty state
  noGames: 'No games',
  noGamesDescription: 'No games found for the selected filter.',

  // Past games
  showOlderGames: 'Show older games ({{count}})',
  loadMore: 'Load more',
  hidePast: 'Hide older games',

  // Actions
  exportICal: 'Add to calendar',
  unassigned: 'Unassigned',
  unconfirm: 'Undo confirmation',

  // Self-assign
  selfAssign: 'Sign me up',
  confirmSelfAssignTitle: 'Confirm assignment',
  confirmSelfAssignMessage: 'Do you want to sign up as {{role}} for {{game}} on {{date}}?',
  cancelAction: 'Cancel',
  confirmAction: 'Confirm',

  // Placeholders
  selectTeam: '— Select team —',
  selectPerson: '— Select person —',

  // Overview
  overviewEmpty: 'No assignments found.',
  dutyCount: '{{count}} duties',

  // Permissions
  permissionsNotice: 'Scorer assignments can only be managed by admins and coaches.',

  // iCal export
  scorerDutyIcal: 'Scorer duty: {{home}} vs {{away}}',

  // BB TOON Import
  bbImportTitle: 'Import BB Officials',
  bbImportDescription: 'TOON file with columns: Tag, Datum, Zeit, SpielNr, Team, OTR1, OTR2, OTR3',
  bbImportButton: 'Import TOON',
  bbImportPaste: 'Paste TOON or upload file',
  bbImportParsing: 'Processing file...',
  bbImportSummary: '{{matched}} of {{total}} games matched',
  bbImportUnmatchedGames: '{{count}} game(s) not found',
  bbImportUnmatchedPersons: '{{count}} person(s) not found',
  bbImportConfirm: 'Import ({{count}})',
  bbImportSuccess: '{{updated}} updated, {{skipped}} skipped, {{errors}} errors',
  bbImportNoRows: 'No games found in file.',
  bbImportGameNotFound: 'Game not found',
  bbImportPersonNotFound: 'Not found',
  bbImportTeamNotFound: 'Team not found',
  bbImportAmbiguous: 'Ambiguous',
  bbImportLicenceWarn: 'Missing licence',
  bbImportNo24s: 'No 24s',
  bbImportEmpty: 'Empty',
  bbImportAlreadyAssigned: 'Already assigned',
} as const
