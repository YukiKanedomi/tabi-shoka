// 合言葉で暗号化された旅データ（data/bundle.enc.json）を端末側で復号する。
// 形式: {v:1, kdf:"PBKDF2-SHA256", iter, salt(b64), iv(b64), ct(b64)} / AES-GCM 256
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function deriveKey(pass, salt, iter) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

export async function decryptBundle(bundle, pass) {
  const key = await deriveKey(pass, b64d(bundle.salt), bundle.iter || 200000);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(bundle.iv) }, key, b64d(bundle.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
