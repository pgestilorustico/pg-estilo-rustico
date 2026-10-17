/* Service worker: permite instalar la app y abrirla aunque falle la conexión.
   Los datos (pedidos, clientes, etc.) los guarda Firebase, no este archivo. */
const CACHE = 'pg-app-v8';
const SHELL = ['./', './index.html', './firebase-config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Firebase, Google, fuentes: directo a internet
  e.respondWith(
    fetch(req).then(res => {                              // primero internet (así siempre ves la última versión)
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
