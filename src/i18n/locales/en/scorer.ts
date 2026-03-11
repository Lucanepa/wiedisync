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

  // Delegation
  delegate: 'Delegate',
  delegateTitle: 'Delegate duty',
  delegateDescription: 'Choose a member to hand off your duty to.',
  delegateSameTeam: 'Your team (instant)',
  delegateCrossTeam: 'Other members (confirmation required)',
  delegateInstant: 'Instant',
  delegateNeedsConfirm: 'Needs confirmation',
  delegateConfirmTitle: 'Delegate duty?',
  delegateConfirmInstant: 'The duty will be transferred to {{name}} immediately.',
  delegateConfirmPending: '{{name}} will receive a request and must confirm.',
  delegateSuccess: 'Duty delegated successfully.',
  delegatePending: 'Request sent. Waiting for confirmation.',
  delegateRequestTitle: 'Duty request',
  delegateRequestMessage: '{{from}} wants to delegate the {{role}} duty for {{game}} on {{date}} to you.',
  delegateAccept: 'Accept',
  delegateDecline: 'Decline',
  delegateAccepted: 'Duty accepted.',
  delegateDeclined: 'Request declined.',
  delegateExpired: 'Expired',
  delegatePendingOutgoing: 'Request pending for {{name}}',
  searchMember: 'Search name...',
  noMembersFound: 'No matching members found.',
  assignedTo: 'Assigned to {{name}}',

  // Reminder toggle
  reminderEmails: 'Reminder emails',
  reminderEmailsOn: 'ON — Reminders will be sent the day before games',
  reminderEmailsOff: 'OFF — No reminder emails will be sent',
} as const
