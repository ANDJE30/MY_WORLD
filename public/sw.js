// Service worker : met en cache la coquille de l'application (jamais les données de l'API).
const CACHE = 'schoolx-v3-3';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/app.js', '/js/ui.js', '/js/api.js', '/js/shared.js', '/js/admin.js', '/js/teacher.js', '/js/discipline.js', '/js/rh.js', '/js/parents.js', '/js/echeancier.js', '/js/console.js', '/js/landing.js', '/img/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // les API (/console/api, /e/<code>/api) ne sont jamais mises en cache : données personnelles et PDF restent sur le serveur
  if (e.request.method !== 'GET' || url.origin !== location.origin || /\/api(\/|$)/.test(url.pathname)) return;
  // réseau d'abord (toujours la dernière version), cache en secours hors ligne
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html'))));
});
