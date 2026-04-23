export default {
  title: 'Spielplanung',
  subtitleSeason: 'Saisonübersicht {{season}}',
  seasonPicker: 'Saison',

  // View options
  viewCalendar: 'Kalender',
  viewByDate: 'Nach Datum',
  viewByTeam: 'Nach Team',

  // Filters
  filterAll: 'Alle',
  filterVolleyball: 'Volleyball',
  filterBasketball: 'Basketball',
  filterHome: 'Heim',
  filterAway: 'Auswärts',
  showAbsences: 'Absenzen anzeigen',

  // Day overflow popover (month view)
  overflow: {
    more: '+{{count}} weitere',
  },

  // Game detail drawer
  drawer: {
    vs: 'vs.',
    hall: 'Halle',
    league: 'Liga',
    round: 'Runde',
    svrzPush: 'SVRZ-Übertragung',
    notInVolleymanager: 'Noch nicht im Volleymanager',
    copySvrz: 'SVRZ-Details kopieren',
    copied: 'Kopiert!',
    sourceSVRZ: 'Verwaltet via SVRZ',
    sourceBasketplan: 'Verwaltet via Basketplan',
    sourceManual: 'Manuell',
  },
} as const
