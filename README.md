# FC Momo Foot

Appli de téléphone du complexe de foot à 6 Momo Foot : vitrine du terrain, planning et réservation avec acompte Wave, défis entre équipes, annonces « il manque des joueurs », disponibilités des joueurs seuls avec prévision de match, profils et classement, espace gérant (vue du jour, encaissement et reçus, réservations par téléphone, score des matchs, statistiques, personnel, export CSV).

Même recette que Racine School : appli HTML/JS installable, publiée sur GitHub Pages depuis `docs/`.

En ligne : https://kanelimamou-blip.github.io/momo-foot/

## Fichiers

- `docs/config.js` : tout ce qui change d'un complexe à l'autre (nom, terrains, horaires, tarifs, acompte, numéros Wave et WhatsApp, clés d'entrée, photos). C'est le seul fichier à adapter pour revendre l'appli.
- `docs/app.js` : l'appli. Sans `FIREBASE_CONFIG`, les données restent sur le téléphone et l'appli démarre avec des données de démo.
- `docs/app.css`, `docs/index.html`, `docs/manifest.webmanifest`, `docs/sw.js` (hors connexion).

## Comptes et espace admin

`docs/compte.js` : connexion Google ou e-mail (Firebase Auth) et fiche de chaque compte dans Firestore (`users/{uid}` : nom, téléphone, quartier, rôle, date d'inscription et dernière activité fixées par le serveur, nombre d'actions par jour sur 14 jours, actif ou suspendu). Les plantages et les écritures refusées partent dans `erreurs` (message, écran, compte, rôle, téléphone ; 5 au plus par visite). Tant que `FIREBASE_CONFIG` est vide dans `docs/config.js`, l'appli marche sans compte.

`#admin` est réservé aux identifiants de la liste `admins` de `docs/config.js` (et de la fonction `admin()` de `firestore.rules`). Non connecté, la page propose la connexion ; connecté sans être admin, elle affiche l'identifiant à copier. L'admin y voit les clients avec leur état (Actif, Nouveau, Inactif, Suspendu), une recherche et des filtres, les chiffres (inscrits, actifs cette semaine, inactifs, erreurs des 7 jours), les erreurs à effacer, et pour chaque client les boutons Suspendre/Réactiver, WhatsApp et Voir (l'appli avec le rôle du client, en lecture seule). Le mode présentation charge des données d'exemple et une barre en haut pour passer de joueur à capitaine, personnel ou gérant. Un client suspendu voit « suspendu, contactez l'équipe au 78 272 19 20 » et les règles lui refusent toute écriture, y compris lever sa suspension.

Pas de paiement de licence dans l'appli ni de blocage automatique : le propriétaire encaisse les abonnements lui-même. Les paiements Wave des joueurs (acomptes, places en session, abonnement joueur) sont ceux du complexe et ne bloquent rien.

Tests (émulateurs Firebase) : `npm run test:regles` (34 cas sur les règles) et `tests/e2e.cjs` (22 vérifications de bout en bout : connexion admin, liste, erreur remontée, suspension, client qui ne lit pas les erreurs et ne se réactive pas, vue d'un client en lecture seule, passage d'un rôle à l'autre en présentation).

## Clés de démo

Gérant : `DIR-DEMO`. Personnel : `PERS-DEMO`.

## À venir

Planning et sessions partagés en temps réel entre tous les téléphones (Firestore), vraies photos et logo, rappels WhatsApp la veille, tournois.
