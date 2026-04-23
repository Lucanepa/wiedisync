export default {
  title: 'Game Planning',
  subtitleSeason: 'Season overview {{season}}',
  seasonPicker: 'Season',

  // View options
  viewCalendar: 'Calendar',
  viewByDate: 'By date',
  viewByTeam: 'By team',

  // Filters
  filterAll: 'All',
  filterVolleyball: 'Volleyball',
  filterBasketball: 'Basketball',
  filterHome: 'Home',
  filterAway: 'Away',
  showAbsences: 'Show absences',

  // Day overflow popover (month view)
  overflow: {
    more: '+{{count}} more',
  },

  // Bulk import panel
  import: {
    title: 'Bulk import',
    hint: 'Download the template, fill in one game per row, then upload to preview. Rows with missing / unknown data will be skipped.',
    downloadTemplate: 'Download Excel template',
    importing: 'Importing…',
    importNValid: 'Import {{count}} valid game(s)',
    nSkipped: '{{count}} row(s) will be skipped',
    result: 'Imported {{created}} game(s). {{failed}} failed.',
    col: {
      team: 'Team',
      type: 'H/A',
      opponent: 'Opponent',
      date: 'Date',
      time: 'Time',
      hall: 'Hall',
      status: 'Status',
    },
  },

  // Manual game creation modal
  manualGame: {
    title: 'Add manual game',
    subtitle: 'Skips the opponent-invite flow — admin / Spielplaner sets all details.',
    team: 'Team',
    teamPlaceholder: 'Select team',
    homeAway: 'Home / Away',
    home: 'Home',
    away: 'Away',
    opponent: 'Opponent',
    opponentPlaceholder: 'e.g. Goldcoast Wadenswil 1',
    date: 'Date',
    time: 'Time',
    hall: 'Hall',
    hallPlaceholder: 'Select hall',
    awayVenue: 'Away venue',
    venueName: 'Venue name',
    venueAddress: 'Address',
    venueCity: 'City / ZIP',
    venuePlusCode: 'Plus code (optional)',
    league: 'League',
    leaguePlaceholder: 'Optional',
    round: 'Round',
    create: 'Create game',
    editTitle: 'Edit manual game',
    save: 'Save changes',
    conflict: {
      sameTeamSameDay: 'This team is already scheduled on the same day ({{time}} vs {{opponent}}).',
      hallOverlap: 'Hall is already booked at an overlapping time ({{time}}–{{endTime}}).',
      sameTeamWithinTwoDays: 'This team also plays {{date}} at {{time}} ({{daysDelta}} days apart).',
    },
  },

  // Game detail drawer
  drawer: {
    vs: 'vs',
    hall: 'Hall',
    league: 'League',
    round: 'Round',
    svrzPush: 'SVRZ push',
    notInVolleymanager: 'Not yet in Volleymanager',
    copySvrz: 'Copy SVRZ details',
    copied: 'Copied!',
    sourceSVRZ: 'Managed by SVRZ',
    sourceBasketplan: 'Managed by Basketplan',
    sourceManual: 'Manual',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirmTitle: 'Delete manual game?',
    deleteConfirmBody: 'This cannot be undone.',
    confirmDelete: 'Delete',
    cancel: 'Cancel',
    svrzReadOnlyHint: 'Official details come from SVRZ. Edit those on Volleymanager.',
  },
} as const
