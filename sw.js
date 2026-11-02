/* AI721_ASTRA_LUZ_2.0 : service worker (application installable, travail hors connexion) */
const VERSION = 'ba64e732df';
const CACHE = 'astraluz-' + VERSION;
const CORE = ["./", "index.html", "assets/app.css?v=ba64e732df", "assets/app.js?v=ba64e732df", "assets/fonts.css", "config.js", "vendor/JsBarcode.all.min.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-32.png", "fonts/public-sans-400.woff2", "fonts/public-sans-500.woff2", "fonts/public-sans-600.woff2", "fonts/public-sans-700.woff2", "fonts/jetbrains-mono-400.woff2", "fonts/jetbrains-mono-600.woff2", "fonts/bricolage-grotesque-var.woff2"];
self.addEventListener('install', ev => { ev.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', ev => { ev.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('astraluz-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', ev => {
  const req = ev.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Firebase et autres domaines : réseau direct
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); return r; }).catch(() => caches.match('./').then(r => r || caches.match('index.html'))));
    return;
  }
  ev.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
});
