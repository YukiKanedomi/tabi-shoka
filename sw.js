// 旅の書架 — オフライン用。同一オリジンはすべて network-first（圏外時のみキャッシュ）。
// CSS/JS を変えたら V を上げ、index.html の ?v= も揃える。
const V = 'v27';
const CACHE = 'tabi-shoka-' + V;
const IMG = 'tabi-img-v1';   // 暗号化写真（名前にハッシュ入り。古い名前は上限で自然に消える）
const DATA = 'tabi-data-v1'; // 旅データ（app.js が初回に自分で入れる）
const NET_MS = 4000;         // これ以上待つならキャッシュを先に返す（新しい版は裏で取って次回に）
const IMG_MAX = 400;         // 端末に置く写真ファイルの上限（サムネと本体で1枚2ファイル）
const SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg', './assets/japan.svg',
  './css/app.css?v=20',
  './js/app.js?v=21', './js/crypto.js', './js/util.js', './js/maps.js', './js/shelf.js', './js/trip.js', './js/sheet.js', './js/icons.js', './js/geo.js', './js/palette.js', './js/palettes.js', './js/photos.js', './js/stats.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // Google Maps / フォントは触らない
  // 同一オリジンはすべてネットワーク優先（更新直後に CSS と JS の新旧が混ざらない）。圏外なら手元のキャッシュ
  const isImg = url.pathname.includes('/data/img/');
  // GitHub Pages は max-age=600 を返すので、HTTP キャッシュを使わず毎回サーバーで再検証（ETag）する
  const net = fetch(e.request, { cache: 'no-cache' }).then(r => {
    if (r.ok) { const c = r.clone(); e.waitUntil(caches.open(isImg ? IMG : CACHE).then(x => x.put(e.request, c)).then(() => isImg ? trimImg() : null).catch(() => {})); }
    return r;
  });
  e.respondWith((async () => {
    const first = await Promise.race([net.catch(() => null), new Promise(res => setTimeout(() => res('timeout'), NET_MS))]);
    if (first && first !== 'timeout') return first;
    // 電波が弱い（4秒待った）か圏外: 手元のものを返す。無ければネットワークを待ち切る
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try { return await net; } catch { return (e.request.mode === 'navigate' && await caches.match('./index.html')) || Response.error(); }
  })());
});

// 写真キャッシュが上限を超えたら古いものから消す（Cache の keys は入れた順）
async function trimImg() {
  const c = await caches.open(IMG);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - IMG_MAX))) await c.delete(k);
}
