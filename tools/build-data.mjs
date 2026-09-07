// private/ の旅データを合言葉で暗号化して data/bundle.enc.json に書き出す。写真も同じ鍵で暗号化して data/img/ に置く。
//   node tools/build-data.mjs
// private/config.json: { passphrase, gmapsKey | gmapsKeyFile, owner, home:{name,lat,lng} }
// private/trips/*.json: 旅1冊ごとのデータ（trip.id 必須）
// private/photos_out/<tripId>/: prep-photos.py の出力（<id>-full.jpg, <id>-thumb.jpg, index.json）
//   旅データの memories.photos[] = [{id, caption, day?, at?}] と突き合わせ、id が一致した写真だけを配信する
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'private/config.json'), 'utf8'));
const dir = path.join(ROOT, 'private/trips');
const trips = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

// 最低限の検証
for (const t of trips) {
  for (const k of ['id', 'title', 'start', 'end', 'nights', 'color']) if (t[k] == null) throw new Error(`${t.id || '?'}: ${k} がありません`);
  const P = t.places || {};
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
const imgRoot = path.join(ROOT, 'data/img');
fs.rmSync(imgRoot, { recursive: true, force: true });
let nPhotos = 0, bytesPhotos = 0;
for (const t of trips) {
  const M = t.memories || (t.memories = {});
  const want = M.photos || [];
  if (!want.length) continue;
  const odir = path.join(ROOT, 'private/photos_out', t.id);
  const idxPath = path.join(odir, 'index.json');
  if (!fs.existsSync(idxPath)) { console.warn(`  ! ${t.id}: 写真の下ごしらえがありません（python tools/prep-photos.py ${t.id}）`); M.photos = []; continue; }
  const index = Object.fromEntries(JSON.parse(fs.readFileSync(idxPath, 'utf8')).map(x => [x.id, x]));
  const out = [];
  for (const ph of want) {
    const meta = index[ph.id]; if (!meta) { console.warn(`  ! ${t.id}: 写真 ${ph.id} が photos_out にありません`); continue; }
    const rel = {};
    for (const tag of ['full', 'thumb']) {
      const src = path.join(odir, `${ph.id}-${tag}.jpg`);
      const { iv, ct } = await encryptBytes(fs.readFileSync(src));
      const dst = path.join(imgRoot, t.id); fs.mkdirSync(dst, { recursive: true });
      const file = `${ph.id}-${tag}.enc`;
      fs.writeFileSync(path.join(dst, file), Buffer.concat([Buffer.from(iv), Buffer.from(ct)]));
      rel[tag] = `data/img/${t.id}/${file}`; bytesPhotos += ct.length;
    }
    out.push({ id: ph.id, caption: ph.caption || '', day: ph.day || null, at: ph.at || null, w: meta.w, h: meta.h, full: rel.full, thumb: rel.thumb });
    nPhotos++;
  }
  M.photos = out;
  if (t.cover && !out.some(p => p.id === t.cover)) t.cover = null;
}

// ---- 本体 ----
const payload = { config: { gmapsKey, home: cfg.home }, trips };
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))));
const built = new Date().toISOString().slice(0, 10);
const out = { v: 2, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), ct: b64(ct), owner: cfg.owner || '', built };
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/bundle.enc.json'), JSON.stringify(out));
console.log(`bundle: ${trips.length} trips (${trips.map(t => t.id).join(', ')}), ${Math.round(ct.length / 1024)} KB, photos ${nPhotos} (${Math.round(bytesPhotos / 1024)} KB), built ${built}`);
