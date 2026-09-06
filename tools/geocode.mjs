// 場所の座標を地名から解決する（鍵不要）。
//   駅（kind:sta / kind なし）… OpenStreetMap Overpass で railway=station を名前で検索（現在座標の 5km 以内）
//   住所を持つ場所（place.addr）… 国土地理院 住所検索 API
//   それ以外 … Nominatim（現在座標の 3km 以内、バス停は除外）
//   node tools/geocode.mjs            … 差分を表示（書き換えない）
//   node tools/geocode.mjs --write    … 50m 以上ずれている地点を更新
//   place.fixed:true は触らない。更新した地点には src / resolved を付ける
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const dir = path.join(ROOT, 'private/trips');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { 'User-Agent': 'tabi-shoka/1.0 (private trip journal)' };
const distM = (a, b) => { const d = Math.PI / 180, x = (b.lng - a.lng) * d * Math.cos((a.lat + b.lat) / 2 * d), y = (b.lat - a.lat) * d; return Math.sqrt(x * x + y * y) * 6371000; };

async function overpassStation(name, p) {
  const n = name.replace(/駅$/, '');
  const q = `[out:json][timeout:25];(node["railway"="station"]["name"="${n}"](around:5000,${p.lat},${p.lng});node["railway"="station"]["name:ja"="${n}"](around:5000,${p.lat},${p.lng});node["public_transport"="station"]["name"="${n}"](around:5000,${p.lat},${p.lng}););out body;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error(`overpass ${r.status}`);
  const j = await r.json();
  const els = (j.elements || []).map(e => ({ lat: e.lat, lng: e.lon, name: `${e.tags?.name || ''}（${e.tags?.operator || e.tags?.network || ''}）`, src: 'osm-station' }));
  if (!els.length) return null;
  // 複数（JR と私鉄など）は現在座標に最も近いもの
  return els.sort((a, b) => distM(p, a) - distM(p, b))[0];
}
async function gsiAddress(addr) {
  const r = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(addr)}`, { headers: UA });
  if (!r.ok) throw new Error(`gsi ${r.status}`);
  const j = await r.json();
  if (!j.length) return null;
  const [lng, lat] = j[0].geometry.coordinates;
  return { lat, lng, name: j[0].properties?.title || addr, src: 'gsi-address' };
}
async function nominatim(q, p) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=jp&accept-language=ja&q=${encodeURIComponent(q)}`, { headers: UA });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const j = await r.json();
  const c = j.map(x => ({ lat: +x.lat, lng: +x.lon, name: x.display_name.slice(0, 60), type: x.type, cls: x.category || x.class, src: 'osm' }))
    .filter(x => distM(p, x) < 3000 && x.type !== 'bus_stop' && x.cls !== 'landuse' && x.cls !== 'highway');
  return c[0] || null;
}

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const fp = path.join(dir, f);
  const t = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const P = t.places || {};
  if (!Object.keys(P).length) continue;
  console.log(`\n== ${t.id}`);
  let changed = 0;
  for (const [k, p] of Object.entries(P)) {
    if (p.fixed) { console.log(`     ${k.padEnd(10)} fixed`); continue; }
    let hit = null, how = '';
    try {
      if (p.addr) { hit = await gsiAddress(p.addr); how = 'addr'; }
      else if (p.kind === 'sta' || !p.kind) { hit = await overpassStation(p.name, p); how = 'station'; if (!hit) { await sleep(1100); hit = await nominatim(p.q || p.name + '駅', p); how = 'nominatim'; } }
      else { hit = await nominatim(p.q || p.name, p); how = 'nominatim'; }
    } catch (e) { console.log(`  ?  ${k.padEnd(10)} ERROR ${e.message}`); await sleep(1100); continue; }
    await sleep(1100);
    if (!hit) { console.log(`  ?  ${k.padEnd(10)} 見つからず（${how}）`); continue; }
    const dm = Math.round(distM(p, hit));
    const tag = dm > 300 ? '!!' : dm > 50 ? ' !' : '  ';
    console.log(`  ${tag} ${k.padEnd(10)} ${String(dm).padStart(5)}m  [${how}] ${hit.lat.toFixed(5)},${hit.lng.toFixed(5)}  ${hit.name}`);
    if (WRITE && dm > 50) { p.lat = +hit.lat.toFixed(5); p.lng = +hit.lng.toFixed(5); p.src = hit.src; p.resolved = new Date().toISOString().slice(0, 10); changed++; }
  }
  if (WRITE && changed) { fs.writeFileSync(fp, JSON.stringify(t, null, 2) + '\n'); console.log(`  -> ${changed} 地点を更新して保存`); }
}
