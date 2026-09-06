// 手帳（旅1冊）— DAY / 宿 / 準備 / 記録
import { makeMap, addPin, drawWalk, walkPath, fitAll, distKm } from './maps.js';
import { esc, h, fmtRange, fmtMDW, fmtMD, WDE, parseDate, tripStatus, dayIndexOf, daysBetween, today, nowHM, hm2min, minDiff, fmtMin, yen, gmapsDir, store } from './util.js';
import { attachSheet } from './sheet.js';
import { icon, catOf } from './icons.js';

let tick = null;

export function renderTrip(app, state, trip, sub, arg) {
  clearInterval(tick);
  const days = trip.days || [];
  if (!days.length) { renderSummary(app, trip); return; }
  let dayIdx = null;
  if (sub === 'day') { dayIdx = arg ? Number(arg) : (dayIndexOf(trip) || 1); if (!(dayIdx >= 1 && dayIdx <= days.length)) dayIdx = 1; }
  const tab = (key, label, on, extra = '') => h`<button class="${extra}${on ? ' on' : ''}" data-go="${key}">${label}</button>`;
  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">${trip.sub ? esc(trip.sub) : esc(trip.area || '')}</span></div>
    <h1>${esc(trip.title)}<span>${fmtRange(trip.start, trip.end)}</span></h1>
    <div class="tabs">
      ${days.map((d, i) => h`<button class="day${sub === 'day' && dayIdx === i + 1 ? ' on' : ''}" data-go="day/${i + 1}"><b>${fmtMD(d.date)}</b><small>${WDE[parseDate(d.date).getDay()]}</small></button>`)}
      <span class="sep"></span>
      ${tab('stay', '宿', sub === 'stay')}${tab('prep', '準備', sub === 'prep')}${tab('log', '記録', sub === 'log')}
    </div>
  </div>
  <div id="body" class="stage"></div>`;
  app.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { location.hash = `#/trip/${trip.id}/${b.dataset.go}`; }));
  const body = document.getElementById('body');
  if (sub === 'stay') renderStay(body, state, trip);
  else if (sub === 'prep') renderPrep(body, state, trip);
  else if (sub === 'log') renderLog(body, state, trip);
  else renderDay(body, state, trip, days[dayIdx - 1], dayIdx);
}

/* ---------------- 簡易の旅（一覧だけの旅・過去の旅） ---------------- */
function renderSummary(app, trip) {
  const st = tripStatus(trip);
  const budget = trip.budget || [];
  const total = budget.reduce((s, b) => s + (b.yen || 0), 0);
  const M = trip.memories || {};
  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">${trip.sub ? esc(trip.sub) : esc(trip.area || '')}</span></div>
    <h1>${esc(trip.title)}<span>${fmtRange(trip.start, trip.end)}</span></h1>
  </div>
  <div class="pane">
    <div class="card">
      <h3>${esc(trip.area || '')}<small>${trip.nights}泊${trip.abroad ? ' · 海外' : ''}${st === 'planned' ? ` · ${daysBetween(today(), trip.start)}日後` : st === 'ongoing' ? ' · 旅行中' : ''}</small></h3>
      ${trip.summary ? h`<p>${esc(trip.summary)}</p>` : '<div class="empty">この旅は一覧にだけ入っています。詳しい行程は入れていません。</div>'}
      ${trip.link ? h`<div class="links"><a class="btn" href="${esc(trip.link.url)}" target="_blank" rel="noopener">${esc(trip.link.label || '開く')}<small>LINK</small></a></div>` : ''}
    </div>
    ${M.notes ? h`<div class="card"><h3>ひとこと<small>NOTES</small></h3><p>${esc(M.notes)}</p></div>` : ''}
    ${(M.highlights || []).length ? h`<div class="card"><h3>よかったところ<small>HIGHLIGHTS</small></h3><div class="chips">${M.highlights.map(x => h`<span>${esc(x)}</span>`)}</div></div>` : ''}
    ${budget.length ? h`<div class="card"><h3>費用<small>${st === 'done' ? 'ACTUAL' : 'ESTIMATE'}</small></h3><table class="yen">${budget.map(b => h`<tr><td>${esc(b.item)}${b.note ? h`<small>${esc(b.note)}</small>` : ''}</td><td class="v">${b.yen != null ? yen(b.yen) : '—'}</td></tr>`)}<tr class="total"><td>合計</td><td class="v">${yen(total)}</td></tr></table></div>` : ''}
  </div>`;
}

/* ---------------- DAY ---------------- */
function currentIndex(sched) {
  const now = hm2min(nowHM());
  let cur = -1;
  sched.forEach((r, i) => { const m = hm2min(r.t); if (m != null && m <= now) cur = i; });
  return cur;
}

function renderDay(body, state, trip, day, idx) {
  const P = trip.places || {};
  const sched = day.sched || [];
  const isToday = day.date === today();
  const st = tripStatus(trip);
  const cur = isToday ? currentIndex(sched) : -1;
  const curRow = cur >= 0 ? sched[cur] : null;
  const nextRow = isToday ? sched.slice(cur + 1).find(r => hm2min(r.t) != null) : null;

  // 位置を持つ行に日内の通し番号（同じ場所は同じ番号）。遠方（far）は番号なし
  const numOf = {}; let n = 0;
  sched.forEach(r => { const p = r.at && P[r.at]; if (p && !p.far && numOf[r.at] == null) numOf[r.at] = ++n; });

  let top;
  if (isToday) {
    const dm = nextRow ? minDiff(nextRow.t) : null;
    top = h`<div class="nowrow"><b><i></i>${esc(curRow ? curRow.h : '出発前')}</b><span>${nowHM()}${nextRow && dm != null && dm >= 0 ? ` · ${esc(nextRow.h)}まで ${fmtMin(dm)}` : ''}</span></div>
      <div class="nowsub">${esc(curRow?.d || day.lead || '')}</div>`;
  } else {
    const cd = st === 'planned' ? h`<span class="cd">${daysBetween(today(), trip.start)}日後</span>` : h`<span class="k">${fmtMDW(day.date)}</span>`;
    top = h`<div class="nowrow"><b>${esc(day.title || `DAY ${idx}`)}</b>${cd}</div>
      <div class="nowsub">${esc(day.lead || '')}</div>`;
  }

  body.innerHTML = h`
    <div class="map" id="map"><div class="gm" id="gm"></div><div class="msg" id="mapmsg">地図を読み込み中…</div></div>
    <div class="sheet" id="sheet">
      <div class="grab"><div class="hdl"></div><div class="pill"><button id="pmap">地図</button><button id="phalf">半々</button><button id="plist">リスト</button></div></div>
      ${top}
      <div class="evs">${sched.map((r, i) => evRow(r, i, P, cur, isToday, numOf))}</div>
    </div>`;

  // 地図とシートの割合: つまみのドラッグ / 地図・半々・リスト
  attachSheet(body, document.getElementById('sheet'), { pill: { peek: document.getElementById('pmap'), half: document.getElementById('phalf'), list: document.getElementById('plist') } });

  let map = null, pins = {};
  // リスト↔地図の結線: 行をタップ→そのピンを選択して寄せる／ピンをタップ→その行へスクロール
  const selectPlace = (key, fromMap) => {
    for (const k in pins) pins[k].select(k === key);
    body.querySelectorAll('.ev').forEach(el => el.classList.toggle('sel', sched[Number(el.dataset.i)].at === key));
    const p = P[key];
    if (!fromMap && map && p && !p.far) { map.panTo(p); if (map.getZoom() < 15) map.setZoom(15); }
    if (fromMap) { const el = body.querySelector(`.ev[data-at="${key}"]`); if (el) { el.classList.add('open'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  };
  body.querySelectorAll('.ev').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    el.classList.toggle('open');
    const at = sched[Number(el.dataset.i)].at;
    if (at && P[at]) selectPlace(at, false);
  }));

  state.maps.then(() => {
    const el = document.getElementById('gm'); if (!el || !el.isConnected) return;
    document.getElementById('mapmsg')?.remove();
    map = makeMap(el);
    const used = [], seen = new Set();
    sched.forEach(r => { if (r.at && P[r.at] && !seen.has(r.at)) { seen.add(r.at); used.push(r.at); } });
    for (const k of used) {
      const p = P[k];
      pins[k] = addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: p.kind || 'sta', side: p.side || 'b', dim: !!p.far, num: numOf[k], onTap: () => selectPlace(k, true) });
    }
    // 徒歩区間は道なりの点線（前の行の場所 → この行の場所）
    let prevAt = null;
    sched.forEach(r => {
      if (r.at && P[r.at]) {
        // 徒歩は同じ町の中だけ（5km以内）。駅から駅へ移った直後の「徒歩5分」に遠距離の経路検索をしない
        if (r.mode === 'walk' && prevAt && prevAt !== r.at && distKm(P[prevAt], P[r.at]) < 5) walkPath(P[prevAt], P[r.at]).then(path => drawWalk(map, path));
        prevAt = r.at;
      }
    });
    if (isToday && curRow?.at && P[curRow.at]) {
      const p = P[curRow.at];
      addPin(map, { lat: p.lat, lng: p.lng, name: `いま ${nowHM()}`, kind: 'now', side: 'r' });
    }
    const focus = (day.focus || used).map(k => P[k]).filter(p => p && !p.far);
    fitAll(map, focus.length ? focus : used.map(k => P[k]), { top: 70, bottom: 30, left: 40, right: 60 }, 16);
    // 現在行にスクロール
    const on = body.querySelector('.ev.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }).catch(e => { const m = document.getElementById('mapmsg'); if (m) m.textContent = e.message || '地図を表示できません'; });

  if (isToday) tick = setInterval(() => { if (location.hash.includes(`/trip/${trip.id}`)) renderTrip(document.getElementById('app'), state, trip, 'day', String(idx)); }, 60000);
}

function evRow(r, i, P, cur, isToday, numOf = {}) {
  const p = r.at ? P[r.at] : null;
  const tips = (r.tips || []).map(t => t.startsWith('注意｜') ? h`<li class="warn">${esc(t.slice(3))}</li>` : h`<li>${esc(t)}</li>`);
  const links = [];
  if (p && !p.far) links.push(h`<a class="btn" href="${gmapsDir(p, null, r.mode === 'walk' ? 'walking' : 'transit')}" target="_blank" rel="noopener">経路<small>MAPS</small></a>`);
  if (r.web) links.push(h`<a class="btn" href="${esc(r.web)}" target="_blank" rel="noopener">公式<small>WEB</small></a>`);
  const cls = ['ev', isToday && i === cur ? 'on' : '', isToday && i < cur ? 'past' : ''].join(' ');
  const num = r.at ? numOf[r.at] : null;
  const cat = catOf(r, p);
  // 場所を持つ行は番号（地図のピンと同じ）、移動だけの行は絵記号
  const mark = num != null ? h`<span class="ic num">${num}</span>` : h`<span class="ic">${icon(cat)}</span>`;
  const ticket = r.ticket ? h`<div class="ticket"><span class="st"><b>${esc(r.ticket.from)}</b><small>${esc(r.ticket.dep || '')}</small></span><span class="arr">${icon(cat)}<small>${esc(r.ticket.name || '')}</small></span><span class="st"><b>${esc(r.ticket.to)}</b><small>${esc(r.ticket.arr || '')}</small></span></div>` : '';
  return h`<div class="${cls}" data-i="${i}" data-at="${esc(r.at || '')}">
    <span class="t">${esc(r.t || '')}${r.t2 ? h`<small>${esc(r.t2)}</small>` : ''}</span>
    ${mark}
    <span class="body"><div class="n">${esc(r.h)}${r.hard ? '<span class="hardtag">厳守</span>' : ''}</div>${ticket}${r.d ? h`<div class="s">${esc(r.d)}</div>` : ''}</span>
    <span class="d">${esc(r.r || '')}</span>
    ${tips.length || links.length ? h`<div class="x">${tips.length ? h`<ul>${tips}</ul>` : ''}${links.length ? h`<div class="links">${links}</div>` : ''}</div>` : ''}
  </div>`;
}

/* ---------------- 宿 ---------------- */
function renderStay(body, state, trip) {
  const P = trip.places || {};
  const stays = trip.stays || [];
  const kv = (rows) => rows?.length ? h`<dl class="kv">${rows.map(r => h`<dt>${esc(r.k)}</dt><dd>${esc(r.v)}</dd>`)}</dl>` : '';
  body.innerHTML = h`
    <div class="map" id="map"><div class="gm" id="gm"></div><div class="msg" id="mapmsg">地図を読み込み中…</div></div>
    <div class="sheet" id="sheet"><div class="grab"><div class="hdl"></div></div>
      ${stays.length ? stays.map(s => {
        const st = P[s.at];
        return h`
        <div class="stayhd">
          <div class="nowrow"><b>${esc(s.name)}</b><span>${esc(s.nights || '')}</span></div>
          ${s.sub ? h`<div class="nowsub">${esc(s.sub)}</div>` : ''}
          ${(s.tags || []).length ? h`<div class="chips">${s.tags.map(t => h`<span>${esc(t)}</span>`)}</div>` : ''}
          <div class="inout"><div><small>IN</small><b>${esc(s.checkin || '—')}</b>${s.lastin ? h`<i>最終 ${esc(s.lastin)}</i>` : ''}</div><div><small>OUT</small><b>${esc(s.checkout || '—')}</b></div>${s.arrive ? h`<div><small>到着</small><b class="sm">${esc(s.arrive)}</b></div>` : ''}</div>
          <div class="links">${st ? h`<a class="btn" href="${gmapsDir(st, null, 'walking')}" target="_blank" rel="noopener">経路<small>MAPS</small></a>` : ''}${s.official ? h`<a class="btn" href="${esc(s.official)}" target="_blank" rel="noopener">公式<small>WEB</small></a>` : ''}${s.web ? h`<a class="btn" href="${esc(s.web)}" target="_blank" rel="noopener">予約ページ<small>WEB</small></a>` : ''}</div>
        </div>
        ${(s.timeline || []).length ? h`<div class="card"><h3>滞在の流れ<small>STAY</small></h3>${s.timeline.map(x => h`<div class="seg"><span class="t">${esc(x.t)}</span><span><div class="n">${esc(x.h)}</div>${x.d ? h`<div class="s">${esc(x.d)}</div>` : ''}</span></div>`)}</div>` : ''}
        ${(s.access || []).length || s.addr || s.tel ? h`<div class="card"><h3>アクセス<small>ACCESS</small></h3>
          ${s.addr ? h`<div class="meta">${esc(s.addr)}${s.tel ? ' · TEL ' + esc(s.tel) : ''}</div>` : ''}
          ${(s.access || []).length ? h`<ul class="ul">${s.access.map(a => h`<li>${esc(a)}</li>`)}</ul>` : ''}
        </div>` : ''}
        ${(s.facilities || []).length ? h`<div class="card"><h3>館内<small>FACILITIES</small></h3>${kv(s.facilities)}</div>` : ''}
        ${s.room || (s.bring || []).length ? h`<div class="card"><h3>部屋と持ち物<small>ROOM</small></h3>${s.room ? h`<p>${esc(s.room)}</p>` : ''}${(s.bring || []).length ? h`<ul class="ul">${s.bring.map(a => h`<li>${esc(a)}</li>`)}</ul>` : ''}</div>` : ''}
        ${(s.nearby || []).length ? h`<div class="card"><h3>周辺<small>NEARBY</small></h3>${kv(s.nearby)}</div>` : ''}
        ${(s.booking || []).length || s.plan || s.price || s.via ? h`<div class="card"><h3>予約<small>BOOKING</small></h3>${kv(s.booking || [{ k: 'プラン', v: s.plan || '' }, { k: '料金', v: s.price || '' }, { k: '経由', v: s.via || '' }].filter(r => r.v))}</div>` : ''}
        ${s.note ? h`<div class="card"><p>${esc(s.note)}</p></div>` : ''}`;
      }) : '<div class="empty">宿の情報はまだありません。</div>'}
    </div>`;
  attachSheet(body, document.getElementById('sheet'));
  state.maps.then(() => {
    const el = document.getElementById('gm'); if (!el || !el.isConnected) return;
    document.getElementById('mapmsg')?.remove();
    const map = makeMap(el);
    const pts = [];
    for (const s of stays) { const p = P[s.at]; if (!p) continue; addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: 'stay', side: p.side || 'b' }); pts.push(p); }
    for (const k of (trip.stayContext || [])) { const p = P[k]; if (p) { addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: 'sta', side: p.side || 'b', dim: true }); pts.push(p); } }
    // 最寄り駅から宿までの徒歩を道なりで
    const s0 = stays[0], ctx = (trip.stayContext || [])[0];
    if (s0 && P[s0.at] && ctx && P[ctx] && distKm(P[ctx], P[s0.at]) < 3) walkPath(P[ctx], P[s0.at]).then(path => drawWalk(map, path));
    fitAll(map, pts, { top: 40, bottom: 30, left: 50, right: 50 }, 16);
  }).catch(e => { const m = document.getElementById('mapmsg'); if (m) m.textContent = e.message || '地図を表示できません'; });
}

/* ---------------- 準備 ---------------- */
function renderPrep(body, state, trip) {
  const key = `tabi_done_${trip.id}`;
  const done = new Set(store.get(key, []));
  const tr = trip.transport || [];
  const todo = trip.prep?.todo || [];
  const pack = trip.prep?.packing || [];
  const t0 = today();
  body.innerHTML = h`<div class="pane">
    ${tr.length ? h`<div class="card"><h3>手配<small>TRANSPORT</small></h3>
      ${tr.map(s => h`<div class="seg"><span class="t">${esc(s.date ? s.date.slice(5).replace('-', '.') + ' ' : '')}${esc(s.dep || '')}</span><span><div class="n">${esc(s.name)}${s.booked ? '' : '<span class="hardtag">未手配</span>'}</div><div class="s">${esc(s.from)} ${esc(s.dep || '')} → ${esc(s.to)} ${esc(s.arr || '')}${s.note ? ' · ' + esc(s.note) : ''}</div></span></div>`)}
    </div>` : ''}
    <div class="card"><h3>やること<small>TODO</small></h3>
      ${todo.length ? todo.map((t, i) => {
        const id = t.id || String(i);
        const soon = t.due && !done.has(id) && daysBetween(t0, t.due) <= 7;
        return h`<button class="todo${done.has(id) ? ' done' : ''}" data-id="${id}"><span class="box"></span><span><div class="n">${esc(t.t)}</div>${t.due ? h`<div class="due${soon ? ' soon' : ''}">${esc(t.due)}${t.dueNote ? ' · ' + esc(t.dueNote) : ''}</div>` : ''}</span></button>`;
      }) : '<div class="empty">やることはありません。</div>'}
    </div>
    ${pack.length ? h`<div class="card"><h3>持ち物<small>PACKING</small></h3><div class="chips">${pack.map(p => h`<span>${esc(p)}</span>`)}</div></div>` : ''}
  </div>`;
  body.querySelectorAll('.todo').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.id; done.has(id) ? done.delete(id) : done.add(id);
    store.set(key, [...done]); b.classList.toggle('done', done.has(id));
  }));
}

/* ---------------- 記録 ---------------- */
function renderLog(body, state, trip) {
  const st = tripStatus(trip);
  const budget = trip.budget || [];
  const total = budget.reduce((s, b) => s + (b.yen || 0), 0);
  const M = trip.memories || {};
  body.innerHTML = h`<div class="pane">
    ${st !== 'done' ? h`<div class="card"><h3>この旅の記録<small>LOG</small></h3><div class="empty">旅のあとに、写真と一言、かかった費用をここに残します。いまは<b>見込みの費用</b>だけ。</div></div>` : ''}
    ${M.notes ? h`<div class="card"><h3>ひとこと<small>NOTES</small></h3><p>${esc(M.notes)}</p></div>` : ''}
    ${(M.highlights || []).length ? h`<div class="card"><h3>よかったところ<small>HIGHLIGHTS</small></h3><div class="chips">${M.highlights.map(x => h`<span>${esc(x)}</span>`)}</div></div>` : ''}
    ${(M.next || []).length ? h`<div class="card"><h3>次に活かす<small>NEXT TIME</small></h3><ul style="font-size:12.5px;line-height:1.8;padding-left:1.2em;margin-top:6px">${M.next.map(x => h`<li>${esc(x)}</li>`)}</ul></div>` : ''}
    ${budget.length ? h`<div class="card"><h3>費用<small>${st === 'done' ? 'ACTUAL' : 'ESTIMATE'}</small></h3>
      <table class="yen">${budget.map(b => h`<tr><td>${esc(b.item)}${b.note ? h`<small>${esc(b.note)}</small>` : ''}</td><td class="v">${b.yen != null ? yen(b.yen) : '—'}</td></tr>`)}
      <tr class="total"><td>合計${trip.budgetNote ? h`<small>${esc(trip.budgetNote)}</small>` : ''}</td><td class="v">${yen(total)}</td></tr></table></div>` : ''}
    ${(M.photos || []).length ? h`<div class="card"><h3>写真<small>PHOTOS</small></h3><div class="chips">${M.photos.map(p => h`<span>${esc(p.caption || p.file)}</span>`)}</div></div>` : (st === 'done' ? '<div class="card"><h3>写真<small>PHOTOS</small></h3><div class="empty">写真はまだ入っていません。</div></div>' : '')}
  </div>`;
}
