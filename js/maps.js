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
    s.onerror = () => reject(new Error('Google Maps の読み込みに失敗'));
    document.head.appendChild(s);
    // 認証エラー（キー制限など）は gm_authFailure に来る
    window.gm_authFailure = () => reject(new Error('Google Maps の認証に失敗（APIキーの制限を確認）'));
  });
  return loading;
}

// 淡い配色（POI 名は残す。細い道路名は消す）
export const STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#EEF0EA' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3A3A3A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 2 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE0EA' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#E6EBDD' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D9E6CB' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -60 }, { lightness: 20 }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#D8DBD2' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F6E9C8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F0D9A3' }] },
  { featureType: 'road.highway', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#9AA0A6' }, { weight: 1.2 }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ saturation: -40 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#C9CDC3' }] }
];

export function makeMap(el, opts = {}) {
  return new google.maps.Map(el, Object.assign({
    center: { lat: 35.0, lng: 137.0 }, zoom: 7, styles: STYLE,
    disableDefaultUI: true, zoomControl: false, gestureHandling: 'greedy', clickableIcons: true,
    mapTypeControl: false, fullscreenControl: false, keyboardShortcuts: false
  }, opts));
}

// HTML マーカー（OverlayView）。p: {lat,lng,name,kind,side,color}
let PinClass = null;
function pinClass() {
  if (PinClass) return PinClass;
  PinClass = class extends google.maps.OverlayView {
    constructor(map, p) { super(); this.p = p; this.setMap(map); }
    onAdd() {
      const el = document.createElement('div');
      el.className = `pin ${this.p.kind || 'sta'} ${this.p.side || ''} ${this.p.dim ? 'dim' : ''}`;
      const dot = this.p.color ? ` style="border-color:${this.p.color}"` : '';
      el.innerHTML = `<div class="dot"${dot}></div>${this.p.name ? `<div class="lb">${this.p.name}</div>` : ''}`;
      this.el = el;
      this.getPanes().overlayMouseTarget.appendChild(el);
    }
    draw() {
      const q = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.p.lat, this.p.lng));
      if (q) { this.el.style.left = q.x + 'px'; this.el.style.top = q.y + 'px'; }
    }
    onRemove() { this.el?.remove(); }
    update(p) { Object.assign(this.p, p); if (this.el) { this.el.className = `pin ${this.p.kind || 'sta'} ${this.p.side || ''}`; this.el.querySelector('.lb') && (this.el.querySelector('.lb').textContent = this.p.name); this.draw(); } }
  };
  return PinClass;
}
export function addPin(map, p) { const C = pinClass(); return new C(map, p); }

// 点線（徒歩）と実線（鉄道など）
const dots = () => ({ path: google.maps.SymbolPath.CIRCLE, fillColor: '#1A1A1A', fillOpacity: 1, strokeOpacity: 0, scale: 2.4 });
export function drawWalk(map, path) {
  const a = new google.maps.Polyline({ map, path, strokeColor: '#FFFFFF', strokeOpacity: .95, strokeWeight: 7, zIndex: 1 });
  const b = new google.maps.Polyline({ map, path, strokeOpacity: 0, icons: [{ icon: dots(), offset: '0', repeat: '10px' }], zIndex: 2 });
  return [a, b];
}
export function drawLine(map, path, color = '#1A1A1A', weight = 4, opacity = .9) {
  return [new google.maps.Polyline({ map, path, strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, zIndex: 1 })];
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
  google.maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > maxZoom) map.setZoom(maxZoom); });
}
