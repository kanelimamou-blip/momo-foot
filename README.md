# FC Momo Foot

Appli de téléphone du complexe de foot à 6 Momo Foot : vitrine du terrain, planning et réservation avec acompte Wave, défis entre équipes, annonces « il manque des joueurs », disponibilités des joueurs seuls avec prévision de match, profils et classement, espace gérant (vue du jour, encaissement et reçus, réservations par téléphone, score des matchs, statistiques, personnel, export CSV).

Même recette que Racine School : appli HTML/JS installable, publiée sur GitHub Pages depuis `docs/`.

En ligne : https://kanelimamou-blip.github.io/momo-foot/

## Fichiers

- `docs/config.js` : tout ce qui change d'un complexe à l'autre (nom, terrains, horaires, tarifs, acompte, numéros Wave et WhatsApp, clés d'entrée, photos). C'est le seul fichier à adapter pour revendre l'appli.
- `docs/app.js` : l'appli. Sans `FIREBASE_CONFIG`, les données restent sur le téléphone et l'appli démarre avec des données de démo.
- `docs/app.css`, `docs/index.html`, `docs/manifest.webmanifest`, `docs/sw.js` (hors connexion).

## Comptes et espace propriétaire

`docs/compte.js` : connexion Google ou e-mail (Firebase Auth) et fiche de chaque compte dans Firestore (`users/{uid}` : nom, e-mail, date d'inscription et dernière activité fixées par le serveur, actif ou suspendu). Les plantages et les actions refusées sont écrits dans `errors` (quel compte, quelle page, quand). Tant que `FIREBASE_CONFIG` est vide dans `docs/config.js`, l'appli marche sans compte.

L'onglet Admin (`#admin`) n'apparaît que pour le compte `PROPRIETAIRE_UID` : liste des comptes, chiffres d'utilisation (jour, 7 jours, 30 jours), journal des erreurs et bouton pour suspendre ou réactiver un compte. Un compte suspendu voit seulement un message et ne peut plus écrire. Sans Firebase, `#admin` montre un aperçu avec des comptes fictifs.

`firestore.rules` : règles à coller dans la console Firebase après y avoir mis l'identifiant du propriétaire. `npm run test:regles` les teste sur l'émulateur Firebase (30 cas : un client ne lit que sa fiche, ne change jamais son statut, seul le propriétaire lit les comptes et le journal...).

Pas de paiement de licence dans l'appli : le propriétaire encaisse lui-même. Les paiements Wave des joueurs (acomptes, places en session, abonnement joueur) restent ceux du complexe et ne bloquent rien automatiquement.

## Clés de démo

Gérant : `DIR-DEMO`. Personnel : `PERS-DEMO`.

## À venir

Planning et sessions partagés en temps réel entre tous les téléphones (Firestore), vraies photos et logo, rappels WhatsApp la veille, tournois.
