// 合言葉で暗号化された旅データ（data/bundle.enc.json）と写真（data/img/*.enc）を端末側で復号する。
// 形式: bundle = {v, kdf:"PBKDF2-SHA256", iter, salt(b64), iv(b64), ct(b64)} / AES-GCM 256
//       写真 = iv(12 バイト) + 暗号文（同じ鍵）
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
let KEY = null; // 復号後にメモリに保持（写真の復号に使う）

export async function deriveKey(pass, salt, iter) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

export async function decryptBundle(bundle, pass) {
  const key = await deriveKey(pass, b64d(bundle.salt), bundle.iter || 200000);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(bundle.iv) }, key, b64d(bundle.ct));
  KEY = key;
  return JSON.parse(new TextDecoder().decode(pt));
}

// 暗号化された写真を取ってきて blob URL にする（同じ URL は使い回す）。
// サムネ（数KB）は持ち続け、全画面（数百KB）は直近 FULL_KEEP 枚だけ残して古いものから解放する
const urlCache = new Map();
const FULL_KEEP = 4;
const isFull = url => /-full\.enc$/.test(url);
export async function decryptImage(url) {
  if (urlCache.has(url)) { const p = urlCache.get(url); urlCache.delete(url); urlCache.set(url, p); return p; } // 使った順を更新
  if (!KEY) throw new Error('鍵がありません');
  const p = (async () => {
    const buf = new Uint8Array(await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, KEY, buf.slice(12));
    return URL.createObjectURL(new Blob([pt], { type: 'image/jpeg' }));
  })();
  urlCache.set(url, p);
  p.catch(() => urlCache.delete(url));
  if (isFull(url)) {
    const fulls = [...urlCache.keys()].filter(isFull);
    for (const k of fulls.slice(0, Math.max(0, fulls.length - FULL_KEEP))) { const q = urlCache.get(k); urlCache.delete(k); q.then(u => URL.revokeObjectURL(u)).catch(() => {}); }
  }
  return p;
}
