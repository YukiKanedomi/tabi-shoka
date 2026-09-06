// カテゴリの絵記号（線画 SVG、16px 基準、stroke 1.5）。絵文字は使わない。
// cat: train / shinkansen / walk / bus / plane / stay / food / spot / venue / note / bath / shop
const S = (d, extra = '') => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;

export const ICONS = {
  train: S('<rect x="3.5" y="2" width="9" height="9.5" rx="2"/><path d="M3.5 8h9M6.5 13.5l-1.5 1.5M9.5 13.5l1.5 1.5"/><circle cx="6" cy="9.8" r=".6" fill="currentColor"/><circle cx="10" cy="9.8" r=".6" fill="currentColor"/>'),
  shinkansen: S('<path d="M2 11.5h9.5c1.7 0 2.5-1.2 2.5-2.5V8c0-1.5-3-4.5-6-4.5H2z"/><path d="M2 8h12M5 3.5v8"/>'),
  walk: S('<circle cx="9" cy="2.6" r="1.1"/><path d="M8.2 5l-2 3 2.2 1.6-.6 4.2M8.2 5l2.6 1.2 1.6 2.4M8.4 9.6l2.4 4.2M6.2 8l-2.4 1"/>'),
  bus: S('<rect x="3" y="2.5" width="10" height="9.5" rx="2"/><path d="M3 8.5h10M5 13.5v1M11 13.5v1"/><circle cx="5.7" cy="10.5" r=".6" fill="currentColor"/><circle cx="10.3" cy="10.5" r=".6" fill="currentColor"/>'),
  plane: S('<path d="M2.5 9.5l4.5-1 3.5 4.5 1.5-.5-1.5-5 3-2c.7-.5.6-1.5-.3-1.6L11.5 4 7 6l-4.5-.8-.8.8 3.5 2z"/>'),
  stay: S('<path d="M2 12.5V5.5M2 10h12v2.5M14 10V8.5a2 2 0 0 0-2-2H7v3.5"/><circle cx="4.5" cy="7.5" r="1.2"/>'),
  food: S('<path d="M4 2v5.5M2.5 2v3a1.5 1.5 0 0 0 3 0V2M4 7.5V14M11.5 2c-1.7 0-2.5 2.2-2.5 4.5 0 1.5.8 2 1.6 2V14M11.5 2v6.5"/>'),
  spot: S('<path d="M8 14.5s4.5-4.2 4.5-8A4.5 4.5 0 0 0 3.5 6.5c0 3.8 4.5 8 4.5 8z"/><circle cx="8" cy="6.5" r="1.6"/>'),
  venue: S('<path d="M2.5 13.5h11M4 13.5V7l4-3.5L12 7v6.5M6.5 13.5V10h3v3.5"/>'),
  note: S('<path d="M4 2.5h6l3 3v8H4z"/><path d="M10 2.5v3h3M6 8h4M6 10.5h4"/>'),
  bath: S('<path d="M2.5 9.5h11v1.5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3zM4 9.5V4a1.5 1.5 0 0 1 3 0"/><path d="M8.5 5.5v1M10.5 4.5v1.5M12.5 5.5v1"/>'),
  shop: S('<path d="M3 5.5h10l-.8 8H3.8z"/><path d="M5.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5"/>'),
  ticket: S('<path d="M2 5.5a1.5 1.5 0 0 0 0 3v3h12v-3a1.5 1.5 0 0 1 0-3v-3H2z"/><path d="M6 3v10" stroke-dasharray="1.5 1.5"/>')
};

// 行の内容から絵記号を推定（データに cat があればそれを優先）
export function catOf(r, place) {
  if (r.cat) return r.cat;
  if (r.ticket) return r.ticket.kind === 'plane' ? 'plane' : (r.ticket.name || '').includes('のぞみ') || (r.ticket.name || '').includes('新幹線') ? 'shinkansen' : 'train';
  if (r.mode === 'walk') return 'walk';
  if (r.mode === 'bus') return 'bus';
  if (r.mode === 'rail') return 'train';
  if (place?.kind === 'stay') return 'stay';
  if (place?.kind === 'venue') return 'venue';
  if (place?.kind === 'pt') return 'spot';
  return 'note';
}
// 画像アイコン（Codex 生成の12種、assets/icons/*.png 96px）。note のみ SVG 線画
export const IMG_CATS = new Set(['shinkansen', 'train', 'bus', 'walk', 'plane', 'stay', 'bath', 'food', 'spot', 'venue', 'shop', 'ticket']);
export function icon(cat) {
  if (IMG_CATS.has(cat)) return `<img class="ico" src="assets/icons/${cat}.png" alt="" width="24" height="24" loading="lazy">`;
  return ICONS[cat] || ICONS.note;
}
