export default {
  title: 'Equipes et membres',
  subtitleSeason: 'Saison {{season}}',

  // Positions
  positionSetter: 'Passeur',
  positionOutside: 'Attaquant reception',
  positionMiddle: 'Central',
  positionOpposite: 'Oppose',
  positionLibero: 'Libero',
  positionPointGuard: 'Meneur',
  positionShootingGuard: 'Arriere',
  positionSmallForward: 'Ailier',
  positionPowerForward: 'Ailier fort',
  positionCenter: 'Pivot',
  positionCoach: 'Entraineur',
  positionGuest: 'Invite',
  positionOther: 'Autre',

  // Roles
  rolePlayer: 'Joueur',
  roleCaptain: 'Capitaine',
  roleCoach: 'Entraineur',

  roleTeamResponsible: 'Responsable d\'equipe',

  // Table headers
  playerCol: 'Joueur',
  numberCol: '#',
  positionCol: 'Poste',
  emailCol: 'Email',
  phoneCol: 'Telephone',
  birthdateCol: 'Date de naissance',
  roleCol: 'Role',

  // Roster editor
  teamLeadership: 'Direction de l\'equipe',
  editTeam: 'Modifier l\'equipe',
  adjustCrop: 'Ajuster le cadrage',
  editRoster: 'Modifier l\'effectif',
  addPlayer: 'Ajouter un joueur',
  searchPlaceholder: 'Rechercher par nom...',
  noSearchResults: 'Aucun resultat',
  currentRoster: 'Effectif actuel ({{count}})',
  removeConfirmTitle: 'Retirer le joueur',
  removeConfirmMessage: 'Retirer {{name}} de l\'effectif ?',

  // Team picture
  teamPicture: 'Photo d\'equipe',
  uploadPicture: 'Telecharger une photo',
  removePicture: 'Supprimer la photo',
  pictureHint: 'JPG ou PNG, max 10 Mo',
  pictureTooLarge: 'Le fichier est trop volumineux (max 10 Mo)',
  errorUploadingPicture: 'Erreur lors du téléchargement de l\'image',

  // Player profile
  statistics: 'Statistiques',
  trainingsAttended: 'Entrainements',
  gamesAttended: 'Matchs',
  trainingRate: 'Taux de presence',
  activeAbsences: 'Absences',
  currentAbsences: 'Absences en cours',

  // Team detail
  sponsors: 'Sponsors',
  age: '{{years}} ans',

  // Empty state
  noTeams: 'Aucune equipe',
  noTeamsDescription: 'Aucune equipe trouvee.',
  noTeamMembership: 'Aucune equipe attribuee',
  noTeamMembershipDescription: 'Vous n\'etes actuellement attribue a aucune equipe.',
  noMembers: 'Aucun membre',
  noMembersDescription: 'Cette equipe n\'a pas encore de membres.',

  // Licences
  licenceScorer: 'Licence de marqueur',
  licenceReferee: 'Licence d\'arbitre',
  licenceOTR1: 'Licence OTR1',
  licenceOTR2: 'Licence OTR2',
  licenceOTN: 'Licence OTN',
  licenceRefereeBB: 'Licence d\'arbitre (Basketball)',

  // Guest levels
  guestBadge: 'I',
  guestLevel0: 'Pas un invite',
  guestLevel1: 'Invite niveau 1',
  guestLevel2: 'Invite niveau 2',
  guestLevel3: 'Invite niveau 3',
  guestLevelTooltip: 'Invite niveau {{level}} — priorite inferieure lorsque les entrainements sont complets',
  guestExplanation: 'Les niveaux d\'invite 1 a 3 determinent la priorite lorsque les entrainements sont complets. Le niveau 1 a la priorite d\'invite la plus elevee, le niveau 3 la plus basse.',

  // Pending requests
  pendingRequests: '{{count}} demande(s) en attente',
  approve: 'Approuver',
  reject: 'Rejeter',
} as const
