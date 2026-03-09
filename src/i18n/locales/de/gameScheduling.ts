export default {
  // Nav & page titles
  title: 'Terminplanung',
  adminTitle: 'Terminplanung (Admin)',
  setupTitle: 'Saison einrichten',
  dashboardTitle: 'Übersicht',

  // Season config
  season: 'Saison',
  seasonStatus: 'Status',
  statusSetup: 'Einrichtung',
  statusOpen: 'Offen',
  statusClosed: 'Geschlossen',
  createSeason: 'Neue Saison erstellen',
  openForBooking: 'Für Buchungen öffnen',
  closeBooking: 'Buchungen schliessen',

  // Spielsamstage
  spielsamstage: 'Spielsamstage',
  addSpielssamstag: 'Spielsamstag hinzufügen',
  removeSpielssamstag: 'Entfernen',
  timeSlot: 'Zeitfenster',
  hall: 'Halle',

  // Slot generation
  generateSlots: 'Spieltermine generieren',
  generatingSlots: 'Generiere Spieltermine...',
  slotsGenerated: '{{count}} Spieltermine generiert',
  slotSource: 'Quelle',
  sourceHallSlot: 'Hallenplan',
  sourceSpielsamstag: 'Spielsamstag',
  sourceSpielHalle: 'Spielhalle',
  sourceManual: 'Manuell',
  teamSlotConfig: 'Team-Konfiguration',
  latestSlot: 'Abendbetrieb (spätester Slot)',
  spielsamstagMode: 'Spielsamstag-Modus',

  // Slot status
  available: 'Verfügbar',
  booked: 'Gebucht',
  blocked: 'Gesperrt',

  // Admin dashboard
  allTeams: 'Alle Teams',
  homeBookings: 'Heimspiele',
  awayProposals: 'Auswärtsvorschläge',
  noBookingsYet: 'Noch keine Buchungen',
  confirmProposal: 'Vorschlag bestätigen',
  rejectProposal: 'Ablehnen',
  proposal: 'Vorschlag',
  proposalNumber: 'Vorschlag {{number}}',
  confirmed: 'Bestätigt',
  pending: 'Ausstehend',
  rejected: 'Abgelehnt',
  opponent: 'Gegner',
  contactEmail: 'Kontakt-E-Mail',
  adminNotes: 'Admin-Notizen',
  override: 'Überschreiben',
  sendSummary: 'Zusammenfassung senden',

  // Excel
  excelImport: 'Excel-Import',
  excelExport: 'Excel-Export',
  importGames: 'Spiele importieren',
  exportSchedule: 'Spielplan exportieren',
  uploadFile: 'Datei hochladen',
  preview: 'Vorschau',
  importSuccess: '{{count}} Spiele importiert',
  downloadExcel: 'Excel herunterladen',

  // Public opponent flow
  publicTitle: 'Spieltermine KSCW',
  publicSubtitle: 'Vereinbare die Spieltermine mit dem KSCW',
  selectGender: 'Geschlecht',
  genderMen: 'Herren',
  genderWomen: 'Damen',
  selectLeague: 'Liga',
  matchingTeam: 'Dein Gegner',
  clubName: 'Vereinsname',
  contactName: 'Kontaktperson',
  contactEmailLabel: 'E-Mail',
  register: 'Weiter',
  registering: 'Wird registriert...',

  // Opponent flow - home game
  homeGameTitle: 'Heimspiel KSCW',
  homeGameDesc: 'Wähle einen Termin für das Spiel in unserer Halle',
  pickSlot: 'Termin wählen',
  confirmSlot: 'Termin bestätigen',
  slotBooked: 'Termin gebucht!',
  noSlotsAvailable: 'Keine Termine verfügbar',

  // Opponent flow - away game
  awayGameTitle: 'Auswärtsspiel',
  awayGameDesc: 'Schlage 3 Termine für das Spiel in eurer Halle vor',
  proposalDate: 'Datum & Zeit',
  proposalPlace: 'Halle / Adresse',
  submitProposals: 'Vorschläge einreichen',
  submitting: 'Wird eingereicht...',
  proposalsSubmitted: 'Vorschläge eingereicht!',
  awaitingConfirmation: 'Wartet auf Bestätigung',

  // Confirmation
  confirmationTitle: 'Vielen Dank!',
  confirmationMessage: 'Du erhältst eine E-Mail-Bestätigung.',
  bookingStatus: 'Buchungsstatus',

  // Errors & validation
  slotUnavailable: 'Dieser Termin ist leider nicht mehr verfügbar.',
  conflictSameDay: 'Am selben Tag findet bereits ein Spiel statt.',
  conflictGapRule: 'Zu nah an einem anderen Spiel (mind. 1 Tag Abstand).',
  conflictClosure: 'Die Halle ist an diesem Datum geschlossen.',
  conflictDoubleBooking: 'Dieser Termin ist bereits belegt.',
  conflictCrossTeam: 'Spieler aus {{teams}} haben an diesem Datum ein anderes Spiel.',
  invalidEmail: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  required: 'Dieses Feld ist erforderlich.',
  turnstileError: 'Bitte bestätige, dass du kein Roboter bist.',
  seasonNotOpen: 'Die Terminplanung ist derzeit nicht geöffnet.',

  // Email
  emailBookingConfirmSubject: 'Spieltermin bestätigt – KSCW',
  emailNewBookingSubject: 'Neue Terminbuchung – {{opponent}}',
}
