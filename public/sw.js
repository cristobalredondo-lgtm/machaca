const CACHE = 'machaca-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/juegos.js', '/icono.svg', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Red primero para el shell (asi entra cada version nueva), cache de respaldo sin cobertura.
// La API nunca se cachea: el ranking siempre va a red.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {}); return res; })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('/index.html')))
  );
});
