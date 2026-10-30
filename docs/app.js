// Momo Foot : vitrine, planning et réservation, matchmaking, profils, espace gérant.
// Sans FIREBASE_CONFIG, les données vivent sur le téléphone (localStorage) et l'appli démarre avec des données de démo.
(function () {
  const C = window.MOMO_CONFIG;
  const KEY = "momo-foot-v1";
  const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const JOURS_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const POSTES = ["Gardien", "Défenseur", "Milieu", "Attaquant"];
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
  const price = (k, h) => (isWeekend(k) || h >= C.tarifs.heurePleine ? C.tarifs.pleine : C.tarifs.creuse);
  const isPast = (k, h) => { const d = fromKey(k); d.setHours(h, 0, 0, 0); return d < new Date(); };
  const waLink = (text, num) => `https://wa.me/${num || ""}?text=${encodeURIComponent(text)}`;
  const APP_URL = C.urlAppli || location.href.split("#")[0];
  const inviteText = () => `Rejoins ${C.nom} sur l'appli : réserve ton créneau, ou inscris-toi seul à une session (à ${C.sessions.minJoueurs} joueurs, on joue). Ouvre le lien puis « Ajouter à l'écran d'accueil » pour l'installer : ${APP_URL}`;
  const qrSvg = (text, cell) => { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); };

  /* ---------- Données ---------- */
  function rng(seed) { return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280); }

  function seed() {
    const r = rng(42);
    const noms = ["Les Lions du Quartier", "Galaxy FC", "Médina Stars", "Team Gorgui", "Les Bleus du Jeudi", "AS Corniche", "Dynamo 221", "Black Panthers"];
    const caps = ["Moussa D.", "Ibrahima S.", "Cheikh N.", "Pape F.", "Alioune B.", "Mamadou K.", "Serigne T.", "Omar G."];
    const teams = noms.map((name, i) => ({ id: "t" + i, name, captain: caps[i], color: COULEURS[i], elo: 1000 + Math.round(r() * 300), w: 0, d: 0, l: 0, gf: 0, ga: 0, phone: `77 ${pad(10 + i * 7)} ${pad(30 + i)} ${pad(40 + i * 3)}` }));
    const prenoms = ["Abdou", "Bamba", "Lamine", "Khadim", "Saliou", "Assane", "Modou", "Babacar", "Ousmane", "Youssou", "Malick", "Fallou", "Idrissa", "Djibril", "Aliou", "Samba", "Demba", "Habib", "Kader", "Ndiaga", "Souleymane", "Tidiane"];
    const dispos = prenoms.map((p, i) => {
      const slots = [];
      for (let d = 0; d < 7; d++) for (const h of SOIR) if (r() < (d >= 4 ? 0.5 : 0.28) + (h >= 20 && h <= 21 ? 0.25 : 0)) slots.push(`${d}-${h}`);
      return { id: "p" + i, name: `${p} ${String.fromCharCode(65 + (i * 7) % 26)}.`, poste: POSTES[i % 4], slots };
    });

    const bookings = [], results = [], receipts = [];
    let rec = 1;
    const t0 = today();
    for (let off = -14; off <= 6; off++) {
      const k = dkey(addDays(t0, off));
      for (const h of hours()) C.terrains.forEach((_, ti) => {
        const p = h >= 19 && h <= 22 ? 0.8 : h >= 17 ? 0.55 : 0.18;
        if (r() > p + (isWeekend(k) ? 0.15 : 0)) return;
        const a = teams[Math.floor(r() * teams.length)];
        let b = teams[Math.floor(r() * teams.length)];
        if (b === a) b = null;
        const past = isPast(k, h);
        const defi = !past && !b && r() < 0.8;
        const bk = { id: uid(), date: k, hour: h, terrain: ti, team: a.name, teamId: a.id, phone: a.phone, opponent: b ? b.name : "", type: defi ? "defi" : "prive", niveau: ["Détente", "Moyen", "Costaud"][Math.floor(r() * 3)], price: price(k, h), status: past ? "paye" : r() < 0.25 ? "attente" : "confirme", createdAt: Date.now() - Math.floor(r() * 6e5) };
        bookings.push(bk);
        if (past) {
          receipts.push({ n: rec++, date: k, hour: h, team: a.name, amount: bk.price, by: r() < 0.5 ? "Wave" : "Espèces" });
          if (b) {
            const sa = Math.floor(r() * 8), sb = Math.floor(r() * 8);
            results.push({ id: uid(), date: k, hour: h, a: a.name, b: b.name, sa, sb, motm: dispos[Math.floor(r() * dispos.length)].name });
            applyResult(teams, a.name, b.name, sa, sb);
          }
        }
      });
    }
    const needs = bookings.filter((b) => !isPast(b.date, b.hour) && b.type === "prive").slice(0, 5).map((b, i) => ({ id: uid(), bookingId: b.id, team: b.team, date: b.date, hour: b.hour, terrain: b.terrain, missing: 1 + (i % 3), poste: POSTES[(i + 1) % 4], joined: i % 2 ? [dispos[i].name] : [] }));
    const staff = [
      { id: uid(), name: "Ousmane", role: "Ouverture et entretien", shift: "10h - 17h" },
      { id: uid(), name: "Fatou", role: "Accueil et caisse", shift: "17h - 00h" },
      { id: uid(), name: "Ibou", role: "Arbitre (week-end)", shift: "Sam. et dim. soir" },
    ];
    const st = { v: 2, demo: true, teams, dispos, bookings, results, receipts, needs, staff, nextReceipt: rec, me: { name: "", poste: "Milieu", teamId: "", role: "joueur", slots: [], goals: 0, motm: 0, abonne: false } };
    // Sessions « Je veux jouer » de la semaine, déjà en partie remplies
    st.bookings = st.bookings.filter((b) => !(isAutoSlot(b.date, b.hour, b.terrain) && !isPast(b.date, b.hour)));
    ensureSessions(st);
    st.bookings.filter((b) => b.type === "session").forEach((b, i) => {
      const off = Math.round((fromKey(b.date) - t0) / 864e5);
      const n = Math.max(3, Math.min(C.sessions.maxJoueurs, Math.round(11 - off * 1.2 + r() * 3 - (i % 3 === 0 ? 3 : 0))));
      const pool = [...dispos].sort(() => r() - 0.5).slice(0, n);
      b.players = pool.map((p) => ({ name: p.name, poste: p.poste, paid: r() < 0.7, abonne: r() < 0.3 }));
      b.price = sessionTotal(b);
    });
    return st;
  }

  function isAutoSlot(k, h, ti) {
    const dow = fromKey(k).getDay();
    return C.sessions.auto.some((a) => a.jours.includes(dow) && a.heure === h && a.terrain === ti);
  }
  // Ouvre les sessions automatiques des 7 prochains jours sur les créneaux encore libres.
  function ensureSessions(st) {
    for (let off = 0; off < 7; off++) {
      const k = dkey(addDays(today(), off)), dow = fromKey(k).getDay();
      for (const a of C.sessions.auto) {
        if (!a.jours.includes(dow) || isPast(k, a.heure) || st.bookings.some((b) => b.date === k && b.hour === a.heure && b.terrain === a.terrain)) continue;
        st.bookings.push(newSession(k, a.heure, a.terrain));
      }
    }
  }
  function newSession(k, h, ti, players) {
    const b = { id: uid(), date: k, hour: h, terrain: ti, team: "Session joueurs seuls", teamId: "", phone: "", opponent: "", type: "session", niveau: "Tous niveaux", status: "confirme", createdAt: Date.now(), players: players || [] };
    b.price = sessionTotal(b);
    return b;
  }
  const sessionTotal = (b) => b.players.reduce((s, p) => s + (p.abonne ? C.sessions.prixAbonne : C.sessions.prixJoueur), 0);

  function applyResult(teams, an, bn, sa, sb) {
    const a = teams.find((t) => t.name === an), b = teams.find((t) => t.name === bn);
    if (!a || !b) return;
    const ea = 1 / (1 + 10 ** ((b.elo - a.elo) / 400)), s = sa > sb ? 1 : sa === sb ? 0.5 : 0;
    a.elo = Math.round(a.elo + 32 * (s - ea)); b.elo = Math.round(b.elo - 32 * (s - ea));
    a.gf += sa; a.ga += sb; b.gf += sb; b.ga += sa;
    if (s === 1) { a.w++; b.l++; } else if (s === 0) { a.l++; b.w++; } else { a.d++; b.d++; }
  }

  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = seed();
  ensureSessions(S);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage bloqué : la session continue en mémoire */ } };

  // Les créneaux en attente d'acompte se libèrent tout seuls après le délai.
  function expireHolds() {
    const lim = Date.now() - C.attenteAcompteMinutes * 60000;
    const before = S.bookings.length;
    S.bookings = S.bookings.filter((b) => !(b.status === "attente" && b.mine && b.createdAt < lim));
    if (S.bookings.length !== before) save();
  }

  const myTeam = () => S.teams.find((t) => t.id === S.me.teamId);
  const isStaff = () => S.me.role === "gerant" || S.me.role === "personnel";
  const level = (elo) => (elo >= 1200 ? "Costaud" : elo >= 1080 ? "Moyen" : "Détente");
  const standings = () => [...S.teams].sort((a, b) => b.elo - a.elo);

  /* ---------- Interface commune ---------- */
  const ICONS = {
    accueil: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    planning: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    matchs: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 5h-5L8 10z"/><path d="M12 3v4M21 10l-5 0M3 10h5M15 15l3 5M9 15l-3 5"/>',
    profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    gerant: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
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
    expireHolds();
    const days = [...Array(7)].map((_, i) => addDays(today(), i));
    const mine = S.bookings.filter((b) => b.mine && !isPast(b.date, b.hour)).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour)));
    return `<main class="wrap">
      <section>
        <h2>Planning</h2>
        <div class="days" role="group" aria-label="Choisir le jour">${days.map((d) => `<button data-day="${dkey(d)}" aria-pressed="${dkey(d) === planDay}"><span>${JOURS[d.getDay()]}</span><b class="num">${d.getDate()}</b></button>`).join("")}</div>
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

  function slotCell(k, h, ti) {
    const b = findBk(k, h, ti);
    if (isPast(k, h)) return `<div class="slot taken past"><b>${b ? esc(b.team) : "-"}</b><span>terminé</span></div>`;
    if (!b) return `<button class="slot free" data-book="${k}|${h}|${ti}"><b class="num">${money(price(k, h))}</b><span>Libre</span></button>`;
    const mine = b.mine ? " mine" : "";
    if (b.type === "session") return `<button class="slot sess${b.players.some((p) => p.name === S.me.name) ? " mine" : ""}" data-sess="${b.id}"><b>Je veux jouer</b><span class="num">${b.players.length}/${C.sessions.minJoueurs} inscrits</span></button>`;
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
        <label class="choice"><input type="checkbox" id="bRec"><span>Répéter chaque ${JOURS_LONG[fromKey(k).getDay()]} à ${hh(h)}</span></label>
        <button class="btn btn-bib btn-block" type="submit">Bloquer le créneau</button>
        <p class="small muted">Le créneau est gardé ${C.attenteAcompteMinutes} min le temps d'envoyer l'acompte de ${money(C.acompte)} par Wave.</p>
      </form>`, (el) => {
      el.querySelector("#bookForm").addEventListener("submit", (e) => {
        e.preventDefault();
        if (findBk(k, h, ti)) { toast("Ce créneau vient d'être pris. Choisissez-en un autre."); closeSheet(); render(); return; }
        const name = el.querySelector("#bTeam").value.trim(), phone = el.querySelector("#bPhone").value.trim();
        let team = S.teams.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!team) { team = { id: "t" + uid(), name, captain: S.me.name || "Capitaine", color: COULEURS[S.teams.length % COULEURS.length], elo: 1050, w: 0, d: 0, l: 0, gf: 0, ga: 0, phone }; S.teams.push(team); }
        if (!S.me.teamId) S.me.teamId = team.id;
        const rec = el.querySelector("#bRec").checked;
        const base = { team: team.name, teamId: team.id, phone, opponent: "", type: el.querySelector("[name=bType]:checked").value, niveau: el.querySelector("[name=bLvl]:checked").value, status: "attente", mine: true, recurrent: rec, createdAt: Date.now() };
        const bk = { id: uid(), date: k, hour: h, terrain: ti, price: price(k, h), ...base };
        S.bookings.push(bk);
        if (rec) for (let w = 1; w <= 3; w++) { const kk = dkey(addDays(fromKey(k), 7 * w)); if (!findBk(kk, h, ti)) S.bookings.push({ ...base, id: uid(), date: kk, hour: h, terrain: ti, price: price(kk, h), status: "confirme" }); }
        save(); paySheet(bk.id); render();
      });
    });
  }

  function paySheet(id) {
    const b = S.bookings.find((x) => x.id === id);
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
      <button class="btn btn-ghost btn-block" id="payDone">J'ai payé (démo : confirme tout de suite)</button>
      <p class="small muted">En production, le gérant confirme le paiement depuis son espace et vous recevez la confirmation. La veille du match, un rappel part sur WhatsApp.</p>`, (el) => {
      el.querySelector("#payDone").addEventListener("click", () => { b.status = "confirme"; save(); closeSheet(); render(); toast("Réservation confirmée. À bientôt sur le terrain !"); });
    });
  }

  function cancelSheet(id) {
    const b = S.bookings.find((x) => x.id === id);
    const d = fromKey(b.date); d.setHours(b.hour);
    const free = (d - Date.now()) / 36e5 >= C.annulationGratuiteHeures;
    sheet(`${head("Annuler la réservation ?", `${dayLabel(b.date)} · ${hh(b.hour)} · ${esc(b.team)}`)}
      <p>${free ? "L'annulation est gratuite : l'acompte vous sera rendu." : `Le match est dans moins de ${C.annulationGratuiteHeures} h : l'acompte de ${money(C.acompte)} est gardé par le complexe.`}</p>
      <div class="row"><button class="btn btn-ghost grow" data-close>Garder</button><button class="btn btn-bib grow" id="doCancel">Annuler le créneau</button></div>`, (el) => {
      el.querySelector("#doCancel").addEventListener("click", () => { S.bookings = S.bookings.filter((x) => x.id !== id); S.needs = S.needs.filter((n) => n.bookingId !== id); save(); closeSheet(); render(); toast("Réservation annulée, le créneau est libéré"); });
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
        let team = S.teams.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!team) { team = { id: "t" + uid(), name, captain: S.me.name || "Capitaine", color: COULEURS[S.teams.length % COULEURS.length], elo: 1050, w: 0, d: 0, l: 0, gf: 0, ga: 0, phone: "" }; S.teams.push(team); }
        if (!S.me.teamId) S.me.teamId = team.id;
        b.opponent = team.name; b.opponentMine = true; save(); closeSheet(); render();
        toast(`Match calé : ${b.team} vs ${team.name}`);
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
    const left = n.missing - n.joined.length, me = S.me.name && n.joined.includes(S.me.name);
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
        S.needs.unshift({ id: uid(), bookingId: b.id, team: b.team, date: b.date, hour: b.hour, terrain: b.terrain, missing: +el.querySelector("#nMiss").value, poste: el.querySelector("[name=nPoste]:checked").value, joined: [], mine: true });
        save(); closeSheet(); seg = "joueurs"; render(); toast("Annonce publiée");
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
        S.bookings.push(newSession(k, h, ti, pool.map((p) => ({ name: p.name, poste: p.poste, paid: false, abonne: p.me ? S.me.abonne : false }))));
        save(); closeSheet(); seg = "jouer"; render(); toast("Session ouverte. Les joueurs reçoivent le lien WhatsApp pour payer leur place.");
      });
    });
  }

  /* ---------- Je veux jouer ---------- */
  const openSessions = () => S.bookings.filter((b) => b.type === "session" && !isPast(b.date, b.hour)).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour)));
  const myPrice = () => (S.me.abonne ? C.sessions.prixAbonne : C.sessions.prixJoueur);

  function sessionCard(b) {
    const n = b.players.length, min = C.sessions.minJoueurs, max = C.sessions.maxJoueurs;
    const me = S.me.name && b.players.some((p) => p.name === S.me.name);
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
    const me = b.players.find((p) => p.name === S.me.name);
    const order = { Gardien: 0, "Défenseur": 1, Milieu: 2, Attaquant: 3 };
    const byPoste = POSTES.map((p) => `${p} : ${b.players.filter((x) => x.poste === p).length}`).join(" · ");
    const ref = "MS-" + b.id.slice(0, 4).toUpperCase();
    const msg = `Bonjour ${C.nomCourt}, je suis inscrit à la session du ${dayLabel(b.date).toLowerCase()} à ${hh(b.hour)}. ${money(myPrice())} envoyés par Wave, référence ${ref}. ${S.me.name}`;
    sheet(`${head("Session joueurs seuls", `${dayLabel(b.date)} · ${hh(b.hour)} · ${esc(C.terrains[b.terrain])}`)}
      <div class="meter"><i style="width:${Math.min(100, (b.players.length / C.sessions.minJoueurs) * 100)}%"></i></div>
      <p class="small"><b class="num">${b.players.length}/${C.sessions.minJoueurs}</b> inscrits. ${byPoste}</p>
      <div class="list small">${[...b.players].sort((x, y) => order[x.poste] - order[y.poste]).map((p) => `<div class="row"><span class="avatars"><i>${initials(p.name)}</i></span><span class="grow">${esc(p.name)}${p.name === S.me.name ? " (vous)" : ""}</span><span class="muted">${esc(p.poste)}</span>${p.paid ? '<span class="chip chip-ok">payé</span>' : '<span class="chip chip-warn">à payer</span>'}</div>`).join("")}</div>
      ${me ? `${me.paid ? "" : `<div class="pay"><span class="label">Votre place</span><span class="big num">${money(myPrice())}</span><div class="copybox"><code>${esc(C.wave)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(C.wave)}" data-done="Numéro Wave copié">Copier</button></div><p class="small">Référence Wave : <b>${ref}</b></p></div>
        <a class="btn btn-turf btn-block" href="${waLink(msg, C.whatsapp)}" target="_blank" rel="noopener">Prévenir le complexe sur WhatsApp</a>
        <button class="btn btn-ghost btn-block" id="jPaid">J'ai payé (démo)</button>`}
        <button class="btn btn-ghost btn-block" id="jLeave">Me désinscrire</button>`
      : `<button class="btn btn-bib btn-block" id="jJoin" ${b.players.length >= C.sessions.maxJoueurs ? "disabled" : ""}>M'inscrire comme ${esc(S.me.poste.toLowerCase())} · ${money(myPrice())}</button>
        <p class="small muted">Payez votre place par Wave pour la garder. Si la session n'atteint pas ${C.sessions.minJoueurs} joueurs, vous êtes remboursé.</p>`}`, (el) => {
      const j = el.querySelector("#jJoin"), l = el.querySelector("#jLeave"), pd = el.querySelector("#jPaid");
      j && j.addEventListener("click", () => { b.players.push({ name: S.me.name, poste: S.me.poste, paid: false, abonne: S.me.abonne }); b.price = sessionTotal(b); save(); render(); joinSheet(id); toast(b.players.length >= C.sessions.minJoueurs ? "Inscrit ! La session est confirmée" : `Inscrit ! Plus que ${C.sessions.minJoueurs - b.players.length} joueurs`); });
      l && l.addEventListener("click", () => { b.players = b.players.filter((p) => p.name !== S.me.name); b.price = sessionTotal(b); save(); closeSheet(); render(); toast("Désinscrit"); });
      pd && pd.addEventListener("click", () => { me.paid = true; save(); closeSheet(); render(); toast("Place payée, à bientôt sur le terrain"); });
    });
  }

  function subCard() {
    const save1 = (C.sessions.prixJoueur - C.sessions.prixAbonne);
    const breakEven = Math.ceil(C.sessions.abonnementMois / save1);
    return `<div class="card">
      <div class="row"><h3 class="grow">Abonné ${esc(C.nomCourt)}</h3>${S.me.abonne ? '<span class="chip chip-ok">Actif</span>' : `<span class="chip chip-n num">${money(C.sessions.abonnementMois)} / mois</span>`}</div>
      <p class="small">Chaque session à ${money(C.sessions.prixAbonne)} au lieu de ${money(C.sessions.prixJoueur)}, et vous êtes prévenu en premier quand une session s'ouvre sur vos dispos. Rentabilisé dès ${breakEven} sessions par mois.</p>
      ${S.me.abonne ? "" : '<button class="btn btn-turf btn-block" data-sub>S\'abonner</button>'}
    </div>`;
  }

  function subSheet() {
    if (!S.me.name) { toast("Créez d'abord votre profil"); location.hash = "profil"; return; }
    sheet(`${head("S'abonner", `${money(C.sessions.abonnementMois)} par mois`)}
      <div class="pay"><span class="label">Abonnement du mois</span><span class="big num">${money(C.sessions.abonnementMois)}</span><div class="copybox"><code>${esc(C.wave)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(C.wave)}" data-done="Numéro Wave copié">Copier</button></div></div>
      <button class="btn btn-bib btn-block" id="subOk">J'ai payé par Wave (démo : active tout de suite)</button>`, (el) => {
      el.querySelector("#subOk").addEventListener("click", () => { S.me.abonne = true; save(); closeSheet(); render(); toast("Abonnement activé"); });
    });
  }

  function openSessSheet() {
    sheet(`${head("Ouvrir une session", "Pour les joueurs sans équipe")}
      <form id="osForm" class="list">
        <div class="row"><div class="field grow"><label for="oDay">Jour</label><select class="input" id="oDay">${[...Array(7)].map((_, i) => { const kk = dkey(addDays(today(), i)); return `<option value="${kk}">${dayLabel(kk)}</option>`; }).join("")}</select></div>
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
        S.bookings.push(newSession(k, h, ti)); save(); closeSheet(); render(); toast("Session ouverte");
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
    if (!S.me.name) return onboarding();
    const mt = S.bookings.filter((b) => (b.teamId === S.me.teamId || (t && b.opponent === t.name)) && isPast(b.date, b.hour)).length;
    const roleName = { joueur: "Joueur", capitaine: "Capitaine", personnel: "Personnel", gerant: "Gérant" }[S.me.role];
    return `<main class="wrap">
      <div class="player">
        <svg class="jersey" viewBox="0 0 84 84" aria-hidden="true"><path d="M26 8h32l18 12-8 14-8-4v46H24V30l-8 4-8-14z" fill="${t ? t.color : "#E9601A"}" stroke="#F4FFF8" stroke-width="2"/><text x="42" y="58" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="26" fill="#F4FFF8">${esc(initials(S.me.name))}</text></svg>
        <div><span class="label" style="color:inherit;opacity:.8">${roleName} · ${esc(S.me.poste)}</span><h2>${esc(S.me.name)}</h2><p>${t ? esc(t.name) : "Sans équipe"}</p></div>
        <div class="stats"><div><b class="num">${mt}</b><span>matchs</span></div><div><b class="num">${S.me.goals}</b><span>buts</span></div><div><b class="num">${S.me.motm}</b><span>homme du match</span></div><div><b class="num">${S.me.slots.length}</b><span>dispos</span></div></div>
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
          <button class="btn btn-ghost btn-block" id="resetDemo">Remettre les données de démo</button>
          <p class="small muted">Version démo : les données restent sur ce téléphone. Avec Firebase branché, tout le monde verra le même planning en temps réel.</p>
        </div>
      </section>
    </main>`;
  }

  function onboarding() {
    const m = S.me;
    return `<main class="wrap"><section>
      <h2>Mon profil</h2>
      <p class="muted">Créez votre profil pour réserver, rejoindre des matchs et suivre vos stats.</p>
      <form id="meForm" class="card">
        <div class="field"><label for="mName">Prénom et nom</label><input class="input" id="mName" required value="${esc(m.name)}" placeholder="Ex. Moussa Diop"></div>
        <div class="field"><span class="label">Poste</span><div class="choices">${POSTES.map((p) => `<label class="choice"><input type="radio" name="mPoste" value="${p}" ${m.poste === p ? "checked" : ""}><span>${p}</span></label>`).join("")}</div></div>
        <div class="field"><label for="mTeam">Équipe</label><select class="input" id="mTeam"><option value="">Pas encore d'équipe</option>${S.teams.map((t) => `<option value="${t.id}" ${t.id === m.teamId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div>
        <div class="field"><span class="label">Je suis</span><div class="choices">${[["joueur", "Joueur"], ["capitaine", "Capitaine"], ["personnel", "Personnel"], ["gerant", "Gérant"]].map(([k, l]) => `<label class="choice"><input type="radio" name="mRole" value="${k}" ${m.role === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
        <div class="field" id="keyField" hidden><label for="mKey">Clé d'entrée</label><input class="input" id="mKey" autocomplete="off" placeholder="Donnée par le complexe"><span class="small muted">Démo : ${esc(C.cles.gerant)} pour le gérant, ${esc(C.cles.personnel)} pour le personnel.</span></div>
        <button class="btn btn-bib btn-block" type="submit">Enregistrer</button>
      </form>
    </section></main>`;
  }

  /* ---------- Espace gérant ---------- */
  function viewGerant() {
    if (!isStaff()) return `<main class="wrap"><section><h2>Espace gérant</h2><div class="empty-state">Réservé au gérant et au personnel. Choisissez ce profil dans l'onglet Profil avec votre clé d'entrée.</div><a class="btn btn-turf btn-block" href="#profil">Aller au profil</a></section></main>`;
    expireHolds();
    const k = dkey(today());
    const todays = S.bookings.filter((b) => b.date === k).sort((a, b) => a.hour - b.hour || a.terrain - b.terrain);
    const cashToday = S.receipts.filter((r) => r.date === k).reduce((s, r) => s + r.amount, 0);
    const slotsDay = hours().length * C.terrains.length;
    const fill = Math.round((todays.length / slotsDay) * 100);
    const waiting = S.bookings.filter((b) => b.status === "attente" && !isPast(b.date, b.hour)).length;
    const toCollect = todays.filter((b) => b.status !== "paye").reduce((s, b) => s + b.price, 0);
    const month = S.receipts.reduce((s, r) => s + r.amount, 0);
    const sessAll = openSessions();

    // Remplissage moyen par heure sur les 14 derniers jours
    const past = [...Array(14)].map((_, i) => dkey(addDays(today(), -14 + i)));
    const byHour = hours().map((h) => ({ h, v: Math.round((S.bookings.filter((b) => b.hour === h && past.includes(b.date)).length / (past.length * C.terrains.length)) * 100) }));
    const best = Object.entries(S.bookings.reduce((m, b) => ((m[b.team] = (m[b.team] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return `<main class="wrap">
      <section>
        <div class="sec-head"><h2>Aujourd'hui</h2><span class="muted small">${dayLabel(k)}</span></div>
        <div class="kpis">
          <div class="kpi lead"><span class="label">Encaissé aujourd'hui</span><b class="num">${money(cashToday)}</b><span class="small">Reste à encaisser : ${money(toCollect)}</span></div>
          <div class="kpi"><span class="label">Remplissage</span><b class="num">${fill} %</b><span class="small muted">${todays.length} / ${slotsDay} créneaux</span></div>
          <div class="kpi"><span class="label">Acomptes attendus</span><b class="num">${waiting}</b><span class="small muted">${waiting ? "à vérifier sur Wave" : "rien en attente"}</span></div>
        </div>
        <div class="row"><button class="btn btn-turf grow" id="addPhone">Ajouter une réservation téléphone</button></div>
        <div class="list">${todays.length ? todays.map(staffBk).join("") : '<div class="empty-state">Aucune réservation aujourd\'hui.</div>'}</div>
      </section>
      <section>
        <div class="sec-head"><h2>Sessions joueurs seuls</h2><button class="link" id="openSess">Ouvrir une session</button></div>
        <div class="kpis">
          <div class="kpi"><span class="label">Inscrits cette semaine</span><b class="num">${sessAll.reduce((n, b) => n + b.players.length, 0)}</b><span class="small muted">sur ${sessAll.length} sessions</span></div>
          <div class="kpi"><span class="label">Sessions confirmées</span><b class="num">${sessAll.filter((b) => b.players.length >= C.sessions.minJoueurs).length} / ${sessAll.length}</b><span class="small muted">à ${C.sessions.minJoueurs} joueurs</span></div>
        </div>
        <p class="small muted">Une session pleine rapporte ${money(C.sessions.minJoueurs * C.sessions.prixJoueur)} à ${money(C.sessions.maxJoueurs * C.sessions.prixJoueur)}, contre ${money(C.tarifs.creuse)} pour un créneau creux loué à une équipe. Ouvrez-les sur les heures pâles du graphique.</p>
        <div class="list">${sessAll.slice(0, 4).map(sessionCard).join("")}</div>
      </section>
      <section>
        <div class="sec-head"><h2>Heures qui remplissent</h2><span class="muted small">14 derniers jours</span></div>
        <div class="card">${hourChart(byHour)}<p class="small muted">En orange, l'heure la plus demandée. Les créneaux pâles sont ceux à pousser avec une promo ou un défi.</p></div>
      </section>
      <section>
        <div class="sec-head"><h2>Caisse</h2><span class="muted small num">${money(month)} sur 14 jours</span></div>
        <div class="card" style="padding:6px 10px"><table class="rank"><thead><tr><th>Reçu</th><th>Équipe</th><th>Mode</th><th class="n">Montant</th></tr></thead><tbody>
          ${[...S.receipts].reverse().slice(0, 8).map((r) => `<tr><td class="num">n° ${pad(r.n)}</td><td>${esc(r.team)}<div class="small muted">${dayLabel(r.date)} ${hh(r.hour)}</div></td><td>${r.by}</td><td class="n">${money(r.amount)}</td></tr>`).join("")}
        </tbody></table></div>
        <button class="btn btn-ghost btn-block" id="exportCsv">Exporter pour Excel (CSV)</button>
      </section>
      <section>
        <h2>Meilleurs clients</h2>
        <div class="card" style="padding:6px 10px"><table class="rank"><tbody>${best.map(([n, c], i) => `<tr><td class="num">${i + 1}</td><td>${esc(n)}</td><td class="n">${c} créneaux</td></tr>`).join("")}</tbody></table></div>
      </section>
      <section>
        <div class="sec-head"><h2>Faire connaître l'appli</h2></div>
        <div class="card">
          <div class="qr-wrap">${qrSvg(APP_URL)}</div>
          <p class="small muted" style="text-align:center">À scanner avec l'appareil photo du téléphone. Affichez-le à l'accueil, sur les murs du terrain et dans vos statuts.</p>
          <div class="row"><button class="btn btn-turf grow" id="qrBig">Afficher en grand</button><a class="btn btn-ghost grow" href="affiche.html" target="_blank" rel="noopener">Affiche à imprimer</a></div>
          <a class="btn btn-wa btn-block" href="${waLink(inviteText())}" target="_blank" rel="noopener">${WA_ICON}Envoyer le lien sur WhatsApp</a>
        </div>
      </section>
      ${S.me.role === "gerant" ? `<section>
        <div class="sec-head"><h2>Personnel</h2><button class="link" id="addStaff">Ajouter</button></div>
        <div class="list">${S.staff.map((p) => `<div class="card"><div class="row"><span class="avatars"><i>${initials(p.name)}</i></span><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.role)}</div></div><span class="chip chip-n num">${esc(p.shift)}</span><button class="link" style="color:var(--bad)" data-rmstaff="${p.id}">Retirer</button></div></div>`).join("")}</div>
      </section>` : ""}
    </main>`;
  }

  function staffBk(b) {
    const past = isPast(b.date, b.hour);
    const res = S.results.find((r) => r.date === b.date && r.hour === b.hour && r.a === b.team);
    const chip = b.status === "paye" ? '<span class="chip chip-ok">Payé</span>' : b.status === "attente" ? '<span class="chip chip-warn">Acompte attendu</span>' : b.status === "absent" ? '<span class="chip chip-bad">Pas venu</span>' : '<span class="chip chip-n">Confirmé</span>';
    return `<div class="card bk">
      <div class="hr num">${hh(b.hour)}</div>
      <div><div class="row"><b class="grow">${b.type === "session" ? `Session : ${b.players.length}/${C.sessions.minJoueurs} joueurs` : esc(b.team)}${b.opponent ? ` vs ${esc(b.opponent)}` : b.type === "defi" ? " (cherche adversaire)" : ""}</b>${chip}</div>
        <div class="small muted">${esc(C.terrains[b.terrain])} · ${money(b.price)}${b.phone ? ` · ${esc(b.phone)}` : ""}${res ? ` · Score ${res.sa}-${res.sb}` : ""}</div>
        <div class="acts">
          ${b.status === "attente" ? `<button class="btn btn-turf btn-sm" data-confirm="${b.id}">Acompte reçu</button>` : ""}
          ${b.type === "session" ? `<button class="btn btn-ghost btn-sm" data-sess="${b.id}">Voir les inscrits (${b.players.filter((x) => x.paid).length} payés)</button>` : ""}
          ${b.type !== "session" && b.status !== "paye" && b.status !== "absent" ? `<button class="btn btn-bib btn-sm" data-cash="${b.id}">Encaisser</button>` : ""}
          ${b.type !== "session" && b.status !== "paye" && b.status !== "absent" && past ? `<button class="btn btn-ghost btn-sm" data-absent="${b.id}">Pas venu</button>` : ""}
          ${past && b.opponent && !res ? `<button class="btn btn-ghost btn-sm" data-score="${b.id}">Saisir le score</button>` : ""}
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
    b.status = "paye";
    S.receipts.push({ n: S.nextReceipt++, date: b.date, hour: b.hour, team: b.team, amount: b.price, by });
    save(); render(); toast(`Reçu n° ${pad(S.nextReceipt - 1)} enregistré`);
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
    const players = S.dispos.map((p) => p.name);
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
        S.results.push({ id: uid(), date: b.date, hour: b.hour, a: b.team, b: b.opponent, sa, sb, motm });
        applyResult(S.teams, b.team, b.opponent, sa, sb);
        if (S.me.name && motm === S.me.name) S.me.motm++;
        save(); closeSheet(); render(); toast("Résultat publié");
      });
    });
  }

  function phoneSheet() {
    const k = dkey(today());
    sheet(`${head("Réservation par téléphone")}
      <form id="phForm" class="list">
        <div class="row"><div class="field grow"><label for="pDay">Jour</label><select class="input" id="pDay">${[...Array(7)].map((_, i) => { const kk = dkey(addDays(today(), i)); return `<option value="${kk}">${dayLabel(kk)}</option>`; }).join("")}</select></div>
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
        const name = el.querySelector("#pTeam").value.trim(), team = S.teams.find((x) => x.name.toLowerCase() === name.toLowerCase());
        S.bookings.push({ id: uid(), date: kk, hour: h, terrain: ti, team: team ? team.name : name, teamId: team ? team.id : "", phone: el.querySelector("#pPhone").value.trim(), opponent: "", type: "prive", niveau: "Moyen", price: price(kk, h), status: "confirme", createdAt: Date.now() });
        save(); closeSheet(); render(); toast("Réservation ajoutée");
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
        <p class="small muted">Donnez-lui la clé personnel pour qu'il ouvre l'espace gérant sur son téléphone.</p>
      </form>`, (el) => {
      el.querySelector("#stForm").addEventListener("submit", (e) => {
        e.preventDefault();
        S.staff.push({ id: uid(), name: el.querySelector("#stN").value.trim(), role: el.querySelector("#stR").value.trim(), shift: el.querySelector("#stS").value.trim() || "-" });
        save(); closeSheet(); render();
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

  /* ---------- Navigation et événements ---------- */
  const VIEWS = { accueil: viewAccueil, planning: viewPlanning, matchs: viewMatchs, profil: viewProfil, gerant: viewGerant };
  const LABELS = { accueil: "Accueil", planning: "Planning", matchs: "Jouer", profil: "Profil", gerant: "Gérant" };
  const current = () => { const h = location.hash.slice(1); return VIEWS[h] ? h : "accueil"; };

  function render() {
    const v = current();
    const tabs = isStaff() ? Object.keys(VIEWS) : Object.keys(VIEWS).filter((k) => k !== "gerant");
    $("#app").innerHTML = `
      <header class="top"><div class="wrap">${crest()}<span class="brand">${esc(C.nom)}</span>${S.demo ? '<span class="demo-badge">Démo</span>' : ""}<span class="who">${S.me.name ? esc(S.me.name) : '<a href="#profil" style="color:inherit">Se connecter</a>'}</span><button class="iconbtn" data-sharesheet aria-label="Partager l'appli"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg></button></div></header>
      ${VIEWS[v]()}
      <div class="tabs"><nav style="--n:${tabs.length}">${tabs.map((k) => `<a href="#${k}" ${k === v ? 'aria-current="page"' : ""}>${icon(k)}${LABELS[k]}</a>`).join("")}</nav></div>`;
    document.title = `${C.nomCourt} · ${LABELS[v]}`;
    bindView();
  }

  function bindView() {
    const app = $("#app");
    const f = $("#meForm");
    if (f) {
      const sync = () => { const r = f.querySelector("[name=mRole]:checked").value; $("#keyField").hidden = !(r === "gerant" || r === "personnel"); };
      f.addEventListener("change", sync); sync();
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const role = f.querySelector("[name=mRole]:checked").value, key = ($("#mKey").value || "").trim().toUpperCase();
        if ((role === "gerant" && key !== C.cles.gerant) || (role === "personnel" && key !== C.cles.personnel)) { toast("Clé d'entrée incorrecte"); return; }
        Object.assign(S.me, { name: $("#mName").value.trim(), poste: f.querySelector("[name=mPoste]:checked").value, teamId: $("#mTeam").value, role });
        save(); location.hash = role === "gerant" || role === "personnel" ? "gerant" : "profil"; render(); toast("Profil enregistré");
      });
    }
    const on = (sel, fn) => app.querySelectorAll(sel).forEach((el) => el.addEventListener("click", (e) => fn(el, e)));
    on("[data-day]", (el) => { planDay = el.dataset.day; render(); });
    on("[data-book]", (el) => { const [k, h, ti] = el.dataset.book.split("|"); bookSheet(k, +h, +ti, pendingDefi); pendingDefi = false; });
    on("[data-defi]", (el) => acceptSheet(el.dataset.defi));
    on("[data-sess]", (el) => joinSheet(el.dataset.sess));
    on("[data-sub]", subSheet);
    on("[data-sharesheet]", shareSheet);
    on("#qrBig", qrFull);
    on("#installApp", () => { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); });
    on("#openSess", openSessSheet);
    on("[data-pay]", (el) => paySheet(el.dataset.pay));
    on("[data-cancel]", (el) => cancelSheet(el.dataset.cancel));
    on("[data-seg]", (el) => { seg = el.dataset.seg; render(); });
    on("#newDefi", () => { pendingDefi = true; toast("Touchez un créneau libre pour lancer votre défi"); });
    on("#newNeed", needSheet);
    on("[data-join]", (el) => {
      if (!S.me.name) { toast("Créez d'abord votre profil"); location.hash = "profil"; return; }
      const n = S.needs.find((x) => x.id === el.dataset.join); n.joined.push(S.me.name); save(); render(); toast(`C'est noté, ${n.team} compte sur vous`);
    });
    on("[data-leave]", (el) => { const n = S.needs.find((x) => x.id === el.dataset.leave); n.joined = n.joined.filter((j) => j !== S.me.name); save(); render(); });
    on("[data-slot]", (el) => { const s = el.dataset.slot, i = S.me.slots.indexOf(s); i >= 0 ? S.me.slots.splice(i, 1) : S.me.slots.push(s); save(); render(); });
    on("[data-forecast]", (el) => { const [k, h] = el.dataset.forecast.split("|"); forecastSheet(k, +h); });
    on("#editProfile", () => { const n = S.me.name; S.me.name = ""; $("#app").querySelector("main").outerHTML = onboarding(); S.me.name = n; $("#mName").value = n; bindView(); });
    on("#resetDemo", () => sheet(`${head("Remettre la démo ?")}<p>Les réservations, profils et résultats de ce téléphone seront remplacés par les données de démo.</p><div class="row"><button class="btn btn-ghost grow" data-close>Garder</button><button class="btn btn-bib grow" id="doReset">Remettre la démo</button></div>`, (el) => el.querySelector("#doReset").addEventListener("click", () => { S = seed(); save(); closeSheet(); location.hash = "accueil"; render(); })));
    on("#addPhone", phoneSheet);
    on("#addStaff", staffSheet);
    on("[data-rmstaff]", (el) => { S.staff = S.staff.filter((p) => p.id !== el.dataset.rmstaff); save(); render(); });
    on("[data-confirm]", (el) => { S.bookings.find((x) => x.id === el.dataset.confirm).status = "confirme"; save(); render(); toast("Acompte validé, l'équipe est prévenue"); });
    on("[data-cash]", (el) => cashSheet(el.dataset.cash));
    on("[data-absent]", (el) => { S.bookings.find((x) => x.id === el.dataset.absent).status = "absent"; save(); render(); });
    on("[data-score]", (el) => scoreSheet(el.dataset.score));
    on("#exportCsv", exportCsv);
  }
  let pendingDefi = false;

  window.addEventListener("hashchange", () => { closeSheet(); render(); window.scrollTo(0, 0); });
  render();
  setInterval(() => { if (current() === "planning" && !$("#scrim")) render(); }, 60000);
  if ("serviceWorker" in navigator && location.protocol === "https:" && window.top === window) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
