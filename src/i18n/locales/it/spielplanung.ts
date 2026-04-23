export default {
  title: 'Pianificazione partite',
  subtitleSeason: 'Panoramica stagione {{season}}',

  // View options
  viewCalendar: 'Calendario',
  viewByDate: 'Per data',
  viewByTeam: 'Per squadra',

  // Filters
  filterAll: 'Tutti',
  filterVolleyball: 'Pallavolo',
  filterBasketball: 'Pallacanestro',
  filterHome: 'Casa',
  filterAway: 'Trasferta',
  showAbsences: 'Mostra assenze',

  // Day overflow popover (month view)
  overflow: {
    more: '+{{count}} altre',
  },

  // Game detail drawer
  drawer: {
    vs: 'vs',
    hall: 'Palestra',
    league: 'Lega',
    round: 'Turno',
    svrzPush: 'Invio a SVRZ',
    notInVolleymanager: 'Non ancora in Volleymanager',
    copySvrz: 'Copia dettagli SVRZ',
    copied: 'Copiato!',
    sourceSVRZ: 'Gestito da SVRZ',
    sourceBasketplan: 'Gestito da Basketplan',
    sourceManual: 'Manuale',
  },
} as const
