// 現在地の表示。地図右下のボタンを押したときだけ端末の位置情報を使う（外部には送らない）。
// 一度オンにしたら次回も自動でオン（localStorage tabi_geo）。
import { store } from './util.js';

const KEY = 'tabi_geo';
const CROSS = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="5.5"/><circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none"/><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3"/></svg>';

export function attachLocate(map, mapEl, opts = {}) {
  if (!('geolocation' in navigator)) return;
  const btn = document.createElement('button');
  btn.className = 'locate'; btn.type = 'button'; btn.title = '現在地'; btn.setAttribute('aria-label', '現在地を表示'); btn.innerHTML = CROSS;
  mapEl.appendChild(btn);
  let watch = null, marker = null, ring = null, first = true;

  const stop = () => {
    if (watch != null) navigator.geolocation.clearWatch(watch); watch = null;
    marker?.setMap(null); ring?.setMap(null); marker = ring = null;
    btn.classList.remove('on', 'err'); store.set(KEY, false);
  };
  const show = pos => {
    const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const acc = pos.coords.accuracy || 0;
    if (!marker) {
      marker = new google.maps.Marker({
        map, position: c, clickable: false, zIndex: 9,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#3C5A72', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2.5 }
      });
      ring = new google.maps.Circle({ map, center: c, radius: acc, clickable: false, fillColor: '#3C5A72', fillOpacity: .10, strokeColor: '#3C5A72', strokeOpacity: .25, strokeWeight: 1, zIndex: 8 });
    } else { marker.setPosition(c); ring.setCenter(c); ring.setRadius(acc); }
    btn.classList.add('on'); btn.classList.remove('err');
    if (first) { first = false; map.panTo(c); if (map.getZoom() < 15) map.setZoom(15); }
  };
  const start = (pan = true) => {
    first = pan;
    btn.classList.add('wait');
    watch = navigator.geolocation.watchPosition(p => { btn.classList.remove('wait'); show(p); store.set(KEY, true); },
      err => { btn.classList.remove('wait'); btn.classList.add('err'); store.set(KEY, false); watch = null; console.warn('geo:', err.message); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  };
  btn.addEventListener('click', () => {
    if (watch != null) { if (marker) { map.panTo(marker.getPosition()); if (map.getZoom() < 15) map.setZoom(15); } else stop(); return; }
    start(true);
  });
  btn.addEventListener('dblclick', e => { e.preventDefault(); stop(); });
  if (store.get(KEY, false) && opts.auto !== false) start(false);
  return { stop };
}
