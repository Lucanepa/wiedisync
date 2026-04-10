export default {
  menu: {
    title: 'Guide',
    subtitle: 'Découvrir WiediSync',
    resetAll: 'Tout réinitialiser',
    completed: 'Terminé',
    steps: '{{count}} étapes',
    restart: 'Revoir la visite ?',
  },
  welcome: {
    title: 'Bienvenue sur WiediSync !',
    body: 'Souhaitez-vous une brève introduction aux principales fonctionnalités ?',
    start: 'Oui, allons-y',
    skip: 'Passer',
  },
  offer: {
    coachTools: 'Vous avez des outils coach ici. Visite rapide ?',
    adminTools: 'Voici vos outils admin. Visite rapide ?',
    start: 'Montrez-moi',
    skip: 'Pas maintenant',
  },
  tooltip: {
    skip: 'Passer',
    back: 'Retour',
    next: 'Suivant',
    finish: 'Terminé',
    stepOf: 'sur',
  },
  sections: {
    basics: 'Bases',
    member: 'Fonctions membre',
    coach: 'Fonctions coach',
    admin: 'Fonctions admin',
  },
  tours: {
    gettingStarted: {
      title: 'Premiers pas',
      description: 'Apprenez les bases de WiediSync',
      steps: {
        nav: {
          title: 'Navigation',
          body: 'Toutes les sections de l\'application se trouvent ici. Sur mobile, la navigation est en bas.',
        },
        home: {
          title: 'Accueil',
          body: 'Votre tableau de bord personnel : prochains matchs, entraînements et tâches en un coup d\'œil.',
        },
        profile: {
          title: 'Mon profil',
          body: 'Consultez et modifiez vos informations personnelles, coordonnées et paramètres de notification.',
        },
        language: {
          title: 'Langue',
          body: 'La langue de l\'application peut être changée à tout moment dans le menu des paramètres.',
        },
        notifications: {
          title: 'Notifications',
          body: 'Restez informé — gérez les notifications push et les alertes in-app ici.',
        },
      },
    },
    trainingPlayer: {
      title: 'Entraînements — Joueur',
      description: 'Comment gérer votre présence aux entraînements',
      steps: {
        list: {
          title: 'Liste des entraînements',
          body: 'Tous les prochains entraînements de votre équipe avec date, heure et lieu.',
        },
        rsvpButtons: {
          title: 'RSVP',
          body: 'Appuyez sur Oui, Peut-être ou Non. Votre coach peut voir les statistiques de présence.',
        },
        absence: {
          title: 'Note d\'absence',
          body: 'Si vous ne pouvez pas participer, vous pouvez ajouter une courte explication.',
        },
        stats: {
          title: 'Statistiques de présence',
          body: 'Suivez votre propre taux de présence sur toute la saison.',
        },
      },
    },
    trainingCoach: {
      title: 'Entraînements — Coach',
      description: 'Comment gérer les entraînements en tant que coach',
      steps: {
        overview: {
          title: 'Vue d\'ensemble de l\'équipe',
          body: 'Voyez d\'un coup d\'œil qui est présent, qui est absent et qui n\'a pas encore répondu.',
        },
        create: {
          title: 'Créer un entraînement',
          body: 'Ajoutez une nouvelle séance avec date, heure, lieu et notes facultatives.',
        },
        attendance: {
          title: 'Liste de présence',
          body: 'Consultez la liste complète de présence pour chaque entraînement et exportez-la si nécessaire.',
        },
        notify: {
          title: 'Notifier les joueurs',
          body: 'Envoyez une notification push à tous les joueurs qui n\'ont pas encore répondu.',
        },
      },
    },
    gamesPlayer: {
      title: 'Matchs — Joueur',
      description: 'Comment suivre vos matchs et résultats',
      steps: {
        list: {
          title: 'Liste des matchs',
          body: 'Tous vos matchs à venir et passés avec date, adversaire et résultat.',
        },
        rsvp: {
          title: 'RSVP match',
          body: 'Confirmez si vous serez présent au match. Votre coach voit ces réponses.',
        },
        result: {
          title: 'Résultats',
          body: 'Les résultats et scores de sets sont mis à jour automatiquement depuis le système de ligue.',
        },
        details: {
          title: 'Détails du match',
          body: 'Appuyez sur un match pour voir tous les détails : lieu, heure de rendez-vous, composition et marqueur.',
        },
      },
    },
    gamesCoach: {
      title: 'Matchs — Coach',
      description: 'Comment gérer les matchs en tant que coach',
      steps: {
        overview: {
          title: 'Vue d\'ensemble des matchs',
          body: 'Votre calendrier complet avec les comptages RSVP et le statut des résultats.',
        },
        lineup: {
          title: 'Composition',
          body: 'Définissez la composition pour chaque match et partagez-la avec votre équipe.',
        },
        scorer: {
          title: 'Attribution du marqueur',
          body: 'Assignez un marqueur pour les matchs à domicile. Il est automatiquement notifié.',
        },
        notes: {
          title: 'Notes du coach',
          body: 'Ajoutez des notes privées à un match — visibles uniquement par les coaches.',
        },
      },
    },
    events: {
      title: 'Événements',
      description: 'Événements du club et activités d\'équipe',
      steps: {
        list: {
          title: 'Liste des événements',
          body: 'Les événements du club et les activités d\'équipe sont affichés ici.',
        },
        rsvp: {
          title: 'Inscription à l\'événement',
          body: 'Inscrivez-vous aux événements, tournois et activités sociales.',
        },
        details: {
          title: 'Détails de l\'événement',
          body: 'Lieu, heure, description et liste des participants inscrits.',
        },
      },
    },
    absences: {
      title: 'Absences',
      description: 'Gérez vos absences planifiées',
      steps: {
        list: {
          title: 'Liste des absences',
          body: 'Toutes vos absences planifiées en un seul endroit — visibles par vos coaches.',
        },
        create: {
          title: 'Ajouter une absence',
          body: 'Appuyez sur le bouton plus pour ajouter une période d\'absence avec dates de début, fin et motif.',
        },
        coachView: {
          title: 'Vue coach',
          body: 'Les coaches voient toutes les absences de l\'équipe superposées au calendrier pour anticiper.',
        },
      },
    },
    scorerPlayer: {
      title: 'Marqueur — Joueur',
      description: 'Vos attributions comme marqueur',
      steps: {
        duty: {
          title: 'Service de marqueur',
          body: 'Si vous êtes désigné marqueur pour un match, vous le verrez ici et recevrez une notification.',
        },
        confirm: {
          title: 'Confirmer',
          body: 'Confirmez ou refusez votre attribution. Un refus notifie votre coach.',
        },
        delegate: {
          title: 'Déléguer',
          body: 'Si vous ne pouvez pas assurer le service, vous pouvez proposer un autre membre de l\'équipe en remplacement.',
        },
      },
    },
    scorerAdmin: {
      title: 'Marqueur — Admin',
      description: 'Gérer les attributions de marqueur',
      steps: {
        overview: {
          title: 'Vue d\'ensemble',
          body: 'Voyez tous les matchs nécessitant un marqueur et leur statut d\'attribution.',
        },
        assign: {
          title: 'Attribuer un marqueur',
          body: 'Sélectionnez un joueur pour chaque match. Il est automatiquement notifié.',
        },
        history: {
          title: 'Historique',
          body: 'Suivez qui a assuré combien de services — utile pour une rotation équitable.',
        },
      },
    },
    hallenplanCoach: {
      title: 'Planning salle — Coach',
      description: 'Gérer les créneaux de salle',
      steps: {
        overview: {
          title: 'Planning de salle',
          body: 'Tous les créneaux de salle de vos équipes sont affichés ici — entraînements, matchs et créneaux libres.',
        },
        claim: {
          title: 'Réserver un créneau',
          body: 'Appuyez sur un créneau libre pour le réserver pour votre équipe. La réservation est immédiate.',
        },
        release: {
          title: 'Libérer un créneau',
          body: 'Si vous n\'avez plus besoin d\'un créneau, libérez-le pour que d\'autres équipes puissent l\'utiliser.',
        },
        conflict: {
          title: 'Conflits',
          body: 'Les créneaux qui se chevauchent sont mis en évidence. Contactez l\'admin pour résoudre les conflits.',
        },
      },
    },
  },
} as const
