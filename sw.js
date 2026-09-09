// 旅の書架 — オフライン用。同一オリジンはすべて network-first（圏外時のみキャッシュ）。
// CSS/JS を変えたら V を上げ、index.html の ?v= も揃える。
const V = 'v21';
const CACHE = 'tabi-shoka-' + V;
const IMG = 'tabi-img-v1';   // 暗号化写真。中身は変わらないので版を上げない
const IMG_MAX = 400;         // 端末に置く写真ファイルの上限（サムネと本体で1枚2ファイル）
const SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg', './assets/japan.svg',
  './css/app.css?v=16',
  './js/app.js?v=15', './js/crypto.js', './js/util.js', './js/maps.js', './js/shelf.js', './js/trip.js', './js/sheet.js', './js/icons.js', './js/geo.js', './js/palette.js', './js/palettes.js', './js/photos.js', './js/stats.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // Google Maps / フォントは触らない
  // 同一オリジンはすべてネットワーク優先（更新直後に CSS と JS の新旧が混ざらない）。圏外なら手元のキャッシュ
  const isImg = url.pathname.includes('/data/img/');
  e.respondWith(
    // GitHub Pages は max-age=600 を返すので、HTTP キャッシュを使わず毎回サーバーで再検証（ETag）する
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const c = r.clone(); e.waitUntil(caches.open(isImg ? IMG : CACHE).then(x => x.put(e.request, c)).then(() => isImg ? trimImg() : null).catch(() => {})); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

// 写真キャッシュが上限を超えたら古いものから消す（Cache の keys は入れた順）
async function trimImg() {
  const c = await caches.open(IMG);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - IMG_MAX))) await c.delete(k);
}
