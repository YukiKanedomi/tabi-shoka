// Google Maps JavaScript API の読み込みと、旅の書架の描き込み（HTMLマーカー・経路）
let loading = null;

export function loadGoogle(key) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const cb = '__tabiMapsReady';
    window[cb] = () => resolve(window.google.maps);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${cb}&language=ja&region=JP&v=weekly&loading=async`;
    s.async = true;
    // 失敗したら読み込み中の印を消して、次の loadGoogle で最初からやり直せるようにする
    s.onerror = () => { loading = null; s.remove(); reject(new Error('地図を読み込めませんでした。電波を確認してください')); };
    document.head.appendChild(s);
    // 認証エラー（キー制限など）は gm_authFailure に来る
    window.gm_authFailure = () => { loading = null; reject(new Error('Google Maps の認証に失敗（APIキーの制限を確認）')); };
  });
  return loading;
}

// 地図枠に失敗の理由と「再試行」ボタンを出す。retry は地図の読み込みからやり直す関数
export function mapError(msgEl, e, retry) {
  if (!msgEl?.isConnected) return;
  msgEl.textContent = '';
  const p = document.createElement('div'); p.textContent = e?.message || '地図を表示できません'; msgEl.appendChild(p);
  if (retry) { const b = document.createElement('button'); b.type = 'button'; b.textContent = '再試行'; b.addEventListener('click', retry); msgEl.appendChild(b); }
}

import { paletteMap } from './palettes.js';
import { onDispose } from './util.js';
// 淡い配色（POI 名は残す。細い道路名は消す）。地色は配色に追従
export const styleFor = (m = paletteMap()) => [
  { elementType: 'geometry', stylers: [{ color: m.geometry }] },
  { elementType: 'labels.text.fill', stylers: [{ color: m.label }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 2 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: m.water }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: m.natural }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: m.park }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -70 }, { lightness: 30 }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: m.road }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: m.roadStroke }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: m.arterial }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: m.highway }] },
  { featureType: 'road.highway', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: m.transit }, { weight: 1.2 }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ saturation: -40 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#C9CDC3' }] }
];

export function makeMap(el, opts = {}) {
  const map = new google.maps.Map(el, Object.assign({
    center: { lat: 35.0, lng: 137.0 }, zoom: 7, styles: styleFor(),
    disableDefaultUI: true, zoomControl: false, gestureHandling: 'greedy', clickableIcons: true,
    mapTypeControl: false, fullscreenControl: false, keyboardShortcuts: false
  }, opts));
  // 生成直後とシートの高さが変わった後に、描画を促す（操作するまで描かれないことがある）
  const kick = () => google.maps.event.trigger(map, 'resize');
  setTimeout(kick, 300); setTimeout(kick, 1200);
  const onSheet = () => { if (el.isConnected) kick(); };
  window.addEventListener('tabi:sheet', onSheet);
  onDispose(() => { window.removeEventListener('tabi:sheet', onSheet); google.maps.event.clearInstanceListeners(map); });
  return map;
}

// 2点間のおおよその距離（km）
export function distKm(a, b) {
  const R = 6371, d = Math.PI / 180;
  const x = (b.lng - a.lng) * d * Math.cos((a.lat + b.lat) / 2 * d), y = (b.lat - a.lat) * d;
  return Math.sqrt(x * x + y * y) * R;
}

// HTML マーカー（OverlayView）。p: {lat,lng,name,kind,side,num,dim,onTap}
//  num があれば番号つきの丸（リストの番号と対応）。onTap があればタップ可能
let PinClass = null;
function pinClass() {
  if (PinClass) return PinClass;
  PinClass = class extends google.maps.OverlayView {
    constructor(map, p) { super(); this.p = p; this.setMap(map); }
    cls() { const p = this.p; return `pin ${p.kind || 'sta'} ${p.side || ''} ${p.dim ? 'dim' : ''} ${p.num != null ? 'num' : ''} ${p.selected ? 'sel' : ''}`; }
    onAdd() {
      const el = document.createElement('div');
      el.className = this.cls();
      if (this.p.color) el.style.setProperty('--c', this.p.color);
      const dot = document.createElement('div'); dot.className = 'dot';
      if (this.p.num != null) { const n = document.createElement('span'); n.textContent = this.p.num; dot.appendChild(n); }
      el.appendChild(dot);
      if (this.p.name) { const lb = document.createElement('div'); lb.className = 'lb'; lb.textContent = this.p.name; el.appendChild(lb); }
      if (this.p.onTap) { el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer'; el.addEventListener('click', e => { e.stopPropagation(); this.p.onTap(this.p); }); }
      this.el = el;
      this.getPanes().overlayMouseTarget.appendChild(el);
    }
    draw() {
      const q = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.p.lat, this.p.lng));
      if (q) { this.el.style.left = q.x + 'px'; this.el.style.top = q.y + 'px'; }
    }
    onRemove() { this.el?.remove(); }
    update(p) { Object.assign(this.p, p); if (this.el) { this.el.className = this.cls(); const lb = this.el.querySelector('.lb'); if (lb && this.p.name) lb.textContent = this.p.name; this.draw(); } }
    select(on) { this.update({ selected: !!on }); }
  };
  return PinClass;
}
export function addPin(map, p) { const C = pinClass(); return new C(map, p); }

// ラベルの間引き: 引きの倍率で近接するピンのラベルを隠す（先に登録したピン＝優先度高を残す）
export function declutter(map, pins, minPx = 56) {
  const run = () => {
    const shown = [];
    for (const pin of pins) {
      const el = pin.el; if (!el) continue;
      const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
      const hit = shown.some(q => Math.hypot(q.x - x, q.y - y) < minPx);
      el.classList.toggle('nolb', hit);
      if (!hit) shown.push({ x, y });
    }
  };
  map.addListener('idle', run);
  setTimeout(run, 400);
}

// 点線（徒歩）と実線（鉄道など）
const dots = () => ({ path: google.maps.SymbolPath.CIRCLE, fillColor: '#5A6356', fillOpacity: .95, strokeOpacity: 0, scale: 2 });
export function drawWalk(map, path) {
  const a = new google.maps.Polyline({ map, path, strokeColor: '#FFFFFF', strokeOpacity: .9, strokeWeight: 6, zIndex: 1 });
  const b = new google.maps.Polyline({ map, path, strokeOpacity: 0, icons: [{ icon: dots(), offset: '0', repeat: '9px' }], zIndex: 2 });
  return [a, b];
}
// 旅の線: 白い縁取りの上に細い本線（Google の経路線と同じ二層）。済んだ旅は薄く
export function drawLine(map, path, color = '#414A3D', weight = 2.5, opacity = .85) {
  return [
    new google.maps.Polyline({ map, path, strokeColor: '#FFFFFF', strokeOpacity: Math.min(1, opacity + .1), strokeWeight: weight + 3, zIndex: 1 }),
    new google.maps.Polyline({ map, path, strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, zIndex: 2 })
  ];
}

// 徒歩は Google の経路検索で道なりに。失敗したら直線
const routeCache = new Map();
export async function walkPath(a, b) {
  const k = `${a.lat},${a.lng}>${b.lat},${b.lng}`;
  if (routeCache.has(k)) return routeCache.get(k);
  const fb = [a, b];
  if (!google.maps.DirectionsService) return fb;
  const p = new Promise(res => {
    try {
      new google.maps.DirectionsService().route({ origin: a, destination: b, travelMode: 'WALKING' }, (r, st) => {
        res(st === 'OK' && r.routes[0] ? r.routes[0].overview_path : fb);
      });
    } catch { res(fb); }
  });
  routeCache.set(k, p);
  return p;
}

export function fitAll(map, pts, pad = { top: 80, bottom: 40, left: 40, right: 40 }, maxZoom = 16) {
  if (!pts.length) return;
  const b = new google.maps.LatLngBounds();
  pts.forEach(p => b.extend(p));
  map.fitBounds(b, pad);
  google.maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > maxZoom) map.setZoom(maxZoom); google.maps.event.trigger(map, 'resize'); });
}
