export default {
  title: 'Spielplanig',
  subtitleSeason: 'Saisonübersicht {{season}}',
  seasonPicker: 'Saison',

  // View options
  viewCalendar: 'Kaländer',
  viewByDate: 'Nach Datum',
  viewByTeam: 'Nach Team',

  // Filters
  filterAll: 'Alli',
  filterVolleyball: 'Volleyball',
  filterBasketball: 'Basketball',
  filterHome: 'Heim',
  filterAway: 'Uswärts',
  showAbsences: 'Absänze aazeige',

  // Day overflow popover (month view)
  overflow: {
    more: '+{{count}} meh',
  },

  // Game detail drawer
  drawer: {
    vs: 'gege',
    hall: 'Halle',
    league: 'Liga',
    round: 'Rundi',
    svrzPush: 'SVRZ-Übertragig',
    notInVolleymanager: 'Nonig im Volleymanager',
    copySvrz: 'SVRZ-Details kopiere',
    copied: 'Kopiert!',
    sourceSVRZ: 'Verwaltet vo SVRZ',
    sourceBasketplan: 'Verwaltet vo Basketplan',
    sourceManual: 'Manuell',
  },
} as const
