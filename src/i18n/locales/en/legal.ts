export default {
  // Privacy Policy page
  privacyTitle: 'Privacy Policy',
  lastUpdated: 'Last updated: March 12, 2026',

  controllerTitle: '1. Data Controller',
  controllerText:
    'Luca Canepa\nZurich, Switzerland\nEmail: luca.canepa@gmail.com',

  dataCollectedTitle: '2. Data We Collect',
  dataAccountTitle: 'Account data (upon registration)',
  dataAccountText:
    'When registering as a club member, we collect: name, email address, phone number, and date of birth. Profile photos are uploaded and managed by members themselves. License number, position, and team assignment are set by coaches or the board.',
  dataRosterTitle: 'Roster data (public)',
  dataRosterText:
    'On the publicly accessible team pages, player names, jersey numbers, positions, and photos are displayed. This information corresponds to data also published publicly by Swiss Volley.',
  dataInternalTitle: 'Internal club data',
  dataInternalText:
    'Training attendance, absences (including reason), scorer duty assignments, and game results are recorded internally for club management and are only visible to logged-in members or coaches.',
  dataTechnicalTitle: 'Technical data',
  dataTechnicalText:
    'When visiting the website, technical information such as IP address and browser information is automatically processed by our hosting provider (Cloudflare).',

  legalBasisTitle: '3. Legal Basis',
  legalBasisText:
    'The processing of personal data is based on:',
  legalBasisContract:
    'Contract fulfillment (club membership) — for managing member data, training, and game planning.',
  legalBasisInterest:
    'Legitimate interest — for the public display of team rosters, as is customary in club sports and expected by members.',
  legalBasisConsent:
    'Consent — Members upload their own profile photo and can change or remove it at any time.',

  thirdPartyTitle: '4. Sub-Processors',
  thirdPartyIntro: 'The following service providers are used as sub-processors:',
  thirdPartyCloudflare:
    'Cloudflare, Inc. — Frontend hosting (Cloudflare Pages) | Global (US-based) | DPA, Standard Contractual Clauses, Swiss-US Data Privacy Framework',
  thirdPartySwissVolley:
    'Swiss Volley API (api.volleyball.ch) — We retrieve publicly available game data and rankings. No personal data is transmitted to Swiss Volley.',
  thirdPartyGCal:
    'Google Calendar — We retrieve a public calendar feed to display hall schedules. No personal data is transmitted to Google.',

  retentionTitle: '5. Data Retention',
  retentionText:
    'Your personal data is retained for as long as you have an active account on the Platform. Upon request or when your membership ends, your data will be deleted within 30 days, unless a longer retention period is required by law. You can also delete your account at any time directly in your profile settings.',

  storageTitle: '6. Data Storage',
  storageServer:
    'Data is stored on a self-hosted server in Switzerland (PocketBase). The frontend is served via Cloudflare Pages.',
  storageLocal:
    'The following non-personal preferences are stored in your browser: color scheme (light/dark) and language setting. For logged-in users, a session token is stored in the browser.',
  storageNoCookies:
    'The website itself does not set any cookies. Cloudflare may set technically necessary cookies that do not require consent.',

  rightsTitle: '7. Your Rights',
  rightsText:
    'Under the Swiss Data Protection Act (nDSG), you have the following rights:',
  rightsAccess: 'Right of access — You can request information about your stored data.',
  rightsCorrection: 'Right to rectification — You can request the correction of inaccurate data. Most data can be updated directly in your profile.',
  rightsDeletion: 'Right to deletion — You can request deletion of your data, or delete your account yourself.',
  rightsPortability: 'Right to data portability — You can receive your data in a commonly used format.',
  rightsObject: 'Right to object — You may object to the processing of your data at any time.',
  rightsContact:
    'For requests regarding your rights, please contact: luca.canepa@gmail.com',
  rightsFDPIC:
    'You also have the right to file a complaint with the Swiss Federal Data Protection and Information Commissioner (FDPIC): www.edoeb.admin.ch',

  photosTitle: '8. Photos',
  photosText:
    'Player photos are uploaded by members themselves via their profile and can be changed or removed at any time. Uploaded photos are visible on the public team pages.',

  changesTitle: '9. Changes',
  changesText:
    'We reserve the right to update this privacy policy as needed. The current version is available on this page.',

  // Impressum page
  impressumTitle: 'Legal Notice',
  impressumClubName: 'KSC Wiedikon',
  impressumAddress: 'Schrennengasse 7\n8003 Zürich',
  impressumContact: 'Email: vorstand@kscw.ch',
  impressumBoard: 'Responsible: Board of KSC Wiedikon',
  impressumHosting: 'Hosting: Cloudflare Pages (frontend), self-hosted server in Switzerland (backend)',
  impressumSocial: 'Social Media',
  impressumFacebook: 'Facebook: KSC Wiedikon',
  impressumInstagram: 'Instagram: @ksc_wiedikon',
  impressumDisclaimer: 'Disclaimer',
  impressumDisclaimerText:
    'KSC Wiedikon assumes no liability for the accuracy, completeness, or timeliness of the information provided. Liability claims against KSC Wiedikon relating to material or immaterial damages are generally excluded.',

  // Privacy notice bar
  noticeCookies: 'This website does not use tracking cookies.',
  noticeLink: 'Learn more',
} as const
