export default {
  title: 'Teams & Members',
  subtitleSeason: 'Season {{season}}',

  // Positions
  positionSetter: 'Setter',
  positionOutside: 'Outside hitter',
  positionMiddle: 'Middle blocker',
  positionOpposite: 'Opposite',
  positionLibero: 'Libero',
  positionCoach: 'Coach',
  positionOther: 'Other',

  // Roles
  rolePlayer: 'Player',
  roleCaptain: 'Captain',
  roleCoach: 'Coach',

  roleTeamResponsible: 'Team Responsible',

  // Table headers
  playerCol: 'Player',
  numberCol: '#',
  positionCol: 'Position',
  emailCol: 'Email',
  phoneCol: 'Phone',
  birthdateCol: 'Birthdate',
  roleCol: 'Role',

  // Roster editor
  teamLeadership: 'Team Leadership',
  editTeam: 'Edit team',
  adjustCrop: 'Adjust crop',
  editRoster: 'Edit roster',
  addPlayer: 'Add player',
  searchPlaceholder: 'Search by name...',
  noSearchResults: 'No results',
  currentRoster: 'Current roster ({{count}})',
  removeConfirmTitle: 'Remove player',
  removeConfirmMessage: 'Remove {{name}} from the roster?',

  // Team picture
  teamPicture: 'Team picture',
  uploadPicture: 'Upload picture',
  removePicture: 'Remove picture',
  pictureHint: 'JPG or PNG, max 10 MB',
  pictureTooLarge: 'File is too large (max 10 MB)',

  // Team detail
  sponsors: 'Sponsors',
  age: '{{years}} years',

  // Empty state
  noTeams: 'No teams',
  noTeamsDescription: 'No teams found.',
  noTeamMembership: 'No team assigned',
  noTeamMembershipDescription: 'You are not currently assigned to any team.',
  noMembers: 'No members',
  noMembersDescription: 'This team has no members yet.',

  // Licences
  licenceScorer: 'Scorer licence',
  licenceReferee: 'Referee licence',
  licenceOTR1: 'OTR1 licence',
  licenceOTR2: 'OTR2 licence',
  licenceOTN: 'OTN licence',
  licenceRefereeBB: 'Referee licence (Basketball)',

  // Guest
  guestBadge: 'Guest',
  toggleGuest: 'Toggle guest status',
  guestExplanation: 'Guests have lower priority than licenced players when trainings are full.',

  // Pending requests
  pendingRequests: '{{count}} pending request(s)',
  approve: 'Approve',
  reject: 'Reject',
} as const
