// 日付・時刻・文字列の小道具
export const pad = n => String(n).padStart(2, '0');
export const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const WDE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function today() { return ymd(new Date()); }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); }
export function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
export function fmtMD(s) { const d = parseDate(s); return `${d.getMonth() + 1}.${d.getDate()}`; }
export function fmtMDW(s) { const d = parseDate(s); return `${d.getMonth() + 1}.${d.getDate()} ${WDE[d.getDay()]}`; }
export function fmtRange(a, b) {
  const da = parseDate(a), db = parseDate(b);
  const sameM = da.getMonth() === db.getMonth();
  return `${da.getFullYear()}.${da.getMonth() + 1}.${da.getDate()} – ${sameM ? '' : (db.getMonth() + 1) + '.'}${db.getDate()}`;
}
export function nowHM() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function hm2min(t) { if (!t) return null; const m = /^(\d{1,2}):(\d{2})/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
export function minDiff(t) { const a = hm2min(nowHM()), b = hm2min(t); return (a == null || b == null) ? null : b - a; }
export function fmtMin(n) { if (n < 60) return `${n}分`; const h = Math.floor(n / 60), m = n % 60; return m ? `${h}時間${m}分` : `${h}時間`; }
export function yen(n) { return n.toLocaleString('ja-JP') + '円'; }
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join('') : vals[i] ?? '') : ''), '');

// 旅の状態: planned / ongoing / done
export function tripStatus(trip, d = today()) {
  if (d < trip.start) return 'planned';
  if (d > trip.end) return 'done';
  return 'ongoing';
}
// 旅の中の何日目か（1始まり）。旅行中でなければ null
export function dayIndexOf(trip, d = today()) {
  if (tripStatus(trip, d) !== 'ongoing') return null;
  return daysBetween(trip.start, d) + 1;
}
// Google マップの経路リンク
export function gmapsDir(to, from, mode = 'walking') {
  const q = p => `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1${from ? '&origin=' + q(from) : ''}&destination=${q(to)}&travelmode=${mode}`;
}
export function gmapsPlace(p) { return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`; }

// 端末の記憶（localStorage）
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
