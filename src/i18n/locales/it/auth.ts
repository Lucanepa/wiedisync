export default {
  // Login
  signIn: 'Accedi',
  email: 'Email',
  password: 'Password',
  emailPlaceholder: 'nome@esempio.com',
  passwordPlaceholder: 'Inserisci password',
  signingIn: 'Accesso in corso...',
  invalidCredentials: 'Email o password non validi',
  rememberMe: 'Ricordami',
  forgotPassword: 'Password dimenticata?',
  sendingResetLink: 'Invio link...',
  enterEmailFirst: 'Inserisci prima la tua email.',
  accountAlreadyExists: 'Esiste già un account con questa email. Accedi.',
  noAccountYet: 'Non hai un account?',
  orContinueWith: 'oppure continua con',
  signInWithGoogle: 'Accedi con Google',
  oauthError: 'Accesso fallito. Riprova.',

  // Profile
  editProfile: 'Modifica profilo',
  contact: 'Contatto',
  phone: 'Telefono',
  licenseNr: 'Nr. licenza',
  licences: 'Licenze',
  upcomingActivities: 'Prossime attività',
  activeAbsences: 'Assenze attive',
  showAll: 'Mostra tutto',
  noUpcomingActivities: 'Nessuna attività nelle prossime 4 settimane.',
  noActiveAbsences: 'Nessuna assenza attiva.',
  teams: 'Squadre',
  roles: 'Ruoli',

  contactPrivacyNotice: 'Il tuo indirizzo email e il numero di telefono sono visibili solo all\'allenatore e al responsabile di squadra delle squadre in cui hai un incarico ufficiale (es. segnapunti).',

  // Profile Edit
  firstName: 'Nome',
  lastName: 'Cognome',
  changePhoto: 'Cambia foto',
  managedByCoach: 'Gestito dall\'allenatore/admin',
  position: 'Posizione',
  number: 'Numero',
  changePassword: 'Cambia password',
  sendResetLink: 'Invia link di reset',
  numberTaken: 'Questo numero è già utilizzato da {{name}}',
  errorSaving: 'Errore durante il salvataggio',
  fileTooLarge: 'Il file è troppo grande (max 5 MB)',
  invalidImageType: 'Tipo di file non valido. Ammessi: JPEG, PNG, WebP, GIF',

  // Training label
  training: 'Allenamento',

  // Sign Up
  signUp: 'Registrati',
  createAccount: 'Crea account',
  confirmPassword: 'Conferma password',
  passwordMismatch: 'Le password non corrispondono',
  registrationFailed: 'Registrazione fallita. Riprova.',
  creatingAccount: 'Creazione account...',
  continue: 'Continua',
  checkingEmail: 'Verifica email...',
  alreadyHaveAccount: 'Hai già un account?',
  change: 'Modifica',

  // Account claim
  accountExists: 'Account trovato',
  accountExistsDescription: 'Esiste già un account con questa email. Ti abbiamo inviato un link per il reset della password.',
  resetLinkSent: 'Link inviato! Controlla la tua casella di posta.',
  tryDifferentEmail: 'Prova con un\'altra email',

  // Team selection
  selectTeam: 'Seleziona squadra',
  selectTeamPlaceholder: 'Scegli una squadra...',
  teamRequired: 'Seleziona una squadra.',

  // Pending page
  pendingApproval: 'In attesa di approvazione',
  pendingDescription: 'Il tuo account è in attesa di approvazione da parte dell\'allenatore della tua squadra o di un admin.',
  requestedTeam: 'Squadra richiesta',
  refreshStatus: 'Aggiorna stato',
  checking: 'Verifica...',
  logout: 'Esci',

  // Onboarding
  onboardingTitle: 'Benvenuto al KSC Wiedikon',
  onboardingSubtitle: 'Completa il tuo profilo per continuare.',
  clubdeskNotice: 'I tuoi dati sono stati importati da Clubdesk. Verifica e conferma.',
  language: 'Lingua',
  languageGerman: 'Deutsch',
  languageEnglish: 'English',
  completeProfile: 'Conferma profilo',
  skipForNow: 'Più tardi',
  birthdate: 'Data di nascita',

  // Privacy
  privacySection: 'Privacy',
  hidePhone: 'Nascondi numero di telefono',
  hidePhoneHint: 'Il tuo numero di telefono non sarà visibile agli altri membri.',
  birthdateVisibility: 'Visibilità data di nascita',
  birthdateVisibilityFull: 'Mostra data completa',
  birthdateVisibilityYearOnly: 'Solo anno',
  birthdateVisibilityHidden: 'Nascondi',
  hidden: 'Nascosto',
  yearOnly: 'Solo anno',

  // Privacy consent
  privacyConsent: 'Registrandoti accetti la nostra',
  privacyPolicy: 'Informativa sulla privacy',

  // Password reset
  resetPasswordTitle: 'Reimposta password',
  newPassword: 'Nuova password',
  resetPasswordButton: 'Salva password',
  resettingPassword: 'Salvataggio...',
  resetSuccess: 'La tua password è stata cambiata con successo. Ora puoi accedere.',
  resetError: 'Questo link non è valido o è scaduto. Richiedi un nuovo link di reset.',

  // Danger Zone
  dangerZone: 'Zona pericolosa',
  deleteAccount: 'Elimina account',
  deleteAccountDescription: 'Il tuo account e tutti i dati associati verranno eliminati definitivamente. Questa azione non può essere annullata.',
  deleteAccountConfirm: 'Elimina account definitivamente',
  deleteAccountEmailPrompt: 'Inserisci il tuo indirizzo email per confermare:',
  deleteAccountEmailPlaceholder: 'Email di conferma',
  deleteAccountError: 'Impossibile eliminare l\'account. Riprova.',
} as const
