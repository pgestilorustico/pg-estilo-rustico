/* Service worker: permite instalar la app y abrirla aunque falle la conexión.
   Los datos (pedidos, clientes, etc.) los guarda Firebase, no este archivo. */
const CACHE = 'pg-app-v50';
const SHELL = ['./', './index.html', './firebase-config.js', './manifest.webmanifest', './icon-v2-192.png', './icon-v2-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'pg-avisos').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Avisos en el celular: Android despierta a la app más o menos 1 o 2 veces por día */
function hoyISO(){ const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function dias(f){ const a = f.split('-'), b = hoyISO().split('-'); return Math.round((Date.UTC(+a[0],a[1]-1,+a[2]) - Date.UTC(+b[0],b[1]-1,+b[2]))/86400000); }
async function revisarAvisos(){
  const c = await caches.open('pg-avisos');
  const r = await c.match('./__avisos.json'); if (!r) return;
  const data = await r.json(), hoy = hoyISO();
  const ya = await c.match('./__avisado.txt'); if (ya && (await ya.text()) === hoy) return;
  const L = [];
  (data.items || []).forEach(it => {
    const d = dias(it.f);
    if (it.tipo === 'entrega' && d <= 1) L.push((d < 0 ? '⏰ Entrega atrasada: ' : d === 0 ? '🚚 Hoy entregás ' : '🚚 Mañana entregás ') + it.ped + ' (' + it.nom + ')');
    if (it.tipo === 'pago' && d <= 1) L.push((d < 0 ? '💰 Pago vencido de ' : d === 0 ? '💰 Hoy te paga ' : '💰 Mañana te paga ') + it.nom + ' · ' + it.monto);
    if (it.tipo === 'compra' && d <= 3 && d >= 0) L.push('🛒 Falta comprar material para ' + it.nom);
  });
  if (!L.length) return;
  await self.registration.showNotification('PG Estilo Rústico · ' + (L.length === 1 ? '1 aviso' : L.length + ' avisos'), { body: L.slice(0, 5).join('\n'), icon: 'notif-icon.png', badge: 'notif-badge.png', tag: 'pg-avisos' });
  await c.put('./__avisado.txt', new Response(hoy));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'pg-avisos') e.waitUntil(revisarAvisos()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) { if ('focus' in c) return c.focus(); } return self.clients.openWindow('./'); }));
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
