export default {
  title: 'Entrainements',
  subtitle: 'Apercu des entrainements avec suivi des presences',

  // Tabs
  tabTrainings: 'Entrainements',
  tabCoachDashboard: 'Tableau de bord entraineur',

  // Training card
  attendance: 'Presence',
  cancelled: 'Annule',

  // Attendance sheet
  attendanceTitle: 'Presence — {{date}}',
  attendanceTitleShort: 'Presence',
  noPlayers: 'Aucun joueur',
  noPlayersAssigned: 'Aucun joueur n\'a encore ete attribue a cette equipe.',

  // Coach dashboard
  seasonLabel: 'Saison',
  noDataAvailable: 'Aucune donnee disponible',
  noDataDescription: 'Aucune donnee de presence a afficher.',

  // Table headers
  playerCol: 'Joueur',
  numberCol: '#',
  trainingsCol: 'Entrainements',
  presentCol: 'Present',
  absentCol: 'Absent',
  rateCol: 'Taux',
  trendCol: 'Tendance',

  // Empty states
  noTrainings: 'Aucun entrainement',
  noTrainingsDescription: 'Aucun entrainement trouve pour les filtres selectionnes.',

  // CRUD
  newTraining: 'Nouvel entrainement',
  newSingleTraining: 'Entrainement unique',
  newRecurringTraining: 'Entrainements recurrents',
  editTraining: 'Modifier l\'entrainement',
  deleteTraining: 'Supprimer l\'entrainement',
  deleteConfirm: 'Voulez-vous vraiment supprimer cet entrainement ?',
  cancelTraining: 'Annuler l\'entrainement',
  trainingCancelled: 'Entrainement annule',
  cancelReason: 'Motif d\'annulation',

  // Recurring
  recurringTitle: 'Generer des entrainements recurrents',
  selectSlot: 'Selectionner un creneau de salle',
  dateRange: 'Periode',
  generatePreview: 'Apercu des dates',
  generate: 'Generer',
  trainingsGenerated: '{{count}} entrainements generes',
  trainingsSkipped: '{{count}} ignore(s) (existaient deja)',
  respondBy: 'Repondre avant le',
  respondByHint: 'Rappel 1 jour avant',
  respondByHours: 'heures',
  respondByDays: 'jours',
  respondByWeeks: 'semaines',
  respondByMonths: 'mois',
  respondByBefore: 'avant',
  participation: 'Participation',
  minParticipants: 'Min. participants',
  maxParticipants: 'Max. participants',
  untilSeasonEnd: 'Indefiniment',
  slotFrom: 'du',
  slotUntil: 'au',

  // Recurring edit
  editRecurringTitle: 'Modifier l\'entrainement recurrent',
  editRecurringDescription: 'Cet entrainement fait partie d\'une serie recurrente. Que souhaitez-vous modifier ?',
  editThisOnly: 'Cet entrainement uniquement',
  editSameDay: 'Tous les entrainements du meme jour de la semaine',
  editAllRecurring: 'Tous les entrainements recurrents',
  cancelEdit: 'Annuler',

  // Slot mode
  slotDetected: 'Creneau de salle detecte',
  claimedSlot: 'Creneau reclame',
  regularSlot: 'Creneau regulier',
  noSlotForDay: 'Aucun creneau de salle pour ce jour',
  useSlot: 'Utiliser le creneau de salle',
  enterManually: 'Saisir manuellement',
} as const
