// 旅の書架 — 起動・合言葉・ルーター
import { decryptBundle } from './crypto.js';
import { loadGoogle } from './maps.js';
import { store, esc } from './util.js';
import { renderShelf } from './shelf.js';
import { renderTrip } from './trip.js';

const app = document.getElementById('app');
const state = { data: null, maps: null, mapsErr: null };

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  let bundle;
  try {
    bundle = await fetch('data/bundle.enc.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  } catch (e) {
    app.innerHTML = `<div class="unlock"><div class="logo"><small>TABI NO SHOKA</small>旅の書架</div><p>旅データを読み込めませんでした。電波のあるところで開き直してください。</p></div>`;
    return;
  }
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
  const key = state.data.config?.gmapsKey;
  state.maps = key ? loadGoogle(key).catch(e => { state.mapsErr = e; throw e; }) : Promise.reject(new Error('地図キー未設定'));
  state.maps.catch(() => {});
  window.addEventListener('hashchange', route);
  route();
}

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [seg, id, sub, arg] = h.split('/');
  if (seg === 'trip' && id) {
    const trip = state.data.trips.find(t => t.id === id);
    if (trip) { renderTrip(app, state, trip, sub || 'day', arg); window.scrollTo(0, 0); return; }
  }
  renderShelf(app, state);
}

boot();
