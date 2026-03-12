export default {
  // Login
  signIn: 'Anmelden',
  email: 'E-Mail',
  password: 'Passwort',
  emailPlaceholder: 'name@beispiel.ch',
  passwordPlaceholder: 'Passwort eingeben',
  signingIn: 'Anmelden...',
  invalidCredentials: 'Ungültige E-Mail oder Passwort',
  rememberMe: 'Angemeldet bleiben',
  orContinueWith: 'oder weiter mit',
  signInWithGoogle: 'Mit Google anmelden',
  oauthError: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',

  // Profile
  editProfile: 'Profil bearbeiten',
  contact: 'Kontakt',
  phone: 'Telefon',
  licenseNr: 'Lizenz Nr.',
  licences: 'Lizenzen',
  upcomingActivities: 'Nächste Aktivitäten',
  activeAbsences: 'Aktive Absenzen',
  showAll: 'Alle anzeigen',
  noUpcomingActivities: 'Keine Aktivitäten in den nächsten 4 Wochen.',
  noActiveAbsences: 'Keine aktiven Absenzen.',
  teams: 'Teams',
  roles: 'Rollen',

  contactPrivacyNotice: 'Deine E-Mail und Telefonnummer sind nur für den Trainer und Teamverantwortlichen der Teams sichtbar, bei denen du einen offiziellen Dienst hast (z.B. Schreiber).',

  // Profile Edit
  firstName: 'Vorname',
  lastName: 'Nachname',
  changePhoto: 'Foto ändern',
  managedByCoach: 'Wird von Trainer/Admin verwaltet',
  position: 'Position',
  number: 'Nummer',
  changePassword: 'Passwort ändern',
  sendResetLink: 'Link senden',
  numberTaken: 'Diese Nummer wird bereits von {{name}} verwendet',
  errorSaving: 'Fehler beim Speichern',
  fileTooLarge: 'Datei ist zu gross (max. 5 MB)',
  invalidImageType: 'Ungültiger Dateityp. Erlaubt: JPEG, PNG, WebP, GIF',

  // Training label
  training: 'Training',

  // Sign Up
  signUp: 'Registrieren',
  createAccount: 'Konto erstellen',
  confirmPassword: 'Passwort bestätigen',
  passwordMismatch: 'Passwörter stimmen nicht überein',
  registrationFailed: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.',
  creatingAccount: 'Konto wird erstellt...',
  continue: 'Weiter',
  checkingEmail: 'E-Mail wird geprüft...',
  alreadyHaveAccount: 'Bereits ein Konto?',
  change: 'Ändern',

  // Account claim
  accountExists: 'Konto gefunden',
  accountExistsDescription: 'Ein Konto mit dieser E-Mail existiert bereits. Wir haben dir einen Link zum Zurücksetzen des Passworts gesendet.',
  resetLinkSent: 'Link gesendet! Prüfe dein E-Mail-Postfach.',
  tryDifferentEmail: 'Andere E-Mail verwenden',

  // Team selection
  selectTeam: 'Team wählen',
  selectTeamPlaceholder: 'Team auswählen...',
  teamRequired: 'Bitte wähle ein Team.',

  // Pending page
  pendingApproval: 'Freigabe ausstehend',
  pendingDescription: 'Dein Konto wartet auf Freigabe durch den Trainer oder Admin deines Teams.',
  requestedTeam: 'Angefragtes Team',
  refreshStatus: 'Status aktualisieren',
  checking: 'Prüfe...',
  logout: 'Abmelden',

  // Onboarding
  onboardingTitle: 'Willkommen beim KSC Wiedikon',
  onboardingSubtitle: 'Bitte vervollständige dein Profil, um fortzufahren.',
  clubdeskNotice: 'Deine Daten wurden aus Clubdesk importiert. Bitte überprüfe sie und bestätige.',
  language: 'Sprache',
  languageGerman: 'Deutsch',
  languageEnglish: 'English',
  completeProfile: 'Profil bestätigen',
  birthdate: 'Geburtsdatum',

  // Privacy
  privacySection: 'Datenschutz',
  hidePhone: 'Telefonnummer verbergen',
  hidePhoneHint: 'Deine Telefonnummer wird für andere Mitglieder nicht angezeigt.',
  birthdateVisibility: 'Geburtsdatum-Sichtbarkeit',
  birthdateVisibilityFull: 'Vollständig anzeigen',
  birthdateVisibilityYearOnly: 'Nur Jahrgang',
  birthdateVisibilityHidden: 'Verbergen',
  hidden: 'Verborgen',
  yearOnly: 'Nur Jahrgang',

  // Guest registration
  isGuest: 'Ich bin Gast-Spieler/in',
  guestExplanation: 'Gäste haben bei vollen Trainings eine niedrigere Priorität als lizenzierte Spieler.',

  // Danger Zone
  dangerZone: 'Gefahrenbereich',
  deleteAccount: 'Konto löschen',
  deleteAccountDescription: 'Dein Konto und alle damit verbundenen Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
  deleteAccountConfirm: 'Konto endgültig löschen',
  deleteAccountEmailPrompt: 'Gib deine E-Mail-Adresse ein, um zu bestätigen:',
  deleteAccountEmailPlaceholder: 'E-Mail zur Bestätigung',
  deleteAccountError: 'Konto konnte nicht gelöscht werden. Bitte versuche es erneut.',
} as const
