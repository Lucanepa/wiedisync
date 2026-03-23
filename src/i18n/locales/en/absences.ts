export default {
  title: 'Absences',
  subtitle: 'Centralized absence management',

  // Tabs
  tabMyAbsences: 'My Absences',
  tabTeamAbsences: 'Team Absences',

  // Actions
  newAbsence: 'New Absence',

  // Form
  member: 'Member',
  startDate: 'From',
  endDate: 'To',
  reason: 'Reason',
  detailsOptional: 'Details (optional)',
  detailsPlaceholder: 'Additional information...',
  affects: 'Affects',

  // Reason options
  reasonInjury: 'Injury',
  reasonVacation: 'Vacation',
  reasonWork: 'Work',
  reasonPersonal: 'Personal',
  reasonOther: 'Other',

  // Affects options
  affectsTrainings: 'Trainings',
  affectsGames: 'Games',
  affectsEvents: 'Events',
  affectsAll: 'All',

  // Validation
  startDateRequired: 'Start date is required',
  endDateRequired: 'End date is required',
  endAfterStart: 'End date must be after start date',
  reasonRequired: 'Please select a reason',
  memberRequired: 'Please select a member',
  errorSaving: 'Error saving absence',

  // Modal titles
  newAbsenceTitle: 'New Absence',
  editAbsenceTitle: 'Edit Absence',

  // Delete dialog
  deleteTitle: 'Delete Absence',
  deleteMessage: 'Are you sure you want to delete this absence?',

  // Empty states
  noAbsences: 'No absences',
  noAbsencesDescription: 'No absences found.',
  noTeamAbsences: 'No absences',
  noTeamAbsencesDescription: 'No reported absences in this period.',

  // Team absence view
  fromTo: 'From',
  until: 'To',

  // Import
  importAbsences: 'Import',
  importTitle: 'Import Absences',
  importDescription: 'Upload a CSV or Excel file with multiple absences.',
  importDownloadTemplate: 'Download template',
  importPreview: 'Preview',
  importValidRows: '{{valid}} valid of {{total}}',
  importButton: 'Import ({{count}})',
  importSuccess: '{{count}} absences imported successfully',
  importPartialSuccess: '{{created}} imported, {{failed}} failed',
  importNoValidRows: 'No valid rows found',
  importInvalidReason: 'Invalid reason: "{{value}}"',
  importInvalidDate: 'Invalid date format',
  importParseError: 'Could not read file',

  // Indefinite
  indefinite: 'Indefinite',
  indefiniteHint: 'no end date',

  // Weekly unavailability
  tabWeeklyUnavailability: 'Weekly Unavailability',
  newWeekly: 'New Weekly',
  newWeeklyTitle: 'New Weekly Unavailability',
  editWeeklyTitle: 'Edit Weekly Unavailability',
  daysOfWeek: 'Days of week',
  noteOptional: 'Note (optional)',
  notePlaceholder: 'Additional information...',
  atLeastOneDay: 'Select at least one day',
  noWeeklyAbsences: 'No weekly unavailabilities',
  noWeeklyAbsencesDescription: 'Set up recurring weekly unavailabilities.',
  deleteWeeklyTitle: 'Delete Weekly Unavailability',
  deleteWeeklyMessage: 'Are you sure you want to delete this weekly unavailability?',

  // Day abbreviations
  dayMon: 'Mon',
  dayTue: 'Tue',
  dayWed: 'Wed',
  dayThu: 'Thu',
  dayFri: 'Fri',
  daySat: 'Sat',
  daySun: 'Sun',
} as const
