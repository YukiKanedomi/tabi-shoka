// private/ の旅データを合言葉で暗号化して data/bundle.enc.json に書き出す。
//   node tools/build-data.mjs
// private/config.json: { passphrase, gmapsKey, owner, home:{name,lat,lng} }
// private/trips/*.json: 旅1冊ごとのデータ（trip.id 必須）
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
  for (const k of ['id', 'no', 'title', 'start', 'end', 'nights', 'color']) if (t[k] == null) throw new Error(`${t.id || '?'}: ${k} がありません`);
  const P = t.places || {};
  for (const d of t.days || []) for (const r of d.sched || []) {
    if (r.at && !P[r.at]) throw new Error(`${t.id} ${d.date} ${r.t}: 場所キー ${r.at} が places にありません`);
    if (r.t && !/^\d{1,2}:\d{2}/.test(r.t)) throw new Error(`${t.id} ${d.date}: 時刻 "${r.t}" の書式`);
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
const payload = { config: { gmapsKey, home: cfg.home }, trips };
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const iter = 200000;
const km = await crypto.subtle.importKey('raw', enc.encode(cfg.passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))));
const b64 = u => Buffer.from(u).toString('base64');
const built = new Date().toISOString().slice(0, 10);
const out = { v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), ct: b64(ct), owner: cfg.owner || '', built };
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/bundle.enc.json'), JSON.stringify(out));
console.log(`bundle: ${trips.length} trips (${trips.map(t => t.id).join(', ')}), ${Math.round(ct.length / 1024)} KB, built ${built}`);
