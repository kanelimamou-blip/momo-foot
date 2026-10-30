# FC Momo Foot

Appli de téléphone du complexe de foot à 6 Momo Foot : vitrine du terrain, planning et réservation avec acompte Wave, défis entre équipes, annonces « il manque des joueurs », disponibilités des joueurs seuls avec prévision de match, profils et classement, espace gérant (vue du jour, encaissement et reçus, réservations par téléphone, score des matchs, statistiques, personnel, export CSV).

Même recette que Racine School : appli HTML/JS installable, publiée sur GitHub Pages depuis `docs/`.

En ligne : https://kanelimamou-blip.github.io/momo-foot/

## Fichiers

- `docs/config.js` : tout ce qui change d'un complexe à l'autre (nom, terrains, horaires, tarifs, acompte, numéros Wave et WhatsApp, clés d'entrée, photos). C'est le seul fichier à adapter pour revendre l'appli.
- `docs/app.js` : l'appli. Avec Firebase, tout est en ligne et partagé en temps réel entre les téléphones ; sans `FIREBASE_CONFIG`, les données restent sur le téléphone. Plus de données de démo : l'appli démarre vide.
- `docs/app.css`, `docs/index.html`, `docs/manifest.webmanifest`, `docs/sw.js` (hors connexion).

## Données en ligne (Firestore)

- `creneaux/{date_heure_terrain}` : réservations, défis et sessions « Je veux jouer ». Un document par créneau, donc deux téléphones ne prennent jamais le même. Un joueur réserve « en attente d'acompte » ; le gérant valide l'acompte. Après 15 min sans acompte, le créneau se libère. Les sessions automatiques de la semaine (`config.sessions.auto`) s'affichent seules et se créent à la première inscription ; chaque joueur n'ajoute ou ne retire que sa propre ligne, et seul le personnel coche « payé ».
- `equipes`, `resultats` (scores publiés par le personnel, qui met à jour le classement), `annonces` (« il manque des joueurs »), `dispos/{uid}`.
- Réservé au personnel : `caisse` (reçus numérotés, jamais effacés, numéro suivi dans `meta/caisse`), `personnel`, `contacts` (téléphone de la réservation), `abonnes/{uid}` (le joueur signale son paiement Wave, le gérant active 30 jours).
- `reglages/tarifs` : prix modifiables dans l'onglet Réglages (créneaux, heure pleine, acompte, places de session, abonnement, nombre de joueurs). `config.js` ne donne que les prix de départ.
- `reglages/roles` : les rôles du complexe, libres. Chaque rôle a un nom, un niveau (1 à 99) et des droits : Planning, Caisse, Scores, Abonnements, Horaires, Prix, Membres. Rôles de départ : Gérant (80), Caissier (50), Personnel (30).

## Propriétaire et rôles

L'admin de l'appli (celui qui la vend) donne le rôle **Propriétaire** (niveau 100, tous les droits) au responsable du complexe, depuis `#admin`. Le propriétaire crée ensuite ses rôles dans Réglages et les donne aux comptes de son équipe (section Membres). Un membre avec le droit Membres ne donne que des rôles sous son propre niveau, à des comptes sous son niveau ; personne d'autre que l'admin ne nomme un propriétaire. L'admin peut garder pour lui le rôle Joueur.

Le planning s'ouvre sur un calendrier en carreaux (un mois, jusqu'à 120 jours à l'avance), chaque jour coloré selon son remplissage, avec les recettes prévues du mois pour les rôles qui ont la Caisse.

## Comptes et espace admin

`docs/compte.js` : connexion Google ou e-mail (Firebase Auth) et fiche de chaque compte dans Firestore (`users/{uid}` : nom, téléphone, quartier, rôle, date d'inscription et dernière activité fixées par le serveur, nombre d'actions par jour sur 14 jours, actif ou suspendu). Les plantages et les écritures refusées partent dans `erreurs` (message, écran, compte, rôle, téléphone ; 5 au plus par visite). Tant que `FIREBASE_CONFIG` est vide dans `docs/config.js`, l'appli marche sans compte.

`#admin` est réservé aux identifiants de la liste `admins` de `docs/config.js` (et de la fonction `admin()` de `firestore.rules`). Non connecté, la page propose la connexion ; connecté sans être admin, elle affiche l'identifiant à copier. L'admin y voit les clients avec leur état (Actif, Nouveau, Inactif, Suspendu), une recherche et des filtres, les chiffres (inscrits, actifs cette semaine, inactifs, erreurs des 7 jours), les erreurs à effacer, et pour chaque client les boutons Suspendre/Réactiver, WhatsApp et Voir (l'appli avec le rôle du client, en lecture seule). Le mode présentation charge des données d'exemple et une barre en haut pour passer de joueur à capitaine, personnel ou gérant. Un client suspendu voit « suspendu, contactez l'équipe au 78 272 19 20 » et les règles lui refusent toute écriture, y compris lever sa suspension.

Pas de paiement de licence dans l'appli ni de blocage automatique : le propriétaire encaisse les abonnements lui-même. Les paiements Wave des joueurs (acomptes, places en session, abonnement joueur) sont ceux du complexe et ne bloquent rien.

Tests (émulateurs Firebase) : `npm run test:regles` (126 cas sur les règles) et `tests/e2e.cjs` (35 vérifications de bout en bout sur deux téléphones : réservation vue en direct, inscription à une session, propriétaire nommé par l'admin, prix changé et vu en direct, rôle créé et donné à un membre, acompte validé, connexion admin, liste, erreur remontée, suspension, vue d'un client en lecture seule, présentation).

## Sans Firebase

Clés d'entrée du gérant et du personnel dans `config.cles`.

## À venir

Vraies photos et logo, rappels WhatsApp la veille, tournois.
