// 旅の手帳（travel-itinerary の trip.js）を旅の書架の旅データに変換する下書きツール。
//   node tools/import-travel-itinerary.mjs <trip.js のパス> <出力 json> [--year 2026] [--id 2026-09-australia]
// 出力は private/drafts/ に置いて、目で確認・手直しした上で private/trips/ に移す（座標は tools/geocode.mjs で）。
import fs from 'node:fs';
import path from 'node:path';

const [src, out, ...rest] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node tools/import-travel-itinerary.mjs <trip.js> <out.json> [--year 2026] [--id id]'); process.exit(1); }
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const year = opt.year || String(new Date().getFullYear());

// trip.js を評価して TRIP / PICKS を取り出す
const code = fs.readFileSync(src, 'utf8');
const { TRIP, PICKS } = new Function(code + '\n;return { TRIP: typeof TRIP !== "undefined" ? TRIP : null, PICKS: typeof PICKS !== "undefined" ? PICKS : {} };')();
if (!TRIP) throw new Error('TRIP が見つかりません');

const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const toDate = md => { const m = /(\d{1,2})\/(\d{1,2})/.exec(md); return m ? `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; };
const keyOf = s => strip(s).toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'p';
const qOf = url => { try { const u = new URL(url); const q = u.searchParams.get('q') || u.searchParams.get('query'); return q ? decodeURIComponent(q).replace(/\+/g, ' ') : null; } catch { return null; } };

const places = {};
const placeFor = (name, mapUrl) => {
  const q = qOf(mapUrl); if (!q) return null;
  const k = keyOf(q);
  if (!places[k]) places[k] = { name: strip(name).split(/[—–・(（]/)[0].trim().slice(0, 20) || q, lat: 0, lng: 0, q, kind: 'pt', side: 'b' };
  return k;
};

const days = (TRIP.days || []).map((d, i) => ({
  date: toDate(d.date) || `${year}-01-0${i + 1}`,
  title: strip(d.title),
  lead: d.memo ? strip(d.memo) : '',
  sched: (d.sched || []).map(r => {
    const row = { t: strip(r.t), h: strip(r.h) };
    if (r.d) row.d = strip(r.d);
    const at = placeFor(r.h, r.map); if (at) row.at = at;
    if (r.hard) row.hard = true;
    if (r.web) row.web = r.web;
    const tips = [...(r.steps || []).map(s => '手順｜' + strip(s)), ...(r.tips || []).map(strip)];
    if (tips.length) row.tips = tips;
    return row;
  })
}));

const stays = (TRIP.hotels || []).map(hh => ({ name: strip(hh.name), sub: strip(hh.jp), addr: strip(hh.addr), tel: strip(hh.tel), nights: strip(hh.stay), note: strip(hh.note), official: hh.web, at: placeFor(hh.name, hh.map), access: (hh.ex || []).map(strip) }));
const transport = (TRIP.flights || []).map(f => {
  const m = /(\S+)\s+(\S+)\s+(\d{1,2}:\d{2})\s*→\s*(\S+)\s+(\S+)\s+(\d{1,2}:\d{2})/.exec(strip(f.route));
  return { name: f.id, from: m ? m[1] : strip(f.route), dep: m ? m[3] : '', to: m ? m[4] : '', arr: m ? m[6] : '', booked: true, note: strip(f.meta) };
});
for (const s of stays) if (s.at && places[s.at]) places[s.at].kind = 'stay';

const trip = {
  id: opt.id || `${year}-import`, title: strip(TRIP.title), sub: strip(TRIP.range), area: '', start: days[0]?.date, end: days[days.length - 1]?.date,
  nights: Math.max(0, days.length - 1), color: '#0284C7', abroad: true, summary: '', places, days, stays, transport,
  prep: { todo: [], packing: [] }, budget: [], memories: {}, _note: `travel-itinerary から自動変換（${new Date().toISOString().slice(0, 10)}）。座標は未解決（lat/lng が 0）。tools/geocode.mjs は日本国内向けなので、海外は手で入れるか country を指定`
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(trip, null, 2) + '\n');
console.log(`${out}: ${days.length} days, ${Object.keys(places).length} places, ${stays.length} stays, ${transport.length} flights`);
