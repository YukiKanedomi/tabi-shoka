// 手帳（旅1冊）— DAY / 宿 / 準備 / 記録
import { makeMap, addPin, drawWalk, walkPath, fitAll } from './maps.js';
import { esc, h, fmtRange, fmtMDW, tripStatus, dayIndexOf, daysBetween, today, nowHM, hm2min, minDiff, fmtMin, yen, gmapsDir, gmapsPlace, store } from './util.js';

let tick = null;

export function renderTrip(app, state, trip, sub, arg) {
  clearInterval(tick);
  const days = trip.days || [];
  let dayIdx = null;
  if (sub === 'day') { dayIdx = arg ? Number(arg) : (dayIndexOf(trip) || 1); if (!(dayIdx >= 1 && dayIdx <= days.length)) dayIdx = 1; }
  const tab = (key, label, on, extra = '') => h`<button class="${extra}${on ? ' on' : ''}" data-go="${key}">${label}</button>`;
  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">No.${String(trip.no).padStart(2, '0')}${trip.sub ? ' · ' + esc(trip.sub) : ''}</span></div>
    <h1>${esc(trip.title)}<span>${fmtRange(trip.start, trip.end)}</span></h1>
    <div class="tabs">
      ${days.map((d, i) => tab(`day/${i + 1}`, `DAY ${i + 1}`, sub === 'day' && dayIdx === i + 1, 'day'))}
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

  let top;
  if (isToday) {
    const dm = nextRow ? minDiff(nextRow.t) : null;
    top = h`<div class="nowrow"><b><i></i>${esc(curRow ? curRow.h : '出発前')}</b><span>${nowHM()}${nextRow && dm != null && dm >= 0 ? ` · ${esc(nextRow.h)}まで ${fmtMin(dm)}` : ''}</span></div>
      <div class="nowsub">${esc(curRow?.d || day.lead || '')}</div>`;
  } else {
    const cd = st === 'planned' ? h`<span class="countdown"><b>${daysBetween(today(), trip.start)}</b>日後</span>` : h`<span class="k">${fmtMDW(day.date)}</span>`;
    top = h`<div class="nowrow"><b>${esc(day.title || `DAY ${idx}`)}</b>${cd}</div>
      <div class="nowsub">${esc(day.lead || '')}${st === 'planned' ? ` — ${fmtMDW(day.date)}` : ''}</div>`;
  }

  body.innerHTML = h`
    <div class="map" id="map"><div class="gm" id="gm"></div><div class="msg" id="mapmsg">地図を読み込み中…</div>
      <div class="over"><div class="pill"><button class="on" id="vmap">地図</button><button id="vlist">リスト</button></div></div>
    </div>
    <div class="sheet" id="sheet">
      <div class="hdl"></div>
      ${top}
      <div class="evs">${sched.map((r, i) => evRow(r, i, P, cur, isToday))}</div>
    </div>`;

  // 地図 / リスト切替（リスト＝シートを全面に）
  const sheet = document.getElementById('sheet');
  document.getElementById('vlist').addEventListener('click', () => { sheet.classList.add('tall'); document.getElementById('map').style.display = 'none'; toggle('vlist'); });
  document.getElementById('vmap').addEventListener('click', () => { sheet.classList.remove('tall'); document.getElementById('map').style.display = ''; toggle('vmap'); });
  const toggle = id => body.querySelectorAll('.pill button').forEach(b => b.classList.toggle('on', b.id === id));

  let map = null, pins = {};
  body.querySelectorAll('.ev').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    el.classList.toggle('open');
    const p = P[sched[Number(el.dataset.i)].at];
    if (map && p && !p.far) { map.panTo(p); if (map.getZoom() < 15) map.setZoom(15); }
  }));

  state.maps.then(() => {
    const el = document.getElementById('gm'); if (!el || !el.isConnected) return;
    document.getElementById('mapmsg')?.remove();
    map = makeMap(el);
    const used = [], seen = new Set();
    sched.forEach(r => { if (r.at && P[r.at] && !seen.has(r.at)) { seen.add(r.at); used.push(r.at); } });
    for (const k of used) {
      const p = P[k];
      pins[k] = addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: p.kind || 'sta', side: p.side || 'b', dim: !!p.far });
    }
    // 徒歩区間は道なりの点線（前の行の場所 → この行の場所）
    let prevAt = null;
    sched.forEach(r => {
      if (r.at && P[r.at]) {
        if (r.mode === 'walk' && prevAt && prevAt !== r.at) walkPath(P[prevAt], P[r.at]).then(path => drawWalk(map, path));
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

function evRow(r, i, P, cur, isToday) {
  const p = r.at ? P[r.at] : null;
  const tips = (r.tips || []).map(t => t.startsWith('注意｜') ? h`<li class="warn">${esc(t.slice(3))}</li>` : h`<li>${esc(t)}</li>`);
  const links = [];
  if (p && !p.far) links.push(h`<a class="btn" href="${gmapsDir(p, null, r.mode === 'walk' ? 'walking' : 'transit')}" target="_blank" rel="noopener">経路<small>MAPS</small></a>`);
  if (r.web) links.push(h`<a class="btn" href="${esc(r.web)}" target="_blank" rel="noopener">公式<small>WEB</small></a>`);
  const cls = ['ev', isToday && i === cur ? 'on' : '', isToday && i < cur ? 'past' : ''].join(' ');
  return h`<div class="${cls}" data-i="${i}">
    <span class="t">${esc(r.t || '')}${r.t2 ? h`<small>${esc(r.t2)}</small>` : ''}</span>
    <span><div class="n">${esc(r.h)}${r.hard ? '<span class="hardtag">厳守</span>' : ''}</div>${r.d ? h`<div class="s">${esc(r.d)}</div>` : ''}</span>
    <span class="d">${esc(r.r || '')}</span>
    ${tips.length || links.length ? h`<div class="x">${tips.length ? h`<ul>${tips}</ul>` : ''}${links.length ? h`<div class="links">${links}</div>` : ''}</div>` : ''}
  </div>`;
}

/* ---------------- 宿 ---------------- */
function renderStay(body, state, trip) {
  const P = trip.places || {};
  const stays = trip.stays || [];
  body.innerHTML = h`
    <div class="map" id="map"><div class="gm" id="gm"></div><div class="msg" id="mapmsg">地図を読み込み中…</div></div>
    <div class="sheet" id="sheet"><div class="hdl"></div>
      ${stays.length ? stays.map(s => h`<div class="card">
        <h3>${esc(s.name)}<small>${esc(s.nights || '')}</small></h3>
        <div class="meta">${esc(s.addr || '')}${s.tel ? '<br>TEL ' + esc(s.tel) : ''}</div>
        <dl class="kv">
          <dt>IN / OUT</dt><dd>${esc(s.checkin || '—')} / ${esc(s.checkout || '—')}${s.arrive ? `（到着予定 ${esc(s.arrive)}）` : ''}</dd>
          ${s.plan ? h`<dt>プラン</dt><dd>${esc(s.plan)}</dd>` : ''}
          ${s.price ? h`<dt>料金</dt><dd>${esc(s.price)}</dd>` : ''}
          ${s.via ? h`<dt>予約</dt><dd>${esc(s.via)}</dd>` : ''}
        </dl>
        ${s.note ? h`<p>${esc(s.note)}</p>` : ''}
        <div class="links">${P[s.at] ? h`<a class="btn" href="${gmapsDir(P[s.at])}" target="_blank" rel="noopener">経路<small>MAPS</small></a>` : ''}${s.web ? h`<a class="btn" href="${esc(s.web)}" target="_blank" rel="noopener">公式<small>WEB</small></a>` : ''}</div>
      </div>`) : '<div class="empty">宿の情報はまだありません。</div>'}
    </div>`;
  state.maps.then(() => {
    const el = document.getElementById('gm'); if (!el || !el.isConnected) return;
    document.getElementById('mapmsg')?.remove();
    const map = makeMap(el);
    const pts = [];
    for (const s of stays) { const p = P[s.at]; if (!p) continue; addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: 'stay', side: p.side || 'b' }); pts.push(p); }
    for (const k of (trip.stayContext || [])) { const p = P[k]; if (p) { addPin(map, { lat: p.lat, lng: p.lng, name: p.name, kind: 'sta', side: p.side || 'b', dim: true }); pts.push(p); } }
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
