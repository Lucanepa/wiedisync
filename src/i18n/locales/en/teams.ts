export default {
  title: 'Teams & Members',
  subtitleSeason: 'Season {{season}}',

  // Positions
  positionSetter: 'Setter',
  positionOutside: 'Outside hitter',
  positionMiddle: 'Middle blocker',
  positionOpposite: 'Opposite',
  positionLibero: 'Libero',
  positionPointGuard: 'Point guard',
  positionShootingGuard: 'Shooting guard',
  positionSmallForward: 'Small forward',
  positionPowerForward: 'Power forward',
  positionCenter: 'Center',
  positionCoach: 'Coach',
  positionGuest: 'Guest',
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
  errorUploadingPicture: 'Error uploading picture',

  // Player profile
  statistics: 'Statistics',
  trainingsAttended: 'Trainings',
  gamesAttended: 'Games',
  trainingRate: 'Training rate',
  activeAbsences: 'Absences',
  currentAbsences: 'Current absences',

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

  // Guest levels
  guestBadge: 'G',
  guestLevel0: 'Not a guest',
  guestLevel1: 'Guest Level 1',
  guestLevel2: 'Guest Level 2',
  guestLevel3: 'Guest Level 3',
  guestLevelTooltip: 'Guest Level {{level}} — lower priority when trainings are full',
  guestExplanation: 'Guest levels 1-3 determine priority when trainings are full. Level 1 has highest guest priority, level 3 lowest.',

  // Pending requests
  pendingRequests: '{{count}} pending request(s)',
  approve: 'Approve',
  reject: 'Reject',

  // QR invite / external user
  inviteExternalUser: 'Add External User',
  inviteExternalUserDesc: 'Generate a QR code for someone to join {{teamName}}',
  joinAs: 'Join as:',
  player: 'Player',
  guest: 'Guest',
  generateQR: 'Generate QR Code',
  inviteLinkExpiry: 'Link expires in 24 hours · Single use',
  copyLink: 'Copy Link',
  addExternalUser: 'Add External User',
  shellAccount: 'Temporary',
  expiresIn: 'expires in {{days}}d',
  extend: 'Extend',
} as const
