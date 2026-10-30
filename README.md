# FC Momo Foot

Appli de téléphone du complexe de foot à 6 Momo Foot : vitrine du terrain, planning et réservation avec acompte Wave, défis entre équipes, annonces « il manque des joueurs », disponibilités des joueurs seuls avec prévision de match, profils et classement, espace gérant (vue du jour, encaissement et reçus, réservations par téléphone, score des matchs, statistiques, personnel, export CSV).

Même recette que Racine School : appli HTML/JS installable, publiée sur GitHub Pages depuis `docs/`.

En ligne : https://kanelimamou-blip.github.io/momo-foot/

## Fichiers

- `docs/config.js` : tout ce qui change d'un complexe à l'autre (nom, terrains, horaires, tarifs, acompte, numéros Wave et WhatsApp, clés d'entrée, photos). C'est le seul fichier à adapter pour revendre l'appli.
- `docs/app.js` : l'appli. Sans `FIREBASE_CONFIG`, les données restent sur le téléphone et l'appli démarre avec des données de démo.
- `docs/app.css`, `docs/index.html`, `docs/manifest.webmanifest`, `docs/sw.js` (hors connexion).

## Clés de démo

Gérant : `DIR-DEMO`. Personnel : `PERS-DEMO`.

## À venir

Firebase (planning partagé en temps réel entre tous les téléphones), vraies photos et logo, rappels WhatsApp la veille, tournois.
