// 手帳（旅1冊）— DAY / 宿 / 準備 / 記録
import { makeMap, addPin, drawWalk, walkPath, fitAll, distKm, mapError } from './maps.js';
import { esc, h, fmtRange, fmtMDW, fmtMD, WDE, parseDate, tripStatus, dayIndexOf, daysBetween, today, nowHM, hm2min, minDiff, fmtMin, yen, gmapsDir, store, onDispose, disposeAll } from './util.js';
import { attachSheet } from './sheet.js';
import { icon, catOf, catGroup } from './icons.js';
import { attachLocate } from './geo.js';
import { grid, thumb, hydrate, bindViewer } from './photos.js';

export function renderTrip(app, state, trip, sub, arg) {
  disposeAll(); // 日付が変わって描き直すときもここを通る
  const days = trip.days || [];
  if (!days.length) { renderSummary(app, trip); return; }
  // 既定の画面: 旅行中は今日の DAY、それ以外は概要
  if (!sub) sub = dayIndexOf(trip) ? 'day' : 'overview';
  let dayIdx = null;
  if (sub === 'day') { dayIdx = arg ? Number(arg) : (dayIndexOf(trip) || 1); if (!(dayIdx >= 1 && dayIdx <= days.length)) dayIdx = 1; }
  const tab = (key, label, on, extra = '') => h`<button class="${extra}${on ? ' on' : ''}" data-go="${key}">${label}</button>`;
  app.style.setProperty('--trip', trip.color || '#414A3D');
  const t0 = today();
  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">${trip.sub ? esc(trip.sub) : esc(trip.area || '')}</span></div>
    <h1><i class="spine"></i>${esc(trip.title)}<span>${fmtRange(trip.start, trip.end)}</span></h1>
    <div class="tabs">
      ${tab('overview', '概要', sub === 'overview')}
      <span class="sep"></span>
      ${days.map((d, i) => h`<button class="day${sub === 'day' && dayIdx === i + 1 ? ' on' : ''}${d.date === t0 ? ' today' : ''}" data-go="day/${i + 1}"><b>${fmtMD(d.date)}</b><small>${d.date === t0 ? 'TODAY' : WDE[parseDate(d.date).getDay()]}</small></button>`)}
      <span class="sep"></span>
      ${tab('stay', '宿', sub === 'stay')}${tab('prep', '準備', sub === 'prep')}${tab('log', '記録', sub === 'log')}
    </div>
  </div>
  <div id="body" class="stage"></div>`;
  app.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { location.hash = `#/trip/${trip.id}/${b.dataset.go}`; }));
  const body = document.getElementById('body');
  if (sub === 'overview') renderOverview(body, state, trip);
  else if (sub === 'stay') renderStay(body, state, trip);
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
  const cover = (M.photos || []).find(p => p.id === trip.cover) || (M.photos || [])[0] || null;
  app.style.setProperty('--trip', trip.color || '#414A3D');
  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">${trip.sub ? esc(trip.sub) : esc(trip.area || '')}</span></div>
    <h1><i class="spine"></i>${esc(trip.title)}<span>${fmtRange(trip.start, trip.end)}</span></h1>
  </div>
  <div class="pane">
    <div class="card">
      ${cover ? h`<div class="ovtop">${thumb(cover, 'ph cover')}<div>` : ''}
      <h3>${esc(trip.area || '')}<small>${trip.nights}泊${trip.abroad ? ' · 海外' : ''}${st === 'planned' ? ` · ${daysBetween(today(), trip.start)}日後` : st === 'ongoing' ? ' · 旅行中' : ''}${(M.photos || []).length ? ` · 写真${M.photos.length}枚` : ''}</small></h3>
      ${trip.summary ? h`<p>${esc(trip.summary)}</p>` : '<div class="empty">この旅は一覧にだけ入っています。詳しい行程は入れていません。</div>'}
      ${cover ? '</div></div>' : ''}
      ${trip.link ? h`<div class="links"><a class="btn" href="${esc(trip.link.url)}" target="_blank" rel="noopener">${esc(trip.link.label || '開く')}<small>LINK</small></a></div>` : ''}
    </div>
    ${M.notes ? h`<div class="card"><h3>ひとこと<small>NOTES</small></h3><p>${esc(M.notes)}</p></div>` : ''}
    ${(M.highlights || []).length ? h`<div class="card"><h3>よかったところ<small>HIGHLIGHTS</small></h3><div class="chips">${M.highlights.map(x => h`<span>${esc(x)}</span>`)}</div></div>` : ''}
    ${(M.next || []).length ? h`<div class="card"><h3>次に活かす<small>NEXT TIME</small></h3><ul class="ul">${M.next.map(x => h`<li>${esc(x)}</li>`)}</ul></div>` : ''}
    ${budget.length ? h`<div class="card"><h3>費用<small>${st === 'done' ? 'ACTUAL' : 'ESTIMATE'}</small></h3><table class="yen">${budget.map(b => h`<tr><td>${esc(b.item)}${b.note ? h`<small>${esc(b.note)}</small>` : ''}</td><td class="v">${b.yen != null ? yen(b.yen) : '—'}</td></tr>`)}<tr class="total"><td>合計</td><td class="v">${yen(total)}</td></tr></table></div>` : ''}
    ${(M.photos || []).length ? h`<div class="card"><h3>写真<small>PHOTOS · ${M.photos.length}</small></h3>${grid(M.photos, trip.id)}</div>` : ''}
  </div>`;
  hydrate(app); bindViewer(app, M.photos || []);
}

/* ---------------- 概要（旅全体） ---------------- */
function renderOverview(body, state, trip) {
  const P = trip.places || {};
  const days = trip.days || [];
  const st = tripStatus(trip);
  const t0 = today();
  const tickets = [];
  days.forEach(d => (d.sched || []).forEach(r => { if (r.ticket) tickets.push({ date: d.date, ...r.ticket, cat: catOf(r, P[r.at]) }); }));
  const budget = trip.budget || [];
  const total = budget.reduce((a, b) => a + (b.yen || 0), 0);
  const M = trip.memories || {};
  const cover = (M.photos || []).find(p => p.id === trip.cover) || (M.photos || [])[0] || null;
  const status = st === 'ongoing' ? h`<span class="cd" style="color:var(--now)">旅行中 DAY ${dayIndexOf(trip)}</span>` : st === 'planned' ? h`<span class="cd">${daysBetween(t0, trip.start)}日後</span>` : h`<span class="cd">済</span>`;
  const stopsOf = d => (d.sched || []).filter(r => r.at && P[r.at] && !P[r.at].far).map(r => r.at).filter((k, i, a) => a.indexOf(k) === i).map(k => P[k].name);

  body.innerHTML = h`
    <div class="map" id="map"><div class="gm" id="gm"></div><div class="msg" id="mapmsg">地図を読み込み中…</div></div>
    <div class="sheet" id="sheet"><div class="grab"><div class="hdl"></div><div class="pill"><button id="pmap">地図</button><button id="phalf">半々</button><button id="plist">リスト</button></div></div>
      <div class="ovtop">${cover ? thumb(cover, 'ph cover') : ''}<div><div class="nowrow"><b>${esc(trip.sub || trip.title)}</b>${status}</div>
      <div class="nowsub">${fmtRange(trip.start, trip.end)} · ${days.length}日間 · ${trip.nights}泊${trip.area ? ' · ' + esc(trip.area) : ''}${(M.photos || []).length ? ` · 写真${M.photos.length}枚` : ''}${trip.summary ? '<br>' + esc(trip.summary) : ''}</div></div></div>
      <div class="ovdays">
        ${days.map((d, i) => h`<button class="ovday" data-go="day/${i + 1}">
          <div class="ovhd"><span class="t">${fmtMD(d.date)} <small>${WDE[parseDate(d.date).getDay()]}</small></span><b>${esc(d.title || `DAY ${i + 1}`)}</b></div>
          ${d.lead ? h`<div class="s">${esc(d.lead)}</div>` : ''}
          <div class="ovrows">${(d.sched || []).map(r => h`<div class="ovrow"><span class="t">${esc(r.t || '')}</span><span>${esc(r.h)}${r.hard ? '<span class="hardtag">厳守</span>' : ''}</span></div>`)}</div>
        </button>`)}
      </div>
      ${(trip.stays || []).length ? h`<div class="card"><h3>宿<small>STAY</small></h3>${trip.stays.map(x => h`<button class="seg go" data-go="stay"><span class="t">${esc(x.nights || '')}</span><span><div class="n">${esc(x.name)}</div>${x.sub ? h`<div class="s">${esc(x.sub)}</div>` : ''}</span></button>`)}</div>` : ''}
      ${tickets.length ? h`<div class="card"><h3>移動<small>TRANSPORT</small></h3>${tickets.map(x => h`<div class="seg"><span class="t">${esc(fmtMD(x.date))} ${esc(x.dep || '')}</span><span><div class="n">${esc(x.from)} → ${esc(x.to)}</div><div class="s">${esc(x.name || '')}${x.arr ? ' · ' + esc(x.arr) + ' 着' : ''}</div></span></div>`)}</div>` : ''}
      ${budget.length ? h`<div class="card"><h3>費用<small>${st === 'done' ? 'ACTUAL' : 'ESTIMATE'}</small></h3><div class="seg"><span class="t">合計</span><span><div class="n">${yen(total)}</div>${trip.budgetNote ? h`<div class="s">${esc(trip.budgetNote)}</div>` : ''}</span></div></div>` : ''}
      ${M.notes ? h`<div class="card"><h3>ひとこと<small>NOTES</small></h3><p>${esc(M.notes)}</p></div>` : ''}
    </div>`;
  attachSheet(body, document.getElementById('sheet'), { key: 'overview', pill: { peek: document.getElementById('pmap'), half: document.getElementById('phalf'), list: document.getElementById('plist') } });
  body.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { location.hash = `#/trip/${trip.id}/${b.dataset.go}`; }));
  hydrate(body); bindViewer(body, M.photos || []);

  const gmEl = document.getElementById('gm'), msgEl = document.getElementById('mapmsg');
  state.maps.then(() => {
    const el = gmEl; if (!el || !el.isConnected) return;
    msgEl?.remove();
    const map = makeMap(el);
    const pts = [];
    const seen = new Set();
    days.forEach((d, i) => (d.sched || []).forEach(r => {
      const p = r.at && P[r.at]; if (!p || p.far || seen.has(r.at)) return; seen.add(r.at);
      // 概要の地図は引きで見るので、ラベルは宿と会場だけ（駅や地点は点のみ）
      addPin(map, { lat: p.lat, lng: p.lng, name: (p.kind === 'stay' || p.kind === 'venue') ? p.name : '', kind: p.kind || 'sta', side: p.side || 'b', onTap: () => { location.hash = `#/trip/${trip.id}/day/${i + 1}`; } });
      pts.push(p);
    }));
    attachLocate(map, document.getElementById('map'));
    fitAll(map, pts, { top: 60, bottom: 30, left: 50, right: 50 }, 14);
  }).catch(e => mapError(msgEl, e, state.retryMaps));
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

  // その日の写真を場所ごとに（行の右端に1枚だけ出す）
  const dayPhotos = (trip.memories?.photos || []).filter(p => p.day === day.date);
  const usedPhoto = new Set();
  const photoFor = r => { if (!r.at) return null; const p = dayPhotos.find(x => x.at === r.at && !usedPhoto.has(x.id)); if (p) usedPhoto.add(p.id); return p; };
  // 位置を持つ行に日内の通し番号（同じ場所は同じ番号）。遠方（far）は番号なし
  const numOf = {}; let n = 0;
  sched.forEach(r => { const p = r.at && P[r.at]; if (p && !p.far && numOf[r.at] == null) numOf[r.at] = ++n; });

  // 上段（いま／次の予定）。当日は30秒ごとに部分更新する
  const topHtml = (cur, curRow, nextRow) => {
    if (isToday) {
      const dm = nextRow ? minDiff(nextRow.t) : null;
      const nextTxt = nextRow && dm != null ? (dm >= 0 ? `${esc(nextRow.h)}まで ${fmtMin(dm)}` : `${esc(nextRow.h)} ${fmtMin(-dm)}前`) : '';
      return h`<div class="nowrow"><b><i></i>${esc(curRow ? curRow.h : '出発前')}</b><span>${nowHM()}${nextTxt ? ' · ' + nextTxt : ''}</span></div>
      <div class="nowsub">${esc(curRow?.d || day.lead || '')}</div>`;
    }
    const cd = st === 'planned' ? h`<span class="cd">${daysBetween(today(), trip.start)}日後</span>` : h`<span class="k">${fmtMDW(day.date)}</span>`;
    return h`<div class="nowrow"><b>${esc(day.title || `DAY ${idx}`)}</b>${cd}</div>
      <div class="nowsub">${esc(day.lead || '')}</div>`;
  };
  const top = h`<div id="daytop">${topHtml(cur, curRow, nextRow)}</div>`;

  body.innerHTML = h`
    <div class="map" id="map"><div class="gm" id="gm"></div><div class="msg" id="mapmsg">地図を読み込み中…</div></div>
    <div class="sheet" id="sheet">
      <div class="grab"><div class="hdl"></div><div class="pill"><button id="pmap">地図</button><button id="phalf">半々</button><button id="plist">リスト</button></div></div>
      ${top}
      <div class="evs">${sched.map((r, i) => evRow(r, i, P, cur, isToday, numOf, photoFor(r)))}</div>
    </div>`;

  // 地図とシートの割合: つまみのドラッグ / 地図・半々・リスト
  attachSheet(body, document.getElementById('sheet'), { pill: { peek: document.getElementById('pmap'), half: document.getElementById('phalf'), list: document.getElementById('plist') } });
  hydrate(body); bindViewer(body, trip.memories?.photos || []);

  let map = null, pins = {}, nowPin = null;
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

  const gmEl = document.getElementById('gm'), msgEl = document.getElementById('mapmsg');
  state.maps.then(() => {
    const el = gmEl; if (!el || !el.isConnected) return;
    msgEl?.remove();
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
      nowPin = addPin(map, { lat: p.lat, lng: p.lng, name: `いまの予定 ${nowHM()}`, kind: 'now', side: 'r' });
    }
    attachLocate(map, document.getElementById('map'));
    const focus = (day.focus || used).map(k => P[k]).filter(p => p && !p.far);
    fitAll(map, focus.length ? focus : used.map(k => P[k]), { top: 70, bottom: 30, left: 40, right: 60 }, 16);
    // 現在行を中央に
    const on = body.querySelector('.ev.on'); if (on) on.scrollIntoView({ block: 'center' });
  }).catch(e => mapError(msgEl, e, state.retryMaps));

  // 当日の部分更新: 30秒ごと＋アプリが前面に戻ったとき。日付が変わったら全体を作り直す
  const refresh = () => {
    if (!body.isConnected) return;
    if (day.date !== today()) { renderTrip(document.getElementById('app'), state, trip, 'day'); return; }
    const c = currentIndex(sched), cr = c >= 0 ? sched[c] : null, nr = sched.slice(c + 1).find(r => hm2min(r.t) != null);
    const t = document.getElementById('daytop'); if (t) t.innerHTML = topHtml(c, cr, nr);
    body.querySelectorAll('.ev').forEach(el => { const i = Number(el.dataset.i); el.classList.toggle('on', i === c); el.classList.toggle('past', i < c); });
    if (map && cr?.at && P[cr.at]) {
      const p = P[cr.at];
      if (nowPin) nowPin.update({ lat: p.lat, lng: p.lng, name: `いまの予定 ${nowHM()}` }); else nowPin = addPin(map, { lat: p.lat, lng: p.lng, name: `いまの予定 ${nowHM()}`, kind: 'now', side: 'r' });
    }
  };
  if (isToday) {
    const tick = setInterval(refresh, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    onDispose(() => { clearInterval(tick); document.removeEventListener('visibilitychange', onVis); });
  }
}

function evRow(r, i, P, cur, isToday, numOf = {}, photo = null) {
  const p = r.at ? P[r.at] : null;
  const tips = (r.tips || []).map(t => t.startsWith('注意｜') ? h`<li class="warn">${esc(t.slice(3))}</li>` : h`<li>${esc(t)}</li>`);
  const links = [];
  if (p && !p.far) links.push(h`<a class="btn" href="${gmapsDir(p, null, r.mode === 'walk' ? 'walking' : 'transit')}" target="_blank" rel="noopener">経路<small>MAPS</small></a>`);
  if (r.web) links.push(h`<a class="btn" href="${esc(r.web)}" target="_blank" rel="noopener">公式<small>WEB</small></a>`);
  const cls = ['ev', isToday && i === cur ? 'on' : '', isToday && i < cur ? 'past' : ''].join(' ');
  const num = r.at ? numOf[r.at] : null;
  const cat = catOf(r, p);
  // 場所を持つ行は番号（地図のピンと同じ）、移動だけの行は絵記号
  const mark = num != null ? h`<span class="ic num">${num}</span>` : h`<span class="ic g-${catGroup(cat)}">${icon(cat)}</span>`;
  const dur = (r.ticket && hm2min(r.ticket.dep) != null && hm2min(r.ticket.arr) != null) ? fmtMin(((hm2min(r.ticket.arr) - hm2min(r.ticket.dep)) + 1440) % 1440) : '';
  const ticket = r.ticket ? h`<div class="ticket g-${catGroup(cat)}"><span class="st"><b>${esc(r.ticket.from)}</b><small>${esc(r.ticket.dep || '')}</small></span><span class="arr">${icon(cat)}<small>${esc(r.ticket.name || '')}${dur ? ' · ' + dur : ''}</small></span><span class="st"><b>${esc(r.ticket.to)}</b><small>${esc(r.ticket.arr || '')}</small></span></div>` : '';
  return h`<div class="${cls}" data-i="${i}" data-at="${esc(r.at || '')}">
    <span class="t">${esc(r.t || '')}${r.t2 ? h`<small>${esc(r.t2)}</small>` : ''}</span>
    ${mark}
    <span class="body"><div class="n">${esc(r.h)}${r.hard ? '<span class="hardtag">厳守</span>' : ''}</div>${ticket}${r.d ? h`<div class="s">${esc(r.d)}</div>` : ''}</span>
    <span class="d">${photo ? thumb(photo, 'ph row') : ''}${r.r ? h`<i>${esc(r.r)}</i>` : ''}</span>
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
  attachSheet(body, document.getElementById('sheet'), { key: 'stay', initial: 'half' });
  const gmEl = document.getElementById('gm'), msgEl = document.getElementById('mapmsg');
  state.maps.then(() => {
    const el = gmEl; if (!el || !el.isConnected) return;
    msgEl?.remove();
    const map = makeMap(el);
    const pts = [];
    for (const s of stays) { const p = P[s.at]; if (!p) continue; addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: 'stay', side: p.side || 'b' }); pts.push(p); }
    for (const k of (trip.stayContext || [])) { const p = P[k]; if (p) { addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: 'sta', side: p.side || 'b', dim: true }); pts.push(p); } }
    // 最寄り駅から宿までの徒歩を道なりで
    const s0 = stays[0], ctx = (trip.stayContext || [])[0];
    if (s0 && P[s0.at] && ctx && P[ctx] && distKm(P[ctx], P[s0.at]) < 3) walkPath(P[ctx], P[s0.at]).then(path => drawWalk(map, path));
    attachLocate(map, document.getElementById('map'));
    fitAll(map, pts, { top: 40, bottom: 30, left: 50, right: 50 }, 16);
  }).catch(e => mapError(msgEl, e, state.retryMaps));
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
    <div class="card"><h3>やること<small>TODO${todo.length ? ` · 残り ${todo.filter((t, i) => !done.has(t.id || String(i))).length}` : ''}</small></h3>
      ${todo.length ? (() => {
        // 期限順（期限なしは最後）。完了は下にまとめて折りたたむ
        const items = todo.map((t, i) => ({ t, id: t.id || String(i) }));
        const open = items.filter(x => !done.has(x.id)).sort((a, b) => (a.t.due || '9999').localeCompare(b.t.due || '9999'));
        const closed = items.filter(x => done.has(x.id));
        const row = ({ t, id }) => {
          const late = t.due && !done.has(id) && t.due < t0, soon = t.due && !done.has(id) && !late && daysBetween(t0, t.due) <= 7;
          return h`<button class="todo${done.has(id) ? ' done' : ''}" data-id="${id}"><span class="box"></span><span><div class="n">${esc(t.t)}</div>${t.due ? h`<div class="due${soon ? ' soon' : ''}${late ? ' late' : ''}">${esc(fmtMDW(t.due))}${late ? ' · 期限切れ' : soon ? ` · あと${daysBetween(t0, t.due)}日` : ''}${t.dueNote ? ' · ' + esc(t.dueNote) : ''}</div>` : ''}</span></button>`;
        };
        return h`${open.map(row)}${open.length ? '' : '<div class="empty">残っているやることはありません。</div>'}${closed.length ? h`<details class="donebox"><summary>完了 ${closed.length} 件</summary>${closed.map(row)}</details>` : ''}`;
      })() : '<div class="empty">やることはありません。</div>'}
    </div>
    ${pack.length ? h`<div class="card"><h3>持ち物<small>PACKING</small></h3><div class="chips">${pack.map(p => h`<span>${esc(p)}</span>`)}</div></div>` : ''}
  </div>`;
  body.querySelectorAll('.todo').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.id; done.has(id) ? done.delete(id) : done.add(id);
    store.set(key, [...done]); b.classList.toggle('done', done.has(id));
    setTimeout(() => renderPrep(body, state, trip), 250); // 並びと折りたたみを更新
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
    ${(M.next || []).length ? h`<div class="card"><h3>次に活かす<small>NEXT TIME</small></h3><ul class="ul">${M.next.map(x => h`<li>${esc(x)}</li>`)}</ul></div>` : ''}
    ${budget.length ? h`<div class="card"><h3>費用<small>${st === 'done' ? 'ACTUAL' : 'ESTIMATE'}</small></h3>
      <table class="yen">${budget.map(b => h`<tr><td>${esc(b.item)}${b.note ? h`<small>${esc(b.note)}</small>` : ''}</td><td class="v">${b.yen != null ? yen(b.yen) : '—'}</td></tr>`)}
      <tr class="total"><td>合計${trip.budgetNote ? h`<small>${esc(trip.budgetNote)}</small>` : ''}</td><td class="v">${yen(total)}</td></tr></table></div>` : ''}
    ${(M.photos || []).length ? h`<div class="card"><h3>写真<small>PHOTOS · ${M.photos.length}</small></h3>${grid(M.photos, trip.id)}</div>` : (st === 'done' ? '<div class="card"><h3>写真<small>PHOTOS</small></h3><div class="empty">写真はまだ入っていません。旅の写真を送ってもらえれば、ここに並びます。</div></div>' : '')}
  </div>`;
  hydrate(body); bindViewer(body, M.photos || []);
}
