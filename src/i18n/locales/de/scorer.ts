export default {
  title: 'Schreiberdienst',
  subtitle: 'Schreiber- und Schiedsrichterzuteilungen für Heimspiele.',

  // Tabs
  tabGames: 'Spiele',
  tabOverview: 'Übersicht',

  // Labels — Volleyball
  scorer: 'Schreiber',
  scoreboard: 'Täfeler',
  scorerTaefeler: 'Schreiber/Täfeler',
  confirmed: 'Bestätigt',

  // Labels — Basketball
  bbAnschreiber: 'Anschreiber/in',
  bbZeitnehmer: 'Zeitnehmer/in',
  bb24sOfficial: '24"-Offizielle/r',
  bbDutyTeam: 'Offiziellen-Team',

  // Sport toggle
  sportVolleyball: 'Volleyball',
  sportBasketball: 'Basketball',
  officialsDuties: 'Offizielle',
  dutyTeam: 'Dienst-Team',

  // Status labels
  statusConfirmed: 'Bestätigt',
  statusAssigned: 'Zugeteilt',
  statusOpen: 'Offen',

  // Filters
  filterDate: 'Datum',
  filterDutyTeam: 'Dienst-Team',
  filterDutyType: 'Dienstart',
  filterUnassigned: 'Offene Dienste',
  filterSearchAssignee: 'Person suchen',
  filterAllTeams: 'Alle Teams',
  filterAllTypes: 'Alle Arten',
  filterAllDuties: 'Alle Dienste',
  filterAnyUnassigned: 'Offene Zuteilungen',
  searchAssigneePlaceholder: 'Name eingeben...',
  clearFilters: 'Filter zurücksetzen',

  // Empty state
  noGames: 'Keine Spiele',
  noGamesDescription: 'Keine Spiele für den ausgewählten Filter gefunden.',

  // Past games
  showOlderGames: 'Ältere Spiele anzeigen ({{count}})',
  loadMore: 'Mehr laden',
  hidePast: 'Ältere ausblenden',

  // Actions
  exportICal: 'Zum Kalender hinzufügen',
  unassigned: 'Nicht zugeteilt',
  unconfirm: 'Bestätigung aufheben',

  // Self-assign
  selfAssign: 'Ich übernehme',
  confirmSelfAssignTitle: 'Einsatz bestätigen',
  confirmSelfAssignMessage: 'Möchtest du dich als {{role}} für {{game}} am {{date}} eintragen?',
  cancelAction: 'Abbrechen',
  confirmAction: 'Bestätigen',

  // Placeholders
  selectTeam: '— Team wählen —',
  selectPerson: '— Person wählen —',

  // Overview
  overviewEmpty: 'Keine Zuteilungen gefunden.',
  dutyCount: '{{count}} Einsätze',

  // Permissions
  permissionsNotice: 'Schreiberdienst kann nur von Admins und Coaches verwaltet werden.',

  // iCal export
  scorerDutyIcal: 'Schreiberdienst: {{home}} vs {{away}}',

  // Delegation
  delegate: 'Weitergeben',
  delegateTitle: 'Einsatz weitergeben',
  delegateDescription: 'Wähle ein Mitglied, dem du deinen Einsatz übergeben möchtest.',
  delegateSameTeam: 'Dein Team (sofort)',
  delegateCrossTeam: 'Andere Mitglieder (Bestätigung nötig)',
  delegateInstant: 'Sofort',
  delegateNeedsConfirm: 'Bestätigung nötig',
  delegateConfirmTitle: 'Einsatz weitergeben?',
  delegateConfirmInstant: 'Der Einsatz wird sofort an {{name}} übertragen.',
  delegateConfirmPending: '{{name}} erhält eine Anfrage und muss bestätigen.',
  delegateSuccess: 'Einsatz erfolgreich weitergegeben.',
  delegatePending: 'Anfrage gesendet. Warte auf Bestätigung.',
  delegateRequestTitle: 'Einsatz-Anfrage',
  delegateRequestMessage: '{{from}} möchte dir den {{role}}-Einsatz für {{game}} am {{date}} übergeben.',
  delegateAccept: 'Annehmen',
  delegateDecline: 'Ablehnen',
  delegateAccepted: 'Einsatz übernommen.',
  delegateDeclined: 'Anfrage abgelehnt.',
  delegateExpired: 'Abgelaufen',
  delegatePendingOutgoing: 'Anfrage ausstehend an {{name}}',
  searchMember: 'Name suchen...',
  noMembersFound: 'Keine passenden Mitglieder gefunden.',
  assignedTo: 'Zugeteilt an {{name}}',

  // Reminder toggle
  reminderEmails: 'Erinnerungs-E-Mails',
  reminderEmailsOn: 'AN — Erinnerungen werden am Vortag verschickt',
  reminderEmailsOff: 'AUS — Keine Erinnerungs-E-Mails',
} as const
