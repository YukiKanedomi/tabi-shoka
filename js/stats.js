// まとめ（横断ビュー）: 通算の数字、年ごとの棚（12か月の帯・旅の一覧・費用）、都道府県の升目
import { esc, h, fmtRange, tripStatus, today, yen, daysBetween, parseDate } from './util.js';
import { thumb, hydrate } from './photos.js';

const PREFS = [
  ['北海道・東北', ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島']],
  ['関東', ['茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川']],
  ['中部', ['新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知']],
  ['近畿', ['三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山']],
  ['中国・四国', ['鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知']],
  ['九州・沖縄', ['福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄']]
];
const ALL = PREFS.flatMap(([, l]) => l);
// JIS の都道府県コード順（assets/japan.svg の data-code と対応）
const JIS = ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];
let svgCache = null;
const japanSvg = () => svgCache || (svgCache = fetch('assets/japan.svg').then(r => r.text()).catch(() => ''));

// 旅の都道府県: trip.prefs があればそれ、なければ area の文字列から拾う
export function prefsOf(t) {
  if (t.prefs) return t.prefs;
  const s = (t.area || '') + ' ' + (t.title || '');
  return ALL.filter(p => s.includes(p));
}

export function renderStats(app, state) {
  const trips = state.data.trips.slice().sort((a, b) => a.start.localeCompare(b.start));
  const t0 = today();
  const done = trips.filter(t => tripStatus(t, t0) === 'done');
  const years = [...new Set(trips.map(t => t.start.slice(0, 4)))].sort().reverse();
  const nights = t => t.nights || 0, days = t => daysBetween(t.start, t.end) + 1;
  const photos = t => (t.memories?.photos || []).length;
  const visited = new Set(done.flatMap(prefsOf));
  const abroad = new Set(done.filter(t => t.abroad).map(t => t.area || t.title));
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  // 移動距離: 行程の場所を順にたどった大圏距離（飛行機・新幹線も含む。同じ場所の連続は数えない）
  const R = 6371, rad = Math.PI / 180;
  const gc = (a, b) => { const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
  const km = t => { const P = t.places || {}; let d = 0, prev = null; (t.days || []).forEach(dd => (dd.sched || []).forEach(r => { const p = r.at && P[r.at]; if (!p || p === prev) return; if (prev) d += gc(prev, p); prev = p; })); return Math.round(d); };
  const tickets = t => (t.days || []).flatMap(d => (d.sched || []).filter(r => r.ticket).map(r => r.ticket));
  const nPlane = t => tickets(t).filter(k => k.kind === 'plane').length;
  const nShink = t => tickets(t).filter(k => /新幹線|のぞみ|ひかり|こだま|かがやき|はやぶさ|さくら|みずほ|つばめ/.test(k.name || '')).length;
  const spots = done.flatMap(t => Object.values(t.places || {}).filter(p => !p.far && p.name));
  const extreme = (f) => spots.length ? spots.reduce((a, b) => f(a, b) ? a : b) : null;
  const north = extreme((a, b) => a.lat >= b.lat), south = extreme((a, b) => a.lat <= b.lat), west = extreme((a, b) => a.lng <= b.lng);
  const total = t => (t.budget || []).reduce((a, b) => a + (b.yen || 0), 0);

  const yearBlock = y => {
    const ts = trips.filter(t => t.start.startsWith(y));
    const maxCost = Math.max(1, ...ts.map(total));
    return h`<section class="ybk">
      <div class="yhd"><b>${y}</b><span class="k">${ts.length} 旅 · ${sum(ts, nights)} 泊 · ${sum(ts, days)} 日${sum(ts, km) ? ` · ${sum(ts, km).toLocaleString('ja-JP')} km` : ''}</span></div>
      <div class="months">${Array.from({ length: 12 }, (_, i) => h`<span class="m">${i + 1}</span>`)}
        ${ts.map(t => {
          // その年の中だけ帯にする（年またぎは切る）。幅は最低でも文字が入る分
          const a = parseDate(t.start < y + '-01-01' ? y + '-01-01' : t.start), b = parseDate(t.end > y + '-12-31' ? y + '-12-31' : t.end);
          const x0 = (a.getMonth() + (a.getDate() - 1) / 31) / 12 * 100, x1 = (b.getMonth() + b.getDate() / 31) / 12 * 100;
          return h`<a class="blk" href="#/trip/${t.id}" style="left:${x0.toFixed(2)}%;width:${Math.max(6, x1 - x0).toFixed(2)}%;background:${t.color}" title="${esc(t.title)}"><span>${esc(t.title.slice(0, 2))}</span></a>`;
        })}
      </div>
      <div class="ylist">${ts.map(t => {
        const st = tripStatus(t, t0);
        return h`<a class="yt" href="#/trip/${t.id}"><span class="sw" style="background:${t.color}"></span>
          <span class="nm">${esc(t.title)}<small>${fmtRange(t.start, t.end)} · ${t.nights}泊${prefsOf(t).length ? ' · ' + prefsOf(t).join('・') : t.abroad ? ' · ' + esc(t.area || '') : ''}${photos(t) ? ' · 写真' + photos(t) : ''}</small></span>
          <span class="cost">${total(t) ? h`<i style="width:${Math.round(total(t) / maxCost * 100)}%;background:${t.color}"></i><b>${yen(total(t))}</b><small>${t.budgetActual ? '実績' : st === 'done' ? '概算' : '見込み'}</small>` : h`<small>${st === 'planned' ? '費用未定' : '費用未入力'}</small>`}</span></a>`;
      })}</div>
    </section>`;
  };

  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">Digest</span></div>
    <h1>旅のまとめ<span>${years.length > 1 ? years[years.length - 1] + '〜' + years[0] : years[0]}</span></h1>
  </div>
  <div class="pane stats">
    <div class="card"><h3>通算<small>SINCE ${years[years.length - 1]}</small></h3>
      <div class="big4">
        <div><b>${done.length}</b><span>旅（済）</span></div>
        <div><b>${sum(done, nights)}</b><span>泊</span></div>
        <div><b>${sum(done, days)}</b><span>日</span></div>
        <div><b>${visited.size}</b><span>都道府県</span></div>
        <div><b>${sum(done, photos)}</b><span>写真</span></div>
        <div><b>${sum(done, km).toLocaleString('ja-JP')}</b><span>km 移動</span></div>
      </div>
      <div class="facts">${[sum(done, nPlane) ? `飛行機 ${sum(done, nPlane)}便` : '', sum(done, nShink) ? `新幹線 ${sum(done, nShink)}本` : '', abroad.size ? `海外 ${abroad.size}` : '', north ? `最北 ${esc(north.name)}` : '', south ? `最南 ${esc(south.name)}` : '', west ? `最西 ${esc(west.name)}` : ''].filter(Boolean).join(' · ')}</div>
      ${trips.length > done.length ? h`<div class="empty">${trips.filter(t => tripStatus(t, t0) === 'ongoing').map(t => '旅行中: ' + esc(t.title) + '　').join('')}これから: ${trips.filter(t => tripStatus(t, t0) === 'planned').map(t => esc(t.title)).join('、')}</div>` : ''}
    </div>
    ${years.map(yearBlock)}
    <div class="card"><h3>訪れた都道府県<small>${visited.size} / 47</small></h3>
      <div class="jmap" id="jmap"></div>
      <div class="prefs">${[...visited].sort((a, b) => JIS.indexOf(a) - JIS.indexOf(b)).map(p => h`<span class="on">${p}</span>`)}</div>
      <div class="empty" style="margin-top:8px">済んだ旅の「エリア」から数えています。自宅の神奈川は数えていません</div>
    </div>
  </div>`;
  hydrate(app);
  // 日本地図: 行った県を旅の色で塗る（複数の旅なら最後に行った旅の色）
  const colorOf = {};
  done.forEach(t => prefsOf(t).forEach(p => { colorOf[p] = t.color; }));
  const box = document.getElementById('jmap');
  japanSvg().then(svg => {
    if (!svg || !box.isConnected) return;
    box.innerHTML = svg;
    const el = box.querySelector('svg'); el.removeAttribute('class'); el.setAttribute('aria-label', '訪れた都道府県の地図');
    box.querySelectorAll('[data-code]').forEach(g => {
      const name = JIS[Number(g.dataset.code) - 1];
      g.removeAttribute('fill'); g.removeAttribute('stroke'); g.removeAttribute('stroke-width');
      g.querySelectorAll('path,polygon').forEach(s => { s.removeAttribute('fill'); s.removeAttribute('stroke'); });
      if (colorOf[name]) { g.classList.add('on'); g.style.fill = colorOf[name]; }
    });
  });
}
