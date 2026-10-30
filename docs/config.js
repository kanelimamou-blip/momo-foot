// Tout ce qui change d'un complexe à l'autre est ici : c'est ce fichier qu'on adapte pour revendre l'appli.
// Les valeurs ci-dessous sont des valeurs de démo, à remplacer par les vraies infos de Momo Foot.
window.MOMO_CONFIG = {
  nom: "FC Momo Foot",
  nomCourt: "Momo Foot",
  urlAppli: "https://kanelimamou-blip.github.io/momo-foot/", // lien partagé sur WhatsApp et dans le QR code
  slogan: "Le foot à 6 du quartier, sous les projecteurs.",
  adresse: "Adresse du complexe à compléter",
  telephone: "77 000 00 00",
  whatsapp: "221770000000", // format international sans le +, pour les liens wa.me
  wave: "77 000 00 00",
  reseaux: { instagram: "", tiktok: "", facebook: "" },

  terrains: ["Terrain 1", "Terrain 2"],
  ouverture: 10, // première heure réservable
  fermeture: 24, // le dernier créneau commence à fermeture - 1
  dureeCreneau: 60, // minutes
  joueursParEquipe: 6,

  tarifs: {
    creuse: 15000, // avant heurePleine, du lundi au vendredi
    pleine: 25000, // à partir de heurePleine et tout le week-end
    heurePleine: 18,
    devise: "F CFA",
  },
  acompte: 5000,

  // « Je veux jouer » : des créneaux ouverts aux joueurs sans équipe, payés par personne.
  // Le match est confirmé dès minJoueurs inscrits ; sinon il est annulé et remboursé annulationSessionHeures avant.
  sessions: {
    prixJoueur: 2000,
    prixAbonne: 1500,
    abonnementMois: 5000,
    minJoueurs: 12,
    maxJoueurs: 14, // 2 remplaçants
    annulationSessionHeures: 3,
    // Sessions ouvertes automatiquement chaque semaine (0 = dimanche) ; le gérant peut en ouvrir d'autres.
    auto: [
      { jours: [1, 2, 3, 4, 5], heure: 18, terrain: 1 },
      { jours: [6, 0], heure: 16, terrain: 1 },
      { jours: [3, 5], heure: 22, terrain: 0 },
    ],
  },
  attenteAcompteMinutes: 15,
  annulationGratuiteHeures: 24,

  // Clés d'entrée des profils réservés (en production, seules des empreintes seront publiées, comme dans Racine School).
  cles: { gerant: "DIR-DEMO", personnel: "PERS-DEMO" },

  // Photos du terrain : chemins vers docs/photos/... ; vide = cases de démo.
  photos: [],

  // Projet Firebase de Momo Foot (configuration publique : la sécurité vient des règles Firestore). null = sans comptes.
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyDWrRmFUZQd4hNPQ9vPVJ3gvBRobGZwoAg",
    authDomain: "momo-b0cb2.firebaseapp.com",
    projectId: "momo-b0cb2",
    storageBucket: "momo-b0cb2.firebasestorage.app",
    messagingSenderId: "149658617883",
    appId: "1:149658617883:web:df118ffa3dad7a85cb90be",
  },
  // Identifiants Firebase des admins de l'appli (le propriétaire qui la vend) : eux seuls ouvrent #admin.
  // Les mêmes identifiants vont dans la fonction admin() de firestore.rules. Jamais d'e-mail ici.
  // Les quatre écritures du même identifiant (lettre O ou chiffre 0, illisibles sur la capture) : seule la vraie existe.
  admins: ["aHnLVoNHOmfw70vwDdAaVmWPhMT2", "aHnLVoNH0mfw70vwDdAaVmWPhMT2", "aHnLVoNHOmfw7OvwDdAaVmWPhMT2", "aHnLVoNH0mfw7OvwDdAaVmWPhMT2"],
  // Équipe à contacter quand un compte est suspendu
  supportTel: "78 272 19 20",
};
