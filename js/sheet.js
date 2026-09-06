// 地図と下のシートの割合を変える: つまみのドラッグ ＋ 地図/半々/リスト の3段。状態は端末に記憶
import { store } from './util.js';

const PEEK = 96; // つまみ＋1行だけ見える高さ
const KEY = 'tabi_sheet';

export function attachSheet(stage, sheet, opts = {}) {
  const pill = opts.pill; // {map, half, list} ボタン要素（任意）
  let state = opts.initial || store.get(KEY, 'half');
  const H = () => stage.getBoundingClientRect().height;
  const target = s => s === 'peek' ? PEEK : s === 'list' ? H() : Math.round(H() * 0.5);

  function apply(s, animate = true) {
    state = s;
    sheet.style.transition = animate ? 'height .22s ease' : 'none';
    sheet.style.height = target(s) + 'px';
    stage.classList.toggle('sheet-list', s === 'list');
    stage.classList.toggle('sheet-peek', s === 'peek');
    if (pill) for (const k in pill) pill[k]?.classList.toggle('on', k === s);
    store.set(KEY, s);
    setTimeout(() => window.dispatchEvent(new Event('tabi:sheet')), animate ? 260 : 30);
  }
  apply(state, false);

  // ドラッグ
  const grab = sheet.querySelector('.grab') || sheet;
  let y0 = 0, h0 = 0, dragging = false, moved = false;
  grab.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a, .ev')) return;
    dragging = true; moved = false; y0 = e.clientY; h0 = sheet.getBoundingClientRect().height;
    sheet.style.transition = 'none'; grab.setPointerCapture?.(e.pointerId);
  });
  grab.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = e.clientY - y0; if (Math.abs(dy) > 4) moved = true;
    const h = Math.max(PEEK, Math.min(H(), h0 - dy));
    sheet.style.height = h + 'px';
  });
  const end = () => {
    if (!dragging) return; dragging = false;
    const h = sheet.getBoundingClientRect().height;
    if (!moved) { apply(state === 'half' ? 'list' : state === 'list' ? 'peek' : 'half'); return; } // タップで巡回
    const cands = ['peek', 'half', 'list'];
    apply(cands.reduce((a, b) => Math.abs(target(b) - h) < Math.abs(target(a) - h) ? b : a));
  };
  grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
  if (pill) for (const k in pill) pill[k]?.addEventListener('click', () => apply(k));
  window.addEventListener('resize', () => apply(state, false), { passive: true });
  return { apply, get state() { return state; } };
}
