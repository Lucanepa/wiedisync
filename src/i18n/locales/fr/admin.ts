export default {
  // Database admin
  database: 'Base de donnees',
  openInNewTab: 'Ouvrir dans un nouvel onglet',
  tab_sql: 'Editeur SQL',
  tab_tables: 'Tables',
  tab_pbadmin: 'PB Admin',

  // SQL Editor
  sqlPlaceholder: 'Saisir une requete SQL... (Ctrl+Entree pour executer)',
  execute: 'Executer',
  clear: 'Effacer',
  history: 'Historique',
  queryError: 'Erreur de requete',
  rowsReturned: '{{count}} ligne(s)',
  dangerousQueryTitle: 'Confirmer la requete destructive',
  dangerousQueryMessage: 'Cette requete va modifier des donnees. Voulez-vous vraiment l\'executer ?',
  resultsSummary: '{{rows}} lignes · {{cols}} colonnes',
  copyResults: 'Copier',
  copiedResults: 'Copie !',
  exportCSV: 'CSV',
  exportJSON: 'JSON',
  exportExcel: 'Excel',
  exportText: 'Texte',

  // Table Browser
  selectTable: 'Selectionner une table...',
  collections: 'Collections',
  noRecords: 'Aucun enregistrement trouve.',
  filterPlaceholder: 'Syntaxe de filtre PocketBase...',
  filter: 'Filtrer',
  newRecord: 'Nouvel enregistrement',
  noResults: 'Aucun resultat.',

  // Schema Viewer
  columnName: 'Colonne',
  type: 'Type',
  required: 'Requis',
  options: 'Options',
  schema: 'Schema',

  // Record Editor
  editRecord: 'Modifier l\'enregistrement',
  createRecord: 'Nouvel enregistrement',
  deleteRecord: 'Supprimer l\'enregistrement',
  deleteRecordMessage: 'Cet enregistrement sera definitivement supprime.',
  save: 'Enregistrer',
  cancel: 'Annuler',

  // Referee expenses
  refereeExpensesTitle: 'Frais d\'arbitrage',
  refereeExpensesDescription: 'Tous les frais d\'arbitrage enregistrés par équipe et saison.',
  refereeExpensesNoRecords: 'Aucun frais d\'arbitrage enregistré.',
  refereeExpensesGame: 'Match',
  refereeExpensesDate: 'Date',
  refereeExpensesPaidBy: 'Payé par',
  refereeExpensesTeam: 'Équipe',
  refereeExpensesAmount: 'Montant',
  refereeExpensesNotes: 'Remarques',
  refereeExpensesExport: 'Export CSV',
  refereeExpensesAllTeams: 'Toutes les équipes',
  refereeExpensesAllSeasons: 'Toutes les saisons',
} as const
