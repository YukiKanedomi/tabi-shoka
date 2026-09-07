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

// 暗号化された写真を取ってきて blob URL にする（同じ URL は使い回す）
const urlCache = new Map();
export async function decryptImage(url) {
  if (urlCache.has(url)) return urlCache.get(url);
  if (!KEY) throw new Error('鍵がありません');
  const p = (async () => {
    const buf = new Uint8Array(await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, KEY, buf.slice(12));
    return URL.createObjectURL(new Blob([pt], { type: 'image/jpeg' }));
  })();
  urlCache.set(url, p);
  p.catch(() => urlCache.delete(url));
  return p;
}
