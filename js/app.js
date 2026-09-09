// 旅の書架 — 起動・合言葉・ルーター
import { decryptBundle } from './crypto.js';
import { loadGoogle } from './maps.js';
import { store, esc, disposeAll } from './util.js';
import { renderShelf } from './shelf.js';
import { renderTrip } from './trip.js';
import { renderSettings } from './palette.js';
import { renderStats } from './stats.js';
import { applyPalette } from './palettes.js';

const app = document.getElementById('app');
const state = { data: null, maps: null, mapsErr: null, built: '' };
applyPalette(null); // 合言葉画面にも配色を効かせる

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  let bundle;
  try {
    bundle = await fetch('data/bundle.enc.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  } catch (e) {
    app.innerHTML = `<div class="unlock"><div class="logo"><small>TABI NO SHOKA</small>旅の書架</div><p>旅データを読み込めませんでした。電波のあるところで開き直してください。</p></div>`;
    return;
  }
  state.built = bundle.built || '';
  const pass = store.get('tabi_pass');
  if (pass) {
    try { state.data = await decryptBundle(bundle, pass); } catch { store.del('tabi_pass'); }
  }
  if (!state.data) { renderUnlock(bundle); return; }
  start();
}

function renderUnlock(bundle) {
  app.innerHTML = `
  <form class="unlock" id="unlock" autocomplete="off">
    <div class="logo"><small>TABI NO SHOKA</small>旅の書架</div>
    <p>ふたりの旅の予定と記録。合言葉を入れるとこの端末に記憶され、次からは開くだけで使えます。</p>
    <input type="password" id="pass" placeholder="合言葉" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="btn fill" type="submit">ひらく</button>
    <div class="err" id="err"></div>
    <div class="foot">PRIVATE EDITION · ${esc(bundle.owner || '')}${bundle.built ? ' · DATA ' + esc(bundle.built) : ''}</div>
  </form>`;
  const f = document.getElementById('unlock');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const pass = document.getElementById('pass').value.trim();
    const err = document.getElementById('err');
    if (!pass) return;
    err.textContent = '確認中…';
    try {
      state.data = await decryptBundle(bundle, pass);
      store.set('tabi_pass', pass);
      start();
    } catch {
      err.textContent = '合言葉が違うようです。';
    }
  });
  setTimeout(() => document.getElementById('pass')?.focus(), 50);
}

function start() {
  applyPalette(state.data);
  const key = state.data.config?.gmapsKey;
  const loadMaps = () => { state.maps = key ? loadGoogle(key) : Promise.reject(new Error('地図キー未設定')); state.maps.catch(() => {}); };
  loadMaps();
  // 地図の読み込みに失敗したとき（圏外など）: 読み込みからやり直して今の画面を描き直す
  state.retryMaps = () => { loadMaps(); route(); };
  window.addEventListener('hashchange', route);
  // 端末が昼夜で切り替わったら配色を当て直して描き直す
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyPalette(state.data); route(); });
  route();
  // 圏外の表示: 手元に保存した情報で動いている旨を出す
  const bar = document.createElement('div'); bar.className = 'offline'; bar.textContent = '圏外 · 保存済みの情報を表示しています（地図は出ません）';
  document.body.appendChild(bar);
  const sync = () => bar.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', sync); window.addEventListener('offline', sync); sync();
}

function route() {
  disposeAll();
  app.animate?.([{ opacity: .55 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' }); // 画面の切り替えを淡く
  const h = location.hash.replace(/^#\/?/, '');
  const [seg, id, sub, arg] = h.split('/');
  if (seg === 'settings' || seg === 'palette') { renderSettings(app, state); window.scrollTo(0, 0); return; }
  if (seg === 'stats') { renderStats(app, state); window.scrollTo(0, 0); return; }
  if (seg === 'trip' && id) {
    const trip = state.data.trips.find(t => t.id === id);
    if (trip) { renderTrip(app, state, trip, sub, arg); window.scrollTo(0, 0); return; }
  }
  renderShelf(app, state);
}

boot();
