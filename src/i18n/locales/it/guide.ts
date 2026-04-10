export default {
  menu: {
    title: 'Guida',
    subtitle: 'Scopri WiediSync',
    resetAll: 'Reimposta tutto',
    completed: 'Completato',
    steps: '{{count}} passi',
    restart: 'Rivedere il tour?',
  },
  welcome: {
    title: 'Benvenuto su WiediSync!',
    body: 'Vuoi una breve introduzione alle funzioni principali?',
    start: 'Sì, iniziamo',
    skip: 'Salta',
  },
  offer: {
    coachTools: 'Hai strumenti coach qui. Tour rapido?',
    adminTools: 'Ecco i tuoi strumenti admin. Tour rapido?',
    start: 'Mostrami',
    skip: 'Non ora',
  },
  tooltip: {
    skip: 'Salta',
    back: 'Indietro',
    next: 'Avanti',
    finish: 'Fatto',
    stepOf: 'di',
  },
  sections: {
    basics: 'Basi',
    member: 'Funzioni membro',
    coach: 'Funzioni coach',
    admin: 'Funzioni admin',
  },
  tours: {
    gettingStarted: {
      title: 'Primi passi',
      description: 'Impara le basi di WiediSync',
      steps: {
        nav: {
          title: 'Navigazione',
          body: 'Qui trovi tutte le sezioni dell'app. Sul cellulare la navigazione è in basso.',
        },
        home: {
          title: 'Home',
          body: 'La tua dashboard personale: prossime partite, allenamenti e compiti in un colpo d'occhio.',
        },
        profile: {
          title: 'Il mio profilo',
          body: 'Visualizza e modifica le tue informazioni personali, i contatti e le impostazioni di notifica.',
        },
        language: {
          title: 'Lingua',
          body: 'La lingua dell'app può essere cambiata in qualsiasi momento nel menu delle impostazioni.',
        },
        notifications: {
          title: 'Notifiche',
          body: 'Resta aggiornato — gestisci le notifiche push e gli avvisi in-app qui.',
        },
      },
    },
    trainingPlayer: {
      title: 'Allenamenti — Giocatore',
      description: 'Come gestire la tua presenza agli allenamenti',
      steps: {
        list: {
          title: 'Lista allenamenti',
          body: 'Tutti i prossimi allenamenti della tua squadra con data, ora e luogo.',
        },
        rsvpButtons: {
          title: 'RSVP',
          body: 'Tocca Sì, Forse o No. Il tuo coach può vedere le statistiche di partecipazione.',
        },
        absence: {
          title: 'Nota di assenza',
          body: 'Se non puoi partecipare, puoi aggiungere una breve spiegazione della tua assenza.',
        },
        stats: {
          title: 'Statistiche presenza',
          body: 'Tieni traccia del tuo tasso di presenza durante tutta la stagione.',
        },
      },
    },
    trainingCoach: {
      title: 'Allenamenti — Coach',
      description: 'Come gestire gli allenamenti come coach',
      steps: {
        overview: {
          title: 'Panoramica squadra',
          body: 'Vedi a colpo d'occhio chi è presente, chi è assente e chi non ha ancora risposto.',
        },
        create: {
          title: 'Crea allenamento',
          body: 'Aggiungi una nuova sessione con data, ora, luogo e note facoltative.',
        },
        attendance: {
          title: 'Lista presenze',
          body: 'Visualizza la lista completa delle presenze per ogni allenamento ed esportala se necessario.',
        },
        notify: {
          title: 'Notifica giocatori',
          body: 'Invia una notifica push a tutti i giocatori che non hanno ancora risposto.',
        },
      },
    },
    gamesPlayer: {
      title: 'Partite — Giocatore',
      description: 'Come seguire le tue partite e risultati',
      steps: {
        list: {
          title: 'Lista partite',
          body: 'Tutte le tue partite passate e future con data, avversario e risultato.',
        },
        rsvp: {
          title: 'RSVP partita',
          body: 'Conferma se sarai presente alla partita. Il tuo coach vede queste risposte.',
        },
        result: {
          title: 'Risultati',
          body: 'I risultati e i punteggi dei set vengono aggiornati automaticamente dal sistema lega.',
        },
        details: {
          title: 'Dettagli partita',
          body: 'Tocca una partita per vedere tutti i dettagli: luogo, orario di ritrovo, formazione e refertista.',
        },
      },
    },
    gamesCoach: {
      title: 'Partite — Coach',
      description: 'Come gestire le partite come coach',
      steps: {
        overview: {
          title: 'Panoramica partite',
          body: 'Il tuo calendario completo con i conteggi RSVP e lo stato dei risultati per ogni partita.',
        },
        lineup: {
          title: 'Formazione',
          body: 'Definisci la formazione per ogni partita e condividila con la tua squadra.',
        },
        scorer: {
          title: 'Assegnazione refertista',
          body: 'Assegna un refertista per le partite in casa. Viene notificato automaticamente.',
        },
        notes: {
          title: 'Note coach',
          body: 'Aggiungi note private a una partita — visibili solo ai coach.',
        },
      },
    },
    events: {
      title: 'Eventi',
      description: 'Eventi del club e attività di squadra',
      steps: {
        list: {
          title: 'Lista eventi',
          body: 'Gli eventi del club e le attività di squadra sono mostrati qui.',
        },
        rsvp: {
          title: 'Iscrizione evento',
          body: 'Registra la tua partecipazione a eventi, tornei e attività sociali.',
        },
        details: {
          title: 'Dettagli evento',
          body: 'Luogo, orario, descrizione e lista dei partecipanti iscritti.',
        },
      },
    },
    absences: {
      title: 'Assenze',
      description: 'Gestisci le tue assenze pianificate',
      steps: {
        list: {
          title: 'Lista assenze',
          body: 'Tutte le tue assenze pianificate in un unico posto — visibili ai tuoi coach.',
        },
        create: {
          title: 'Aggiungi assenza',
          body: 'Tocca il pulsante più per aggiungere un periodo di assenza con data inizio, fine e motivo.',
        },
        coachView: {
          title: 'Vista coach',
          body: 'I coach vedono tutte le assenze della squadra sovrapposte al calendario per pianificare in anticipo.',
        },
      },
    },
    scorerPlayer: {
      title: 'Refertista — Giocatore',
      description: 'Le tue assegnazioni come refertista',
      steps: {
        duty: {
          title: 'Turno refertista',
          body: 'Se sei assegnato come refertista per una partita, lo vedrai qui e riceverai una notifica.',
        },
        confirm: {
          title: 'Conferma',
          body: 'Conferma o rifiuta la tua assegnazione. Un rifiuto notifica il tuo coach.',
        },
        delegate: {
          title: 'Delega',
          body: 'Se non puoi fare il refertista, puoi suggerire un altro membro della squadra come sostituto.',
        },
      },
    },
    scorerAdmin: {
      title: 'Refertista — Admin',
      description: 'Gestisci le assegnazioni refertista',
      steps: {
        overview: {
          title: 'Panoramica refertisti',
          body: 'Vedi tutte le partite che richiedono un refertista e il loro stato di assegnazione.',
        },
        assign: {
          title: 'Assegna refertista',
          body: 'Seleziona un giocatore per ogni partita. Viene notificato automaticamente.',
        },
        history: {
          title: 'Storico',
          body: 'Tieni traccia di chi ha fatto quante partite — utile per una rotazione equa.',
        },
      },
    },
    hallenplanCoach: {
      title: 'Piano palestra — Coach',
      description: 'Gestisci gli slot della palestra',
      steps: {
        overview: {
          title: 'Piano palestra',
          body: 'Tutti gli slot di palestra per le tue squadre sono mostrati qui — allenamenti, partite e slot liberi.',
        },
        claim: {
          title: 'Prenota uno slot',
          body: 'Tocca uno slot libero per prenotarlo per la tua squadra. La prenotazione è immediata.',
        },
        release: {
          title: 'Libera uno slot',
          body: 'Se non hai più bisogno di uno slot, liberalo in modo che altre squadre possano usarlo.',
        },
        conflict: {
          title: 'Conflitti',
          body: 'Gli slot sovrapposti sono evidenziati. Contatta l'admin per risolvere i conflitti.',
        },
      },
    },
  },
} as const
