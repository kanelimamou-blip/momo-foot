"use strict";
// Comptes clients : connexion Google ou e-mail (Firebase Auth), fiche de chaque compte et journal des erreurs (Firestore).
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

  async function profile() {
    const ref = db.collection("users").doc(user.uid);
    let snap = await ref.get();
    if (!snap.exists) {
      // date d'inscription fixée par le serveur ; un compte neuf est toujours actif
      await ref.set({ name: user.displayName || "", email: user.email || "", created: ts(), lastSeen: ts(), active: true, role: "joueur", poste: "" });
      snap = await ref.get();
    } else if (snap.data().active !== false) {
      // dernière activité : au plus une écriture par heure et par téléphone
      const last = snap.data().lastSeen;
      if (!last || Date.now() - last.toMillis() > 36e5) await ref.update({ lastSeen: ts() }).catch((e) => logError("refus", e.message, "connexion"));
    }
    doc = snap.data();
    return { uid: user.uid, name: doc.name || user.displayName || "", email: user.email || "", active: doc.active !== false, role: doc.role || "joueur", poste: doc.poste || "" };
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

  // Le client ne peut changer que son nom, son rôle et son poste ; jamais son statut actif
  function saveProfile(p) {
    if (!user || !db) return Promise.resolve();
    return db.collection("users").doc(user.uid).update({ name: p.name, role: p.role, poste: p.poste, lastSeen: ts() })
      .catch((e) => { logError("refus", e.message, "profil"); throw e; });
  }

  /* ---------- Journal des erreurs ---------- */
  // Au plus 20 erreurs par visite, sans répéter la même, pour ne pas remplir le quota gratuit.
  const seen = new Set();
  function logError(kind, message, page) {
    if (!db) return;
    const msg = String(message || "").slice(0, 500), key = kind + msg;
    if (seen.has(key) || seen.size >= 20) return;
    seen.add(key);
    db.collection("errors").add({
      kind, message: msg, page: String(page || location.hash.slice(1) || "accueil").slice(0, 60),
      uid: user ? user.uid : null, name: (doc && doc.name) || (user && user.displayName) || "",
      ua: navigator.userAgent.slice(0, 200), at: ts(),
    }).catch(() => {});
  }
  window.addEventListener("error", (e) => logError("plantage", `${e.message} (${(e.filename || "").split("/").pop()}:${e.lineno})`));
  window.addEventListener("unhandledrejection", (e) => logError("plantage", (e.reason && (e.reason.message || e.reason)) || "promesse rejetée"));

  /* ---------- Espace propriétaire ---------- */
  const isOwner = () => !!(user && C.PROPRIETAIRE_UID && user.uid === C.PROPRIETAIRE_UID);
  const admin = {
    users: () => db.collection("users").orderBy("created", "desc").limit(500).get().then((s) => s.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    errors: () => db.collection("errors").orderBy("at", "desc").limit(100).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    setActive: (uid, active) => db.collection("users").doc(uid).update({ active }),
    deleteError: (id) => db.collection("errors").doc(id).delete(),
  };

  return { enabled, emu, start, signIn, signInEmail, resetPassword, signOut, saveProfile, logError, isOwner, admin, get user() { return user; }, get ready() { return ready; } };
})();
