"use strict";
// Comptes clients : connexion Google ou e-mail (Firebase Auth), fiche de chaque compte et erreurs remontées (Firestore).
// users/{uid}   nom, e-mail, téléphone, quartier, rôle, poste, inscription et dernière activité (heure du serveur),
//               activite (nombre d'actions par jour, 14 derniers jours), active (false = suspendu par l'admin)
// erreurs/{id}  plantages et écritures refusées : message, écran, compte, rôle, téléphone (lues par l'admin seulement)
// Sans FIREBASE_CONFIG dans config.js, l'appli garde le fonctionnement local (Compte.enabled = false).
// La configuration Firebase n'est pas secrète : la sécurité vient des règles Firestore (firestore.rules).
const Compte = (() => {
  const C = window.MOMO_CONFIG;
  const SDK = C.FIREBASE_SDK || "https://www.gstatic.com/firebasejs/10.12.2/"; // FIREBASE_SDK : copie locale pour les tests
  const enabled = !!C.FIREBASE_CONFIG;
  // ?emu=1 sur la machine de test : on parle aux émulateurs Firebase au lieu du vrai projet
  const emu = /[?&]emu=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  let auth = null, db = null, user = null, doc = null, ready = false;
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ROLES = ["joueur", "capitaine", "personnel", "gerant"];

  const load = (src) => new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });

  // Résout avec la fiche du compte ou null si personne n'est connecté
  async function start() {
    if (!enabled) return null;
    await load(SDK + "firebase-app-compat.js");
    await Promise.all([load(SDK + "firebase-auth-compat.js"), load(SDK + "firebase-firestore-compat.js")]);
    firebase.initializeApp(C.FIREBASE_CONFIG);
    auth = firebase.auth(); db = firebase.firestore();
    if (emu) { auth.useEmulator("http://127.0.0.1:9099"); db.useEmulator("127.0.0.1", 8080); }
    await auth.getRedirectResult().catch(() => null);
    user = await new Promise((ok) => { const off = auth.onAuthStateChanged((u) => { off(); ok(u); }); });
    ready = true;
    return user ? profile() : null;
  }

  const shape = (uid, d) => ({ uid, name: d.name || "", email: d.email || "", tel: d.tel || "", quartier: d.quartier || "", role: d.role || "joueur", poste: d.poste || "",
    active: d.active !== false, created: d.created && d.created.toDate ? d.created.toDate() : null, lastSeen: d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate() : null, activite: d.activite || {} });

  async function profile() {
    const ref = db.collection("users").doc(user.uid);
    let snap = await ref.get();
    if (!snap.exists) {
      // date d'inscription fixée par le serveur ; un compte neuf est toujours actif
      await ref.set({ name: user.displayName || "", email: user.email || "", tel: "", quartier: "", created: ts(), lastSeen: ts(), active: true, role: "joueur", poste: "", activite: {} });
      snap = await ref.get();
    } else if (snap.data().active !== false) {
      // dernière activité : au plus une écriture par heure et par téléphone
      const last = snap.data().lastSeen;
      if (!last || Date.now() - last.toMillis() > 36e5) await ref.update({ lastSeen: ts() }).catch((e) => logError("refus", e.message, "connexion"));
    }
    doc = snap.data();
    return shape(user.uid, doc);
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(provider); }
    catch (e) {
      if (/popup|operation-not-supported/.test(e.code || "")) return auth.signInWithRedirect(provider);
      throw e;
    }
    user = auth.currentUser;
    return profile();
  }

  // Connexion par e-mail et mot de passe (utile sur iPhone si la fenêtre Google ne s'ouvre pas)
  async function signInEmail(email, pass, create) {
    const r = create ? await auth.createUserWithEmailAndPassword(email, pass) : await auth.signInWithEmailAndPassword(email, pass);
    user = r.user;
    return profile();
  }
  const resetPassword = (email) => auth.sendPasswordResetEmail(email);
  async function signOut() { if (auth) await auth.signOut(); user = null; doc = null; }

  // Le client change son nom, son téléphone, son quartier, son rôle et son poste ; jamais son statut ni sa date d'inscription
  function saveProfile(p) {
    if (!user || !db) return Promise.resolve();
    const data = { name: p.name, tel: p.tel || "", quartier: p.quartier || "", role: ROLES.includes(p.role) ? p.role : "joueur", poste: p.poste || "", lastSeen: ts() };
    return db.collection("users").doc(user.uid).update(data)
      .then(() => { Object.assign(doc, data); }, (e) => { logError("refus", e.message, "profil"); throw e; });
  }

  // Activité : une action comptée (réservation, inscription à une session, défi...) ; on garde les 14 derniers jours
  let actTimer = null;
  function track() {
    if (!user || !db || !doc || doc.active === false) return;
    const k = dayKey(), lim = dayKey(new Date(Date.now() - 13 * 864e5));
    const act = Object.fromEntries(Object.entries(doc.activite || {}).filter(([d]) => d >= lim));
    act[k] = (act[k] || 0) + 1;
    doc.activite = act;
    clearTimeout(actTimer);
    actTimer = setTimeout(() => db.collection("users").doc(user.uid).update({ activite: doc.activite, lastSeen: ts() }).catch((e) => logError("refus", e.message)), 1500);
  }

  /* ---------- Erreurs remontées ---------- */
  // Au plus 5 par visite, sans répéter la même, pour ne pas remplir le quota gratuit.
  const seen = new Set();
  let roleNow = () => (doc && doc.role) || "visiteur";
  function logError(kind, message, route) {
    if (!db || !user) return;
    const msg = String(message || "").slice(0, 500), key = kind + msg;
    if (seen.has(key) || seen.size >= 5) return;
    seen.add(key);
    db.collection("erreurs").add({
      kind, msg, route: String(route || location.hash.slice(1) || "accueil").slice(0, 60),
      uid: user.uid, name: String((doc && doc.name) || user.displayName || "").slice(0, 80), role: String(roleNow()).slice(0, 20),
      ua: navigator.userAgent.slice(0, 200), at: ts(),
    }).catch(() => {});
  }
  window.addEventListener("error", (e) => logError("plantage", `${e.message} (${(e.filename || "").split("/").pop()}:${e.lineno})`));
  window.addEventListener("unhandledrejection", (e) => logError("plantage", (e.reason && (e.reason.message || e.reason)) || "promesse rejetée"));

  /* ---------- Espace admin ---------- */
  const isAdmin = () => !!(user && (C.admins || []).includes(user.uid));
  const admin = {
    users: () => db.collection("users").orderBy("created", "desc").limit(500).get().then((s) => s.docs.map((d) => shape(d.id, d.data()))),
    user: (uid) => db.collection("users").doc(uid).get().then((d) => (d.exists ? shape(d.id, d.data()) : null)),
    errors: (sinceMs) => db.collection("erreurs").where("at", ">=", new Date(sinceMs)).orderBy("at", "desc").limit(100).get()
      .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().at && d.data().at.toDate ? d.data().at.toDate() : null }))),
    setActive: (uid, active) => db.collection("users").doc(uid).update({ active }),
    deleteError: (id) => db.collection("erreurs").doc(id).delete(),
  };

  return { enabled, emu, start, signIn, signInEmail, resetPassword, signOut, saveProfile, track, logError, isAdmin, admin, setRole(fn) { roleNow = fn; },
    get user() { return user; }, get ready() { return ready; } };
})();
