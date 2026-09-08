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
  const total = t => (t.budget || []).reduce((a, b) => a + (b.yen || 0), 0);

  const yearBlock = y => {
    const ts = trips.filter(t => t.start.startsWith(y));
    const maxCost = Math.max(1, ...ts.map(total));
    return h`<section class="ybk">
      <div class="yhd"><b>${y}</b><span class="k">${ts.length} 旅 · ${sum(ts, nights)} 泊 · ${sum(ts, days)} 日</span></div>
      <div class="months">${Array.from({ length: 12 }, (_, i) => h`<span class="m">${i + 1}</span>`)}
        ${ts.map(t => { const a = parseDate(t.start), b = parseDate(t.end); const x0 = (a.getMonth() + (a.getDate() - 1) / 31) / 12 * 100, x1 = (b.getMonth() + b.getDate() / 31) / 12 * 100; return h`<a class="blk" href="#/trip/${t.id}" style="left:${x0.toFixed(2)}%;width:${Math.max(1.6, x1 - x0).toFixed(2)}%;background:${t.color}" title="${esc(t.title)}"></a>`; })}
      </div>
      <div class="ylist">${ts.map(t => {
        const st = tripStatus(t, t0);
        return h`<a class="yt" href="#/trip/${t.id}"><span class="sw" style="background:${t.color}"></span>
          <span class="nm">${esc(t.title)}<small>${fmtRange(t.start, t.end)} · ${t.nights}泊${prefsOf(t).length ? ' · ' + prefsOf(t).join('・') : t.abroad ? ' · ' + esc(t.area || '') : ''}${photos(t) ? ' · 写真' + photos(t) : ''}</small></span>
          <span class="cost">${total(t) ? h`<i style="width:${Math.round(total(t) / maxCost * 100)}%;background:${t.color}"></i><b>${yen(total(t))}</b><small>${st === 'done' ? (t.budgetNote?.includes('概算') ? '概算' : '実績') : '見込み'}</small>` : h`<small>${st === 'planned' ? '費用未定' : '費用未入力'}</small>`}</span></a>`;
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
        <div><b>${abroad.size}</b><span>海外</span></div>
      </div>
      ${trips.length > done.length ? h`<div class="empty">${trips.filter(t => tripStatus(t, t0) === 'ongoing').map(t => '旅行中: ' + esc(t.title) + '　').join('')}これから: ${trips.filter(t => tripStatus(t, t0) === 'planned').map(t => esc(t.title)).join('、')}</div>` : ''}
    </div>
    ${years.map(yearBlock)}
    <div class="card"><h3>訪れた都道府県<small>${visited.size} / 47</small></h3>
      ${PREFS.map(([reg, list]) => h`<div class="reg"><span class="k">${reg}</span><div class="prefs">${list.map(p => h`<span class="${visited.has(p) ? 'on' : ''}">${p}</span>`)}</div></div>`)}
      <div class="empty" style="margin-top:8px">済んだ旅の「エリア」から数えています。旅データに prefs を書けば手で直せます。自宅の神奈川は数えていません</div>
    </div>
  </div>`;
  hydrate(app);
}
