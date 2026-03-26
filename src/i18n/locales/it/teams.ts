export default {
  title: 'Squadre e membri',
  subtitleSeason: 'Stagione {{season}}',

  // Positions
  positionSetter: 'Palleggiatore',
  positionOutside: 'Schiacciatore',
  positionMiddle: 'Centrale',
  positionOpposite: 'Opposto',
  positionLibero: 'Libero',
  positionPointGuard: 'Playmaker',
  positionShootingGuard: 'Guardia tiratrice',
  positionSmallForward: 'Ala piccola',
  positionPowerForward: 'Ala grande',
  positionCenter: 'Centro',
  positionGuest: 'Ospite',
  positionOther: 'Altro',

  // Roles
  rolePlayer: 'Giocatore',
  roleCaptain: 'Capitano',
  roleCoach: 'Allenatore',

  roleTeamResponsible: 'Responsabile di squadra',

  // Table headers
  playerCol: 'Giocatore',
  numberCol: '#',
  positionCol: 'Posizione',
  emailCol: 'Email',
  phoneCol: 'Telefono',
  birthdateCol: 'Data di nascita',
  roleCol: 'Ruolo',

  // Roster editor
  teamLeadership: 'Direzione della squadra',
  editTeam: 'Modifica squadra',
  adjustCrop: 'Modifica ritaglio',
  zoomIn: 'Ingrandisci',
  zoomOut: 'Riduci',
  editRoster: 'Modifica roster',
  addPlayer: 'Aggiungi giocatore',
  searchPlaceholder: 'Cerca per nome...',
  noSearchResults: 'Nessun risultato',
  currentRoster: 'Roster attuale ({{count}})',
  removeConfirmTitle: 'Rimuovi giocatore',
  removeConfirmMessage: 'Rimuovere {{name}} dal roster?',

  // Team picture
  teamPicture: 'Foto della squadra',
  uploadPicture: 'Carica foto',
  removePicture: 'Rimuovi foto',
  pictureHint: 'JPG o PNG, max 10 MB',
  pictureTooLarge: 'Il file è troppo grande (max 10 MB)',
  errorUploadingPicture: 'Errore durante il caricamento dell\'immagine',

  // Player profile
  statistics: 'Statistiche',
  trainingsAttended: 'Allenamenti',
  gamesAttended: 'Partite',
  trainingRate: 'Tasso di presenza',
  activeAbsences: 'Assenze',
  currentAbsences: 'Assenze attuali',

  // Team detail
  sponsors: 'Sponsor',
  age: '{{years}} anni',

  // Empty state
  noTeams: 'Nessuna squadra',
  noTeamsDescription: 'Nessuna squadra trovata.',
  noTeamMembership: 'Nessuna squadra assegnata',
  noTeamMembershipDescription: 'Al momento non sei assegnato a nessuna squadra.',
  noMembers: 'Nessun membro',
  noMembersDescription: 'Questa squadra non ha ancora membri.',

  // Licences
  licenceScorer: 'Licenza segnapunti',
  licenceReferee: 'Licenza arbitro',
  licenceOTR1: 'Licenza OTR1',
  licenceOTR2: 'Licenza OTR2',
  licenceOTN: 'Licenza OTN',
  licenceRefereeBB: 'Licenza arbitro (pallacanestro)',

  // Guest levels
  guestBadge: 'O',
  guestLevel0: 'Non ospite',
  guestLevel1: 'Ospite livello 1',
  guestLevel2: 'Ospite livello 2',
  guestLevel3: 'Ospite livello 3',
  guestLevelTooltip: 'Ospite livello {{level}} — priorità inferiore quando gli allenamenti sono al completo',
  guestExplanation: 'I livelli ospite 1-3 determinano la priorità quando gli allenamenti sono al completo. Il livello 1 ha la priorità ospite più alta, il livello 3 la più bassa.',

  // Pending requests
  pendingRequests: '{{count}} richiesta/e in attesa',
  approve: 'Approva',
  reject: 'Rifiuta',
  teamJoinRequest: 'Richiesta di adesione',
  // Funzionalità
  featureToggles: 'Funzionalità',
  featureTogglesDescription: 'Attiva o disattiva le funzionalità opzionali per questa squadra.',
  featureTasks: 'Compiti (assegna doveri per partita/allenamento/evento)',
  featureCarpool: 'Carpooling (organizza passaggi per le trasferte)',
  featurePolls: 'Sondaggi (votazioni e decisioni di squadra)',
  featureShowRsvpTime: 'Mostra orario di risposta (quando i membri hanno risposto)',
  // Sponsor
  teamSponsors: 'Sponsor della squadra',
  addSponsor: 'Aggiungi sponsor',
  editSponsor: 'Modifica sponsor',
  deleteSponsor: 'Rimuovi sponsor',
  deleteSponsorConfirm: 'Rimuovere davvero lo sponsor "{{name}}"?',
  sponsorName: 'Nome',
  sponsorWebsite: 'Sito web',
  sponsorLogo: 'Logo',
  teamPageOnly: 'Solo pagina squadra',
  teamPageOnlyHint: 'Se disattivato, lo sponsor appare anche nella homepage e nella pagina sponsor',
  sponsorSaved: 'Sponsor salvato',
  sponsorDeleted: 'Sponsor rimosso',
} as const
