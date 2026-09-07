// 本棚（ホーム）— 足あとの地図＋旅の一覧
import { makeMap, addPin, fitAll } from './maps.js';
import { attachLocate } from './geo.js';
import { esc, h, fmtRange, tripStatus, dayIndexOf, daysBetween, today, store } from './util.js';
import { attachSheet } from './sheet.js';

export function renderShelf(app, state) {
  const trips = state.data.trips.slice();
  const t0 = today();
  // 並び順: 新しい順（既定）／古い順／これから（予定の旅を出発が近い順に上へ、済んだ旅は新しい順）。端末に記憶
  const SORTS = {
    newest: (a, b) => b.start.localeCompare(a.start),
    oldest: (a, b) => a.start.localeCompare(b.start),
    upcoming: (a, b) => { const oa = tripStatus(a, t0) === 'done' ? 1 : 0, ob = tripStatus(b, t0) === 'done' ? 1 : 0; return oa - ob || (oa ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)); }
  };
  let sortKey = store.get('tabi_sort', 'newest'); if (!SORTS[sortKey]) sortKey = 'newest';
  trips.sort(SORTS[sortKey]);
  const nights = trips.reduce((s, t) => s + (t.nights || 0), 0);
  const next = trips.find(t => tripStatus(t, t0) === 'planned');
  const live = trips.find(t => tripStatus(t, t0) === 'ongoing');
  const year = new Date().getFullYear();

  app.innerHTML = h`
  <div class="hd shelf">
    <div class="row"><div class="k">Tabi no Shoka — 足あと</div><button class="back" id="lock">LOCK</button></div>
    <h1>旅の書架<span>${year}</span></h1>
    <div class="sum"><span><b>${trips.length}</b> 旅</span><span><b>${nights}</b> 泊</span>${live ? h`<span><b style="color:var(--now)">DAY ${dayIndexOf(live)}</b> 旅行中</span>` : next ? h`<span><b>${daysBetween(t0, next.start)}</b> 日後に出発</span>` : ''}</div>
  </div>
  <div class="stage" id="stage">
    <div class="map" id="map"><div class="gm" id="gm"></div><div class="msg" id="mapmsg">地図を読み込み中…</div></div>
    <div class="sheet" id="sheet"><div class="grab"><div class="hdl"></div><div class="pill"><button id="pmap">地図</button><button id="phalf">半々</button><button id="plist">リスト</button></div></div>
      <div class="sortbar"><span class="k">並び</span><div class="pill sm" id="sort"><button data-s="newest">新しい順</button><button data-s="oldest">古い順</button><button data-s="upcoming">これから</button></div></div>
      <div class="trips" id="trips">${trips.map(t => row(t, t0))}</div>
    </div>
  </div>`;

  const bindRows = () => app.querySelectorAll('.tr').forEach(b => b.addEventListener('click', () => { location.hash = `#/trip/${b.dataset.id}`; }));
  bindRows();
  const sortEl = document.getElementById('sort');
  const paintSort = () => sortEl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.s === sortKey));
  paintSort();
  sortEl.querySelectorAll('button').forEach(x => x.addEventListener('click', () => {
    sortKey = x.dataset.s; store.set('tabi_sort', sortKey); paintSort();
    trips.sort(SORTS[sortKey]); document.getElementById('trips').innerHTML = trips.map(t => row(t, t0)).join(''); bindRows();
  }));
  attachSheet(document.getElementById('stage'), document.getElementById('sheet'), { pill: { peek: document.getElementById('pmap'), half: document.getElementById('phalf'), list: document.getElementById('plist') } });
  document.getElementById('lock').addEventListener('click', () => { if (confirm('合言葉の記憶を消して閉じますか？')) { store.del('tabi_pass'); location.reload(); } });

  state.maps.then(() => mountMap(state, trips)).catch(e => { document.getElementById('mapmsg').textContent = e.message || '地図を表示できません'; });
}

function row(t, t0) {
  const st = tripStatus(t, t0);
  let status;
  if (st === 'ongoing') status = h`<span class="st live"><b>DAY ${dayIndexOf(t, t0)}</b>旅行中</span>`;
  else if (st === 'planned') status = h`<span class="st"><b>${daysBetween(t0, t.start)}日</b>あと</span>`;
  else status = h`<span class="st done"><b>済</b>${t.end.slice(5).replace('-', '.')}</span>`;
  return h`<button class="tr" data-id="${t.id}">
    <span class="sw" style="background:${t.color}"></span>
    <span class="nm">${esc(t.title)}${t.abroad ? '<span class="chip">海外</span>' : ''}<small>${fmtRange(t.start, t.end)} · ${t.nights}泊${t.area ? ' · ' + esc(t.area) : ''}</small></span>
    ${status}
  </button>`;
}

function mountMap(state, trips) {
  const el = document.getElementById('gm');
  if (!el || !el.isConnected) return;
  document.getElementById('mapmsg')?.remove();
  const map = makeMap(el, { zoom: 7 });
  const home = state.data.config.home;
  const pts = [];
  if (home) { addPin(map, { lat: home.lat, lng: home.lng, name: home.name, kind: 'trip', side: 'r' }); pts.push(home); }
  for (const t of trips) {
    const P = t.places || {};
    const done = tripStatus(t, today()) === 'done';
    for (const k of (t.shelfPins || [])) {
      const p = P[k]; if (!p) continue;
      addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: 'trip', side: p.side || 'b', color: t.color, dim: done, onTap: () => { location.hash = `#/trip/${t.id}`; } });
      pts.push(p);
    }
  }
  attachLocate(map, document.getElementById('map'));
  fitAll(map, pts, { top: 60, bottom: 40, left: 70, right: 60 }, 11);
}
