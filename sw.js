// 旅の書架 — オフライン用。同一オリジンはすべて network-first（圏外時のみキャッシュ）。
// CSS/JS を変えたら V を上げ、index.html の ?v= も揃える。
const V = 'v8';
const CACHE = 'tabi-shoka-' + V;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './css/app.css?v=6',
  './js/app.js?v=6', './js/crypto.js', './js/util.js', './js/maps.js', './js/shelf.js', './js/trip.js', './js/sheet.js', './js/icons.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // Google Maps / フォントは触らない
  // 同一オリジンはすべてネットワーク優先（更新直後に CSS と JS の新旧が混ざらない）。圏外なら手元のキャッシュ
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
