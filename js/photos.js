// 写真の表示: 暗号化された画像を復号して <img> に流し込む。グリッド、行のサムネ、全画面ビューア
import { decryptImage } from './crypto.js';
import { esc, h } from './util.js';

// data-enc 属性を持つ img を復号して表示。
//  サムネ: 画面に近づいたものから順に（IntersectionObserver）。サムネ同士は1枚ずつ
//  全画面（data-full を持たない=ビューアの img）: 順番待ちせず即時
let queue = Promise.resolve();
function load(img) {
  const url = img.dataset.enc; if (!url || img.dataset.loading) return;
  img.dataset.loading = '1';
  const run = () => decryptImage(url).then(u => { img.src = u; img.classList.add('ok'); }).catch(e => { img.classList.add('ng'); console.warn('photo:', url, e.message); });
  if (img.dataset.full) queue = queue.then(run); else run();
}
const io = ('IntersectionObserver' in window) ? new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } });
}, { rootMargin: '400px 0px' }) : null;
export function hydrate(root = document) {
  root.querySelectorAll('img[data-enc]:not(.ok)').forEach(img => { if (io && img.dataset.full) io.observe(img); else load(img); });
}

// サムネ（行の右端など）。写真オブジェクト {thumb, full, w, h, caption}
export function thumb(p, cls = 'ph') {
  return h`<img class="${cls}" data-enc="${esc(p.thumb)}" data-full="${esc(p.full)}" alt="${esc(p.caption || '')}" width="${p.w}" height="${p.h}">`;
}

// グリッド（記録画面）。2列、縦横比を保つ
export function grid(photos, tripId) {
  if (!photos?.length) return '';
  const md = d => d ? `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : '';
  return h`<div class="phgrid" data-trip="${tripId}">${photos.map((p, i) => h`<figure class="phcell" data-i="${i}">${thumb(p, 'ph')}${p.caption ? h`<figcaption>${esc(p.caption)}</figcaption>` : (p.day || p.taken) ? h`<figcaption class="k">${esc([md(p.day), p.taken].filter(Boolean).join(' · '))}</figcaption>` : ''}</figure>`)}</div>`;
}

// 全画面ビューア（左右にスワイプ／タップで閉じる）
let viewer = null;
export function openViewer(photos, idx = 0) {
  closeViewer();
  const v = document.createElement('div'); v.className = 'phview'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '写真');
  let i = idx;
  const render = () => {
    const p = photos[i];
    v.innerHTML = h`<div class="phstage"><img data-enc="${esc(p.full)}" alt="${esc(p.caption || '')}"></div>
      <div class="phbar"><span class="mono">${i + 1} / ${photos.length}</span><span class="cap">${esc(p.caption || '')}</span><button class="x" aria-label="閉じる">×</button></div>`;
    hydrate(v);
    v.querySelector('.x').addEventListener('click', () => closeViewer());
    v.querySelector('.x').focus({ preventScroll: true });
  };
  render();
  const onKey = e => { if (e.key === 'Escape') closeViewer(); else if (e.key === 'ArrowRight') { i = (i + 1) % photos.length; render(); } else if (e.key === 'ArrowLeft') { i = (i - 1 + photos.length) % photos.length; render(); } };
  document.addEventListener('keydown', onKey);
  v._onKey = onKey;
  let x0 = null;
  v.addEventListener('pointerdown', e => { x0 = e.clientX; });
  v.addEventListener('pointerup', e => {
    if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { i = (i + (dx < 0 ? 1 : -1) + photos.length) % photos.length; render(); }
    else if (e.target.closest('.phstage')) closeViewer();
  });
  document.body.appendChild(v); viewer = v;
  history.pushState({ viewer: true }, '');
  window.addEventListener('popstate', onPop);
}
function onPop() { closeViewer(true); }
// 閉じる: ボタンや Escape から閉じたときは、開くときに積んだ履歴も戻して「戻る」が二重にならないようにする
export function closeViewer(fromHistory = false) {
  if (!viewer) return;
  document.removeEventListener('keydown', viewer._onKey);
  window.removeEventListener('popstate', onPop);
  viewer.remove(); viewer = null;
  if (!fromHistory && history.state?.viewer) history.back();
}

// グリッドと行サムネのタップでビューアを開く
export function bindViewer(root, photos) {
  root.querySelectorAll('.phcell').forEach(c => {
    c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.addEventListener('click', () => openViewer(photos, Number(c.dataset.i)));
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } });
  });
  root.querySelectorAll('img.ph.row').forEach(img => img.addEventListener('click', e => { e.stopPropagation(); const i = photos.findIndex(p => p.full === img.dataset.full); openViewer(photos, Math.max(0, i)); }));
}
