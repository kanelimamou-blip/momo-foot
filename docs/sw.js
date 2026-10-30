// Garde l'appli disponible hors connexion : on sert le cache, puis on le rafraîchit en arrière-plan.
const CACHE = "momo-foot-v5";
const FILES = ["./", "index.html", "app.css", "config.js", "app.js", "qrcode.js", "compte.js", "affiche.html", "manifest.webmanifest", "icons/logo.svg"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => hit);
    return hit || net;
  }));
});
