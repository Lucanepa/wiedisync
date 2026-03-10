export default {
  title: 'Teams & Mitglieder',
  subtitleSeason: 'Saison {{season}}',

  // Positions
  positionSetter: 'Passeuse/Passeur',
  positionOutside: 'Aussenangreifer/in',
  positionMiddle: 'Mittelblocker/in',
  positionOpposite: 'Diagonal',
  positionLibero: 'Libero',
  positionPointGuard: 'Point Guard',
  positionShootingGuard: 'Shooting Guard',
  positionSmallForward: 'Small Forward',
  positionPowerForward: 'Power Forward',
  positionCenter: 'Center',
  positionCoach: 'Trainer/in',
  positionOther: 'Andere',

  // Roles
  rolePlayer: 'Spieler/in',
  roleCaptain: 'Captain',
  roleCoach: 'Trainer/in',

  roleTeamResponsible: 'Teamverantwortliche/r',

  // Table headers
  playerCol: 'Spieler',
  numberCol: '#',
  positionCol: 'Position',
  emailCol: 'E-Mail',
  phoneCol: 'Telefon',
  birthdateCol: 'Geburtstag',
  roleCol: 'Rolle',

  // Roster editor
  teamLeadership: 'Teamführung',
  editTeam: 'Team bearbeiten',
  adjustCrop: 'Bildausschnitt anpassen',
  editRoster: 'Kader bearbeiten',
  addPlayer: 'Spieler hinzufügen',
  searchPlaceholder: 'Nach Name suchen...',
  noSearchResults: 'Keine Ergebnisse',
  currentRoster: 'Aktuelles Kader ({{count}})',
  removeConfirmTitle: 'Spieler entfernen',
  removeConfirmMessage: '{{name}} aus dem Kader entfernen?',

  // Team picture
  teamPicture: 'Teambild',
  uploadPicture: 'Bild hochladen',
  removePicture: 'Bild entfernen',
  pictureHint: 'JPG oder PNG, max. 10 MB',
  pictureTooLarge: 'Datei ist zu gross (max. 10 MB)',

  // Team detail
  sponsors: 'Sponsoren',
  age: '{{years}} Jahre',

  // Empty state
  noTeams: 'Keine Teams',
  noTeamsDescription: 'Keine Teams gefunden.',
  noTeamMembership: 'Kein Team zugewiesen',
  noTeamMembershipDescription: 'Du bist aktuell keinem Team zugeordnet.',
  noMembers: 'Keine Mitglieder',
  noMembersDescription: 'Dieses Team hat noch keine Mitglieder.',

  // Licences
  licenceScorer: 'Schreiber-Lizenz',
  licenceReferee: 'Schiedsrichter-Lizenz',
  licenceOTR1: 'OTR1-Lizenz',
  licenceOTR2: 'OTR2-Lizenz',
  licenceOTN: 'OTN-Lizenz',
  licenceRefereeBB: 'Schiedsrichter-Lizenz (Basketball)',

  // Guest
  guestBadge: 'Gast',
  toggleGuest: 'Gast-Status umschalten',
  guestExplanation: 'Gäste haben bei vollen Trainings eine niedrigere Priorität als lizenzierte Spieler.',

  // Pending requests
  pendingRequests: '{{count}} ausstehende Beitrittsanfrage(n)',
  approve: 'Annehmen',
  reject: 'Ablehnen',
} as const
