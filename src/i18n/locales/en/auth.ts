export default {
  // Login
  signIn: 'Sign in',
  email: 'Email',
  password: 'Password',
  emailPlaceholder: 'name@example.com',
  passwordPlaceholder: 'Enter password',
  signingIn: 'Signing in...',
  invalidCredentials: 'Invalid email or password',
  rememberMe: 'Remember me',
  orContinueWith: 'or continue with',
  signInWithGoogle: 'Sign in with Google',
  oauthError: 'Sign in failed. Please try again.',

  // Profile
  editProfile: 'Edit Profile',
  contact: 'Contact',
  phone: 'Phone',
  licenseNr: 'License Nr.',
  licences: 'Licences',
  upcomingActivities: 'Upcoming Activities',
  activeAbsences: 'Active Absences',
  showAll: 'Show all',
  noUpcomingActivities: 'No activities in the next 4 weeks.',
  noActiveAbsences: 'No active absences.',
  teams: 'Teams',
  roles: 'Roles',

  contactPrivacyNotice: 'Your email and phone number are only visible to the coach and team responsible of teams where you have an official duty (e.g. scorekeeper).',

  // Profile Edit
  firstName: 'First Name',
  lastName: 'Last Name',
  changePhoto: 'Change Photo',
  managedByCoach: 'Managed by coach/admin',
  position: 'Position',
  number: 'Number',
  changePassword: 'Change Password',
  sendResetLink: 'Send reset link',
  numberTaken: 'This number is already used by {{name}}',
  errorSaving: 'Error saving',
  fileTooLarge: 'File is too large (max 5 MB)',
  invalidImageType: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF',

  // Training label
  training: 'Training',

  // Sign Up
  signUp: 'Sign up',
  createAccount: 'Create Account',
  confirmPassword: 'Confirm Password',
  passwordMismatch: 'Passwords do not match',
  registrationFailed: 'Registration failed. Please try again.',
  creatingAccount: 'Creating account...',
  continue: 'Continue',
  checkingEmail: 'Checking email...',
  alreadyHaveAccount: 'Already have an account?',
  change: 'Change',

  // Account claim
  accountExists: 'Account found',
  accountExistsDescription: 'An account with this email already exists. We\'ve sent you a password reset link.',
  resetLinkSent: 'Link sent! Check your inbox.',
  tryDifferentEmail: 'Try a different email',

  // Team selection
  selectTeam: 'Select team',
  selectTeamPlaceholder: 'Choose a team...',
  teamRequired: 'Please select a team.',

  // Pending page
  pendingApproval: 'Pending Approval',
  pendingDescription: 'Your account is waiting for approval from your team\'s coach or an admin.',
  requestedTeam: 'Requested Team',
  refreshStatus: 'Refresh Status',
  checking: 'Checking...',
  logout: 'Log out',

  // Onboarding
  onboardingTitle: 'Welcome to KSC Wiedikon',
  onboardingSubtitle: 'Please complete your profile to continue.',
  clubdeskNotice: 'Your data was imported from Clubdesk. Please review and confirm.',
  language: 'Language',
  languageGerman: 'Deutsch',
  languageEnglish: 'English',
  completeProfile: 'Confirm Profile',
  birthdate: 'Birthdate',

  // Privacy
  privacySection: 'Privacy',
  hidePhone: 'Hide phone number',
  hidePhoneHint: 'Your phone number will not be shown to other members.',
  birthdateVisibility: 'Birthdate visibility',
  birthdateVisibilityFull: 'Show full date',
  birthdateVisibilityYearOnly: 'Year only',
  birthdateVisibilityHidden: 'Hide',
  hidden: 'Hidden',
  yearOnly: 'Year only',

  // Privacy consent
  privacyConsent: 'By registering you accept our',
  privacyPolicy: 'Privacy Policy',

  // Password reset
  resetPasswordTitle: 'Reset Password',
  newPassword: 'New password',
  resetPasswordButton: 'Save password',
  resettingPassword: 'Saving...',
  resetSuccess: 'Your password has been changed successfully. You can now sign in.',
  resetError: 'This link is invalid or expired. Please request a new reset link.',

  // Danger Zone
  dangerZone: 'Danger Zone',
  deleteAccount: 'Delete Account',
  deleteAccountDescription: 'Your account and all associated data will be permanently deleted. This action cannot be undone.',
  deleteAccountConfirm: 'Permanently delete account',
  deleteAccountEmailPrompt: 'Type your email address to confirm:',
  deleteAccountEmailPlaceholder: 'Email to confirm',
  deleteAccountError: 'Could not delete account. Please try again.',
} as const
