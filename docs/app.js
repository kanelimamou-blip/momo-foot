// Momo Foot : vitrine, planning et réservation, matchmaking, profils, espace gérant.
// Avec Firebase, les données sont en ligne et partagées en temps réel ; sans FIREBASE_CONFIG, elles restent sur le téléphone.
(function () {
  const C = window.MOMO_CONFIG;
  const KEY = "momo-foot-v3"; // v1 : anciennes données de démo, plus lues
  const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const JOURS_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const POSTES = ["Gardien", "Défenseur", "Milieu", "Attaquant"];
  // « Comment avez-vous connu le complexe ? » : pour savoir quelle action fait venir du monde
  const SOURCES = ["Un ami", "WhatsApp", "Instagram ou TikTok", "Affiche ou QR code", "En passant devant", "Un tournoi", "Autre"];
  const SOIR = [18, 19, 20, 21, 22, 23].filter((h) => h >= C.ouverture && h < C.fermeture);
  const COULEURS = ["#12704A", "#E9601A", "#2C5BD6", "#B8232F", "#7A3FC2", "#C79A00", "#0E8C8C", "#3E4A44"];

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => n.toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pad = (n) => String(n).padStart(2, "0");
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const hh = (h) => `${pad(h % 24)}h`;
  const dayLabel = (k) => {
    const d = fromKey(k), t = dkey(today());
    if (k === t) return "Aujourd'hui";
    if (k === dkey(addDays(today(), 1))) return "Demain";
    if (k === dkey(addDays(today(), -1))) return "Hier";
    return `${JOURS_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  };
  const initials = (n) => String(n || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const hours = () => { const a = []; for (let h = C.ouverture; h < C.fermeture; h++) a.push(h); return a; };
  const isWeekend = (k) => [0, 6].includes(fromKey(k).getDay());
  // Afterwork : le premier créneau du soir en semaine, à son propre prix (0 = pas d'afterwork)
  const isAfterwork = (k, h) => !isWeekend(k) && h === C.ouverture && C.tarifs.afterwork > 0;
  const price = (k, h) => (isAfterwork(k, h) ? C.tarifs.afterwork : isWeekend(k) || h >= C.tarifs.heurePleine ? C.tarifs.pleine : C.tarifs.creuse);
  const isPast = (k, h) => { const d = fromKey(k); d.setHours(h, 0, 0, 0); return d < new Date(); };
  const waLink = (text, num) => `https://wa.me/${num || ""}?text=${encodeURIComponent(text)}`;
  const APP_URL = C.urlAppli || location.href.split("#")[0];
  const inviteText = () => `Rejoins ${C.nom} sur l'appli : réserve ton créneau, ou inscris-toi seul à une session (à ${C.sessions.minJoueurs} joueurs, on joue). Ouvre le lien puis « Ajouter à l'écran d'accueil » pour l'installer : ${APP_URL}`;
  const qrSvg = (text, cell) => { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); };

  /* ---------- Données ---------- */
  // Avec Firebase, tout est en ligne et partagé en temps réel entre les téléphones (Firestore) :
  //   creneaux/{date_heure_terrain}  réservations, défis et sessions « Je veux jouer » (players : { uid: {name, poste, paid, abonne, at} })
  //   equipes, resultats, annonces (« il manque des joueurs », joined : { uid: nom }), dispos/{uid}
  //   réservés au personnel : caisse (reçus), meta/caisse (numéro du prochain reçu), personnel, contacts/{créneau} (téléphone), abonnes/{uid}
  //   reglages/tarifs (prix modifiables) et reglages/roles (rôles du complexe, leur niveau et leurs droits)
  // Sans Firebase, les mêmes données restent sur ce téléphone. Le mode présentation de l'admin a ses propres données d'exemple.
  const COLS = ["creneaux", "equipes", "resultats", "annonces", "dispos", "caisse", "meta", "personnel", "contacts", "abonnes", "reglages"];
  const empty = () => Object.fromEntries(COLS.map((c) => [c, {}]));
  const slotId = (k, h, ti) => `${k}_${h}_${ti}`;
  const sessionBase = (k, h, ti) => ({ date: k, hour: h, terrain: ti, team: "Session joueurs seuls", teamId: "", opponent: "", opponentId: "", type: "session", niveau: "Tous niveaux", status: "confirme", by: "", players: {} });
  const sessionTotal = (b) => b.players.reduce((s, p) => s + (p.abonne ? C.sessions.prixAbonne : C.sessions.prixJoueur), 0);

  function rng(seed) { return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280); }

  // Données d'exemple du mode présentation (jamais enregistrées)
  function seed() {
    const r = rng(42), D = empty();
    const noms = ["Les Lions du Quartier", "Galaxy FC", "Médina Stars", "Team Gorgui", "Les Bleus du Jeudi", "AS Corniche", "Dynamo 221", "Black Panthers"];
    const caps = ["Moussa D.", "Ibrahima S.", "Cheikh N.", "Pape F.", "Alioune B.", "Mamadou K.", "Serigne T.", "Omar G."];
    const teams = noms.map((name, i) => ({ id: "t" + i, name, captain: caps[i], color: COULEURS[i], elo: 1000 + Math.round(r() * 300), w: 0, d: 0, l: 0, gf: 0, ga: 0, by: "x" }));
    teams.forEach((t) => { D.equipes[t.id] = t; });
    const prenoms = ["Abdou", "Bamba", "Lamine", "Khadim", "Saliou", "Assane", "Modou", "Babacar", "Ousmane", "Youssou", "Malick", "Fallou", "Idrissa", "Djibril", "Aliou", "Samba", "Demba", "Habib", "Kader", "Ndiaga", "Souleymane", "Tidiane"];
    const dispos = prenoms.map((p, i) => {
      const slots = [];
      for (let d = 0; d < 7; d++) for (const h of SOIR) if (r() < (d >= 4 ? 0.5 : 0.28) + (h >= 20 && h <= 21 ? 0.25 : 0)) slots.push(`${d}-${h}`);
      return { id: "p" + i, name: `${p} ${String.fromCharCode(65 + (i * 7) % 26)}.`, poste: POSTES[i % 4], slots };
    });
    dispos.forEach((p) => { D.dispos[p.id] = { name: p.name, poste: p.poste, slots: p.slots }; });
    let rec = 1;
    const t0 = today();
    for (let off = -14; off <= 6; off++) {
      const k = dkey(addDays(t0, off));
      for (const h of hours()) C.terrains.forEach((_, ti) => {
        const past = isPast(k, h);
        if (!past && isAutoSlot(k, h, ti)) return;
        const p = h >= 19 && h <= 22 ? 0.8 : h >= 17 ? 0.55 : 0.18;
        if (r() > p + (isWeekend(k) ? 0.15 : 0)) return;
        const a = teams[Math.floor(r() * teams.length)];
        let b = teams[Math.floor(r() * teams.length)];
        if (b === a) b = null;
        const id = slotId(k, h, ti), defi = !past && !b && r() < 0.8;
        D.creneaux[id] = { date: k, hour: h, terrain: ti, team: a.name, teamId: a.id, opponent: b ? b.name : "", opponentId: b ? b.id : "", type: defi ? "defi" : "prive", niveau: ["Détente", "Moyen", "Costaud"][Math.floor(r() * 3)], price: price(k, h), status: past ? "paye" : r() < 0.25 ? "attente" : "confirme", by: "x", createdAt: Date.now() - Math.floor(r() * 6e5) };
        D.contacts[id] = { phone: `77 ${pad(10 + ti * 7)} ${pad(30 + h)} ${pad(40 + off + 14)}`, name: a.captain, by: "x" };
        if (past) {
          D.caisse["r" + rec] = { n: rec, date: k, hour: h, team: a.name, amount: price(k, h), by: r() < 0.5 ? "Wave" : "Espèces" }; rec++;
          if (b) {
            const sa = Math.floor(r() * 8), sb = Math.floor(r() * 8);
            D.resultats[uid()] = { date: k, hour: h, a: a.name, b: b.name, sa, sb, motm: dispos[Math.floor(r() * dispos.length)].name };
            applyResult(teams, a.name, b.name, sa, sb);
          }
        }
      });
    }
    D.meta.caisse = { next: rec };
    Object.entries(D.creneaux).filter(([, b]) => !isPast(b.date, b.hour) && b.type === "prive").slice(0, 5).forEach(([id, b], i) => {
      D.annonces[uid()] = { bookingId: id, team: b.team, date: b.date, hour: b.hour, terrain: b.terrain, missing: 1 + (i % 3), poste: POSTES[(i + 1) % 4], joined: i % 2 ? { [dispos[i].id]: dispos[i].name } : {}, by: "x" };
    });
    [["Ousmane", "Ouverture et entretien", "10h - 17h"], ["Fatou", "Accueil et caisse", "17h - 00h"], ["Ibou", "Arbitre (week-end)", "Sam. et dim. soir"]].forEach(([name, role, shift]) => { D.personnel[uid()] = { name, role, shift }; });
    // Sessions « Je veux jouer » de la semaine, déjà en partie remplies
    for (let off = 0; off < 7; off++) {
      const k = dkey(addDays(t0, off)), dow = fromKey(k).getDay();
      C.sessions.auto.filter((a) => a.jours.includes(dow) && !isPast(k, a.heure)).forEach((a, i) => {
        const n = Math.max(3, Math.min(C.sessions.maxJoueurs, Math.round(11 - off * 1.2 + r() * 3 - (i % 3 === 0 ? 3 : 0))));
        const players = {};
        [...dispos].sort(() => r() - 0.5).slice(0, n).forEach((p, j) => { players[p.id] = { name: p.name, poste: p.poste, paid: r() < 0.7, abonne: r() < 0.3, at: j }; });
        D.creneaux[slotId(k, a.heure, a.terrain)] = { ...sessionBase(k, a.heure, a.terrain), players, createdAt: Date.now() };
      });
    }
    D.abonnes.p3 = { name: dispos[3].name, status: "demande", at: Date.now() - 36e5 };
    D.abonnes.p5 = { name: dispos[5].name, status: "actif", until: Date.now() + 12 * 864e5 };
    return D;
  }

  function isAutoSlot(k, h, ti) {
    const dow = fromKey(k).getDay();
    return C.sessions.auto.some((a) => a.jours.includes(dow) && a.heure === h && a.terrain === ti);
  }

  function applyResult(teams, an, bn, sa, sb) {
    const a = teams.find((t) => t.name === an), b = teams.find((t) => t.name === bn);
    if (!a || !b) return;
    const ea = 1 / (1 + 10 ** ((b.elo - a.elo) / 400)), s = sa > sb ? 1 : sa === sb ? 0.5 : 0;
    a.elo = Math.round(a.elo + 32 * (s - ea)); b.elo = Math.round(b.elo - 32 * (s - ea));
    a.gf += sa; a.ga += sb; b.gf += sb; b.ga += sa;
    if (s === 1) { a.w++; b.l++; } else if (s === 0) { a.l++; b.w++; } else { a.d++; b.d++; }
  }

  // LIVE : copie des données en ligne ; LOCAL : sans Firebase ; DEMO : présentation
  let LIVE = empty(), LOCAL = empty(), DEMO = null, ME = { name: "", poste: "Milieu", role: "joueur", equipe: "" };
  try { const x = JSON.parse(localStorage.getItem(KEY)); if (x && x.v === 3) { LOCAL = { ...empty(), ...x.raw }; ME = { ...ME, ...x.me }; } } catch (e) { /* rien d'enregistré */ }
  const src = () => (mode && mode.type === "demo" ? DEMO : Compte.enabled ? LIVE : LOCAL);
  const live = () => !!(Compte.enabled && account && !mode);
  const myId = () => (mode ? (mode.type === "voir" ? mode.who.uid : "moi") : account ? account.uid : "moi");
  const saveLocal = () => { if (Compte.enabled || mode) return; try { localStorage.setItem(KEY, JSON.stringify({ v: 3, raw: LOCAL, me: ME })); } catch (e) { /* stockage bloqué : on continue en mémoire */ } };

  let S = {};
  // Vue de travail tirée des données : listes triées, sessions automatiques de la semaine, créneaux en attente expirés retirés
  function derive() {
    const R = src(), me = myId(), lim = Date.now() - C.attenteAcompteMinutes * 60000;
    applyTarifs(R.reglages.tarifs);
    const base = mode ? modeMe : account ? { name: account.name, poste: account.poste || "Milieu", role: account.role, equipe: account.equipe || "" } : ME;
    const results = Object.entries(R.resultats).map(([id, x]) => ({ id, ...x }));
    const abo = R.abonnes[me];
    const bookings = Object.entries(R.creneaux).filter(([, b]) => !(b.status === "attente" && b.createdAt < lim)).map(([id, b]) => {
      const players = Object.entries(b.players || {}).map(([u, p]) => ({ uid: u, ...p })).sort((x, y) => (x.at || 0) - (y.at || 0));
      const x = { ...b, id, players, mine: !!b.by && b.by === me, opponentMine: !!b.opBy && b.opBy === me, phone: (R.contacts[id] || {}).phone || "", cname: (R.contacts[id] || {}).name || "" };
      if (b.type === "session") x.price = sessionTotal(x);
      return x;
    });
    // Sessions automatiques des 7 prochains jours : affichées sur les créneaux libres, créées en ligne à la première inscription
    for (let off = 0; off < 7; off++) {
      const k = dkey(addDays(today(), off)), dow = fromKey(k).getDay();
      for (const a of C.sessions.auto) {
        if (!a.jours.includes(dow) || isPast(k, a.heure) || bookings.some((b) => b.date === k && b.hour === a.heure && b.terrain === a.terrain)) continue;
        bookings.push({ ...sessionBase(k, a.heure, a.terrain), id: slotId(k, a.heure, a.terrain), players: [], price: 0, virtual: true, createdAt: Date.now() });
      }
    }
    S = {
      bookings, results,
      teams: Object.entries(R.equipes).map(([id, t]) => ({ id, ...t })),
      needs: Object.entries(R.annonces).map(([id, n]) => ({ id, ...n, joined: Object.values(n.joined || {}), joinedMe: !!(n.joined || {})[me], mine: !!n.by && n.by === me })).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour))),
      dispos: Object.entries(R.dispos).filter(([id]) => id !== me).map(([id, p]) => ({ id, ...p, slots: p.slots || [] })),
      receipts: Object.values(R.caisse).sort((a, b) => a.n - b.n),
      staff: Object.entries(R.personnel).map(([id, p]) => ({ id, ...p })),
      abos: Object.entries(R.abonnes).map(([id, a]) => ({ id, ...a })),
      me: { ...base, teamId: base.equipe || "", slots: (R.dispos[me] || {}).slots || [], abonne: !!(abo && abo.status === "actif" && abo.until > Date.now()), aboDemande: !!(abo && abo.status === "demande"),
        motm: base.name ? results.filter((x) => x.motm === base.name).length : 0 },
    };
    // Les créneaux en attente d'acompte se libèrent tout seuls après le délai (les règles autorisent tout compte à les effacer)
    Object.entries(R.creneaux).filter(([id, b]) => b.status === "attente" && b.createdAt < lim && !expiring.has(id)).forEach(([id]) => {
      expiring.add(id);
      if (live()) Compte.db().collection("creneaux").doc(id).delete().catch(() => {});
      else if (!Compte.enabled || (mode && mode.type === "demo")) delete R.creneaux[id];
    });
  }
  const expiring = new Set();

  // Écritures : en ligne avec Firebase, sinon dans les données locales (ou de présentation)
  const NOW = { now: 1 }, DEL = { del: 1 };
  const fsv = (v) => (v === NOW ? firebase.firestore.FieldValue.serverTimestamp() : v === DEL ? firebase.firestore.FieldValue.delete() : v);
  const lv = (v) => (v === NOW ? Date.now() : v instanceof Date ? v.getTime() : v);
  const fsData = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, fsv(v)]));
  const lData = (d) => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, lv(v)]))));
  function changed() { derive(); saveLocal(); later(); }
  const col = (c) => Compte.db().collection(c);
  // Crée un document neuf, ou le remplace en entier (dispos, abonnement)
  function put(c, id, data) {
    id = id || uid() + uid();
    if (live()) return col(c).doc(id).set(fsData(data)).then(() => id);
    src()[c][id] = lData(data); changed(); return Promise.resolve(id);
  }
  // Met à jour quelques champs ; "players.<uid>" vise une seule entrée, DEL l'efface
  function patch(c, id, data) {
    if (live()) return col(c).doc(id).update(fsData(data));
    const d = src()[c][id] || (src()[c][id] = {});
    Object.entries(data).forEach(([path, v]) => { const ks = path.split("."), last = ks.pop(); let o = d; ks.forEach((k) => { o = o[k] = o[k] || {}; }); if (v === DEL) delete o[last]; else o[last] = lv(v); });
    changed(); return Promise.resolve();
  }
  function drop(c, id) {
    if (live()) return col(c).doc(id).delete();
    delete src()[c][id]; changed(); return Promise.resolve();
  }
  // Prend un créneau : refusé s'il vient d'être pris sur un autre téléphone
  const PRIS = () => Object.assign(new Error("Créneau déjà pris"), { code: "pris" });
  function claim(id, data) {
    if (live()) { const ref = col("creneaux").doc(id); return Compte.db().runTransaction(async (tx) => { if ((await tx.get(ref)).exists) throw PRIS(); tx.set(ref, fsData(data)); }); }
    if (src().creneaux[id]) return Promise.reject(PRIS());
    return put("creneaux", id, data);
  }
  // Encaissement : numéro de reçu suivi, reçu et créneau payé, en une seule fois
  function cashOp(b, by) {
    const rcpt = { date: b.date, hour: b.hour, team: b.team, amount: b.price, by };
    if (live()) {
      const meta = col("meta").doc("caisse"), out = col("caisse").doc();
      let n = 1;
      return Compte.db().runTransaction(async (tx) => {
        const m = await tx.get(meta); n = (m.exists && m.data().next) || 1;
        tx.set(meta, { next: n + 1 }); tx.set(out, { ...rcpt, n, at: fsv(NOW), staff: account.uid });
        tx.update(col("creneaux").doc(b.id), { status: "paye" });
      }).then(() => n);
    }
    const R = src(), n = (R.meta.caisse && R.meta.caisse.next) || 1;
    R.meta.caisse = { next: n + 1 }; R.caisse[uid()] = { ...rcpt, n, at: Date.now() }; R.creneaux[b.id].status = "paye";
    changed(); return Promise.resolve(n);
  }
  // Refus d'une écriture : message clair, et l'erreur part dans le journal de l'admin
  const fail = (what) => (e) => { toast(e && e.code === "pris" ? "Ce créneau vient d'être pris. Choisissez-en un autre." : "Enregistrement refusé, réessayez"); logRefus(`${what} refusé : ${(e && (e.code || e.message)) || e}`); render(); };

  // Lecture en temps réel : chaque changement fait sur un téléphone arrive sur les autres
  let unsubs = [];
  const plain = (d) => { Object.keys(d).forEach((k) => { if (d[k] && d[k].toMillis) d[k] = d[k].toMillis(); }); return d; };
  function listen() {
    unsubs.forEach((f) => f()); unsubs = [];
    LIVE = empty();
    if (!Compte.enabled || !Compte.ready) return;
    const since = dkey(addDays(today(), -14));
    // quiet : lecture réservée à certains rôles, un refus n'est pas une erreur
    const sub = (c, q, quiet) => unsubs.push(q.onSnapshot((s) => {
      LIVE[c] = Object.fromEntries(s.docs.map((d) => [d.id, plain(d.data({ serverTimestamps: "estimate" }))])); changed();
    }, (e) => { console.warn(c, e.code); if (!quiet) Compte.logError("refus", `Lecture ${c} refusée : ${e.code}`); }));
    const one = (c, id) => unsubs.push(col(c).doc(id).onSnapshot((d) => { LIVE[c] = d.exists ? { [id]: plain(d.data({ serverTimestamps: "estimate" })) } : {}; changed(); }, () => {}));
    sub("creneaux", col("creneaux").where("date", ">=", since));
    sub("equipes", col("equipes"));
    sub("resultats", col("resultats").where("date", ">=", dkey(addDays(today(), -30))));
    sub("annonces", col("annonces").where("date", ">=", dkey(today())));
    sub("reglages", col("reglages"));
    if (!account) return;
    sub("dispos", col("dispos"));
    // Membres du complexe : chacun lit ce que son rôle permet. L'admin lit tout, pour la vue « Voir » d'un membre.
    const adm = Compte.isAdmin();
    if (account.active && (!["joueur", "capitaine"].includes(account.role) || adm)) {
      sub("caisse", col("caisse").where("date", ">=", dkey(addDays(today(), -62))), !adm);
      sub("personnel", col("personnel"), !adm);
      sub("contacts", col("contacts"), !adm);
      sub("abonnes", col("abonnes"), !adm);
    } else one("abonnes", account.uid);
  }
  // Un nouveau rendu groupé, sans effacer ce que l'utilisateur est en train de taper
  let laterT = null;
  function later() {
    clearTimeout(laterT);
    laterT = setTimeout(() => { const a = document.activeElement; if (a && a.closest && a.closest("#app") && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return later(); render(); }, 120);
  }

  const myTeam = () => S.teams.find((t) => t.id === S.me.teamId);
  /* ---------- Rôles du complexe ---------- */
  // Le propriétaire (niveau 100, donné par l'admin de l'appli) a tous les droits. Il crée les autres rôles dans les réglages,
  // chacun avec un niveau (1 à 99) et des droits. Un membre ne donne un rôle qu'en dessous de son propre niveau.
  const DROITS = [["planning", "Planning", "valider les acomptes, réservations par téléphone, sessions"], ["caisse", "Caisse", "encaisser, reçus et recettes"],
    ["scores", "Scores", "saisir les scores, classement"], ["abonnements", "Abonnements", "activer les abonnements des joueurs"],
    ["personnel", "Horaires", "tenir la liste de l'équipe et ses horaires"], ["tarifs", "Prix", "changer les prix, l'acompte et les sessions"],
    ["membres", "Membres", "donner les rôles aux comptes, sous son propre niveau"]];
  // Rôles de départ, tant que le propriétaire n'a rien changé (les mêmes sont écrits dans firestore.rules)
  const ROLES_BASE = { gerant: { nom: "Gérant", niveau: 80, droits: ["planning", "caisse", "scores", "abonnements", "personnel", "tarifs", "membres"] },
    caissier: { nom: "Caissier", niveau: 50, droits: ["planning", "caisse", "abonnements"] },
    personnel: { nom: "Personnel", niveau: 30, droits: ["planning", "scores"] } };
  const roles = () => { const r = src().reglages.roles; return (r && r.roles) || ROLES_BASE; };
  const roleName = (r) => (r === "proprietaire" ? "Propriétaire" : r === "joueur" ? "Joueur" : r === "capitaine" ? "Capitaine" : (roles()[r] || {}).nom || "Joueur");
  const niveau = (r) => (r === "proprietaire" ? 100 : roles()[r] ? Math.min(99, roles()[r].niveau || 0) : 0);
  const memberRole = (r) => r === "proprietaire" || !!roles()[r];
  const can = (d, r = S.me.role) => r === "proprietaire" || ((roles()[r] || {}).droits || []).includes(d);
  const isStaff = () => memberRole(S.me.role);
  // Tous les rôles, du plus haut au plus bas
  const allRoles = () => [["proprietaire", "Propriétaire"], ...Object.entries(roles()).sort((a, b) => (b[1].niveau || 0) - (a[1].niveau || 0)).map(([k, v]) => [k, v.nom]), ["capitaine", "Capitaine"], ["joueur", "Joueur"]];

  /* ---------- Prix modifiables ---------- */
  // config.js donne les prix de départ ; le propriétaire (ou un rôle avec le droit Prix) les change dans les réglages
  const TARIFS = [["creuse", "Créneau heures creuses", "F"], ["pleine", "Créneau heures pleines et week-end", "F"], ["heurePleine", "Début des heures pleines", "h"], ["afterwork", "Afterwork : premier créneau en semaine (0 = sans)", "F"], ["acompte", "Acompte pour bloquer un créneau", "F"],
    ["prixJoueur", "Session : place joueur", "F"], ["prixAbonne", "Session : place abonné", "F"], ["abonnementMois", "Abonnement joueur par mois", "F"], ["minJoueurs", "Session : joueurs pour lancer le match", ""], ["maxJoueurs", "Session : joueurs au plus", ""]];
  const BASE_T = { creuse: C.tarifs.creuse, pleine: C.tarifs.pleine, heurePleine: C.tarifs.heurePleine, afterwork: C.tarifs.afterwork || 0, acompte: C.acompte, prixJoueur: C.sessions.prixJoueur, prixAbonne: C.sessions.prixAbonne,
    abonnementMois: C.sessions.abonnementMois, minJoueurs: C.sessions.minJoueurs, maxJoueurs: C.sessions.maxJoueurs };
  function applyTarifs(t) {
    const x = { ...BASE_T, ...(t || {}) };
    Object.assign(C.tarifs, { creuse: x.creuse, pleine: x.pleine, heurePleine: x.heurePleine, afterwork: x.afterwork || 0 });
    C.acompte = x.acompte;
    Object.assign(C.sessions, { prixJoueur: x.prixJoueur, prixAbonne: x.prixAbonne, abonnementMois: x.abonnementMois, minJoueurs: x.minJoueurs, maxJoueurs: x.maxJoueurs });
  }
  const tarifs = () => Object.fromEntries(TARIFS.map(([k]) => [k, { ...BASE_T, ...(src().reglages.tarifs || {}) }[k]]));
  const level = (elo) => (elo >= 1200 ? "Costaud" : elo >= 1080 ? "Moyen" : "Détente");
  const standings = () => [...S.teams].sort((a, b) => b.elo - a.elo);
  // Change le profil : en ligne pour un compte, sinon sur ce téléphone
  function setMe(p) {
    if (mode) { Object.assign(modeMe, p); changed(); return Promise.resolve(); }
    if (account) { Object.assign(account, p); changed(); return Compte.saveProfile(account); }
    Object.assign(ME, p); changed(); return Promise.resolve();
  }
  // Nouvelle équipe, ou celle qui porte déjà ce nom
  async function teamFor(name) {
    const t = S.teams.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (t) return t;
    const d = { name, captain: S.me.name || "Capitaine", color: COULEURS[S.teams.length % COULEURS.length], elo: 1050, w: 0, d: 0, l: 0, gf: 0, ga: 0, by: myId() };
    return { id: await put("equipes", null, d), ...d };
  }

  /* ---------- Interface commune ---------- */
  const ICONS = {
    accueil: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    planning: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    matchs: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 5h-5L8 10z"/><path d="M12 3v4M21 10l-5 0M3 10h5M15 15l3 5M9 15l-3 5"/>',
    profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    gerant: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    admin: '<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9.5 4.6-1.2 8-4.5 8-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
  const PITCH = '<svg class="pitch" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#fff" stroke-width="2.5"><rect x="12" y="12" width="376" height="236" rx="6"/><path d="M200 12v236"/><circle cx="200" cy="130" r="38"/><circle cx="200" cy="130" r="3" fill="#fff"/><path d="M12 80h50v100H12M388 80h-50v100h50"/><path d="M12 108h-8v44h8M388 108h8v44h-8"/></svg>';
  const crest = () => `<svg class="crest" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 36 8v12c0 9-7 15-16 18C11 35 4 29 4 20V8z" fill="#E9601A"/><path d="M20 6 32 10.5V20c0 7-5.5 11.8-12 14.2C13.5 31.8 8 27 8 20v-9.5z" fill="#0B3F2A"/><text x="20" y="25" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="13" fill="#F4FFF8">MF</text></svg>`;

  function toast(msg) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function sheet(html, onMount) {
    closeSheet();
    const s = document.createElement("div");
    s.className = "scrim"; s.id = "scrim";
    s.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    s.addEventListener("click", (e) => { if (e.target === s || e.target.closest("[data-close]")) closeSheet(); });
    document.body.appendChild(s);
    onMount && onMount(s.querySelector(".sheet"));
    const f = s.querySelector("input, select, button.btn");
    f && f.focus({ preventScroll: true });
  }
  function closeSheet() { const s = $("#scrim"); s && s.remove(); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  const head = (title, sub) => `<div class="sheet-head"><div><h2>${title}</h2>${sub ? `<p class="muted small">${sub}</p>` : ""}</div><button class="x" data-close aria-label="Fermer">×</button></div>`;

  function copy(text, done) {
    const ok = () => toast(done || "Copié");
    try { navigator.clipboard.writeText(text).then(ok, () => toast("Sélectionnez le texte pour le copier")); } catch (e) { toast("Sélectionnez le texte pour le copier"); }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (b) copy(b.dataset.copy, b.dataset.done);
  });

  /* ---------- Vitrine ---------- */
  function viewAccueil() {
    const k = dkey(today());
    const nowH = new Date().getHours();
    const libresCeSoir = SOIR.filter((h) => h > nowH).reduce((n, h) => n + C.terrains.filter((_, ti) => !findBk(k, h, ti)).length, 0);
    const defis = openDefis().slice(0, 3);
    const res = [...S.results].sort((a, b) => (b.date + pad(b.hour)).localeCompare(a.date + pad(a.hour))).slice(0, 3);
    const matchsMois = S.results.length;
    const sess = openSessions();
    const inscrits = sess.reduce((n, b) => n + b.players.length, 0);
    const photos = C.photos.length ? C.photos : ["Le terrain sous les projecteurs", "Les vestiaires", "La tribune", "Soirée tournoi", "Le parking"];
    return `
    <div class="hero"><div class="wrap">
      ${PITCH}
      <span class="tonight"><i></i>${libresCeSoir ? `Ce soir : ${libresCeSoir} créneau${libresCeSoir > 1 ? "x" : ""} libre${libresCeSoir > 1 ? "s" : ""}` : "Ce soir : complet, essayez demain"}</span>
      <h1>${esc(C.nomCourt.split(" ")[0])} <em>${esc(C.nomCourt.split(" ").slice(1).join(" ") || "Foot")}</em></h1>
      <p>${esc(C.slogan)}</p>
      <p><b>Pas d'équipe ?</b> Inscrivez-vous seul à une session : dès ${C.sessions.minJoueurs} joueurs, on joue, pour ${money(C.sessions.prixJoueur)} par personne.</p>
      <div class="row"><a class="btn btn-bib" href="#matchs">Je veux jouer</a><a class="btn btn-line" href="#planning">Réserver le terrain</a></div>
      <div class="scoreline">
        <div><b class="num">${inscrits}</b><span>joueurs inscrits aux sessions</span></div>
        <div><b class="num">${matchsMois}</b><span>matchs ces 2 semaines</span></div>
        <div><b class="num">${C.joueursParEquipe} vs ${C.joueursParEquipe}</b><span>en salle fermée</span></div>
      </div>
    </div></div>
    <main class="wrap">
      <section>
        <div class="sec-head"><h2>Sessions ouvertes</h2><a href="#matchs">Toutes</a></div>
        <p class="muted small">Venez seul ou à plusieurs, l'appli fait les équipes.</p>
        <div class="list">${sess.filter((b) => b.players.length < C.sessions.maxJoueurs).slice(0, 3).map(sessionCard).join("")}</div>
      </section>
      <section>
        <div class="sec-head"><h2>Défis à relever</h2><a href="#matchs">Tout voir</a></div>
        ${defis.length ? `<div class="list">${defis.map(defiCard).join("")}</div>` : `<div class="empty-state">Aucun défi ouvert pour l'instant. Réservez un créneau et lancez le premier.</div>`}
      </section>
      <section>
        <div class="sec-head"><h2>Derniers matchs</h2></div>
        <div class="list">${res.map(resultCard).join("")}</div>
      </section>
      <section>
        <div class="card share">
          <h3>Invitez vos potes</h3>
          <p class="small">Plus il y a de joueurs dans l'appli, plus les sessions se remplissent vite. Envoyez le lien d'installation à votre groupe WhatsApp.</p>
          <a class="btn btn-wa btn-block" href="${waLink(inviteText())}" target="_blank" rel="noopener">${WA_ICON}Partager sur WhatsApp</a><button class="btn btn-ghost btn-block" data-sharesheet>Afficher le QR code</button>
          ${installEvt ? '<button class="btn btn-turf btn-block" id="installApp">Installer l\'appli sur ce téléphone</button>' : ""}
        </div>
      </section>
      <section>
        <h2>Le terrain</h2>
        <div class="gallery">${photos.slice(0, 5).map((p, i) => `<div class="ph">${C.photos.length ? `<img src="${esc(p)}" alt="Photo du terrain ${i + 1}">` : PITCH.replace('class="pitch"', "")}<span>${C.photos.length ? "" : esc(p)}</span></div>`).join("")}</div>
        ${C.photos.length ? "" : '<p class="muted small">Cases de démo : les vraies photos du complexe se placent dans la configuration.</p>'}
      </section>
      <section>
        <h2>Infos pratiques</h2>
        <div class="facts">
          <div class="fact"><span class="label">Horaires</span><b class="num">${hh(C.ouverture)} - ${hh(C.fermeture)}</b><span class="small muted">7 jours sur 7</span></div>
          <div class="fact"><span class="label">Terrains</span><b>${C.terrains.length} terrain${C.terrains.length > 1 ? "s" : ""}</b><span class="small muted">créneaux de ${C.dureeCreneau} min</span></div>
          <div class="fact" style="grid-column:1/-1"><span class="label">Adresse</span><span>${esc(C.adresse)}</span><span class="small muted">Tél. et WhatsApp : ${esc(C.telephone)}</span></div>
        </div>
        <div class="card">
          <span class="label">Tarifs par créneau</span>
          <table class="tarifs num"><tbody>
            <tr><td>Semaine avant ${hh(C.tarifs.heurePleine)}</td><td>${money(C.tarifs.creuse)}</td></tr>
            <tr><td>Semaine dès ${hh(C.tarifs.heurePleine)}, et week-end</td><td>${money(C.tarifs.pleine)}</td></tr>
            <tr><td>Acompte pour bloquer le créneau (Wave)</td><td>${money(C.acompte)}</td></tr>
          </tbody></table>
          <p class="small muted">Annulation gratuite jusqu'à ${C.annulationGratuiteHeures} h avant le match. En défi, le prix du terrain est partagé entre les deux équipes.</p>
        </div>
      </section>
      <section>
        <div class="sec-head"><h2>Classement</h2><a href="#profil">Mon équipe</a></div>
        ${rankTable(5)}
      </section>
    </main>`;
  }

  function resultCard(r) {
    const txt = `${C.nom} | ${r.a} ${r.sa} - ${r.sb} ${r.b}. Homme du match : ${r.motm}. Réservez votre créneau sur l'appli ${C.nomCourt} !`;
    return `<div class="card">
      <div class="row small muted"><span>${dayLabel(r.date)} · ${hh(r.hour)}</span><span style="margin-left:auto">Homme du match : <b>${esc(r.motm)}</b></span></div>
      <div class="result"><span class="t">${esc(r.a)}</span><span class="s num">${r.sa} - ${r.sb}</span><span class="t">${esc(r.b)}</span></div>
      <div class="row"><a class="btn btn-ghost btn-sm" href="${waLink(txt)}" target="_blank" rel="noopener">Partager sur WhatsApp</a><button class="btn btn-ghost btn-sm" data-copy="${esc(txt)}" data-done="Texte copié, à coller sur Instagram ou TikTok">Copier pour Insta / TikTok</button></div>
    </div>`;
  }

  function rankTable(limit) {
    const rows = standings().slice(0, limit || 99);
    return `<div class="card" style="padding:6px 10px"><table class="rank"><thead><tr><th>#</th><th>Équipe</th><th class="n">J</th><th class="n">V-N-D</th><th class="n">Pts</th></tr></thead><tbody>
      ${rows.map((t, i) => `<tr class="${t.id === S.me.teamId ? "me" : ""}"><td class="num">${i + 1}</td><td><span class="dot" style="background:${t.color}"></span>${esc(t.name)}</td><td class="n">${t.w + t.d + t.l}</td><td class="n">${t.w}-${t.d}-${t.l}</td><td class="n"><b>${t.elo}</b></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  /* ---------- Planning ---------- */
  let planDay = dkey(today());
  const findBk = (k, h, ti) => S.bookings.find((b) => b.date === k && b.hour === h && b.terrain === ti);

  function viewPlanning() {
    const mine = S.bookings.filter((b) => b.mine && !isPast(b.date, b.hour)).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour)));
    return `<main class="wrap">
      <section>
        <h2>Planning</h2>
        ${calendar()}
        <div class="legend"><span><i style="border:1.5px dashed var(--turf)"></i>Libre</span><span><i style="background:var(--sess)"></i>Session joueurs seuls</span><span><i style="background:var(--bib)"></i>Cherche adversaire</span><span><i style="background:var(--warn-bg)"></i>En attente d'acompte</span><span><i style="background:var(--surface-2)"></i>Réservé</span></div>
        <p class="small muted">${dayLabel(planDay)} · ${isWeekend(planDay) ? "tarif week-end toute la journée" : `heures creuses avant ${hh(C.tarifs.heurePleine)}`}</p>
        <div class="grid" style="--cols:${C.terrains.length}">
          <div></div>${C.terrains.map((t) => `<div class="colh">${esc(t)}</div>`).join("")}
          ${hours().map((h) => `<div class="h num">${hh(h)}</div>${C.terrains.map((_, ti) => slotCell(planDay, h, ti)).join("")}`).join("")}
        </div>
      </section>
      <section>
        <h2>Mes réservations</h2>
        ${mine.length ? `<div class="list">${mine.map(myBookingCard).join("")}</div>` : `<div class="empty-state">Vos réservations apparaîtront ici. Touchez un créneau libre pour commencer.</div>`}
      </section>
    </main>`;
  }

  // Calendrier en carreaux : un mois d'un coup, chaque jour coloré selon son remplissage, pour planifier loin
  const HORIZON = 120; // jours réservables à l'avance
  let calMonth = 0; // 0 = mois en cours, 1 = mois suivant...
  const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function calendar() {
    const t = today(), first = new Date(t.getFullYear(), t.getMonth() + calMonth, 1), nDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const last = dkey(addDays(t, HORIZON)), slotsDay = hours().length * C.terrains.length, mk = dkey(first).slice(0, 7);
    const real = S.bookings.filter((b) => !b.virtual && b.date.startsWith(mk));
    const byDay = real.reduce((m, b) => ((m[b.date] = (m[b.date] || 0) + 1), m), {});
    const lead = (first.getDay() + 6) % 7; // semaine du lundi au dimanche
    const cells = [...Array(lead)].map(() => "<span></span>").concat([...Array(nDays)].map((_, i) => {
      const k = dkey(new Date(first.getFullYear(), first.getMonth(), i + 1)), n = byDay[k] || 0, past = k < dkey(t), off = k > last;
      const pct = Math.round((n / slotsDay) * 100);
      return `<button data-day="${k}" aria-pressed="${k === planDay}" ${past || off ? "disabled" : ""} class="${k === dkey(t) ? "today" : ""}" style="--f:${Math.min(100, pct)}%" aria-label="${dayLabel(k)} : ${n} réservé${n > 1 ? "s" : ""}"><b class="num">${i + 1}</b><i>${n ? n : ""}</i></button>`;
    })).join("");
    const booked = real.filter((b) => b.date >= dkey(t)).length, open = [...Array(nDays)].map((_, i) => dkey(new Date(first.getFullYear(), first.getMonth(), i + 1))).filter((k) => k >= dkey(t) && k <= last).length;
    const money0 = real.filter((b) => b.status !== "absent").reduce((x, b) => x + (b.price || 0), 0);
    return `<div class="card cal">
      <div class="row"><button class="iconbtn" data-cal="-1" ${calMonth <= 0 ? "disabled" : ""} aria-label="Mois précédent">‹</button><h3 class="grow" style="text-align:center">${MOIS_LONG[first.getMonth()]} ${first.getFullYear()}</h3><button class="iconbtn" data-cal="1" ${dkey(first) > dkey(addDays(t, HORIZON - 28)) ? "disabled" : ""} aria-label="Mois suivant">›</button></div>
      <div class="cal-grid">${["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((j) => `<span class="cal-h">${j}</span>`).join("")}${cells}</div>
      <p class="small muted">${open ? `À venir ce mois : <b>${booked}</b> créneau${booked > 1 ? "x" : ""} réservé${booked > 1 ? "s" : ""} sur ${open * slotsDay} (${Math.round((booked / (open * slotsDay)) * 100)} %)` : "Mois terminé"}${can("caisse") ? ` · recettes prévues du mois <b class="num">${money(money0)}</b>` : ""}. Plus la case est foncée, plus le jour est plein.</p>
    </div>`;
  }

  function slotCell(k, h, ti) {
    const b = findBk(k, h, ti);
    if (isPast(k, h)) return `<div class="slot taken past"><b>${b ? esc(b.team) : "-"}</b><span>terminé</span></div>`;
    if (!b) return `<button class="slot free" data-book="${k}|${h}|${ti}"><b class="num">${money(price(k, h))}</b><span>Libre</span></button>`;
    const mine = b.mine ? " mine" : "";
    if (b.type === "session") return `<button class="slot sess${b.players.some((p) => p.uid === myId()) ? " mine" : ""}" data-sess="${b.id}"><b>Je veux jouer</b><span class="num">${b.players.length}/${sMin(b)} inscrits</span></button>`;
    if (b.type === "defi" && !b.opponent) return `<button class="slot defi${mine}" data-defi="${b.id}"><b>${esc(b.team)}</b><span>cherche adversaire</span></button>`;
    if (b.status === "attente") return `<div class="slot hold${mine}"><b>${esc(b.team)}</b><span>attente acompte</span></div>`;
    return `<div class="slot taken${mine}"><b>${esc(b.team)}</b><span>${b.opponent ? "vs " + esc(b.opponent) : "match privé"}</span></div>`;
  }

  function myBookingCard(b) {
    const mins = Math.max(0, Math.ceil((b.createdAt + C.attenteAcompteMinutes * 60000 - Date.now()) / 60000));
    const chip = b.status === "attente" ? `<span class="chip chip-warn">Acompte attendu, ${mins} min</span>` : b.status === "paye" ? '<span class="chip chip-ok">Payé</span>' : '<span class="chip chip-ok">Confirmé</span>';
    return `<div class="card">
      <div class="row"><span class="when">${dayLabel(b.date)} · ${hh(b.hour)}</span>${chip}</div>
      <p>${esc(C.terrains[b.terrain])} · ${esc(b.team)} ${b.opponent ? `vs ${esc(b.opponent)}` : b.type === "defi" ? '<span class="chip chip-bib">cherche adversaire</span>' : ""}${b.recurrent ? ' · <span class="chip chip-n">chaque semaine</span>' : ""}</p>
      <div class="row">${b.status === "attente" ? `<button class="btn btn-bib btn-sm" data-pay="${b.id}">Payer l'acompte</button>` : ""}<button class="btn btn-ghost btn-sm" data-cancel="${b.id}">Annuler</button></div>
    </div>`;
  }

  function bookSheet(k, h, ti, presetDefi) {
    const t = myTeam();
    sheet(`${head("Réserver", `${dayLabel(k)} · ${hh(h)} · ${esc(C.terrains[ti])} · ${money(price(k, h))}`)}
      <form id="bookForm" class="list">
        <div class="field"><label for="bTeam">Nom de l'équipe</label><input class="input" id="bTeam" required value="${esc(t ? t.name : "")}" placeholder="Ex. Les Lions du Quartier" list="teamList"><datalist id="teamList">${S.teams.map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist></div>
        <div class="field"><label for="bPhone">Téléphone du capitaine</label><input class="input" id="bPhone" required inputmode="tel" value="${esc(t ? t.phone : "")}" placeholder="77 123 45 67"></div>
        <div class="field"><span class="label">Type de match</span><div class="choices">
          <label class="choice"><input type="radio" name="bType" value="prive" ${presetDefi ? "" : "checked"}><span>On a nos deux équipes</span></label>
          <label class="choice"><input type="radio" name="bType" value="defi" ${presetDefi ? "checked" : ""}><span>On cherche un adversaire</span></label>
        </div></div>
        <div class="field"><span class="label">Niveau de l'équipe</span><div class="choices">${["Détente", "Moyen", "Costaud"].map((n, i) => `<label class="choice"><input type="radio" name="bLvl" value="${n}" ${(t ? level(t.elo) : "Moyen") === n ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></div>
        <button class="btn btn-bib btn-block" type="submit">Bloquer le créneau</button>
        <p class="small muted">Le créneau est gardé ${C.attenteAcompteMinutes} min le temps d'envoyer l'acompte de ${money(C.acompte)} par Wave. Pour un créneau chaque semaine, appelez le complexe.</p>
      </form>`, (el) => {
      el.querySelector("#bookForm").addEventListener("submit", (e) => {
        e.preventDefault();
        if (findBk(k, h, ti)) { toast("Ce créneau vient d'être pris. Choisissez-en un autre."); logRefus("Réservation refusée : créneau déjà pris"); closeSheet(); render(); return; }
        const name = el.querySelector("#bTeam").value.trim(), phone = el.querySelector("#bPhone").value.trim();
        const type = el.querySelector("[name=bType]:checked").value, niveau = el.querySelector("[name=bLvl]:checked").value, id = slotId(k, h, ti);
        const btn = el.querySelector("[type=submit]"); btn.disabled = true;
        (async () => {
          const team = await teamFor(name);
          if (!S.me.teamId) setMe({ equipe: team.id }).catch(() => {});
          const bk = { date: k, hour: h, terrain: ti, price: price(k, h), team: team.name, teamId: team.id, opponent: "", opponentId: "", type, niveau, status: can("planning") ? "confirme" : "attente", by: myId(), createdAt: NOW };
          await claim(id, bk);
          if (phone) put("contacts", id, { phone, name: S.me.name, by: myId() }).catch(fail("Téléphone de la réservation"));
          act(); paySheet({ ...bk, id, createdAt: Date.now() }); render();
        })().catch((e) => { closeSheet(); fail("Réservation")(e); });
      });
    });
  }

  function paySheet(b) {
    if (!b) return;
    const ref = "MF-" + b.id.slice(0, 4).toUpperCase();
    const msg = `Bonjour ${C.nomCourt}, j'ai réservé ${C.terrains[b.terrain]} le ${dayLabel(b.date).toLowerCase()} à ${hh(b.hour)} pour ${b.team}. Acompte de ${money(C.acompte)} envoyé par Wave, référence ${ref}.`;
    sheet(`${head("Créneau bloqué", `${dayLabel(b.date)} · ${hh(b.hour)} · ${esc(C.terrains[b.terrain])}`)}
      <div class="pay">
        <span class="label">Acompte Wave</span>
        <span class="big num">${money(C.acompte)}</span>
        <div class="copybox"><code>${esc(C.wave)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(C.wave)}" data-done="Numéro Wave copié">Copier</button></div>
        <p class="small">Référence à mettre dans le message Wave : <b>${ref}</b>. Reste à payer sur place : <b class="num">${money(b.price - C.acompte)}</b>.</p>
      </div>
      <a class="btn btn-turf btn-block" href="${waLink(msg, C.whatsapp)}" target="_blank" rel="noopener">Prévenir le complexe sur WhatsApp</a>
      <p class="small muted">Dès que le gérant voit votre acompte, la réservation passe en « Confirmé » dans Mes réservations.</p>`);
  }

  function cancelSheet(id) {
    const b = S.bookings.find((x) => x.id === id);
    const d = fromKey(b.date); d.setHours(b.hour);
    const free = (d - Date.now()) / 36e5 >= C.annulationGratuiteHeures;
    sheet(`${head("Annuler la réservation ?", `${dayLabel(b.date)} · ${hh(b.hour)} · ${esc(b.team)}`)}
      <p>${free ? "L'annulation est gratuite : l'acompte vous sera rendu." : `Le match est dans moins de ${C.annulationGratuiteHeures} h : l'acompte de ${money(C.acompte)} est gardé par le complexe.`}</p>
      <div class="row"><button class="btn btn-ghost grow" data-close>Garder</button><button class="btn btn-bib grow" id="doCancel">Annuler le créneau</button></div>`, (el) => {
      el.querySelector("#doCancel").addEventListener("click", () => {
        closeSheet();
        drop("creneaux", id).then(() => {
          toast("Réservation annulée, le créneau est libéré");
          if (b.phone) drop("contacts", id).catch(() => {});
          S.needs.filter((n) => n.bookingId === id && n.mine).forEach((n) => drop("annonces", n.id).catch(() => {}));
        }, fail("Annulation"));
      });
    });
  }

  /* ---------- Matchmaking ---------- */
  let seg = "jouer";
  const openDefis = () => S.bookings.filter((b) => b.type === "defi" && !b.opponent && !isPast(b.date, b.hour)).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour)));

  function defiCard(b) {
    const t = S.teams.find((x) => x.id === b.teamId);
    return `<div class="card">
      <div class="row"><span class="when">${dayLabel(b.date)} · ${hh(b.hour)}</span><span class="chip chip-n" style="margin-left:auto">${esc(C.terrains[b.terrain])}</span></div>
      <div class="versus"><div class="team"><span class="dot" style="background:${t ? t.color : "var(--turf)"}"></span>${esc(b.team)}<div class="small muted">Niveau ${esc(b.niveau)}${t ? ` · ${t.elo} pts` : ""}</div></div><span class="vs">VS</span><div class="empty">Votre équipe ?</div></div>
      <div class="row"><span class="small muted">${money(Math.round(b.price / 2))} par équipe</span><button class="btn btn-bib btn-sm" style="margin-left:auto" data-defi="${b.id}">Relever le défi</button></div>
    </div>`;
  }

  function acceptSheet(id) {
    const b = S.bookings.find((x) => x.id === id), t = myTeam();
    sheet(`${head("Relever le défi", `${esc(b.team)} · ${dayLabel(b.date)} à ${hh(b.hour)}`)}
      <form id="accForm" class="list">
        <div class="field"><label for="aTeam">Votre équipe</label><input class="input" id="aTeam" required value="${esc(t ? t.name : "")}" list="teamList2" placeholder="Nom de l'équipe"><datalist id="teamList2">${S.teams.filter((x) => x.id !== b.teamId).map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist></div>
        <p class="small muted">Chaque équipe paie ${money(Math.round(b.price / 2))}. Le capitaine de ${esc(b.team)} est prévenu sur WhatsApp.</p>
        <button class="btn btn-bib btn-block" type="submit">Confirmer le match</button>
      </form>`, (el) => {
      el.querySelector("#accForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = el.querySelector("#aTeam").value.trim();
        if (name.toLowerCase() === b.team.toLowerCase()) { toast("Choisissez une autre équipe que celle qui lance le défi"); return; }
        closeSheet();
        (async () => {
          const team = await teamFor(name);
          if (!S.me.teamId) setMe({ equipe: team.id }).catch(() => {});
          await patch("creneaux", b.id, { opponent: team.name, opponentId: team.id, opBy: myId() });
          act(); toast(`Match calé : ${b.team} vs ${team.name}`);
        })().catch(fail("Défi"));
      });
    });
  }

  function viewMatchs() {
    const tabs = [["jouer", "Je veux jouer"], ["defis", "Défis"], ["joueurs", "Il manque..."]];
    let body = "";
    if (seg === "jouer") body = jouerBody();
    else if (seg === "defis") {
      const d = openDefis();
      body = `<p class="muted">Des équipes ont réservé un créneau et cherchent un adversaire. Relevez le défi, le prix du terrain est partagé.</p>
        ${d.length ? `<div class="list">${d.map(defiCard).join("")}</div>` : '<div class="empty-state">Aucun défi ouvert.</div>'}
        <a class="btn btn-turf btn-block" href="#planning" id="newDefi">Lancer un défi sur un créneau libre</a>`;
    } else if (seg === "joueurs") {
      const needs = S.needs.filter((n) => !isPast(n.date, n.hour));
      body = `<p class="muted">Une équipe a son créneau mais il lui manque du monde. Proposez-vous.</p>
        ${needs.length ? `<div class="list">${needs.map(needCard).join("")}</div>` : '<div class="empty-state">Aucune équipe ne cherche de joueur pour l\'instant.</div>'}
        <button class="btn btn-turf btn-block" id="newNeed">Il manque des joueurs dans mon équipe</button>`;
    }
    return `<main class="wrap"><section>
      <h2>Jouer</h2>
      <div class="seg" role="group">${tabs.map(([k, l]) => `<button data-seg="${k}" aria-pressed="${seg === k}">${l}</button>`).join("")}</div>
      ${body}
    </section></main>`;
  }

  function needCard(n) {
    const left = n.missing - n.joined.length, me = n.joinedMe;
    return `<div class="card">
      <div class="row"><span class="when">${dayLabel(n.date)} · ${hh(n.hour)}</span>${left > 0 ? `<span class="chip chip-bib" style="margin-left:auto">Il manque ${left}</span>` : '<span class="chip chip-ok" style="margin-left:auto">Complet</span>'}</div>
      <p><b>${esc(n.team)}</b> cherche ${n.missing > 1 ? `${n.missing} joueurs` : "un joueur"}, de préférence ${esc(n.poste.toLowerCase())}.</p>
      <div class="row"><div class="avatars">${n.joined.map((j) => `<i title="${esc(j)}">${initials(j)}</i>`).join("")}${[...Array(Math.max(0, left))].map(() => '<i class="open">+</i>').join("")}</div>
      ${me ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-leave="${n.id}">Je ne viens plus</button>` : left > 0 ? `<button class="btn btn-bib btn-sm" style="margin-left:auto" data-join="${n.id}">Je viens</button>` : ""}</div>
    </div>`;
  }

  function needSheet() {
    const mine = S.bookings.filter((b) => b.mine && !isPast(b.date, b.hour));
    if (!mine.length) { toast("Réservez d'abord un créneau, puis cherchez des joueurs"); location.hash = "planning"; return; }
    sheet(`${head("Chercher des joueurs")}
      <form id="needForm" class="list">
        <div class="field"><label for="nBk">Pour quel match ?</label><select class="input" id="nBk">${mine.map((b) => `<option value="${b.id}">${dayLabel(b.date)} · ${hh(b.hour)} · ${esc(b.team)}</option>`).join("")}</select></div>
        <div class="field"><label for="nMiss">Combien de joueurs manquent ?</label><select class="input" id="nMiss">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select></div>
        <div class="field"><span class="label">Poste recherché</span><div class="choices">${[...POSTES, "Peu importe"].map((p, i) => `<label class="choice"><input type="radio" name="nPoste" value="${p}" ${i === 4 ? "checked" : ""}><span>${p}</span></label>`).join("")}</div></div>
        <button class="btn btn-bib btn-block" type="submit">Publier l'annonce</button>
        <p class="small muted">Les joueurs qui se sont dit disponibles sur ce créneau sont prévenus en premier.</p>
      </form>`, (el) => {
      el.querySelector("#needForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const b = S.bookings.find((x) => x.id === el.querySelector("#nBk").value);
        closeSheet(); seg = "joueurs";
        put("annonces", null, { bookingId: b.id, team: b.team, date: b.date, hour: b.hour, terrain: b.terrain, missing: +el.querySelector("#nMiss").value, poste: el.querySelector("[name=nPoste]:checked").value, joined: {}, by: myId(), at: NOW })
          .then(() => { act(); toast("Annonce publiée"); }, fail("Annonce"));
      });
    });
  }

  function dispoBody() {
    const need = C.joueursParEquipe * 2;
    const days = [...Array(7)].map((_, i) => addDays(today(), i));
    const count = (dow, h) => S.dispos.filter((p) => p.slots.includes(`${dow}-${h}`)).length + (S.me.slots.includes(`${dow}-${h}`) ? 1 : 0);
    const max = Math.max(need, ...days.flatMap((d) => SOIR.map((h) => count(d.getDay(), h))));
    const ready = [];
    const cells = SOIR.map((h) => `<div class="h num">${hh(h)}</div>${days.map((d) => {
      const dow = d.getDay(), n = count(dow, h), mine = S.me.slots.includes(`${dow}-${h}`);
      if (n >= need) ready.push([dkey(d), h, n]);
      const a = 0.08 + 0.72 * (n / max);
      return `<button class="${mine ? "mine" : ""} ${n >= need ? "ready" : ""}" data-slot="${dow}-${h}" data-k="${dkey(d)}" aria-label="${JOURS_LONG[dow]} ${hh(h)} : ${n} joueurs dispo" style="background:color-mix(in srgb, var(--turf) ${Math.round(a * 100)}%, var(--surface));color:${a > .45 ? "var(--on-turf)" : "var(--ink)"}">${n}</button>`;
    }).join("")}`).join("");
    return `<h3>Aucune session ne vous arrange ?</h3><p class="muted">Touchez les créneaux où vous êtes libre. Dès que ${need} joueurs sont dispo en même temps, l'appli propose d'ouvrir une session.</p>
      <div class="card">
        <div class="heat"><div></div>${days.map((d) => `<div class="colh">${JOURS[d.getDay()]}<br>${d.getDate()}</div>`).join("")}${cells}</div>
        <div class="legend"><span><i style="border:2px solid var(--ink)"></i>Mes dispos</span><span><i style="background:var(--bib)"></i>Assez de joueurs pour un match</span></div>
      </div>
      <h3>Matchs possibles</h3>
      ${ready.length ? `<div class="list">${ready.slice(0, 4).map(([k, h, n]) => `<div class="card"><div class="row"><span class="when">${dayLabel(k)} · ${hh(h)}</span><span class="chip chip-bib" style="margin-left:auto">${n} joueurs dispo</span></div><p class="small muted">Assez pour deux équipes de ${C.joueursParEquipe}. L'appli fait les équipes en équilibrant les postes.</p><button class="btn btn-turf btn-sm" data-forecast="${k}|${h}">Voir les équipes proposées</button></div>`).join("")}</div>` : '<div class="empty-state">Pas encore assez de joueurs sur un même créneau. Ajoutez vos dispos et partagez l\'appli.</div>'}`;
  }

  function forecastSheet(k, h) {
    const dow = fromKey(k).getDay();
    let pool = S.dispos.filter((p) => p.slots.includes(`${dow}-${h}`));
    if (S.me.slots.includes(`${dow}-${h}`)) pool = [{ name: S.me.name || "Vous", poste: S.me.poste, me: true }, ...pool];
    const order = { Gardien: 0, Défenseur: 1, Milieu: 2, Attaquant: 3 };
    pool = pool.slice(0, C.joueursParEquipe * 2).sort((a, b) => order[a.poste] - order[b.poste]);
    const A = [], B = [];
    pool.forEach((p, i) => ((i % 4 === 0 || i % 4 === 3) ? A : B).push(p));
    const ti = C.terrains.findIndex((_, i) => !findBk(k, h, i));
    const list = (team) => `<div class="list small">${team.map((p) => `<div class="row"><span class="avatars"><i>${initials(p.name)}</i></span><span class="grow">${esc(p.name)}${p.me ? " (vous)" : ""}</span><span class="muted">${esc(p.poste)}</span></div>`).join("")}</div>`;
    sheet(`${head("Prévision de match", `${dayLabel(k)} · ${hh(h)}`)}
      <div class="row" style="align-items:flex-start"><div class="card grow"><h3>Chasubles</h3>${list(A)}</div><div class="card grow"><h3>Maillots</h3>${list(B)}</div></div>
      ${ti >= 0 ? `<p class="small muted">${esc(C.terrains[ti])} est libre à cette heure. Chacun paie ${money(C.sessions.prixJoueur)} (${money(C.sessions.prixAbonne)} pour les abonnés).</p><button class="btn btn-bib btn-block" id="fcBook">Ouvrir la session et prévenir les joueurs</button>` : '<p class="small muted">Tous les terrains sont pris à cette heure. Essayez un autre créneau.</p>'}`, (el) => {
      const btn = el.querySelector("#fcBook");
      btn && btn.addEventListener("click", () => {
        // Chacun s'inscrit lui-même : on ouvre la session avec vous dedans si vous êtes dispo
        const me = pool.find((p) => p.me), players = me ? { [myId()]: entry() } : {};
        closeSheet(); seg = "jouer";
        claim(slotId(k, h, ti), { ...sessionBase(k, h, ti), players, createdAt: NOW })
          .then(() => { act(); toast("Session ouverte. Partagez-la sur WhatsApp pour que les autres s'inscrivent."); }, fail("Session"));
      });
    });
  }

  /* ---------- Je veux jouer ---------- */
  const openSessions = () => S.bookings.filter((b) => b.type === "session" && !isPast(b.date, b.hour)).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour)));
  const entry = () => ({ name: S.me.name, poste: S.me.poste, paid: false, abonne: S.me.abonne, at: Date.now() });
  const myPrice = () => (S.me.abonne ? C.sessions.prixAbonne : C.sessions.prixJoueur);
  // Joueurs pour lancer une session : le réglage du complexe, ou moins si le personnel l'a lancée plus tôt (« Lancer à 10 »)
  const sMin = (b) => b.min || C.sessions.minJoueurs;

  function sessionCard(b) {
    const n = b.players.length, min = sMin(b), max = C.sessions.maxJoueurs;
    const me = b.players.some((p) => p.uid === myId());
    const chip = n >= max ? '<span class="chip chip-n">Complet</span>' : n >= min ? '<span class="chip chip-ok">On joue !</span>' : `<span class="chip chip-bib">Il manque ${min - n}</span>`;
    return `<div class="card">
      <div class="row"><span class="when">${dayLabel(b.date)} · ${hh(b.hour)}</span>${chip}</div>
      <div class="meter" role="img" aria-label="${n} inscrits sur ${min}"><i style="width:${Math.min(100, (n / min) * 100)}%"></i></div>
      <div class="row small"><span class="num"><b>${n}</b> / ${min} joueurs${n > min ? ` (+${n - min} remplaçant${n - min > 1 ? "s" : ""})` : ""}</span><span class="muted" style="margin-left:auto">${esc(C.terrains[b.terrain])}</span></div>
      <div class="row"><div class="avatars">${b.players.slice(0, 8).map((p) => `<i title="${esc(p.name)}">${initials(p.name)}</i>`).join("")}${n > 8 ? `<i class="open">+${n - 8}</i>` : ""}</div></div>
      <div class="row" style="justify-content:flex-end"><a class="btn btn-ghost btn-sm" href="${waLink(`${n >= min ? "Session confirmée" : `Il manque ${min - n} joueur${min - n > 1 ? "s" : ""}`} pour jouer ${dayLabel(b.date).toLowerCase()} à ${hh(b.hour)} chez ${C.nom}, ${money(C.sessions.prixJoueur)} la place. Inscris-toi sur l'appli : ${APP_URL}#matchs`)}" target="_blank" rel="noopener" aria-label="Partager cette session sur WhatsApp">${WA_ICON}</a>
      <button class="btn ${me ? "btn-ghost" : "btn-bib"} btn-sm" data-sess="${b.id}" ${!me && n >= max ? "disabled" : ""}>${me ? "Je suis inscrit" : n >= max ? "Complet" : `Je joue · ${money(myPrice())}`}</button></div>
    </div>`;
  }

  function jouerBody() {
    const sess = openSessions();
    return `<p class="muted">Votre équipe n'est pas dispo ? Inscrivez-vous seul. Dès ${C.sessions.minJoueurs} inscrits, le match est confirmé et l'appli fait deux équipes équilibrées.</p>
      <div class="facts">
        <div class="fact"><span class="label">Par joueur</span><b class="num">${money(C.sessions.prixJoueur)}</b></div>
        <div class="fact"><span class="label">Abonnés</span><b class="num">${money(C.sessions.prixAbonne)}</b>${S.me.abonne ? '<span class="small muted">vous êtes abonné</span>' : '<button class="link" data-sub style="text-align:left">S\'abonner</button>'}</div>
      </div>
      ${sess.length ? `<div class="list">${sess.map(sessionCard).join("")}</div>` : '<div class="empty-state">Aucune session ouverte cette semaine.</div>'}
      <p class="small muted">Si une session n'atteint pas ${C.sessions.minJoueurs} joueurs ${C.sessions.annulationSessionHeures} h avant, elle est annulée et chacun est remboursé.</p>
      ${dispoBody()}`;
  }

  function joinSheet(id) {
    const b = S.bookings.find((x) => x.id === id);
    if (!S.me.name) { toast("Créez d'abord votre profil, ça prend 20 secondes"); location.hash = "profil"; return; }
    const me = b.players.find((p) => p.uid === myId()), staff = can("caisse");
    const order = { Gardien: 0, "Défenseur": 1, Milieu: 2, Attaquant: 3 };
    const byPoste = POSTES.map((p) => `${p} : ${b.players.filter((x) => x.poste === p).length}`).join(" · ");
    const ref = "MS-" + b.id.slice(0, 4).toUpperCase();
    const msg = `Bonjour ${C.nomCourt}, je suis inscrit à la session du ${dayLabel(b.date).toLowerCase()} à ${hh(b.hour)}. ${money(myPrice())} envoyés par Wave, référence ${ref}. ${S.me.name}`;
    sheet(`${head("Session joueurs seuls", `${dayLabel(b.date)} · ${hh(b.hour)} · ${esc(C.terrains[b.terrain])}`)}
      <div class="meter"><i style="width:${Math.min(100, (b.players.length / sMin(b)) * 100)}%"></i></div>
      <p class="small"><b class="num">${b.players.length}/${sMin(b)}</b> inscrits. ${byPoste}</p>
      <div class="list small">${[...b.players].sort((x, y) => order[x.poste] - order[y.poste]).map((p) => `<div class="row"><span class="avatars"><i>${initials(p.name)}</i></span><span class="grow">${esc(p.name)}${p.uid === myId() ? " (vous)" : ""}${p.abonne ? ' <span class="chip chip-n">abonné</span>' : ""}</span><span class="muted">${esc(p.poste)}</span>${p.paid ? '<span class="chip chip-ok">payé</span>' : staff ? `<button class="btn btn-turf btn-sm" data-ppaid="${esc(p.uid)}">Encaissé</button>` : '<span class="chip chip-warn">à payer</span>'}</div>`).join("")}</div>
      ${me ? `${me.paid ? "" : `<div class="pay"><span class="label">Votre place</span><span class="big num">${money(myPrice())}</span><div class="copybox"><code>${esc(C.wave)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(C.wave)}" data-done="Numéro Wave copié">Copier</button></div><p class="small">Référence Wave : <b>${ref}</b></p></div>
        <a class="btn btn-turf btn-block" href="${waLink(msg, C.whatsapp)}" target="_blank" rel="noopener">Prévenir le complexe sur WhatsApp</a>
        <p class="small muted">Le complexe coche « payé » dès qu'il voit votre paiement.</p>`}
        <button class="btn btn-ghost btn-block" id="jLeave">Me désinscrire</button>`
      : isStaff() ? "" : `<button class="btn btn-bib btn-block" id="jJoin" ${b.players.length >= C.sessions.maxJoueurs ? "disabled" : ""}>M'inscrire comme ${esc(S.me.poste.toLowerCase())} · ${money(myPrice())}</button>
        <p class="small muted">Payez votre place par Wave pour la garder. Si la session n'atteint pas ${sMin(b)} joueurs, vous êtes remboursé.</p>`}`, (el) => {
      const j = el.querySelector("#jJoin"), l = el.querySelector("#jLeave"), n = b.players.length + 1;
      // Première inscription à une session automatique : on la crée en ligne ; sinon on ajoute seulement sa ligne
      const join = () => (b.virtual ? claim(b.id, { ...sessionBase(b.date, b.hour, b.terrain), players: { [myId()]: entry() }, createdAt: NOW }).catch((e) => { if (e.code !== "pris") throw e; return patch("creneaux", b.id, { ["players." + myId()]: entry() }); })
        : patch("creneaux", b.id, { ["players." + myId()]: entry() }));
      j && j.addEventListener("click", () => { closeSheet(); join().then(() => { act(); toast(n >= sMin(b) ? "Inscrit ! La session est confirmée" : `Inscrit ! Plus que ${sMin(b) - n} joueurs`); }, fail("Inscription à la session")); });
      l && l.addEventListener("click", () => { closeSheet(); patch("creneaux", b.id, { ["players." + myId()]: DEL }).then(() => toast("Désinscrit"), fail("Désinscription")); });
      el.querySelectorAll("[data-ppaid]").forEach((x) => x.addEventListener("click", () => { x.disabled = true; patch("creneaux", b.id, { [`players.${x.dataset.ppaid}.paid`]: true }).then(() => { x.outerHTML = '<span class="chip chip-ok">payé</span>'; }, fail("Place encaissée")); }));
    });
  }

  function subCard() {
    const save1 = (C.sessions.prixJoueur - C.sessions.prixAbonne);
    const breakEven = Math.ceil(C.sessions.abonnementMois / save1);
    return `<div class="card">
      <div class="row"><h3 class="grow">Abonné ${esc(C.nomCourt)}</h3>${S.me.abonne ? '<span class="chip chip-ok">Actif</span>' : S.me.aboDemande ? '<span class="chip chip-warn">Demande envoyée</span>' : `<span class="chip chip-n num">${money(C.sessions.abonnementMois)} / mois</span>`}</div>
      <p class="small">Chaque session à ${money(C.sessions.prixAbonne)} au lieu de ${money(C.sessions.prixJoueur)}, et vous êtes prévenu en premier quand une session s'ouvre sur vos dispos. Rentabilisé dès ${breakEven} sessions par mois.</p>
      ${S.me.abonne || S.me.aboDemande ? "" : '<button class="btn btn-turf btn-block" data-sub>S\'abonner</button>'}
    </div>`;
  }

  function subSheet() {
    if (!S.me.name) { toast("Créez d'abord votre profil"); location.hash = "profil"; return; }
    sheet(`${head("S'abonner", `${money(C.sessions.abonnementMois)} par mois`)}
      <div class="pay"><span class="label">Abonnement du mois</span><span class="big num">${money(C.sessions.abonnementMois)}</span><div class="copybox"><code>${esc(C.wave)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(C.wave)}" data-done="Numéro Wave copié">Copier</button></div></div>
      <a class="btn btn-turf btn-block" href="${waLink(`Bonjour ${C.nomCourt}, je m'abonne pour le mois : ${money(C.sessions.abonnementMois)} envoyés par Wave. ${S.me.name}`, C.whatsapp)}" target="_blank" rel="noopener">Prévenir le complexe sur WhatsApp</a>
      <button class="btn btn-bib btn-block" id="subOk">J'ai payé par Wave</button>
      <p class="small muted">Le gérant active votre abonnement dès qu'il voit le paiement, pour 30 jours.</p>`, (el) => {
      el.querySelector("#subOk").addEventListener("click", () => { closeSheet(); put("abonnes", myId(), { name: S.me.name, status: "demande", at: NOW }).then(() => toast("Demande envoyée au complexe"), fail("Demande d'abonnement")); });
    });
  }

  // Jours proposés dans les formulaires : la semaine, plus le jour choisi dans le calendrier
  const pickDays = () => { const d = [...Array(7)].map((_, i) => dkey(addDays(today(), i))); return d.includes(planDay) || planDay < d[0] ? d : [...d, planDay]; };
  function openSessSheet() {
    sheet(`${head("Ouvrir une session", "Pour les joueurs sans équipe")}
      <form id="osForm" class="list">
        <div class="row"><div class="field grow"><label for="oDay">Jour</label><select class="input" id="oDay">${pickDays().map((kk) => `<option value="${kk}" ${kk === planDay ? "selected" : ""}>${dayLabel(kk)}</option>`).join("")}</select></div>
        <div class="field grow"><label for="oHour">Heure</label><select class="input" id="oHour">${hours().map((h) => `<option value="${h}" ${h === 17 ? "selected" : ""}>${hh(h)}</option>`).join("")}</select></div></div>
        <div class="field"><label for="oTer">Terrain</label><select class="input" id="oTer">${C.terrains.map((t, i) => `<option value="${i}">${esc(t)}</option>`).join("")}</select></div>
        <button class="btn btn-bib btn-block" type="submit">Ouvrir la session</button>
        <p class="small muted">Les joueurs qui ont mis une dispo sur ce créneau sont prévenus.</p>
      </form>`, (el) => {
      el.querySelector("#osForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const k = el.querySelector("#oDay").value, h = +el.querySelector("#oHour").value, ti = +el.querySelector("#oTer").value;
        if (findBk(k, h, ti)) { toast("Ce créneau est déjà pris"); return; }
        if (isPast(k, h)) { toast("Cette heure est déjà passée"); return; }
        closeSheet(); claim(slotId(k, h, ti), { ...sessionBase(k, h, ti), createdAt: NOW }).then(() => toast("Session ouverte"), fail("Session"));
      });
    });
  }

  /* ---------- Partage ---------- */
  const WA_ICON = '<svg class="wa" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (current() === "accueil") render(); });

  function shareSheet() {
    sheet(`${head("Partager l'appli", "Pour que vos amis l'installent")}
      <div class="qr-wrap">${qrSvg(APP_URL)}</div>
      <p class="small muted" style="text-align:center">Faites scanner ce code avec l'appareil photo, ou envoyez le lien.</p>
      <a class="btn btn-wa btn-block" href="${waLink(inviteText())}" target="_blank" rel="noopener">${WA_ICON}Partager sur WhatsApp</a>
      ${navigator.share ? '<button class="btn btn-ghost btn-block" id="nativeShare">Autres applis (Instagram, SMS...)</button>' : ""}
      <div class="copybox"><code>${esc(APP_URL)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(APP_URL)}" data-done="Lien copié">Copier</button></div>
      <p class="small muted">Pour installer : ouvrir le lien, puis dans le menu du navigateur, « Ajouter à l'écran d'accueil ».</p>`, (el) => {
      const n = el.querySelector("#nativeShare");
      n && n.addEventListener("click", () => navigator.share({ title: C.nom, text: inviteText().replace(" : " + APP_URL, ""), url: APP_URL }).catch(() => {}));
    });
  }

  function qrFull() {
    sheet(`${head(esc(C.nom), "Scannez pour installer l'appli")}<div class="qr-wrap qr-big">${qrSvg(APP_URL, 10)}</div><p style="text-align:center"><b>${esc(APP_URL.replace(/^https?:\/\//, ""))}</b></p>`);
  }

  /* ---------- Profil ---------- */
  function viewProfil() {
    const t = myTeam();
    if (!S.me.name || (Compte.enabled && !account)) return onboarding();
    const mt = S.bookings.filter((b) => (b.teamId === S.me.teamId || (t && b.opponent === t.name)) && isPast(b.date, b.hour)).length;
    const roleLabel = roleName(S.me.role);
    return `<main class="wrap">
      <div class="player">
        <svg class="jersey" viewBox="0 0 84 84" aria-hidden="true"><path d="M26 8h32l18 12-8 14-8-4v46H24V30l-8 4-8-14z" fill="${t ? t.color : "#E9601A"}" stroke="#F4FFF8" stroke-width="2"/><text x="42" y="58" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="26" fill="#F4FFF8">${esc(initials(S.me.name))}</text></svg>
        <div><span class="label" style="color:inherit;opacity:.8">${esc(roleLabel)} · ${esc(S.me.poste)}</span><h2>${esc(S.me.name)}</h2><p>${t ? esc(t.name) : "Sans équipe"}</p></div>
        <div class="stats"><div><b class="num">${mt}</b><span>matchs</span></div><div><b class="num">${S.me.motm}</b><span>homme du match</span></div><div><b class="num">${S.me.slots.length}</b><span>dispos</span></div></div>
      </div>
      ${t ? `<section><div class="sec-head"><h2>Mon équipe</h2></div><div class="card">
        <div class="row"><span class="dot" style="background:${t.color};width:16px;height:16px"></span><h3 class="grow">${esc(t.name)}</h3><span class="chip chip-n">Niveau ${level(t.elo)}</span></div>
        <div class="facts"><div class="fact"><span class="label">Bilan</span><b class="num">${t.w} V · ${t.d} N · ${t.l} D</b></div><div class="fact"><span class="label">Buts</span><b class="num">${t.gf} pour · ${t.ga} contre</b></div></div>
        <p class="small muted">Capitaine : ${esc(t.captain)}. Les points montent quand on bat une équipe mieux classée.</p>
      </div></section>` : ""}
      <section><h2>Abonnement</h2>${subCard()}</section>
      <section><h2>Classement des équipes</h2>${rankTable()}</section>
      <section><h2>Réglages</h2>
        <div class="card">
          <button class="btn btn-ghost btn-block" id="editProfile">Modifier mon profil</button>
          ${account ? `<span class="label">Mon identifiant</span><div class="copybox"><code>${esc(account.uid)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(account.uid)}" data-done="Identifiant copié">Copier</button></div>
          <button class="btn btn-ghost btn-block" id="signOut">Me déconnecter</button>` : ""}
          <p class="small muted">${account ? "Votre compte, vos réservations et vos inscriptions sont en ligne : vous les retrouvez sur tous vos téléphones." : "Les données restent sur ce téléphone."}</p>
        </div>
      </section>
    </main>`;
  }

  function signInView() {
    return `<main class="wrap"><section>
      <h2>Mon compte</h2>
      <p class="muted">Connectez-vous pour réserver, vous inscrire aux sessions et garder vos stats sur tous vos téléphones.</p>
      ${signInCard()}
    </section></main>`;
  }
  function signInCard() {
    return `<div class="card">
        <button class="btn btn-turf btn-block" id="gSignIn">Continuer avec Google</button>
        <p class="small muted" style="text-align:center">ou avec une adresse e-mail</p>
        <form id="mailForm" class="list">
          <div class="field"><label for="lMail">E-mail</label><input class="input" id="lMail" type="email" autocomplete="email" required></div>
          <div class="field"><label for="lPass">Mot de passe (6 caractères ou plus)</label><input class="input" id="lPass" type="password" autocomplete="current-password" minlength="6" required></div>
          <div class="row"><button class="btn btn-ghost grow" type="submit" data-mode="in">Me connecter</button><button class="btn btn-ghost grow" type="submit" data-mode="new">Créer mon compte</button></div>
        </form>
      </div>`;
  }

  function onboarding() {
    if (Compte.enabled && !account) return signInView();
    const m = S.me, staffRole = memberRole(m.role);
    return `<main class="wrap"><section>
      <h2>Mon profil</h2>
      <p class="muted">Créez votre profil pour réserver, rejoindre des matchs et suivre vos stats.</p>
      <form id="meForm" class="card">
        <div class="field"><label for="mName">Prénom et nom</label><input class="input" id="mName" required value="${esc(m.name)}" placeholder="Ex. Moussa Diop"></div>
        <div class="field"><span class="label">Poste</span><div class="choices">${POSTES.map((p) => `<label class="choice"><input type="radio" name="mPoste" value="${p}" ${m.poste === p ? "checked" : ""}><span>${p}</span></label>`).join("")}</div></div>
        <div class="field"><label for="mTeam">Équipe</label><select class="input" id="mTeam"><option value="">Pas encore d'équipe</option>${S.teams.map((t) => `<option value="${t.id}" ${t.id === m.teamId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div>
        ${staffRole && Compte.enabled ? `<input type="radio" name="mRole" value="${m.role}" checked hidden><p class="small"><span class="chip chip-ok">${esc(roleName(m.role))}</span> rôle donné par ${m.role === "proprietaire" ? "l'administrateur de l'appli" : "le propriétaire du complexe"}</p>` : `<div class="field"><span class="label">Je suis</span><div class="choices">${(Compte.enabled ? [["joueur", "Joueur"], ["capitaine", "Capitaine"]] : Object.entries(LOCAL_ROLES)).map(([k, l]) => `<label class="choice"><input type="radio" name="mRole" value="${k}" ${m.role === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
          ${Compte.enabled ? '<span class="small muted">Vous travaillez au complexe ? Créez votre compte, puis demandez votre rôle au propriétaire.</span>' : ""}</div>`}
        <div class="field" id="keyField" hidden><label for="mKey">Clé d'entrée</label><input class="input" id="mKey" autocomplete="off" placeholder="Donnée par le complexe"></div>
        ${account ? `<div class="row"><div class="field grow"><label for="mTel">Téléphone</label><input class="input" id="mTel" inputmode="tel" value="${esc(account.tel)}" placeholder="77 123 45 67"></div>
        <div class="field grow"><label for="mQuartier">Quartier</label><input class="input" id="mQuartier" value="${esc(account.quartier)}"></div></div>
        <div class="field"><label for="mSource">Comment avez-vous connu ${esc(C.nomCourt)} ?</label><select class="input" id="mSource"><option value="">Choisir</option>${SOURCES.map((x) => `<option ${account.source === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <label class="row small"><input type="checkbox" id="mAccord" ${account.accord ? "checked" : ""}><span>J'accepte de recevoir les rappels et les bons plans de ${esc(C.nomCourt)} sur WhatsApp. Je peux répondre STOP à tout moment.</span></label>` : ""}
        <button class="btn btn-bib btn-block" type="submit">Enregistrer</button>
      </form>
    </section></main>`;
  }

  /* ---------- Espace gérant ---------- */
  function viewGerant() {
    if (!isStaff()) return `<main class="wrap"><section><h2>Gestion</h2><div class="empty-state">Réservé au propriétaire et à l'équipe du complexe. ${Compte.enabled ? "Le propriétaire donne les rôles depuis ses réglages." : "Choisissez ce profil dans l'onglet Profil avec votre clé d'entrée."}</div><a class="btn btn-turf btn-block" href="#profil">Aller au profil</a></section></main>`;
    const cPlan = can("planning"), cCash = can("caisse");
    const k = dkey(today());
    const todays = S.bookings.filter((b) => b.date === k).sort((a, b) => a.hour - b.hour || a.terrain - b.terrain);
    const cashToday = S.receipts.filter((r) => r.date === k).reduce((s, r) => s + r.amount, 0);
    const slotsDay = hours().length * C.terrains.length;
    const fill = Math.round((todays.length / slotsDay) * 100);
    const waiting = S.bookings.filter((b) => b.status === "attente" && !isPast(b.date, b.hour)).length;
    const pending = S.bookings.filter((b) => b.status === "attente" && b.date > k).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour)));
    const toCollect = todays.filter((b) => b.status !== "paye").reduce((s, b) => s + b.price, 0);
    const month = S.receipts.filter((r) => r.date.slice(0, 7) === k.slice(0, 7)).reduce((s, r) => s + r.amount, 0);
    const sessAll = openSessions();

    // Remplissage moyen par heure sur les 14 derniers jours
    const past = [...Array(14)].map((_, i) => dkey(addDays(today(), -14 + i)));
    const byHour = hours().map((h) => ({ h, v: Math.round((S.bookings.filter((b) => b.hour === h && past.includes(b.date)).length / (past.length * C.terrains.length)) * 100) }));
    const best = Object.entries(S.bookings.filter((b) => b.type !== "session").reduce((m, b) => ((m[b.team] = (m[b.team] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return `<main class="wrap">
      <section>
        <div class="sec-head"><h2>Aujourd'hui</h2><span class="muted small">${dayLabel(k)}</span></div>
        <div class="kpis">
          ${cCash ? `<div class="kpi lead"><span class="label">Encaissé aujourd'hui</span><b class="num">${money(cashToday)}</b><span class="small">Reste à encaisser : ${money(toCollect)}</span></div>` : ""}
          <div class="kpi"><span class="label">Remplissage</span><b class="num">${fill} %</b><span class="small muted">${todays.length} / ${slotsDay} créneaux</span></div>
          <div class="kpi"><span class="label">Acomptes attendus</span><b class="num">${waiting}</b><span class="small muted">${waiting ? "à vérifier sur Wave" : "rien en attente"}</span></div>
        </div>
        ${cPlan ? '<div class="row"><button class="btn btn-turf grow" id="addPhone">Ajouter une réservation téléphone</button></div>' : ""}
        <div class="list">${todays.length ? todays.map((b) => staffBk(b)).join("") : '<div class="empty-state">Aucune réservation aujourd\'hui.</div>'}</div>
        ${pending.length ? `<h3>Acomptes à vérifier, prochains jours</h3><div class="list">${pending.map((b) => staffBk(b, true)).join("")}</div>` : ""}
      </section>
      ${cPlan ? relancesSection() : ""}
      ${can("membres") ? perdusSection() : ""}
      <section ${cPlan ? "" : "hidden"}>
        <div class="sec-head"><h2>Sessions joueurs seuls</h2><button class="link" id="openSess">Ouvrir une session</button></div>
        <div class="kpis">
          <div class="kpi"><span class="label">Inscrits cette semaine</span><b class="num">${sessAll.reduce((n, b) => n + b.players.length, 0)}</b><span class="small muted">sur ${sessAll.length} sessions</span></div>
          <div class="kpi"><span class="label">Sessions confirmées</span><b class="num">${sessAll.filter((b) => b.players.length >= sMin(b)).length} / ${sessAll.length}</b><span class="small muted">à ${C.sessions.minJoueurs} joueurs</span></div>
        </div>
        <p class="small muted">Une session pleine rapporte ${money(C.sessions.minJoueurs * C.sessions.prixJoueur)} à ${money(C.sessions.maxJoueurs * C.sessions.prixJoueur)}, contre ${money(C.tarifs.creuse)} pour un créneau creux loué à une équipe. Ouvrez-les sur les heures pâles du graphique.</p>
        <div class="list">${sessAll.slice(0, 4).map(sessionCard).join("")}</div>
      </section>
      <section ${can("abonnements") ? "" : "hidden"}>
        <div class="sec-head"><h2>Abonnés</h2><span class="muted small">${money(C.sessions.abonnementMois)} / mois</span></div>
        ${aboList()}
      </section>
      <section>
        <div class="sec-head"><h2>Heures qui remplissent</h2><span class="muted small">14 derniers jours</span></div>
        <div class="card">${hourChart(byHour)}<p class="small muted">En orange, l'heure la plus demandée. Les créneaux pâles sont ceux à pousser avec une promo ou un défi.</p></div>
      </section>
      <section ${cCash ? "" : "hidden"}>
        <div class="sec-head"><h2>Caisse</h2><span class="muted small num">${money(month)} ce mois-ci</span></div>
        <div class="card" style="padding:6px 10px"><table class="rank"><thead><tr><th>Reçu</th><th>Équipe</th><th>Mode</th><th class="n">Montant</th></tr></thead><tbody>
          ${S.receipts.length ? "" : '<tr><td colspan="4" class="muted small">Aucun reçu pour l\'instant.</td></tr>'}${[...S.receipts].reverse().slice(0, 8).map((r) => `<tr><td class="num">n° ${pad(r.n)}</td><td>${esc(r.team)}<div class="small muted">${dayLabel(r.date)} ${hh(r.hour)}</div></td><td>${r.by}</td><td class="n">${money(r.amount)}</td></tr>`).join("")}
        </tbody></table></div>
        <button class="btn btn-ghost btn-block" id="exportCsv">Exporter pour Excel (CSV)</button>
      </section>
      <section>
        <h2>Meilleurs clients</h2>
        <div class="card" style="padding:6px 10px"><table class="rank"><tbody>${best.length ? "" : '<tr><td class="muted small">Les équipes qui réservent le plus apparaîtront ici.</td></tr>'}${best.map(([n, c], i) => `<tr><td class="num">${i + 1}</td><td>${esc(n)}</td><td class="n">${c} créneaux</td></tr>`).join("")}</tbody></table></div>
      </section>
      <section>
        <div class="sec-head"><h2>Faire connaître l'appli</h2></div>
        <div class="card">
          <div class="qr-wrap">${qrSvg(APP_URL)}</div>
          <p class="small muted" style="text-align:center">À scanner avec l'appareil photo du téléphone. Affichez-le à l'accueil, sur les murs du terrain et dans vos statuts.</p>
          <div class="row"><button class="btn btn-turf grow" id="qrBig">Afficher en grand</button><a class="btn btn-ghost grow" href="affiche.html" target="_blank" rel="noopener">Affiche à imprimer</a></div>
          <a class="btn btn-wa btn-block" href="${waLink(inviteText())}" target="_blank" rel="noopener">${WA_ICON}Envoyer le lien sur WhatsApp</a>
        </div>
        <div class="card">
          <h3>Images pour les statuts</h3>
          <p class="small muted">Une image prête à poster en statut WhatsApp, sur Instagram ou TikTok, avec le QR code de l'appli.</p>
          <div class="row"><button class="btn btn-ghost grow" data-img="libres">Créneaux libres ce soir</button><button class="btn btn-ghost grow" data-img="semaine">Programme de la semaine</button></div>
        </div>
      </section>
      ${can("personnel") ? `<section>
        <div class="sec-head"><h2>Équipe et horaires</h2><button class="link" id="addStaff">Ajouter</button></div>
        <div class="list">${S.staff.length ? "" : '<div class="empty-state">Ajoutez l\'équipe du complexe et ses horaires.</div>'}${S.staff.map((p) => `<div class="card"><div class="row"><span class="avatars"><i>${initials(p.name)}</i></span><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.role)}</div></div><span class="chip chip-n num">${esc(p.shift)}</span><button class="link" style="color:var(--bad)" data-rmstaff="${p.id}">Retirer</button></div></div>`).join("")}</div>
      </section>` : ""}
    </main>`;
  }

  /* ---------- Relances WhatsApp en un clic ---------- */
  // L'appli écrit le message et choisit le numéro ; le personnel n'a plus qu'à appuyer sur Envoyer dans WhatsApp.
  const STOP = "Pour ne plus recevoir nos messages, répondez STOP.";
  const waBtn = (label, text, num) => `<a class="btn btn-wa btn-sm" href="${waLink(text, num)}" target="_blank" rel="noopener">${WA_ICON}${label}</a>`;
  function relancesSection() {
    const tmw = dkey(addDays(today(), 1)), soon = [dkey(today()), tmw, dkey(addDays(today(), 2))];
    const rappels = S.bookings.filter((b) => b.date === tmw && !b.virtual && b.status !== "absent").sort((a, b) => a.hour - b.hour || a.terrain - b.terrain);
    const aRemplir = openSessions().filter((b) => soon.includes(b.date) && b.players.length < sMin(b));
    const lance = C.sessions.minJoueurs - 2;
    const rappel = (b) => b.type === "session"
      ? `<div class="card"><div class="row"><b class="grow">Session de ${hh(b.hour)} · ${b.players.length} inscrits</b>${waBtn("Rappel", `Rappel ${C.nom} : session demain à ${hh(b.hour)} (${C.terrains[b.terrain]}). Inscrits : ${b.players.map((p) => p.name).join(", ")}. Pensez à payer votre place par Wave. À demain ! ${APP_URL}#matchs`)}</div><p class="small muted">À envoyer dans le groupe des joueurs.</p></div>`
      : `<div class="card"><div class="row"><b class="grow">${hh(b.hour)} · ${esc(b.team)}</b>${b.phone ? waBtn("Rappel", `Bonjour ${b.cname || b.team}, petit rappel de ${C.nom} : votre créneau est demain à ${hh(b.hour)} (${C.terrains[b.terrain]}).${b.status === "attente" ? ` L'acompte de ${money(C.acompte)} par Wave au ${C.wave} confirme la réservation.` : ""} À demain sur le terrain ! ${STOP}`, telWa(b.phone)) : '<span class="small muted">pas de téléphone</span>'}</div></div>`;
    const remplir = (b) => { const n = b.players.length, m = sMin(b), k = m - n;
      return `<div class="card"><div class="row"><b class="grow">${dayLabel(b.date)} ${hh(b.hour)} · ${n}/${m}</b>${waBtn(`Il manque ${k}`, `Plus que ${k} place${k > 1 ? "s" : ""} pour jouer ${dayLabel(b.date).toLowerCase()} à ${hh(b.hour)} chez ${C.nom} : ${n} inscrits sur ${m}, ${money(C.sessions.prixJoueur)} la place. Inscris-toi en 1 minute : ${APP_URL}#matchs`)}</div>
        ${n >= lance && !b.virtual ? `<div class="row"><span class="small muted grow">Plutôt que d'annuler, lancez le match à ${n} (${Math.floor(n / 2)} contre ${Math.ceil(n / 2)}).</span><button class="btn btn-turf btn-sm" data-launch="${b.id}" data-n="${n}">Lancer à ${n}</button></div>` : ""}</div>`; };
    return `<section>
        <div class="sec-head"><h2>Relances WhatsApp</h2><span class="muted small">en un clic</span></div>
        <h3>Rappels pour demain</h3>
        <div class="list">${rappels.length ? rappels.map(rappel).join("") : '<div class="empty-state">Aucun match demain pour l\'instant.</div>'}</div>
        <h3>Sessions à remplir</h3>
        <div class="list">${aRemplir.length ? aRemplir.map(remplir).join("") : '<div class="empty-state">Toutes les sessions des 3 prochains jours sont complètes.</div>'}</div>
      </section>`;
  }
  // Joueurs qui n'ont pas ouvert l'appli depuis 30 jours : un message « tu nous manques » avec une place à prix abonné
  function perdusSection() {
    if (!Compte.enabled && !(mode && mode.type === "demo")) return "";
    if (!membres) loadMembres();
    if (!Array.isArray(membres)) return `<section><h2>Clients à relancer</h2><div class="empty-state">${membres.fail ? "Lecture des comptes refusée." : "Chargement des comptes..."}</div></section>`;
    const lim = Date.now() - 30 * 864e5;
    const list = membres.filter((u) => ["joueur", "capitaine"].includes(u.role) && u.active !== false && u.accord !== false && u.tel && toDate(u.lastSeen) && toDate(u.lastSeen).getTime() < lim)
      .sort((a, b) => toDate(b.lastSeen) - toDate(a.lastSeen));
    const msg = (u) => `Bonjour ${(u.name || "").split(" ")[0]}, ça fait un moment qu'on ne t'a pas vu chez ${C.nom} ! Reviens jouer cette semaine : ta prochaine place en session est à ${money(C.sessions.prixAbonne)} au lieu de ${money(C.sessions.prixJoueur)}, montre simplement ce message. Les sessions : ${APP_URL}#matchs. ${STOP}`;
    return `<section>
        <div class="sec-head"><h2>Clients à relancer</h2><span class="muted small">absents depuis 30 jours</span></div>
        <div class="list">${list.length ? list.slice(0, 30).map((u) => `<div class="card"><div class="row"><span class="avatars"><i>${initials(u.name)}</i></span><div class="grow"><b>${esc(u.name || "Sans nom")}</b><div class="small muted">vu ${ago(toDate(u.lastSeen))}${u.quartier ? ` · ${esc(u.quartier)}` : ""}</div></div>${waBtn("Tu nous manques", msg(u), telWa(u.tel))}</div></div>`).join("") : '<div class="empty-state">Personne à relancer : tous les joueurs sont venus ce mois-ci.</div>'}</div>
        <p class="small muted">Le message offre une place au prix abonné : appliquez-le quand le joueur le montre.</p>
      </section>`;
  }

  /* ---------- Images à partager ---------- */
  // Une image 1080 x 1350 aux couleurs du complexe, avec le QR code de l'appli, partagée directement si le téléphone le permet.
  function drawImage(kicker, title, lines) {
    const W = 1080, H = 1350, cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = W; cv.height = H;
    g.fillStyle = "#0B3D2C"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(244,255,248,.12)"; g.lineWidth = 6; g.strokeRect(60, 60, W - 120, H - 120); g.beginPath(); g.arc(W / 2, H / 2, 150, 0, 7); g.stroke();
    g.fillStyle = "#E9601A"; g.font = "800 44px 'Barlow Condensed', Arial Narrow, sans-serif"; g.fillText(kicker.toUpperCase(), 110, 190);
    g.fillStyle = "#F4FFF8"; g.font = "800 96px 'Barlow Condensed', Arial Narrow, sans-serif";
    title.split("\n").forEach((t, i) => g.fillText(t, 110, 300 + i * 100));
    let y = 300 + title.split("\n").length * 100 + 40;
    g.font = "600 46px Arial, sans-serif";
    lines.slice(0, 7).forEach((l) => { g.fillStyle = l.startsWith("!") ? "#E9601A" : "#F4FFF8"; g.fillText(l.replace(/^!/, ""), 110, y); y += 66; });
    const q = qrcode(0, "M"); q.addData(APP_URL); q.make();
    const n = q.getModuleCount(), cell = Math.floor(220 / n), qs = cell * n, qx = W - 110 - qs - 24, qy = H - 110 - qs - 24;
    g.fillStyle = "#F4FFF8"; g.fillRect(qx - 24, qy - 24, qs + 48, qs + 48); g.fillStyle = "#0B3D2C";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(qx + c * cell, qy + r * cell, cell, cell);
    g.fillStyle = "#F4FFF8"; g.font = "800 60px 'Barlow Condensed', Arial Narrow, sans-serif"; g.fillText(C.nom, 110, H - 200);
    g.font = "500 36px Arial, sans-serif"; g.fillStyle = "rgba(244,255,248,.8)"; g.fillText("Réserve ou inscris-toi seul sur l'appli", 110, H - 140);
    return cv;
  }
  function shareImage(kind, resId) {
    const k = dkey(today());
    let cv, name, text;
    if (kind === "libres") {
      const free = hours().filter((h) => !isPast(k, h)).map((h) => [h, C.terrains.filter((_, ti) => !S.bookings.some((b) => b.date === k && b.hour === h && b.terrain === ti))]).filter(([, t]) => t.length);
      if (!free.length) return toast("Tout est complet ce soir, bravo !");
      cv = drawImage(dayLabel(k), "Créneaux libres\nce soir", free.map(([h, t]) => `${hh(h)}  ·  ${t.join(", ")}`).concat(free.some(([h]) => isAfterwork(k, h)) ? [`!${hh(C.ouverture)} : afterwork à ${money(C.tarifs.afterwork)}`] : []));
      name = "creneaux-libres"; text = `Créneaux libres ce soir chez ${C.nom} : ${free.map(([h]) => hh(h)).join(", ")}. Réserve ici : ${APP_URL}#planning`;
    } else if (kind === "semaine") {
      const sess = openSessions().filter((b) => b.date < dkey(addDays(today(), 7)));
      // 7 lignes tiennent au-dessus du QR code : les 5 prochaines sessions et les prix
      const lines = sess.slice(0, 5).map((b) => `${dayLabel(b.date)} ${hh(b.hour)}  ·  ${b.players.length}/${sMin(b)} inscrits`);
      if (C.tarifs.afterwork > 0) lines.push(`!Afterwork ${hh(C.ouverture)} en semaine : ${money(C.tarifs.afterwork)}`);
      lines.push(`!Session : ${money(C.sessions.prixJoueur)} la place`);
      cv = drawImage("Cette semaine", "Viens jouer,\nmême seul", lines);
      name = "programme-semaine"; text = `Cette semaine chez ${C.nom} : ${sess.length} sessions ouvertes aux joueurs seuls, ${money(C.sessions.prixJoueur)} la place. Inscris-toi : ${APP_URL}#matchs`;
    } else {
      const r = S.results.find((x) => x.id === resId);
      if (!r) return;
      cv = drawImage(`${dayLabel(r.date)} · ${hh(r.hour)}`, `${r.sa} - ${r.sb}`, [r.a, "contre", r.b, "", r.motm ? `!Homme du match : ${r.motm}` : ""]);
      name = "score"; text = `${r.a} ${r.sa} - ${r.sb} ${r.b} chez ${C.nom}. À qui le tour ? ${APP_URL}`;
    }
    cv.toBlob((blob) => {
      const file = new File([blob], `${name}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], text }).catch(() => {});
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      toast("Image enregistrée : publiez-la depuis votre galerie");
    }, "image/png");
  }

  function staffBk(b, withDay) {
    const past = isPast(b.date, b.hour);
    const res = S.results.find((r) => r.date === b.date && r.hour === b.hour && r.a === b.team);
    const chip = b.status === "paye" ? '<span class="chip chip-ok">Payé</span>' : b.status === "attente" ? '<span class="chip chip-warn">Acompte attendu</span>' : b.status === "absent" ? '<span class="chip chip-bad">Pas venu</span>' : '<span class="chip chip-n">Confirmé</span>';
    return `<div class="card bk">
      <div class="hr num">${hh(b.hour)}</div>
      <div><div class="row"><b class="grow">${b.type === "session" ? `Session : ${b.players.length}/${sMin(b)} joueurs` : esc(b.team)}${b.opponent ? ` vs ${esc(b.opponent)}` : b.type === "defi" ? " (cherche adversaire)" : ""}</b>${chip}</div>
        <div class="small muted">${withDay ? `${dayLabel(b.date)} · ` : ""}${esc(C.terrains[b.terrain])} · ${money(b.price)}${b.phone ? ` · ${esc(b.phone)}` : ""}${res ? ` · Score ${res.sa}-${res.sb}` : ""}</div>
        <div class="acts">
          ${b.status === "attente" && (can("planning") || can("caisse")) ? `<button class="btn btn-turf btn-sm" data-confirm="${b.id}">Acompte reçu</button>` : ""}
          ${b.type === "session" ? `<button class="btn btn-ghost btn-sm" data-sess="${b.id}">Voir les inscrits (${b.players.filter((x) => x.paid).length} payés)</button>` : ""}
          ${b.type !== "session" && b.status !== "paye" && b.status !== "absent" && can("caisse") ? `<button class="btn btn-bib btn-sm" data-cash="${b.id}">Encaisser</button>` : ""}
          ${b.type !== "session" && b.status !== "paye" && b.status !== "absent" && past && can("planning") ? `<button class="btn btn-ghost btn-sm" data-absent="${b.id}">Pas venu</button>` : ""}
          ${past && b.opponent && !res && can("scores") ? `<button class="btn btn-ghost btn-sm" data-score="${b.id}">Saisir le score</button>` : ""}
          ${res ? `<button class="btn btn-ghost btn-sm" data-img="score" data-res="${esc(res.id)}">Image du score</button>` : ""}
        </div></div>
    </div>`;
  }

  function hourChart(data) {
    const W = 340, H = 150, top = 18, bottom = 22, n = data.length, bw = (W - 4) / n;
    const peak = Math.max(...data.map((d) => d.v), 1);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Remplissage moyen par heure">
      <line class="base" x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/>
      ${data.map((d, i) => { const h = ((H - top - bottom) * d.v) / 100, x = 2 + i * bw; return `<rect class="bar ${d.v === peak ? "peak" : ""}" x="${x + 2}" y="${H - bottom - h}" width="${bw - 4}" height="${Math.max(h, 1)}" rx="3"/>${d.v === peak ? `<text class="val" x="${x + bw / 2}" y="${H - bottom - h - 5}" text-anchor="middle">${d.v}%</text>` : ""}${i % 2 === 0 ? `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${hh(d.h)}</text>` : ""}`; }).join("")}
    </svg>`;
  }

  function cash(b, by) {
    cashOp(b, by).then((n) => toast(`Reçu n° ${pad(n)} enregistré`), fail("Encaissement"));
  }

  // Demandes d'abonnement (le joueur a payé par Wave) et abonnés en cours
  function aboList() {
    const list = [...S.abos].sort((a, b) => (a.status === "demande" ? -1 : 1) - (b.status === "demande" ? -1 : 1));
    if (!list.length) return '<div class="empty-state">Les demandes d\'abonnement des joueurs arrivent ici.</div>';
    return `<div class="list">${list.map((a) => { const on = a.status === "actif" && a.until > Date.now(); return `<div class="card"><div class="row"><span class="avatars"><i>${initials(a.name)}</i></span><div class="grow"><b>${esc(a.name)}</b><div class="small muted">${a.status === "demande" ? "dit avoir payé par Wave, à vérifier" : on ? `jusqu'au ${dayLabel(dkey(new Date(a.until))).toLowerCase()}` : "abonnement terminé"}</div></div>
      ${on ? '<span class="chip chip-ok">Actif</span>' : ""}<button class="btn ${on ? "btn-ghost" : "btn-turf"} btn-sm" data-abo="${esc(a.id)}">${on ? "+30 jours" : "Activer 30 jours"}</button></div></div>`; }).join("")}</div>`;
  }

  function cashSheet(id) {
    const b = S.bookings.find((x) => x.id === id);
    sheet(`${head("Encaisser", `${esc(b.team)} · ${hh(b.hour)} · ${money(b.price)}`)}
      <div class="row"><button class="btn btn-turf grow" data-by="Espèces">Espèces</button><button class="btn btn-turf grow" data-by="Wave">Wave</button><button class="btn btn-turf grow" data-by="Orange Money">Orange Money</button></div>`, (el) => {
      el.querySelectorAll("[data-by]").forEach((x) => x.addEventListener("click", () => { closeSheet(); cash(b, x.dataset.by); }));
    });
  }

  function scoreSheet(id) {
    const b = S.bookings.find((x) => x.id === id);
    const players = [...new Set([...S.dispos.map((p) => p.name), ...S.bookings.flatMap((x) => x.players.map((p) => p.name))])];
    sheet(`${head("Score du match", `${esc(b.team)} vs ${esc(b.opponent)}`)}
      <form id="scoreForm" class="list">
        <div class="row"><div class="field grow"><label for="sA">${esc(b.team)}</label><input class="input num" id="sA" type="number" min="0" max="40" required value="0"></div><div class="field grow"><label for="sB">${esc(b.opponent)}</label><input class="input num" id="sB" type="number" min="0" max="40" required value="0"></div></div>
        <div class="field"><label for="sM">Homme du match</label><input class="input" id="sM" list="pl" placeholder="Nom du joueur"><datalist id="pl">${players.map((p) => `<option value="${esc(p)}">`).join("")}</datalist></div>
        <button class="btn btn-bib btn-block" type="submit">Publier le résultat</button>
        <p class="small muted">Le résultat part dans le fil des matchs et le classement est mis à jour.</p>
      </form>`, (el) => {
      el.querySelector("#scoreForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const sa = +el.querySelector("#sA").value, sb = +el.querySelector("#sB").value, motm = el.querySelector("#sM").value.trim() || "Non désigné";
        const teams = S.teams.filter((t) => t.name === b.team || t.name === b.opponent).map((t) => ({ ...t }));
        applyResult(teams, b.team, b.opponent, sa, sb);
        closeSheet();
        put("resultats", null, { date: b.date, hour: b.hour, a: b.team, b: b.opponent, sa, sb, motm, at: NOW })
          .then(() => Promise.all(teams.map((t) => patch("equipes", t.id, { elo: t.elo, w: t.w, d: t.d, l: t.l, gf: t.gf, ga: t.ga }))))
          .then(() => toast("Résultat publié"), fail("Score"));
      });
    });
  }

  function phoneSheet() {
    const k = dkey(today());
    sheet(`${head("Réservation par téléphone")}
      <form id="phForm" class="list">
        <div class="row"><div class="field grow"><label for="pDay">Jour</label><select class="input" id="pDay">${pickDays().map((kk) => `<option value="${kk}" ${kk === planDay ? "selected" : ""}>${dayLabel(kk)}</option>`).join("")}</select></div>
        <div class="field grow"><label for="pHour">Heure</label><select class="input" id="pHour">${hours().map((h) => `<option value="${h}" ${h === 20 ? "selected" : ""}>${hh(h)}</option>`).join("")}</select></div></div>
        <div class="field"><label for="pTer">Terrain</label><select class="input" id="pTer">${C.terrains.map((t, i) => `<option value="${i}">${esc(t)}</option>`).join("")}</select></div>
        <div class="field"><label for="pTeam">Équipe</label><input class="input" id="pTeam" required list="tl3"><datalist id="tl3">${S.teams.map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist></div>
        <div class="field"><label for="pPhone">Téléphone</label><input class="input" id="pPhone" inputmode="tel"></div>
        <button class="btn btn-bib btn-block" type="submit">Ajouter au planning</button>
      </form>`, (el) => {
      el.querySelector("#phForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const kk = el.querySelector("#pDay").value, h = +el.querySelector("#pHour").value, ti = +el.querySelector("#pTer").value;
        if (findBk(kk, h, ti)) { toast("Ce créneau est déjà pris"); return; }
        if (isPast(kk, h)) { toast("Cette heure est déjà passée"); return; }
        const name = el.querySelector("#pTeam").value.trim(), team = S.teams.find((x) => x.name.toLowerCase() === name.toLowerCase()), phone = el.querySelector("#pPhone").value.trim(), id = slotId(kk, h, ti);
        closeSheet();
        claim(id, { date: kk, hour: h, terrain: ti, team: team ? team.name : name, teamId: team ? team.id : "", opponent: "", opponentId: "", type: "prive", niveau: "Moyen", price: price(kk, h), status: "confirme", by: myId(), createdAt: NOW })
          .then(() => { toast("Réservation ajoutée"); if (phone) put("contacts", id, { phone, name, by: myId() }).catch(() => {}); }, fail("Réservation téléphone"));
      });
    });
  }

  function staffSheet() {
    sheet(`${head("Ajouter un membre du personnel")}
      <form id="stForm" class="list">
        <div class="field"><label for="stN">Prénom</label><input class="input" id="stN" required></div>
        <div class="field"><label for="stR">Rôle</label><input class="input" id="stR" placeholder="Ex. Caisse, arbitre, entretien" required></div>
        <div class="field"><label for="stS">Horaires</label><input class="input" id="stS" placeholder="Ex. 17h - 00h"></div>
        <button class="btn btn-bib btn-block" type="submit">Ajouter</button>
        <p class="small muted">${Compte.enabled ? "Pour ouvrir l'espace gérant sur son téléphone, il crée son compte dans l'appli et l'administrateur lui donne le rôle Personnel." : "Donnez-lui la clé personnel pour qu'il ouvre l'espace gérant sur son téléphone."}</p>
      </form>`, (el) => {
      el.querySelector("#stForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const d = { name: el.querySelector("#stN").value.trim(), role: el.querySelector("#stR").value.trim(), shift: el.querySelector("#stS").value.trim() || "-" };
        closeSheet(); put("personnel", null, d).catch(fail("Personnel"));
      });
    });
  }

  function exportCsv() {
    const rows = [["Reçu", "Date", "Heure", "Équipe", "Mode", "Montant"], ...S.receipts.map((r) => [r.n, r.date, hh(r.hour), r.team, r.by, r.amount])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
      a.download = `caisse-${dkey(today())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { /* le téléchargement peut être bloqué : on propose la copie */ }
    sheet(`${head("Export de la caisse", `${S.receipts.length} reçus`)}<p class="small muted">Si le fichier ne s'est pas téléchargé, copiez le texte et collez-le dans Excel.</p><textarea class="input small" id="csvBox" rows="8" readonly>${esc(csv)}</textarea><button class="btn btn-turf btn-block" data-copy="${esc(csv)}">Copier</button>`);
  }

  /* ---------- Réglages du complexe ---------- */
  // Prix (droit Prix), rôles de l'équipe (propriétaire seulement) et rôle de chaque compte (droit Membres)
  let rolesDraft = null, membres = null, membreQuery = "";
  const isOwner = () => S.me.role === "proprietaire";
  const canReglages = () => can("tarifs") || can("membres") || isOwner();

  function viewReglages() {
    if (!canReglages()) return `<main class="wrap"><section><h2>Réglages</h2><div class="empty-state">Réservé au propriétaire du complexe.</div></section></main>`;
    const t = tarifs();
    return `<main class="wrap">
      ${can("tarifs") ? `<section>
        <h2>Prix</h2>
        <p class="muted small">Changez-les quand vous voulez : les nouveaux prix s'affichent tout de suite sur tous les téléphones. Les réservations déjà faites gardent leur prix.</p>
        <form id="tarifForm" class="card list">
          ${TARIFS.map(([k, l, u]) => `<div class="row"><label class="grow" for="t_${k}">${l}</label><input class="input input-sm num" style="width:110px" id="t_${k}" data-t="${k}" type="number" min="${k === "heurePleine" ? C.ouverture : 0}" max="${k === "heurePleine" ? C.fermeture : k.endsWith("Joueurs") ? 30 : 1000000}" step="${u === "F" ? 500 : 1}" required value="${t[k]}"><span class="small muted" style="width:14px">${u}</span></div>`).join("")}
          <button class="btn btn-bib btn-block" type="submit">Enregistrer les prix</button>
        </form>
      </section>` : ""}
      ${isOwner() ? rolesSection() : ""}
      ${can("membres") ? membresSection() : ""}
    </main>`;
  }

  function rolesSection() {
    if (!rolesDraft) rolesDraft = JSON.parse(JSON.stringify(roles()));
    const list = Object.entries(rolesDraft).sort((a, b) => (b[1].niveau || 0) - (a[1].niveau || 0));
    return `<section>
      <h2>Rôles de l'équipe</h2>
      <p class="muted small">Créez les rôles de votre complexe et choisissez ce que chacun peut faire. Le niveau fixe la hiérarchie : un membre ne donne un rôle qu'en dessous du sien. Vous êtes Propriétaire, niveau 100.</p>
      <form id="rolesForm" class="list">
        ${list.map(([id, r]) => `<fieldset class="card list" data-rid="${esc(id)}">
          <div class="row"><input class="input grow" data-rnom value="${esc(r.nom)}" maxlength="30" required aria-label="Nom du rôle"><label class="small muted" for="niv_${esc(id)}">Niveau</label><input class="input input-sm num" style="width:64px" id="niv_${esc(id)}" data-rniv type="number" min="1" max="99" required value="${r.niveau || 1}"></div>
          <div class="choices">${DROITS.map(([d, l, help]) => `<label class="choice" title="${esc(help)}"><input type="checkbox" data-rdroit="${d}" ${(r.droits || []).includes(d) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
          <div class="row"><span class="small muted grow">${DROITS.filter(([d]) => (r.droits || []).includes(d)).map(([, , h]) => h).join(" ; ") || "Aucun droit : il voit seulement l'espace Gestion."}</span><button type="button" class="link" style="color:var(--bad)" data-rdel="${esc(id)}">Supprimer</button></div>
        </fieldset>`).join("")}
        <button type="button" class="btn btn-ghost btn-block" id="addRole">Ajouter un rôle</button>
        <button class="btn btn-bib btn-block" type="submit">Enregistrer les rôles</button>
      </form>
    </section>`;
  }
  // Lit le formulaire des rôles (pour garder ce qui est tapé avant d'ajouter ou de supprimer un rôle)
  function readRoles() {
    const out = {};
    document.querySelectorAll("#rolesForm [data-rid]").forEach((f) => {
      out[f.dataset.rid] = { nom: f.querySelector("[data-rnom]").value.trim() || "Rôle", niveau: Math.max(1, Math.min(99, Math.round(+f.querySelector("[data-rniv]").value || 1))),
        droits: [...f.querySelectorAll("[data-rdroit]:checked")].map((x) => x.dataset.rdroit) };
    });
    return out;
  }

  function loadMembres() {
    if (mode && mode.type === "demo") { membres = demoAdmin().users; return; }
    if (!Compte.enabled) { membres = []; return; }
    membres = { loading: true };
    Compte.admin.users().then((u) => { membres = u; }, (e) => { membres = { fail: e.code || e.message }; }).then(() => { if (["reglages", "gerant"].includes(current())) render(); });
  }
  function membresSection() {
    if (!Compte.enabled) return '<section><h2>Membres</h2><div class="empty-state">Les membres arrivent avec les comptes en ligne.</div></section>';
    if (!membres) loadMembres();
    const mine = niveau(S.me.role), q = membreQuery.toLowerCase();
    const body = membres.loading ? '<div class="empty-state">Chargement des comptes...</div>' : membres.fail ? `<div class="empty-state">Lecture refusée (${esc(membres.fail)}).</div>` : (() => {
      const list = membres.filter((u) => !q || `${u.name} ${u.quartier} ${u.tel} ${roleName(u.role)}`.toLowerCase().includes(q))
        .sort((a, b) => niveau(b.role) - niveau(a.role) || String(a.name).localeCompare(String(b.name)));
      const opts = allRoles().filter(([k]) => niveau(k) < mine);
      return `<div class="list">${list.length ? list.slice(0, 60).map((u) => `<div class="card"><div class="row"><span class="avatars"><i>${initials(u.name || u.email)}</i></span>
        <div class="grow" style="min-width:0"><b>${esc(u.name || "Sans nom")}</b><div class="small muted">${esc([u.quartier, u.tel].filter(Boolean).join(" · ")) || "&nbsp;"}</div></div>
        ${u.uid === myId() || niveau(u.role) >= mine ? `<span class="chip chip-n">${esc(roleName(u.role))}</span>`
          : `<select class="input input-sm" data-mrole="${esc(u.uid)}" aria-label="Rôle de ${esc(u.name || "ce compte")}">${opts.map(([k, l]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`}</div></div>`).join("") : '<div class="empty-state">Aucun compte ne correspond.</div>'}</div>`;
    })();
    return `<section>
      <div class="sec-head"><h2>Membres</h2><button class="link" id="membresReload">Actualiser</button></div>
      <p class="muted small">Chaque personne crée son compte dans l'appli, puis vous lui donnez son rôle ici. Vous ne voyez pas les rôles au-dessus du vôtre.</p>
      <input class="input" id="membreSearch" type="search" placeholder="Chercher un nom, un quartier, un téléphone" value="${esc(membreQuery)}">
      ${body}
    </section>`;
  }

  /* ---------- Espace admin ---------- */
  // Réservé aux comptes listés dans C.admins ; les règles Firestore refusent ces lectures à tout autre compte.
  // Sans Firebase, #admin montre un aperçu avec des comptes fictifs.
  let account = null, adminData = null, adminQuery = "", adminFilter = "tous";
  // mode : null, { type: "voir", who } (l'appli comme un client la voit, lecture seule) ou { type: "demo" } (présentation)
  let mode = null, modeMe = null;
  const act = () => { if (!mode) Compte.track(); };
  const logRefus = (msg) => Compte.logError("refus", msg);
  Compte.setRole(() => S.me.role);
  const canAdmin = () => Compte.isAdmin() || (!Compte.enabled && location.hash === "#admin");
  // Sans Firebase seulement : rôles choisis avec une clé d'entrée
  const LOCAL_ROLES = { joueur: "Joueur", capitaine: "Capitaine", personnel: "Personnel", gerant: "Gérant" };
  const toDate = (t) => (t && t.toDate ? t.toDate() : t ? new Date(t) : null);
  const ago = (d) => {
    if (!d) return "jamais";
    const m = Math.round((Date.now() - d) / 6e4);
    if (m < 2) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
    const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
    const j = Math.round(h / 24); return j < 31 ? `il y a ${j} j` : `le ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  };
  const week = (u) => { const lim = dkey(addDays(today(), -6)); return Object.entries(u.activite || {}).reduce((n, [d, c]) => (d >= lim ? n + c : n), 0); };
  // Actif : des actions ces 7 derniers jours ; Nouveau : inscrit depuis moins de 7 jours ; sinon Inactif
  const userState = (u) => (!u.active ? ["Suspendu", "bad"] : week(u) > 0 ? ["Actif", "ok"] : u.created && Date.now() - u.created < 7 * 864e5 ? ["Nouveau", "warn"] : ["Inactif", "n"]);
  const telWa = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length === 9 ? "221" + d : d; };

  function demoAdmin() {
    const r = rng(7), now = Date.now(), quartiers = ["Médina", "Grand Yoff", "Parcelles", "Sicap", "HLM", "Ouakam"];
    const users = Object.values(seed().dispos).map((p, i) => {
      const activite = {};
      for (let d = 0; d < 7; d++) if (i % 4 && r() < 0.45) activite[dkey(addDays(today(), -d))] = 1 + Math.floor(r() * 3);
      return { uid: "demo" + i, name: p.name, email: "", tel: `77 ${pad(10 + i)} ${pad(20 + i)} ${pad(30 + i)}`, quartier: quartiers[i % quartiers.length], role: i === 0 ? "gerant" : i === 1 ? "personnel" : i < 5 ? "capitaine" : "joueur", poste: p.poste,
        created: new Date(now - (2 + i * 5) * 864e5), lastSeen: new Date(now - Math.floor(r() * 9 * 864e5)), active: i !== 7, activite };
    });
    const errors = [
      { id: "e1", kind: "refus", msg: "Réservation refusée : créneau déjà pris", route: "planning", name: users[2].name, role: "capitaine", uid: "demo2", ua: "Android", at: new Date(now - 42 * 6e4) },
      { id: "e2", kind: "plantage", msg: "Cannot read properties of undefined (reading 'players') (app.js:612)", route: "matchs", name: users[5].name, role: "joueur", uid: "demo5", ua: "iPhone", at: new Date(now - 5 * 36e5) },
    ];
    return { users, errors };
  }

  function loadAdmin() {
    if (!Compte.enabled) { adminData = demoAdmin(); return; }
    adminData = { loading: true, users: [], errors: [] };
    Promise.all([Compte.admin.users(), Compte.admin.errors(Date.now() - 7 * 864e5)])
      .then(([users, errors]) => { adminData = { users, errors }; })
      .catch((e) => { adminData = { users: [], errors: [], fail: e.message }; })
      .then(() => { if (current() === "admin") render(); });
  }

  function viewAdmin() {
    const shell = (body) => `<main class="wrap"><section><h2>Espace admin</h2>${body}</section></main>`;
    if (Compte.enabled && !account) return shell(`<p class="muted">Connectez-vous avec votre compte pour superviser l'appli.</p>${signInCard()}`);
    if (!canAdmin()) return shell(`<div class="card"><p>Ce compte n'est pas encore administrateur.</p><span class="label">Votre identifiant</span>
      <div class="copybox"><code id="adUid">${esc(account ? account.uid : "")}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(account ? account.uid : "")}" data-done="Identifiant copié">Copier</button></div>
      <p class="small muted">Envoyez-le pour qu'il soit ajouté dans l'appli et dans les règles Firebase.</p></div>`);
    if (!adminData) loadAdmin();
    if (adminData.loading) return shell('<div class="empty-state">Chargement des comptes...</div>');
    const users = adminData.users.map((u) => ({ ...u, created: toDate(u.created), lastSeen: toDate(u.lastSeen) }));
    const errors = adminData.errors.map((e) => ({ ...e, at: toDate(e.at) }));
    const count = (st) => users.filter((u) => userState(u)[0] === st).length;
    const q = adminQuery.toLowerCase();
    const FILTERS = [["tous", "Tous"], ["Actif", "Actifs"], ["Nouveau", "Nouveaux"], ["Inactif", "Inactifs"], ["Suspendu", "Suspendus"]];
    const list = users.filter((u) => (adminFilter === "tous" || userState(u)[0] === adminFilter) && (!q || `${u.name} ${u.quartier} ${u.tel} ${u.email}`.toLowerCase().includes(q)));
    return `<main class="wrap">
      <section>
        <div class="sec-head"><h2>Espace admin</h2><button class="link" id="adminReload">Actualiser</button></div>
        ${Compte.enabled ? "" : '<p class="small muted">Aperçu avec des comptes fictifs. Avec Firebase branché, seul votre compte voit cette page et ces données.</p>'}
        ${adminData.fail ? `<div class="empty-state">Lecture refusée : ${esc(adminData.fail)}. Vérifiez que votre identifiant est bien dans les règles Firestore.</div>` : ""}
        <div class="kpis">
          <div class="kpi"><span class="label">Inscrits</span><b class="num">${users.length}</b></div>
          <div class="kpi"><span class="label">Actifs cette semaine</span><b class="num">${count("Actif")}</b></div>
          <div class="kpi"><span class="label">Inactifs</span><b class="num">${count("Inactif")}</b></div>
          <div class="kpi"><span class="label">Erreurs (7 j)</span><b class="num" style="color:${errors.length ? "var(--bad)" : "inherit"}">${errors.length}</b></div>
        </div>
        ${(() => { const src = SOURCES.map((x) => [x, users.filter((u) => u.source === x).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
          return src.length ? `<div class="card"><h3>Comment ils ont connu ${esc(C.nomCourt)}</h3><table class="rank"><tbody>${src.map(([x, n]) => `<tr><td>${esc(x)}</td><td class="n">${n}</td></tr>`).join("")}</tbody></table>
          <p class="small muted">${users.filter((u) => u.accord).length} joueurs acceptent les messages WhatsApp.</p></div>` : ""; })()}
        <div class="card">
          <h3>Mode présentation</h3>
          <p class="small muted">Montrez l'appli sur votre seul téléphone, avec des données d'exemple : la barre en haut de l'écran passe de joueur à capitaine, personnel ou gérant.</p>
          <button class="btn btn-turf btn-block" id="startDemo">Lancer la présentation</button>
        </div>
      </section>
      <section>
        <h2>Clients</h2>
        <input class="input" id="adminSearch" type="search" placeholder="Chercher un nom, un quartier, un téléphone" value="${esc(adminQuery)}">
        <div class="choices" role="group" aria-label="Filtrer par état">${FILTERS.map(([k, l]) => `<button class="fchip" data-afilter="${k}" aria-pressed="${adminFilter === k}">${l} <span class="num">${k === "tous" ? users.length : count(k)}</span></button>`).join("")}</div>
        <div class="list">${list.length ? list.map((u) => { const [st, cls] = userState(u), n = week(u), e = errors.filter((x) => x.uid === u.uid).length; return `<div class="card">
          <div class="row"><span class="avatars"><i>${initials(u.name || u.email)}</i></span><div class="grow" style="min-width:0"><b>${esc(u.name || "Sans nom")}</b><div class="small muted" style="overflow-wrap:anywhere">${esc(roleName(u.role))}${u.quartier ? ` · ${esc(u.quartier)}` : ""}${u.tel ? ` · ${esc(u.tel)}` : ""}</div></div><span class="chip chip-${cls}">${st}</span></div>
          <div class="small muted">Inscrit ${ago(u.created)} · vu ${ago(u.lastSeen)} · <b style="color:var(--ink)">${n} action${n > 1 ? "s" : ""}</b> cette semaine (réservations, sessions, défis)${e ? ` · <b style="color:var(--bad)">${e} erreur${e > 1 ? "s" : ""}</b>` : ""}</div>
          <div class="row">${u.uid === (account && account.uid) ? "" : `<button class="btn ${u.active ? "btn-ghost" : "btn-turf"} btn-sm" data-toggle="${esc(u.uid)}" data-active="${u.active ? "0" : "1"}">${u.active ? "Suspendre" : "Réactiver"}</button>`}
            ${u.tel ? `<a class="btn btn-wa btn-sm" href="${waLink(`Bonjour ${u.name || ""}, ici l'équipe de l'appli ${C.nomCourt}. `, telWa(u.tel))}" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>` : ""}
            <button class="btn btn-bib btn-sm" data-voir="${esc(u.uid)}">Voir</button>
            <select class="input input-sm" data-role="${esc(u.uid)}" aria-label="Rôle de ${esc(u.name || "ce client")}">${allRoles().map(([k, l]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        </div>`; }).join("") : '<div class="empty-state">Aucun client ne correspond.</div>'}</div>
        <p class="small muted">« Voir » ouvre l'appli comme ce client la voit, avec son rôle, en lecture seule : rien n'est enregistré. Donnez le rôle Propriétaire au responsable du complexe : il crée ensuite ses propres rôles et les donne à son équipe.</p>
      </section>
      <section>
        <h2>Erreurs des 7 derniers jours</h2>
        <div class="list">${errors.length ? errors.map((e) => `<div class="card">
          <div class="row">${e.kind === "plantage" ? '<span class="chip chip-bad">Plantage</span>' : '<span class="chip chip-warn">Écriture refusée</span>'}<span class="small muted">${ago(e.at)} · écran ${esc(e.route || "accueil")}</span><button class="link" style="margin-left:auto" data-delerr="${esc(e.id)}">Effacer</button></div>
          <p style="overflow-wrap:anywhere">${esc(e.msg)}</p>
          <p class="small muted">${esc(e.name || e.uid)} · ${esc(e.role === "visiteur" || !e.role ? "visiteur" : roleName(e.role))} · ${esc(/iPhone|iPad/.test(e.ua || "") ? "iPhone" : /Android/.test(e.ua || "") ? "Android" : "Ordinateur")}</p>
        </div>`).join("") : '<div class="empty-state">Aucune erreur. Tout marche.</div>'}</div>
      </section>
    </main>`;
  }

  function setRole(uid, role) {
    const u = adminData.users.find((x) => x.uid === uid), done = () => { u.role = role; render(); toast(`${u.name || "Compte"} : ${roleName(role)}`); };
    if (!Compte.enabled) return done();
    Compte.admin.setRole(uid, role).then(done, () => { toast("Refusé : ce compte n'est pas admin dans les règles Firebase"); render(); });
  }

  function toggleAccount(uid, active) {
    const u = adminData.users.find((x) => x.uid === uid), done = () => { u.active = active; render(); toast(active ? `${u.name || "Compte"} réactivé` : `${u.name || "Compte"} suspendu`); };
    if (!Compte.enabled) return done();
    Compte.admin.setActive(uid, active).then(done, () => toast("Refusé : ce compte n'est pas admin dans les règles Firebase"));
  }

  // Voir : l'appli avec le profil et le rôle du client, sur les vraies données en ligne, sans rien enregistrer
  async function startVoir(uid) {
    let who = adminData && adminData.users.find((u) => u.uid === uid);
    if (Compte.enabled) who = await Compte.admin.user(uid).catch(() => who);
    if (!who) return toast("Compte introuvable");
    mode = { type: "voir", who };
    modeMe = { name: who.name || "Client", role: who.role || "joueur", poste: who.poste || "Milieu", equipe: who.equipe || "" };
    derive(); location.hash = memberRole(who.role) ? "gerant" : "accueil"; render();
  }
  // Présentation : données d'exemple neuves, rôle choisi dans la barre du haut
  function startDemo(role) {
    if (!mode || mode.type !== "demo") { DEMO = seed(); modeMe = { name: "Démo", poste: "Milieu", equipe: "t0" }; }
    modeMe.role = role; mode = { type: "demo" };
    derive(); location.hash = memberRole(role) ? "gerant" : "accueil"; render();
  }
  function stopMode() { mode = null; modeMe = null; DEMO = null; adminData = null; derive(); location.hash = "admin"; render(); }
  function modeBar() {
    if (!mode) return "";
    const list = allRoles().reverse();
    return `<div class="modebar"><div class="wrap">${mode.type === "voir"
      ? `<span class="small">Vue de <b>${esc(mode.who.name || "client")}</b> (${esc(roleName(S.me.role))}) · lecture seule</span>`
      : `<span class="small"><b>Présentation</b></span>${list.map(([k, l]) => `<button class="fchip fchip-sm" data-demorole="${k}" aria-pressed="${S.me.role === k}">${esc(l)}</button>`).join("")}`}
      <button class="iconbtn" data-stopmode aria-label="Quitter">×</button></div></div>`;
  }
  // En lecture seule, les boutons qui enregistrent quelque chose sont bloqués
  const WRITE_SEL = "[data-book],[data-defi],[data-sess],[data-pay],[data-cancel],[data-join],[data-leave],[data-slot],[data-confirm],[data-cash],[data-absent],[data-score],[data-sub],[data-abo],[data-ppaid],#newNeed,#addPhone,#addStaff,[data-rmstaff],#openSess,#editProfile,#signOut,[data-forecast]";
  document.addEventListener("click", (e) => {
    const w = e.target.closest(WRITE_SEL);
    if (mode && mode.type === "voir" && (w || e.target.closest("button[type=submit]"))) { e.preventDefault(); e.stopImmediatePropagation(); toast("Vue en lecture seule : rien n'est modifié"); return; }
    // Avec les comptes, il faut être connecté pour réserver, jouer ou s'inscrire
    if (w && Compte.enabled && !account && !mode) { e.preventDefault(); e.stopImmediatePropagation(); closeSheet(); toast("Connectez-vous d'abord, ça prend 20 secondes"); location.hash = "profil"; }
  }, true);
  document.addEventListener("submit", (e) => { if (mode && mode.type === "voir") { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

  function suspendedView() {
    return `<main class="wrap"><section><h2>Compte suspendu</h2><div class="empty-state">Votre compte est suspendu. Contactez l'équipe au <b>${esc(C.supportTel || C.telephone)}</b>.</div><button class="btn btn-ghost btn-block" id="signOut">Me déconnecter</button></section></main>`;
  }

  /* ---------- Navigation et événements ---------- */
  const VIEWS = { accueil: viewAccueil, planning: viewPlanning, matchs: viewMatchs, profil: viewProfil, gerant: viewGerant, reglages: viewReglages, admin: viewAdmin };
  const LABELS = { accueil: "Accueil", planning: "Planning", matchs: "Jouer", profil: "Profil", gerant: "Gestion", reglages: "Réglages", admin: "Admin" };
  const current = () => { const h = location.hash.slice(1); return VIEWS[h] ? h : "accueil"; };

  function render() {
    derive();
    const v = current();
    const tabs = Object.keys(VIEWS).filter((k) => (k !== "gerant" || isStaff()) && (k !== "reglages" || canReglages()) && (k !== "admin" || (canAdmin() && !mode)));
    if (account && !account.active) {
      $("#app").innerHTML = `<header class="top"><div class="wrap">${crest()}<span class="brand">${esc(C.nom)}</span></div></header>${suspendedView()}`;
      $("#signOut").addEventListener("click", () => Compte.signOut().then(() => { account = null; render(); }));
      return;
    }
    $("#app").innerHTML = `
      <header class="top"><div class="wrap">${crest()}<span class="brand">${esc(C.nom)}</span><span class="who">${S.me.name ? esc(S.me.name) : '<a href="#profil" style="color:inherit">Se connecter</a>'}</span><button class="iconbtn" data-sharesheet aria-label="Partager l'appli"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg></button></div>${modeBar()}</header>
      ${VIEWS[v]()}
      <div class="tabs"><nav style="--n:${tabs.length}">${tabs.map((k) => `<a href="#${k}" ${k === v ? 'aria-current="page"' : ""}>${icon(k)}${LABELS[k]}</a>`).join("")}</nav></div>`;
    document.title = `${C.nomCourt} · ${LABELS[v]}`;
    bindView();
  }

  function bindView() {
    const app = $("#app");
    const f = $("#meForm");
    if (f) {
      const sync = () => { const r = f.querySelector("[name=mRole]:checked").value; $("#keyField").hidden = Compte.enabled || !(r === "gerant" || r === "personnel"); };
      f.addEventListener("change", sync); sync();
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const role = f.querySelector("[name=mRole]:checked").value, key = ($("#mKey").value || "").trim().toUpperCase();
        if (!Compte.enabled && ((role === "gerant" && key !== C.cles.gerant) || (role === "personnel" && key !== C.cles.personnel))) { toast("Clé d'entrée incorrecte"); return; }
        const p = { name: $("#mName").value.trim(), poste: f.querySelector("[name=mPoste]:checked").value, equipe: $("#mTeam").value, role };
        if (account) Object.assign(p, { tel: ($("#mTel") || {}).value || "", quartier: ($("#mQuartier") || {}).value || "", source: ($("#mSource") || {}).value || "", accord: !!($("#mAccord") || {}).checked });
        setMe(p).then(() => toast("Profil enregistré"), fail("Profil"));
        if (account) put("dispos", myId(), { name: p.name, poste: p.poste, slots: S.me.slots }).catch(() => {});
        location.hash = memberRole(role) ? "gerant" : "profil"; render();
      });
    }
    const on = (sel, fn) => app.querySelectorAll(sel).forEach((el) => el.addEventListener("click", (e) => fn(el, e)));
    on("[data-day]", (el) => { planDay = el.dataset.day; render(); const g = $(".grid"); g && g.scrollIntoView({ behavior: "smooth", block: "start" }); });
    on("[data-cal]", (el) => { calMonth = Math.max(0, calMonth + +el.dataset.cal); render(); });
    on("[data-book]", (el) => { const [k, h, ti] = el.dataset.book.split("|"); bookSheet(k, +h, +ti, pendingDefi); pendingDefi = false; });
    on("[data-defi]", (el) => acceptSheet(el.dataset.defi));
    on("[data-sess]", (el) => joinSheet(el.dataset.sess));
    on("[data-sub]", subSheet);
    on("[data-sharesheet]", shareSheet);
    on("#qrBig", qrFull);
    on("#installApp", () => { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); });
    on("#openSess", openSessSheet);
    on("[data-pay]", (el) => paySheet(S.bookings.find((x) => x.id === el.dataset.pay)));
    on("[data-cancel]", (el) => cancelSheet(el.dataset.cancel));
    on("[data-seg]", (el) => { seg = el.dataset.seg; render(); });
    on("#newDefi", () => { pendingDefi = true; toast("Touchez un créneau libre pour lancer votre défi"); });
    on("#newNeed", needSheet);
    on("[data-join]", (el) => {
      if (!S.me.name) { toast("Créez d'abord votre profil"); location.hash = "profil"; return; }
      const n = S.needs.find((x) => x.id === el.dataset.join);
      patch("annonces", n.id, { ["joined." + myId()]: S.me.name }).then(() => { act(); toast(`C'est noté, ${n.team} compte sur vous`); }, fail("Réponse à l'annonce"));
    });
    on("[data-leave]", (el) => patch("annonces", el.dataset.leave, { ["joined." + myId()]: DEL }).catch(fail("Réponse à l'annonce")));
    on("[data-slot]", (el) => {
      if (!S.me.name) { toast("Créez d'abord votre profil"); location.hash = "profil"; return; }
      const s = el.dataset.slot, slots = S.me.slots.includes(s) ? S.me.slots.filter((x) => x !== s) : [...S.me.slots, s];
      put("dispos", myId(), { name: S.me.name, poste: S.me.poste, slots }).catch(fail("Disponibilités"));
    });
    on("[data-forecast]", (el) => { const [k, h] = el.dataset.forecast.split("|"); forecastSheet(k, +h); });
    on("#editProfile", () => { $("#app").querySelector("main").outerHTML = onboarding(); bindView(); });
    on("#addPhone", phoneSheet);
    on("#addStaff", staffSheet);
    on("[data-rmstaff]", (el) => drop("personnel", el.dataset.rmstaff).catch(fail("Personnel")));
    on("[data-confirm]", (el) => patch("creneaux", el.dataset.confirm, { status: "confirme" }).then(() => toast("Acompte validé, la réservation est confirmée"), fail("Acompte")));
    on("[data-abo]", (el) => { const a = S.abos.find((x) => x.id === el.dataset.abo), from = Math.max(Date.now(), a.status === "actif" && a.until > Date.now() ? a.until : 0);
      patch("abonnes", a.id, { status: "actif", until: new Date(from + 30 * 864e5) }).then(() => toast(`${a.name} abonné jusqu'au ${dayLabel(dkey(new Date(from + 30 * 864e5))).toLowerCase()}`), fail("Abonnement")); });
    on("[data-cash]", (el) => cashSheet(el.dataset.cash));
    on("[data-absent]", (el) => patch("creneaux", el.dataset.absent, { status: "absent" }).catch(fail("Absence")));
    on("[data-score]", (el) => scoreSheet(el.dataset.score));
    on("#exportCsv", exportCsv);
    on("[data-img]", (el) => shareImage(el.dataset.img, el.dataset.res));
    on("[data-launch]", (el) => { el.disabled = true; patch("creneaux", el.dataset.launch, { min: +el.dataset.n }).then(() => toast(`Session lancée à ${el.dataset.n} joueurs : prévenez-les avec le bouton Rappel`), fail("Lancement de la session")); });
    const tf = $("#tarifForm");
    tf && tf.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = Object.fromEntries([...tf.querySelectorAll("[data-t]")].map((x) => [x.dataset.t, Math.round(+x.value)]));
      if (v.minJoueurs > v.maxJoueurs) return toast("Le nombre de joueurs au plus doit être au moins égal au minimum");
      put("reglages", "tarifs", v).then(() => toast("Prix enregistrés"), fail("Prix"));
    });
    const rf = $("#rolesForm");
    if (rf) {
      rf.addEventListener("submit", (e) => { e.preventDefault(); const r = readRoles(); put("reglages", "roles", { roles: r }).then(() => { rolesDraft = null; toast("Rôles enregistrés"); }, fail("Rôles")); });
      on("#addRole", () => { rolesDraft = readRoles(); rolesDraft["r" + uid()] = { nom: "Nouveau rôle", niveau: 10, droits: [] }; render(); });
      on("[data-rdel]", (el) => { rolesDraft = readRoles(); delete rolesDraft[el.dataset.rdel]; render(); toast("Rôle retiré : enregistrez pour confirmer"); });
    }
    app.querySelectorAll("[data-mrole]").forEach((el) => el.addEventListener("change", () => {
      const u = membres.find((x) => x.uid === el.dataset.mrole);
      if (mode && mode.type === "voir") { toast("Vue en lecture seule : rien n'est modifié"); return render(); }
      const done = () => { u.role = el.value; toast(`${u.name || "Compte"} : ${roleName(el.value)}`); render(); };
      if (!Compte.enabled || mode) return done();
      Compte.admin.setRole(u.uid, el.value).then(done, (e) => { fail("Rôle d'un membre")(e); });
    }));
    on("#membresReload", () => { membres = null; render(); });
    const ms = $("#membreSearch");
    ms && ms.addEventListener("input", () => { membreQuery = ms.value; const pos = ms.selectionStart; render(); const m2 = $("#membreSearch"); m2.focus(); m2.setSelectionRange(pos, pos); });
    on("[data-afilter]", (el) => { adminFilter = el.dataset.afilter; render(); });
    on("[data-voir]", (el) => startVoir(el.dataset.voir));
    on("#startDemo", () => startDemo("joueur"));
    on("[data-demorole]", (el) => startDemo(el.dataset.demorole));
    on("[data-stopmode]", stopMode);
    on("#adminReload", () => { adminData = null; render(); });
    on("[data-toggle]", (el) => toggleAccount(el.dataset.toggle, el.dataset.active === "1"));
    app.querySelectorAll("[data-role]").forEach((el) => el.addEventListener("change", () => setRole(el.dataset.role, el.value)));
    on("[data-delerr]", (el) => {
      const id = el.dataset.delerr, drop = () => { adminData.errors = adminData.errors.filter((e) => e.id !== id); render(); };
      Compte.enabled ? Compte.admin.deleteError(id).then(drop, (e) => toast("Refusé : " + e.message)) : drop();
    });
    const search = $("#adminSearch");
    search && search.addEventListener("input", () => { adminQuery = search.value; const pos = search.selectionStart; render(); const s2 = $("#adminSearch"); s2.focus(); s2.setSelectionRange(pos, pos); });
    on("#signOut", () => Compte.signOut().then(() => { account = null; adminData = null; listen(); derive(); location.hash = "profil"; render(); toast("Déconnecté"); }));
    const signedIn = (p) => { account = p; adminData = null; listen(); derive(); render(); };
    const authFail = (e) => { logRefus("Connexion refusée : " + (e.code || e.message)); toast(/wrong-password|invalid-credential|user-not-found/.test(e.code || "") ? "E-mail ou mot de passe incorrect" : /email-already/.test(e.code || "") ? "Ce compte existe déjà, connectez-vous" : "Connexion impossible : " + (e.code || e.message)); };
    on("#gSignIn", () => Compte.signIn().then((p) => p && signedIn(p), authFail));
    const mf = $("#mailForm");
    mf && mf.addEventListener("submit", (e) => {
      e.preventDefault();
      Compte.signInEmail($("#lMail").value.trim(), $("#lPass").value, e.submitter && e.submitter.dataset.mode === "new").then(signedIn, authFail);
    });
  }
  let pendingDefi = false;

  window.addEventListener("hashchange", () => { closeSheet(); if (current() === "admin") adminData = null; if (current() === "reglages") { membres = null; rolesDraft = null; } render(); window.scrollTo(0, 0); });
  derive(); render();
  if (Compte.enabled) Compte.start().then((p) => { account = p; listen(); derive(); render(); }, (e) => { console.warn(e); toast("Connexion au serveur impossible, vérifiez Internet puis rouvrez l'appli"); });
  setInterval(() => { if (current() === "planning" && !$("#scrim")) render(); }, 60000);
  if ("serviceWorker" in navigator && location.protocol === "https:" && window.top === window) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
