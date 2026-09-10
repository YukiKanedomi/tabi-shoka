// private/ の旅データを合言葉で暗号化して data/bundle.enc.json に書き出す。写真も同じ鍵で暗号化して data/img/ に置く。
//   node tools/build-data.mjs
// private/config.json: { passphrase, gmapsKey | gmapsKeyFile, owner, home:{name,lat,lng} }
// private/trips/*.json: 旅1冊ごとのデータ（trip.id 必須）
// private/photos_out/<tripId>/: prep-photos.py の出力（<id>-full.jpg, <id>-thumb.jpg, index.json）
//   旅データの memories.photos[] = [{id, caption, day?, at?}] と突き合わせ、id が一致した写真だけを配信する
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'private/config.json'), 'utf8'));
const dir = path.join(ROOT, 'private/trips');
const trips = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

// 検証（壊れたデータを公開しない）
const ids = new Set();
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:'; } catch { return false; } };
for (const t of trips) {
  for (const k of ['id', 'title', 'start', 'end', 'nights', 'color']) if (t[k] == null) throw new Error(`${t.id || '?'}: ${k} がありません`);
  if (ids.has(t.id)) throw new Error(`${t.id}: id が重複しています`); ids.add(t.id);
  if (!isDate(t.start) || !isDate(t.end) || t.start > t.end) throw new Error(`${t.id}: start/end の日付（YYYY-MM-DD、start ≤ end）`);
  if (!/^#[0-9A-Fa-f]{6}$/.test(t.color)) throw new Error(`${t.id}: color は #RRGGBB`);
  const P = t.places || {};
  for (const [k, p] of Object.entries(P)) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) throw new Error(`${t.id}: 場所 ${k} の lat/lng`);
    if (!p.name) throw new Error(`${t.id}: 場所 ${k} に name がありません`);
  }
  const dates = new Set();
  for (const d of t.days || []) {
    if (!isDate(d.date) || d.date < t.start || d.date > t.end) throw new Error(`${t.id}: 日 ${d.date} が旅の期間の外です`);
    if (dates.has(d.date)) throw new Error(`${t.id}: 日 ${d.date} が重複しています`); dates.add(d.date);
    for (const r of d.sched || []) if (r.web && !isUrl(r.web)) throw new Error(`${t.id} ${d.date}: web の URL "${r.web}"`);
  }
  for (const s of t.stays || []) for (const u of [s.web, s.official]) if (u && !isUrl(u)) throw new Error(`${t.id}: 宿 ${s.name} の URL "${u}"`);
  if (t.link?.url && !isUrl(t.link.url)) throw new Error(`${t.id}: link.url "${t.link.url}"`);
  const phIds = new Set();
  for (const ph of (Array.isArray(t.memories?.photos) ? t.memories.photos : [])) { if (phIds.has(ph.id)) throw new Error(`${t.id}: 写真 ${ph.id} が重複しています`); phIds.add(ph.id); }
  for (const d of t.days || []) for (const r of d.sched || []) {
    if (r.at && !P[r.at]) throw new Error(`${t.id} ${d.date} ${r.t}: 場所キー ${r.at} が places にありません`);
    // 時刻は HH:MM が基本。過去の旅など大まかなメモでは「朝」「夜」などの語も許す（当日モードの時刻計算からは外れる）
    if (r.t && !/^\d{1,2}:\d{2}/.test(r.t) && r.t.length > 4) throw new Error(`${t.id} ${d.date}: 時刻 "${r.t}" の書式（HH:MM か短い語）`);
  }
  for (const k of [...(t.route || []), ...(t.shelfPins || []), ...(t.stayContext || [])]) if (!P[k]) throw new Error(`${t.id}: 場所キー ${k} が places にありません`);
  for (const s of t.stays || []) if (s.at && !P[s.at]) throw new Error(`${t.id}: 宿の場所キー ${s.at}`);
}

// Google Maps キー: config.gmapsKey か、gmapsKeyFile（window.GMAPS_KEY='...' 形式の js）から読む
let gmapsKey = cfg.gmapsKey || '';
if (!gmapsKey && cfg.gmapsKeyFile) {
  const m = /GMAPS_KEY\s*=\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(cfg.gmapsKeyFile, 'utf8'));
  if (!m) throw new Error('gmapsKeyFile からキーを読めません');
  gmapsKey = m[1];
}
if (!gmapsKey) throw new Error('Google Maps キーがありません（config.gmapsKey か gmapsKeyFile）');

// ---- 鍵 ----
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iter = 200000;
const km = await crypto.subtle.importKey('raw', enc.encode(cfg.passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const b64 = u => Buffer.from(u).toString('base64');
async function encryptBytes(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv, ct };
}

// ---- 写真: private/photos_out/<tripId>/ → data/img/<tripId>/<id>-{full,thumb}.enc（iv 12 バイト + 暗号文） ----
// 先に data/img.next へ全部作り、最後に入れ替える（途中で失敗しても配信中の写真を壊さない）
const imgFinal = path.join(ROOT, 'data/img'), imgRoot = path.join(ROOT, 'data/img.next');
fs.rmSync(imgRoot, { recursive: true, force: true });
let nPhotos = 0, bytesPhotos = 0;
const distM = (a, b) => { const d = Math.PI / 180, x = (b.lng - a.lng) * d * Math.cos((a.lat + b.lat) / 2 * d), y = (b.lat - a.lat) * d; return Math.sqrt(x * x + y * y) * 6371000; };
// 写真がどの日・どの行のものかを決める。位置があれば一番近い場所（1.5km 以内）、なければ撮影時刻以前の最後の行
function placePhoto(t, meta) {
  const P = t.places || {};
  const taken = meta.taken || '';
  const date = taken.slice(0, 10);
  const day = (t.days || []).find(d => d.date === date) || null;
  const out = { day: day ? day.date : (date >= t.start && date <= t.end ? date : null), at: null };
  if (meta.lat != null && meta.lng != null) {
    let best = null, bd = 1500;
    for (const [k, p] of Object.entries(P)) { if (p.far) continue; const dd = distM(meta, p); if (dd < bd) { bd = dd; best = k; } }
    if (best) out.at = best;
  }
  if (!out.at && day && taken.length >= 16) {
    const hm = taken.slice(11, 16);
    let last = null;
    for (const r of day.sched || []) { const m = /^(\d{1,2}):(\d{2})/.exec(r.t || ''); if (m && `${m[1].padStart(2, '0')}:${m[2]}` <= hm && r.at && P[r.at] && !P[r.at].far) last = r.at; }
    out.at = last;
  }
  return out;
}
for (const t of trips) {
  const M = t.memories || (t.memories = {});
  const odir = path.join(ROOT, 'private/photos_out', t.id);
  const idxPath = path.join(odir, 'index.json');
  const hasIdx = fs.existsSync(idxPath);
  // memories.photos が無ければ photos_out の全部（撮影順）。あればその並びと説明を使い、足りない day/at は自動で補う
  const list = hasIdx ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : [];
  const want = Array.isArray(M.photos) ? M.photos : list.map(x => ({ id: x.id }));
  if (!want.length) { M.photos = []; continue; }
  if (!hasIdx) { console.warn(`  ! ${t.id}: 写真の下ごしらえがありません（python tools/prep-photos.py ${t.id}）`); M.photos = []; continue; }
  const index = Object.fromEntries(list.map(x => [x.id, x]));
  const out = [];
  for (const ph of want) {
    const meta = index[ph.id]; if (!meta) { console.warn(`  ! ${t.id}: 写真 ${ph.id} が photos_out にありません`); continue; }
    const auto = placePhoto(t, meta);
    if (!ph.day && auto.day) ph.day = auto.day;
    if (!ph.at && auto.at) ph.at = auto.at;
    const rel = {};
    for (const tag of ['full', 'thumb']) {
      const src = path.join(odir, `${ph.id}-${tag}.jpg`);
      const { iv, ct } = await encryptBytes(fs.readFileSync(src));
      const dst = path.join(imgRoot, t.id); fs.mkdirSync(dst, { recursive: true });
      // ビルドごとに鍵が変わるので、暗号文のハッシュを名前に入れて古いキャッシュと混ざらないようにする
      const file = `${ph.id}-${tag}-${createHash('sha256').update(ct).digest('hex').slice(0, 8)}.enc`;
      fs.writeFileSync(path.join(dst, file), Buffer.concat([Buffer.from(iv), Buffer.from(ct)]));
      rel[tag] = `data/img/${t.id}/${file}`; bytesPhotos += ct.length;
    }
    out.push({ id: ph.id, caption: ph.caption || '', day: ph.day || null, at: ph.at || null, taken: meta.taken ? meta.taken.slice(11, 16) : null, w: meta.w, h: meta.h, full: rel.full, thumb: rel.thumb });
    nPhotos++;
  }
  M.photos = out;
  if (t.cover && !out.some(p => p.id === t.cover)) t.cover = null;
  if (!t.cover && out.length) t.cover = out[0].id;
  console.log(`  ${t.id}: 写真 ${out.length} 枚（日が付いたもの ${out.filter(p => p.day).length}、場所が付いたもの ${out.filter(p => p.at).length}）`);
}

// ---- 本体 ----
const payload = { config: { gmapsKey, home: cfg.home }, trips };
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))));
const built = new Date().toISOString().slice(0, 10);
const out = { v: 2, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), ct: b64(ct), owner: cfg.owner || '', built };
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.rmSync(imgFinal, { recursive: true, force: true });
if (fs.existsSync(imgRoot)) fs.renameSync(imgRoot, imgFinal);
fs.writeFileSync(path.join(ROOT, 'data/bundle.enc.json'), JSON.stringify(out));
console.log(`bundle: ${trips.length} trips (${trips.map(t => t.id).join(', ')}), ${Math.round(ct.length / 1024)} KB, photos ${nPhotos} (${Math.round(bytesPhotos / 1024)} KB), built ${built}`);
