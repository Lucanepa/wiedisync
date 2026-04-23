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

  // Manual game creation modal
  manualGame: {
    title: 'Manuelles Spiel erfassen',
    subtitle: 'Überspringt den Einlade-Flow — Admin / Spielplaner setzt alle Details selbst.',
    team: 'Team',
    teamPlaceholder: 'Team auswählen',
    homeAway: 'Heim / Auswärts',
    home: 'Heim',
    away: 'Auswärts',
    opponent: 'Gegner',
    opponentPlaceholder: 'z.B. Goldcoast Wädenswil 1',
    date: 'Datum',
    time: 'Zeit',
    hall: 'Halle',
    hallPlaceholder: 'Halle auswählen',
    awayVenue: 'Auswärts-Spielort',
    venueName: 'Name der Halle',
    venueAddress: 'Adresse',
    venueCity: 'PLZ / Ort',
    venuePlusCode: 'Plus-Code (optional)',
    league: 'Liga',
    leaguePlaceholder: 'Optional',
    round: 'Runde',
    create: 'Spiel erstellen',
    editTitle: 'Manuelles Spiel bearbeiten',
    save: 'Änderungen speichern',
    conflict: {
      sameTeamSameDay: 'Dieses Team spielt bereits am gleichen Tag ({{time}} gegen {{opponent}}).',
      hallOverlap: 'Die Halle ist zu einer überlappenden Zeit bereits belegt ({{time}}–{{endTime}}).',
      sameTeamWithinTwoDays: 'Dieses Team spielt auch am {{date}} um {{time}} ({{daysDelta}} Tage Abstand).',
    },
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
    edit: 'Bearbeiten',
    delete: 'Löschen',
    deleteConfirmTitle: 'Manuelles Spiel löschen?',
    deleteConfirmBody: 'Dies kann nicht rückgängig gemacht werden.',
    confirmDelete: 'Löschen',
    cancel: 'Abbrechen',
    svrzReadOnlyHint: 'Offizielle Details stammen aus SVRZ. Änderungen bitte im Volleymanager vornehmen.',
  },
} as const
