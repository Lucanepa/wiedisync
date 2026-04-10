export default {
  menu: {
    title: 'Anleitung',
    subtitle: 'Lerne WiediSync kennen',
    resetAll: 'Alle zurücksetzen',
    completed: 'Abgeschlossen',
    steps: '{{count}} Schritte',
    restart: 'Tour wiederholen?',
  },
  welcome: {
    title: 'Willkommen bei WiediSync!',
    body: 'Möchtest du eine kurze Einführung in die wichtigsten Funktionen?',
    start: "Ja, los geht's",
    skip: 'Überspringen',
  },
  offer: {
    coachTools: 'Du hast hier Coach-Tools. Kurze Tour?',
    adminTools: 'Hier sind deine Admin-Tools. Kurze Tour?',
    start: 'Zeig mir',
    skip: 'Jetzt nicht',
  },
  tooltip: {
    skip: 'Überspringen',
    back: 'Zurück',
    next: 'Weiter',
    finish: 'Fertig',
    stepOf: 'von',
  },
  sections: {
    basics: 'Grundlagen',
    member: 'Mitglied-Funktionen',
    coach: 'Coach-Funktionen',
    admin: 'Admin-Funktionen',
  },
  tours: {
    gettingStarted: {
      title: 'Erste Schritte',
      description: 'Lerne die Grundlagen von WiediSync',
      steps: {
        nav: {
          title: 'Navigation',
          body: 'Hier findest du alle Bereiche der App. Auf dem Handy ist die Navigation unten.',
        },
        home: {
          title: 'Startseite',
          body: 'Dein persönliches Dashboard: bevorstehende Spiele, Trainings und Aufgaben auf einen Blick.',
        },
        profile: {
          title: 'Mein Profil',
          body: 'Persönliche Informationen, Kontaktdaten und Benachrichtigungseinstellungen ansehen und bearbeiten.',
        },
        language: {
          title: 'Sprache',
          body: 'Die App-Sprache kann jederzeit im Einstellungsmenü gewechselt werden.',
        },
        notifications: {
          title: 'Benachrichtigungen',
          body: 'Bleib auf dem Laufenden – verwalte Push-Benachrichtigungen und In-App-Meldungen hier.',
        },
      },
    },
    trainingPlayer: {
      title: 'Training – Spieler',
      description: 'Wie du deine Trainingsteilnahme verwaltest',
      steps: {
        list: {
          title: 'Trainingsliste',
          body: 'Alle bevorstehenden Trainings deines Teams sind hier mit Datum, Uhrzeit und Ort aufgelistet.',
        },
        rsvpButtons: {
          title: 'RSVP',
          body: 'Klicke auf Ja, Vielleicht oder Nein. Dein Coach sieht die Teilnahme-Statistiken.',
        },
        absence: {
          title: 'Abwesenheitsnotiz',
          body: 'Falls du nicht teilnehmen kannst, kannst du eine kurze Begründung hinterlassen.',
        },
        stats: {
          title: 'Anwesenheitsstatistik',
          body: 'Verfolge deine eigene Anwesenheitsquote über die ganze Saison.',
        },
      },
    },
    trainingCoach: {
      title: 'Training – Coach',
      description: 'Wie du Trainings als Coach verwaltest',
      steps: {
        overview: {
          title: 'Team-Übersicht',
          body: 'Sieh auf einen Blick, wer dabei ist, wer fehlt und wer noch nicht geantwortet hat.',
        },
        create: {
          title: 'Training erstellen',
          body: 'Füge eine neue Trainingseinheit mit Datum, Uhrzeit, Ort und optionalen Notizen hinzu.',
        },
        attendance: {
          title: 'Anwesenheitsliste',
          body: 'Zeige die vollständige Anwesenheitsliste für jedes Training an und exportiere sie bei Bedarf.',
        },
        notify: {
          title: 'Spieler benachrichtigen',
          body: 'Sende eine Push-Benachrichtigung an alle Spieler, die noch nicht geantwortet haben.',
        },
      },
    },
    gamesPlayer: {
      title: 'Spiele – Spieler',
      description: 'Wie du deine Spiele und Resultate verfolgst',
      steps: {
        list: {
          title: 'Spielliste',
          body: 'Alle bevorstehenden und vergangenen Spiele mit Datum, Gegner und Resultat.',
        },
        rsvp: {
          title: 'Spiel-RSVP',
          body: 'Bestätige, ob du am Spiel teilnehmen wirst. Dein Coach sieht diese Antworten.',
        },
        result: {
          title: 'Resultate',
          body: 'Spielresultate und Satzstände werden automatisch aus dem Liga-System aktualisiert.',
        },
        details: {
          title: 'Spieldetails',
          body: 'Tippe auf ein Spiel, um die vollständigen Details zu sehen: Ort, Treffpunkt, Aufstellung und Schreiber.',
        },
      },
    },
    gamesCoach: {
      title: 'Spiele – Coach',
      description: 'Wie du Spiele als Coach verwaltest',
      steps: {
        overview: {
          title: 'Spielübersicht',
          body: 'Dein gesamter Spielplan mit RSVP-Zahlen und Resultatsstatus für jedes Spiel.',
        },
        lineup: {
          title: 'Aufstellung',
          body: 'Definiere die Spieleraufstellung für jedes Spiel und teile sie mit deinem Team.',
        },
        scorer: {
          title: 'Schreiber-Zuteilung',
          body: 'Weise einem Heimspiel einen Schreiber zu. Der Schreiber wird automatisch benachrichtigt.',
        },
        notes: {
          title: 'Coach-Notizen',
          body: 'Füge einem Spiel private Notizen hinzu – nur für Coaches sichtbar.',
        },
      },
    },
    events: {
      title: 'Veranstaltungen',
      description: 'Vereinsanlässe und Teamaktivitäten',
      steps: {
        list: {
          title: 'Veranstaltungsliste',
          body: 'Vereinsweite Anlässe und Teamaktivitäten werden hier angezeigt.',
        },
        rsvp: {
          title: 'Event-Anmeldung',
          body: 'Melde dich für Veranstaltungen, Turniere und gesellschaftliche Aktivitäten an.',
        },
        details: {
          title: 'Veranstaltungsdetails',
          body: 'Ort, Uhrzeit, Beschreibung und die Liste der angemeldeten Teilnehmer.',
        },
      },
    },
    absences: {
      title: 'Abwesenheiten',
      description: 'Verwalte deine geplanten Abwesenheiten',
      steps: {
        list: {
          title: 'Abwesenheitsliste',
          body: 'Alle deine geplanten Abwesenheiten an einem Ort – für deine Coaches sichtbar.',
        },
        create: {
          title: 'Abwesenheit hinzufügen',
          body: 'Tippe auf das Plus-Symbol, um eine Abwesenheitsperiode mit Start-, Enddatum und Grund hinzuzufügen.',
        },
        coachView: {
          title: 'Coach-Ansicht',
          body: 'Coaches sehen alle Team-Abwesenheiten im Kalender überlagert, um vorausplanen zu können.',
        },
      },
    },
    scorerPlayer: {
      title: 'Schreibereinsatz – Spieler',
      description: 'Deine Schreiber-Zuteilungen',
      steps: {
        duty: {
          title: 'Schreibereinsatz',
          body: 'Wenn du als Schreiber für ein Spiel eingeteilt bist, siehst du es hier und erhältst eine Benachrichtigung.',
        },
        confirm: {
          title: 'Bestätigen',
          body: 'Bestätige oder lehne deine Schreiber-Zuteilung ab. Eine Ablehnung benachrichtigt deinen Coach.',
        },
        delegate: {
          title: 'Delegieren',
          body: 'Falls du nicht schreiben kannst, kannst du ein anderes Teammitglied als Ersatz vorschlagen.',
        },
      },
    },
    scorerAdmin: {
      title: 'Schreiber – Admin',
      description: 'Schreiber-Zuteilungen verwalten',
      steps: {
        overview: {
          title: 'Schreiber-Übersicht',
          body: 'Sieh alle Spiele, die einen Schreiber benötigen, und den aktuellen Zuteilungsstatus.',
        },
        assign: {
          title: 'Schreiber zuweisen',
          body: 'Wähle für jedes Spiel einen Spieler aus. Er wird automatisch benachrichtigt.',
        },
        history: {
          title: 'Verlauf',
          body: 'Verfolge, wer wie viele Spiele geschrieben hat – nützlich für eine faire Rotation.',
        },
      },
    },
    hallenplanCoach: {
      title: 'Hallenplan – Coach',
      description: 'Hallenzeitslots verwalten',
      steps: {
        overview: {
          title: 'Hallenplan',
          body: 'Alle Hallenzeitslots für deine Teams werden hier angezeigt – Trainings, Spiele und freie Slots.',
        },
        claim: {
          title: 'Slot beanspruchen',
          body: 'Tippe auf einen freien Slot, um ihn für dein Team zu reservieren. Der Slot wird sofort belegt.',
        },
        release: {
          title: 'Slot freigeben',
          body: 'Falls du einen Slot nicht mehr benötigst, gib ihn frei, damit andere Teams ihn nutzen können.',
        },
        conflict: {
          title: 'Konflikte',
          body: 'Überlappende Slots werden hervorgehoben. Kontaktiere den Admin, um Konflikte zu lösen.',
        },
      },
    },
  },
} as const
