export default {
  // Database admin
  database: 'Database',
  openInNewTab: 'Apri in una nuova scheda',
  tab_sql: 'Editor SQL',
  tab_tables: 'Tabelle',
  tab_pbadmin: 'PB Admin',

  // SQL Editor
  sqlPlaceholder: 'Inserisci query SQL... (Ctrl+Invio per eseguire)',
  execute: 'Esegui',
  clear: 'Cancella',
  history: 'Cronologia',
  queryError: 'Errore nella query',
  rowsReturned: '{{count}} riga/e',
  dangerousQueryTitle: 'Conferma query distruttiva',
  dangerousQueryMessage: 'Questa query modificherà i dati. Sei sicuro di volerla eseguire?',
  resultsSummary: '{{rows}} righe · {{cols}} colonne',
  copyResults: 'Copia',
  copiedResults: 'Copiato!',
  exportCSV: 'CSV',
  exportJSON: 'JSON',
  exportExcel: 'Excel',
  exportText: 'Testo',

  // Table Browser
  selectTable: 'Seleziona una tabella...',
  collections: 'Collezioni',
  noRecords: 'Nessun record trovato.',
  filterPlaceholder: 'Sintassi filtro Directus...',
  filter: 'Filtro',
  newRecord: 'Nuovo record',
  noResults: 'Nessun risultato.',

  // Schema Viewer
  columnName: 'Colonna',
  type: 'Tipo',
  required: 'Obbligatorio',
  options: 'Opzioni',
  schema: 'Schema',

  // Record Editor
  editRecord: 'Modifica record',
  createRecord: 'Nuovo record',
  deleteRecord: 'Elimina record',
  deleteRecordMessage: 'Questo record verrà eliminato definitivamente.',
  save: 'Salva',
  cancel: 'Annulla',

  // Referee expenses
  refereeExpensesTitle: 'Spese arbitrali',
  refereeExpensesDescription: 'Tutte le spese arbitrali registrate per squadra e stagione.',
  refereeExpensesNoRecords: 'Nessuna spesa arbitrale registrata.',
  refereeExpensesGame: 'Partita',
  refereeExpensesDate: 'Data',
  refereeExpensesPaidBy: 'Pagato da',
  refereeExpensesTeam: 'Squadra',
  refereeExpensesAmount: 'Importo',
  refereeExpensesNotes: 'Note',
  refereeExpensesExport: 'Export CSV',
  refereeExpensesAllTeams: 'Tutte le squadre',
  refereeExpensesAllSeasons: 'Tutte le stagioni',
} as const
