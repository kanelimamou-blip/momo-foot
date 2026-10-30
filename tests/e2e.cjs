// Test de bout en bout de l'espace admin avec les émulateurs Firebase (Auth + Firestore) et les vraies règles.
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

  // 1. Un client s'inscrit, réserve, et plante
  const cli = await page();
  const stamp = Date.now(), mail = `client${stamp}@test.sn`, NAME = `Moussa ${stamp}`;
  await cli.goto(BASE + "#profil"); await cli.waitForSelector("#gSignIn");
  await cli.fill("#lMail", mail); await cli.fill("#lPass", PASS); await cli.click("[data-mode=new]");
  await cli.waitForSelector("#meForm");
  await cli.fill("#mName", NAME); await cli.fill("#mTel", "77 123 45 67"); await cli.fill("#mQuartier", "Médina");
  await cli.click("#meForm button[type=submit]"); await cli.waitForTimeout(1200);
  await cli.goto(BASE + "#planning"); await cli.waitForTimeout(400);
  await cli.click(".days button:nth-child(3)"); await cli.click(".slot.free");
  await cli.fill("#bTeam", "Les Testeurs"); await cli.fill("#bPhone", "77 123 45 67"); await cli.click("#bookForm button[type=submit]");
  await cli.waitForTimeout(2500); // l'activité part après 1,5 s
  await cli.evaluate(() => setTimeout(() => { throw new Error("Plantage de test"); }, 0)); await cli.waitForTimeout(1500);
  const tabsCli = await cli.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()));
  check("le client n'a pas d'onglet Admin", !tabsCli.includes("Admin"));
  await cli.goto(BASE + "#admin"); await cli.waitForTimeout(800);
  check("#admin d'un non-admin montre son identifiant à copier", /pas encore administrateur/.test(await text(cli, "main")) && !!(await text(cli, "#adUid")));
  check("le client ne lit pas les erreurs", /refus permission-denied/.test(await fsTry(cli, () => firebase.firestore().collection("erreurs").get())));
  check("le client ne lit pas les autres comptes", /refus permission-denied/.test(await fsTry(cli, () => firebase.firestore().collection("users").get())));

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
  check("présentation lancée en joueur", /Présentation/.test(await text(adm, ".modebar")) && !(await adm.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()))).includes("Gérant"));
  await adm.click('[data-demorole="gerant"]'); await adm.waitForTimeout(400);
  check("passage en gérant : espace gérant ouvert", (await adm.$$eval(".tabs a", (x) => x.map((e) => e.textContent.trim()))).includes("Gérant") && /Aujourd'hui/.test(await text(adm, "main h2")));
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
