export default {
  title: 'Absences',
  subtitle: 'Gestion centralisee des absences',

  // Tabs
  tabMyAbsences: 'Mes absences',
  tabTeamAbsences: 'Absences de l\'equipe',

  // Actions
  newAbsence: 'Nouvelle absence',

  // Form
  member: 'Membre',
  startDate: 'Du',
  endDate: 'Au',
  reason: 'Motif',
  detailsOptional: 'Details (optionnel)',
  detailsPlaceholder: 'Informations supplementaires...',
  affects: 'Concerne',

  // Reason options
  reasonInjury: 'Blessure',
  reasonVacation: 'Vacances',
  reasonWork: 'Travail',
  reasonPersonal: 'Personnel',
  reasonOther: 'Autre',

  // Affects options
  affectsTrainings: 'Entrainements',
  affectsGames: 'Matchs',
  affectsAll: 'Tout',

  // Validation
  startDateRequired: 'La date de debut est requise',
  endDateRequired: 'La date de fin est requise',
  endAfterStart: 'La date de fin doit etre posterieure a la date de debut',
  reasonRequired: 'Veuillez selectionner un motif',
  memberRequired: 'Veuillez selectionner un membre',
  errorSaving: 'Erreur lors de l\'enregistrement de l\'absence',

  // Modal titles
  newAbsenceTitle: 'Nouvelle absence',
  editAbsenceTitle: 'Modifier l\'absence',

  // Delete dialog
  deleteTitle: 'Supprimer l\'absence',
  deleteMessage: 'Voulez-vous vraiment supprimer cette absence ?',

  // Empty states
  noAbsences: 'Aucune absence',
  noAbsencesDescription: 'Aucune absence trouvee.',
  noTeamAbsences: 'Aucune absence',
  noTeamAbsencesDescription: 'Aucune absence signalee pour cette periode.',

  // Team absence view
  fromTo: 'Du',
  until: 'Au',
} as const
