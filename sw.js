// 旅の書架 — オフライン用。シェル（HTML/CSS/JS）は cache-first、旅データは network-first。
// CSS/JS を変えたら V を上げ、index.html の ?v= も揃える。
const V = 'v6';
const CACHE = 'tabi-shoka-' + V;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './css/app.css?v=5',
  './js/app.js?v=5', './js/crypto.js', './js/util.js', './js/maps.js', './js/shelf.js', './js/trip.js', './js/sheet.js', './js/icons.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Google Maps / フォントは触らない
  if (url.pathname.endsWith('/data/bundle.enc.json')) {
    // 旅データ: 取れたら更新、取れなければ手元のもの
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    // シェル本体（HTML）はネットワーク優先。更新が即座に反映され、圏外では手元のものを使う
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: false }).then(r => r || fetch(e.request).then(res => {
    if (e.request.method === 'GET' && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return res;
  })));
});
