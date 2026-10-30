// Test de bout en bout avec les émulateurs Firebase (Auth + Firestore) et les vraies règles :
// planning partagé en temps réel entre deux téléphones, sessions, rôle gérant donné par l'admin, espace admin.
// Prérequis : émulateurs lancés, site servi avec ?emu=1 et le compte admin ADMIN_EMAIL dans config.js et les règles.
// node tests/e2e.cjs http://localhost:8768 dossier-captures
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://localhost:8768") + "/?emu=1", SHOTS = process.argv[3] || ".";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.sn", PASS = "secret123";
let ok = 0, ko = 0;
const check = (label, cond) => { cond ? ok++ : ko++; console.log(cond ? "ok  " : "FAIL", label); };

(async () => {
  const b = await chromium.launch();
  const page = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.on("dialog", (d) => d.dismiss()); return p; };
  const fsTry = (p, fn) => p.evaluate(`(${fn})().then(() => "ok", (e) => "refus " + e.code)`);
  const text = (p, sel) => p.textContent(sel).catch(() => "");
  // Choisit un jour dans le calendrier en carreaux (après-demain), en passant au mois suivant si besoin
  const goDay = async (p, off) => {
    const k = await p.evaluate((o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, off);
    if (!(await p.$(`[data-day="${k}"]`))) await p.click('[data-cal="1"]');
    await p.click(`[data-day="${k}"]`);
  };

  // 1. Un client s'inscrit, réserve, et plante
  const cli = await page();
  const stamp = Date.now(), mail = `client${stamp}@test.sn`, NAME = `Moussa ${stamp}`, TEAM = `Testeurs ${stamp % 100000}`;
  await cli.goto(BASE + "#profil"); await cli.waitForSelector("#gSignIn");
  await cli.fill("#lMail", mail); await cli.fill("#lPass", PASS); await cli.click("[data-mode=new]");
  await cli.waitForSelector("#meForm");
  await cli.fill("#mName", NAME); await cli.fill("#mTel", "77 123 45 67"); await cli.fill("#mQuartier", "Médina");
  await cli.click("#meForm button[type=submit]"); await cli.waitForTimeout(1200);
  await cli.goto(BASE + "#planning"); await cli.waitForTimeout(400);
  check("le planning montre un calendrier en carreaux", (await cli.$$(".cal-grid [data-day]")).length >= 28);
  await goDay(cli, 2); await cli.click(".slot.free");
  await cli.fill("#bTeam", TEAM); await cli.fill("#bPhone", "77 123 45 67"); await cli.click("#bookForm button[type=submit]");
  await cli.waitForTimeout(2500); // l'activité part après 1,5 s
  await cli.evaluate(() => setTimeout(() => { throw new Error("Plantage de test"); }, 0)); await cli.waitForTimeout(1500);
  const tabsCli = await cli.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()));
  check("le client n'a pas d'onglet Admin", !tabsCli.includes("Admin"));
  await cli.goto(BASE + "#admin"); await cli.waitForTimeout(800);
  check("#admin d'un non-admin montre son identifiant à copier", /pas encore administrateur/.test(await text(cli, "main")) && !!(await text(cli, "#adUid")));
  check("le client ne lit pas les erreurs", /refus permission-denied/.test(await fsTry(cli, () => firebase.firestore().collection("erreurs").get())));
  check("le client ne lit pas les autres comptes", /refus permission-denied/.test(await fsTry(cli, () => firebase.firestore().collection("users").get())));

  check("plus de badge ni de bouton de démo", !(await cli.$(".demo-badge")) && !/démo/i.test(await text(cli, "#app")));

  // 1 bis. Un deuxième téléphone voit la réservation en direct, et s'inscrit à une session
  const cl2 = await page();
  await cl2.goto(BASE + "#profil"); await cl2.waitForSelector("#gSignIn");
  await cl2.fill("#lMail", `joueur${stamp}@test.sn`); await cl2.fill("#lPass", PASS); await cl2.click("[data-mode=new]");
  await cl2.waitForSelector("#meForm"); await cl2.fill("#mName", `Awa ${stamp}`); await cl2.click("#meForm button[type=submit]"); await cl2.waitForTimeout(1000);
  await cl2.goto(BASE + "#planning"); await cl2.waitForTimeout(1500); await goDay(cl2, 2);
  check("l'autre téléphone voit le créneau réservé (en attente d'acompte)", (await cl2.locator(".slot.hold", { hasText: TEAM }).count()) === 1);
  await cli.goto(BASE + "#matchs"); await cli.waitForTimeout(1200);
  const before1 = await text(cli, ".card:has(.meter)");
  await cl2.goto(BASE + "#matchs"); await cl2.waitForTimeout(800);
  await cl2.click(".card:has(.meter) [data-sess]"); await cl2.click("#jJoin"); await cl2.waitForTimeout(2000);
  const after1 = await text(cli, ".card:has(.meter)");
  const n0 = +(before1.match(/(\d+) \/ 12/) || [])[1], n1 = +(after1.match(/(\d+) \/ 12/) || [])[1];
  check(`inscription à une session vue en direct sur l'autre téléphone (${n0} puis ${n1})`, n1 === n0 + 1);
  check("le joueur ne coche pas lui-même « payé »", /refus permission-denied/.test(await fsTry(cl2, () => { const db = firebase.firestore(), u = firebase.auth().currentUser.uid; return db.collection("creneaux").where("type", "==", "session").get().then((q) => q.docs.find((d) => d.data().players[u]).ref.update({ [`players.${u}.paid`]: true })); })));
  await cl2.screenshot({ path: SHOTS + "/e2e-session.png" });

  // 2. L'admin se connecte depuis #admin
  const adm = await page();
  await adm.goto(BASE + "#admin"); await adm.waitForSelector("#gSignIn");
  check("#admin propose la connexion", true);
  await adm.fill("#lMail", ADMIN_EMAIL); await adm.fill("#lPass", PASS); await adm.click("[data-mode=in]");
  await adm.waitForSelector("[data-afilter]", { timeout: 15000 });
  const card = adm.locator(".card:has([data-voir])", { hasText: NAME });
  check("la liste montre le client avec quartier et téléphone", /Médina/.test(await card.textContent()) && /77 123 45 67/.test(await card.textContent()));
  check("le client est Actif (1 action cette semaine)", /Actif/.test(await card.textContent()) && /1 action/.test(await card.textContent()));
  check("l'erreur du client est remontée", /Plantage de test/.test(await text(adm, "main")));
  await adm.fill("#adminSearch", String(stamp)); await adm.waitForTimeout(200);
  check("la recherche trouve le client", (await adm.locator(".card:has([data-voir])", { hasText: NAME }).count()) === 1);
  await adm.fill("#adminSearch", ""); await adm.click('[data-afilter="Suspendu"]');
  check("le filtre Suspendus est vide", (await adm.locator(".card:has([data-voir])", { hasText: NAME }).count()) === 0);
  await adm.click('[data-afilter="tous"]');
  await adm.screenshot({ path: SHOTS + "/e2e-admin.png", fullPage: true });

  // 3. Suspension
  await adm.locator(".card:has([data-voir])", { hasText: NAME }).locator("[data-toggle]").click(); await adm.waitForTimeout(1200);
  check("le client passe Suspendu", /Suspendu/.test(await adm.locator(".card:has([data-voir])", { hasText: NAME }).textContent()));
  await cli.reload(); await cli.waitForTimeout(3500);
  check("le client suspendu voit le message avec le 78 272 19 20", /suspendu/i.test(await text(cli, "main")) && /78 272 19 20/.test(await text(cli, "main")));
  check("le client suspendu ne lève pas sa suspension", /refus permission-denied/.test(await fsTry(cli, () => firebase.firestore().collection("users").doc(firebase.auth().currentUser.uid).update({ active: true }))));
  check("le client suspendu n'enregistre plus rien", /refus permission-denied/.test(await fsTry(cli, () => firebase.firestore().collection("users").doc(firebase.auth().currentUser.uid).update({ name: "x", lastSeen: firebase.firestore.FieldValue.serverTimestamp() }))));
  await cli.screenshot({ path: SHOTS + "/e2e-suspendu.png" });
  await adm.locator(".card:has([data-voir])", { hasText: NAME }).locator("[data-toggle]").click(); await adm.waitForTimeout(1200);
  await cli.reload(); await cli.waitForTimeout(3500);
  check("réactivé, le client retrouve l'appli", !/suspendu/i.test(await text(cli, "main")));

  // 3 bis. L'admin donne le rôle gérant ; le gérant valide l'acompte, vu en direct par l'autre téléphone
  await adm.locator(".card:has([data-voir])", { hasText: NAME }).locator("[data-role]").selectOption("proprietaire"); await adm.waitForTimeout(1200);
  await cli.reload(); await cli.waitForTimeout(3500);
  const tabsOwn = await cli.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()));
  check("le client devenu propriétaire a Gestion et Réglages", tabsOwn.includes("Gestion") && tabsOwn.includes("Réglages"));
  await cl2.goto(BASE + "#planning"); await cl2.waitForTimeout(800); await goDay(cl2, 2);
  await cli.goto(BASE + "#gerant"); await cli.waitForTimeout(1000);
  const pend = cli.locator(".card:has([data-confirm])", { hasText: TEAM });
  check("le gérant voit l'acompte à vérifier", (await pend.count()) === 1);
  await pend.locator("[data-confirm]").click();
  await cl2.waitForTimeout(1500);
  check("acompte validé : l'autre téléphone voit le créneau confirmé", (await cl2.locator(".slot.hold", { hasText: TEAM }).count()) === 0 && (await cl2.locator(".slot.taken", { hasText: TEAM }).count()) === 1);
  check("un joueur ne lit pas la caisse", /refus permission-denied/.test(await fsTry(cl2, () => firebase.firestore().collection("caisse").get())));
  await cli.screenshot({ path: SHOTS + "/e2e-gerant.png", fullPage: true });

  // 3 ter. Le propriétaire change un prix (vu en direct), crée un rôle et le donne à un membre
  await cli.goto(BASE + "#reglages"); await cli.waitForTimeout(1000);
  await cli.fill("#t_pleine", "21500"); await cli.click("#tarifForm button[type=submit]"); await cl2.waitForTimeout(1500);
  check("nouveau prix vu en direct sur l'autre téléphone", /21\s500 F/.test(await text(cl2, ".grid")));
  await cli.click("#addRole"); await cli.waitForTimeout(200);
  const nf = cli.locator("#rolesForm fieldset", { has: cli.locator('[data-rnom][value="Nouveau rôle"]') });
  const ARB = `Arbitre ${stamp % 1000}`;
  await nf.locator("[data-rnom]").fill(ARB); await nf.locator("[data-rniv]").fill("20"); await nf.locator('[data-rdroit="scores"]').check();
  await cli.click("#rolesForm button[type=submit]"); await cli.waitForTimeout(1500);
  check("le rôle Arbitre est enregistré", (await cli.$$eval("#rolesForm [data-rnom]", (x) => x.map((e) => e.value))).includes(ARB));
  await cli.fill("#membreSearch", `Awa ${stamp}`); await cli.waitForTimeout(800);
  const sel = cli.locator(".card", { hasText: `Awa ${stamp}` }).locator("[data-mrole]");
  const optArb = await sel.locator("option", { hasText: ARB }).getAttribute("value");
  check("le propriétaire ne peut pas nommer un autre propriétaire", (await sel.locator("option", { hasText: "Propriétaire" }).count()) === 0);
  await sel.selectOption(optArb); await cli.waitForTimeout(1200);
  await cl2.reload(); await cl2.waitForTimeout(3500);
  const tabsArb = await cl2.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()));
  await cl2.goto(BASE + "#gerant"); await cl2.waitForTimeout(800);
  check("l'arbitre a Gestion sans la caisse ni les réglages", tabsArb.includes("Gestion") && !tabsArb.includes("Réglages") && !(await cl2.isVisible("text=Encaissé aujourd'hui")));
  await cli.screenshot({ path: SHOTS + "/e2e-reglages.png", fullPage: true });

  // 4. Voir un client, en lecture seule
  await adm.locator(".card:has([data-voir])", { hasText: NAME }).locator("[data-voir]").click(); await adm.waitForTimeout(1200);
  check("« Voir » ouvre la vue du client", /Vue de/.test(await text(adm, ".modebar")) && (await text(adm, ".top")).includes(NAME));
  await adm.goto(BASE.replace("?emu=1", "?emu=1") + "#planning").catch(() => {});
  await adm.evaluate(() => { location.hash = "planning"; }); await adm.waitForTimeout(400);
  await adm.click(".slot.free"); await adm.waitForTimeout(300);
  check("en vue client, réserver est bloqué", !(await adm.$("#bookForm")) && /lecture seule/.test(await text(adm, ".toast")));
  await adm.screenshot({ path: SHOTS + "/e2e-voir.png" });
  await adm.click("[data-stopmode]"); await adm.waitForTimeout(800);

  // 5. Présentation : passer d'un rôle à l'autre
  await adm.click("#startDemo"); await adm.waitForTimeout(400);
  check("présentation lancée en joueur", /Présentation/.test(await text(adm, ".modebar")) && !(await adm.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()))).includes("Gestion"));
  await adm.click('[data-demorole="gerant"]'); await adm.waitForTimeout(400);
  check("passage en gérant : espace gérant ouvert", (await adm.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()))).includes("Gestion") && /Aujourd'hui/.test(await text(adm, "main h2")));
  await adm.screenshot({ path: SHOTS + "/e2e-presentation.png" });
  await adm.click('[data-demorole="capitaine"]'); await adm.waitForTimeout(300);
  check("passage en capitaine", /Capitaine|capitaine/.test(await adm.$eval('[data-demorole="capitaine"]', (e) => e.getAttribute("aria-pressed") === "true" ? "Capitaine" : "")));
  await adm.click("[data-stopmode]"); await adm.waitForTimeout(800);
  check("fin de présentation : retour à l'espace admin", /Espace admin/.test(await text(adm, "main h2")));

  // 6. Effacer une erreur
  const before = await adm.$$("[data-delerr]");
  await before[0].click(); await adm.waitForTimeout(800);
  check("l'admin efface une erreur", (await adm.$$("[data-delerr]")).length === before.length - 1);

  console.log(`\n${ok}/${ok + ko} vérifications passées`);
  await b.close(); process.exit(ko ? 1 : 0);
})();
