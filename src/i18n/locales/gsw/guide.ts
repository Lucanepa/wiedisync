export default {
  menu: {
    title: 'Aleitig',
    subtitle: 'Lern WiediSync kenne',
    resetAll: 'Alles zrücksetze',
    completed: 'Abgschlosse',
    steps: '{{count}} Schritt',
    restart: 'Tour wiederhole?',
  },
  welcome: {
    title: 'Willkomme bi WiediSync!',
    body: 'Möchtisch en churze Iiführig i d Hauptfunktione?',
    start: 'Ja, los gahts',
    skip: 'Übersprige',
  },
  offer: {
    coachTools: 'Du hesch da Coach-Tools. Churze Tour?',
    adminTools: 'Da sind dini Admin-Tools. Churze Tour?',
    start: 'Zeig mer',
    skip: 'Jetzt nöd',
  },
  tooltip: {
    skip: 'Übersprige',
    back: 'Zrugg',
    next: 'Wiiter',
    finish: 'Fertig',
    stepOf: 'vo',
  },
  sections: {
    basics: 'Grundlage',
    member: 'Mitgliid-Funktione',
    coach: 'Coach-Funktione',
    admin: 'Admin-Funktione',
  },
  tours: {
    gettingStarted: {
      title: 'Ersti Schritt',
      description: 'Lern d Grundlage vo WiediSync',
      steps: {
        nav: {
          title: 'Navigation',
          body: 'Da findsch alli Bereich vo der App. Ufem Handy isch d Navigation unne.',
        },
        home: {
          title: 'Startsiite',
          body: 'Dis persönlichs Dashboard: nächschti Spiel, Training und Ufgabe uf eim Blick.',
        },
        profile: {
          title: 'Mis Profil',
          body: 'Persönlichi Informatione, Kontaktdate und Benachrichtigigsiistellige aluege und bearbeite.',
        },
        language: {
          title: 'Sprach',
          body: 'D App-Sprach cha jederziit im Iistelligsmenü gwechslet werde.',
        },
        notifications: {
          title: 'Benachrichtigige',
          body: 'Bliib uf em Laufende – verwalte Push-Benachrichtigige und In-App-Mäldigige da.',
        },
      },
    },
    trainingPlayer: {
      title: 'Training – Spieler',
      description: 'Wie du dini Trainingsteilnahm verwaltesch',
      steps: {
        list: {
          title: 'Trainigslischte',
          body: 'Alli bevorstehende Training vo dim Team sind da mit Datum, Uhrziit und Ort ufglistet.',
        },
        rsvpButtons: {
          title: 'RSVP',
          body: 'Klick uf Ja, Villicht oder Nei. Din Coach gseht d Teilnahm-Statistike.',
        },
        absence: {
          title: 'Abwesenheitsnotiz',
          body: 'Falls du nöd cha, chasch en churze Begründig hinterloh.',
        },
        stats: {
          title: 'Anwesenheitsstatistik',
          body: 'Verfölg dini eigeni Anwesenheitsquote über d ganzi Saison.',
        },
      },
    },
    trainingCoach: {
      title: 'Training – Coach',
      description: 'Wie du Training als Coach verwaltesch',
      steps: {
        overview: {
          title: 'Team-Übersicht',
          body: 'Gseht uf eim Blick, wer dabei isch, wer fehlt und wer no nöd gantwortet het.',
        },
        create: {
          title: 'Training erstelle',
          body: 'Füeg e neui Trainingsiinheit mit Datum, Uhrziit, Ort und optionale Notize iine.',
        },
        attendance: {
          title: 'Anwesenhaitslischte',
          body: 'Zeig d vollständigi Anwesenhaitslischte für jedes Training ah und exportier si bi Bedarf.',
        },
        notify: {
          title: 'Spieler benachrichtige',
          body: 'Schick en Push-Benachrichtiging an alli Spieler, die no nöd gantwortet hend.',
        },
      },
    },
    gamesPlayer: {
      title: 'Spiel – Spieler',
      description: 'Wie du dini Spiel und Resultat verfölgsch',
      steps: {
        list: {
          title: 'Spielilischte',
          body: 'Alli bevorstehende und vergangeni Spiel mit Datum, Gägner und Resultat.',
        },
        rsvp: {
          title: 'Spiel-RSVP',
          body: 'Bestätig, ob du am Spiel teilnimmsch. Din Coach gseht disi Antwort.',
        },
        result: {
          title: 'Resultat',
          body: 'Spielresultat und Satzstand werde automatisch us em Liga-System aktualisiert.',
        },
        details: {
          title: 'Spieldetails',
          body: 'Tipf uf es Spiel, um d vollständige Details z gsehn: Ort, Treffpunkt, Ufstellig und Schriber.',
        },
      },
    },
    gamesCoach: {
      title: 'Spiel – Coach',
      description: 'Wie du Spiel als Coach verwaltesch',
      steps: {
        overview: {
          title: 'Spielübersicht',
          body: 'Din gsamte Spielplan mit RSVP-Zahle und Resultatsstatus für jedes Spiel.',
        },
        lineup: {
          title: 'Ufstellig',
          body: 'Definier d Spielerufstellig für jedes Spiel und teil sie mit dim Team.',
        },
        scorer: {
          title: 'Schriber-Zueteilig',
          body: 'Wis emem Heimspiel en Schriber zue. De Schriber wird automatisch benachrichtigt.',
        },
        notes: {
          title: 'Coach-Notize',
          body: 'Füeg emem Spiel privati Notize iine – nur für Coach sichtbar.',
        },
      },
    },
    events: {
      title: 'Veranschtaltige',
      description: 'Vereinsanläss und Teamaktivitäte',
      steps: {
        list: {
          title: 'Veranschtaltigslischte',
          body: 'Vereinswiiti Anläss und Teamaktivitäte werde da aazeigt.',
        },
        rsvp: {
          title: 'Event-Ammäldig',
          body: 'Mäld dich für Veranschtaltige, Turnier und gesellschaftlichi Aktivitäte ah.',
        },
        details: {
          title: 'Veranschtaltigsdetails',
          body: 'Ort, Uhrziit, Beschriibig und d Lischte vo de aagmäldete Teilnehmer.',
        },
      },
    },
    absences: {
      title: 'Abwesenheite',
      description: 'Verwalte dini gplante Abwesenheite',
      steps: {
        list: {
          title: 'Abwesenheitslischte',
          body: 'Alli dini gplante Abwesenheite ah eim Ort – für dini Coach sichtbar.',
        },
        create: {
          title: 'Abwesenheit iifüege',
          body: 'Tipf uf s Plus-Symbol, um en Abwesenheitsperiode mit Start-, Enddatum und Grund iizfüege.',
        },
        coachView: {
          title: 'Coach-Ansicht',
          body: 'Coach gsehn alli Team-Abwesenheite im Kalender überlageret, zum vorausplane.',
        },
      },
    },
    scorerPlayer: {
      title: 'Schribereisatz – Spieler',
      description: 'Dini Schriber-Zueteiligige',
      steps: {
        duty: {
          title: 'Schribereisatz',
          body: 'Wenn du als Schriber für es Spiel iigtäilt bisch, gsehtsch es da und kriegsch en Benachrichtiging.',
        },
        confirm: {
          title: 'Bestätige',
          body: 'Bestätig oder lehne dini Schriber-Zueteilig ab. E Ablehning benachrichtigt din Coach.',
        },
        delegate: {
          title: 'Delegiere',
          body: 'Falls du nöd schribe chasch, chasch es anderes Teammitglied als Ersatz vorschlah.',
        },
      },
    },
    scorerAdmin: {
      title: 'Schriber – Admin',
      description: 'Schriber-Zueteiligige verwalte',
      steps: {
        overview: {
          title: 'Schriber-Übersicht',
          body: 'Gseht alli Spiel, wo en Schriber bruche, und de aktuell Zueteiligsstatus.',
        },
        assign: {
          title: 'Schriber zuwise',
          body: 'Wähl für jedes Spiel en Spieler us. Er wird automatisch benachrichtigt.',
        },
        history: {
          title: 'Verlauf',
          body: 'Verfölg, wer wie vili Spiel gschribe het – nützlich für en faire Rotation.',
        },
      },
    },
    hallenplanCoach: {
      title: 'Halleplan – Coach',
      description: 'Hallezitslot verwalte',
      steps: {
        overview: {
          title: 'Halleplan',
          body: 'Alli Hallezitslot für dini Teams werde da aazeigt – Training, Spiel und freii Slot.',
        },
        claim: {
          title: 'Slot beanspruche',
          body: 'Tipf uf en freie Slot, um ihn für dis Team z reserviere. De Slot wird sofort belegt.',
        },
        release: {
          title: 'Slot fröigeh',
          body: 'Falls du en Slot nümm bruuchsch, gib ihn fröi, damit anderi Teams ihn nutze chönd.',
        },
        conflict: {
          title: 'Konflikte',
          body: 'Überlappendi Slot werde hervorgehobe. Kontaktier de Admin, um Konflikte z löse.',
        },
      },
    },
  },
} as const
