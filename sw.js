// Air de famille — fonctionnement hors ligne.
// Page et code : réseau d'abord (les mises à jour arrivent), cache en secours.
// Modèles, moteur, polices, icônes : cache d'abord (ils ne changent pas).
const CACHE = 'air-de-famille-2.0';
const CORE = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'fonts/fonts.css',
  'vendor/face-api.js',
];
// Les modèles (13 Mo) ne sont plus préchargés à l'installation : ils seraient téléchargés deux fois
// à la première visite. Ils sont mis en cache à leur premier chargement (voir fetch ci-dessous).

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const store = (req, res) => {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};
self.addEventListener('fetch', (e) => {
  const req = e.request,
    url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const isCode = req.mode === 'navigate' || /\/(index\.html|app\.js)?$/.test(url.pathname);
  e.respondWith(
    isCode
      ? fetch(req)
          .then((res) => store(req, res))
          .catch(() => caches.match(req).then((h) => h || caches.match('index.html')))
      : caches.match(req).then((h) => h || fetch(req).then((res) => store(req, res))),
  );
});
