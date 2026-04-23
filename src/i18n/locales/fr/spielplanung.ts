export default {
  title: 'Planning des matchs',
  subtitleSeason: 'Apercu de la saison {{season}}',

  // View options
  viewCalendar: 'Calendrier',
  viewByDate: 'Par date',
  viewByTeam: 'Par equipe',

  // Filters
  filterAll: 'Tout',
  filterVolleyball: 'Volleyball',
  filterBasketball: 'Basketball',
  filterHome: 'Domicile',
  filterAway: 'Exterieur',
  showAbsences: 'Afficher les absences',

  // Day overflow popover (month view)
  overflow: {
    more: '+{{count}} autres',
  },

  // Game detail drawer
  drawer: {
    vs: 'vs',
    hall: 'Salle',
    league: 'Ligue',
    round: 'Tour',
    svrzPush: 'Envoi SVRZ',
    notInVolleymanager: 'Pas encore dans Volleymanager',
    copySvrz: 'Copier les details SVRZ',
    copied: 'Copie !',
    sourceSVRZ: 'Gere par SVRZ',
    sourceBasketplan: 'Gere par Basketplan',
    sourceManual: 'Manuel',
  },
} as const
