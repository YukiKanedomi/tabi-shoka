// 写真の表示: 暗号化された画像を復号して <img> に流し込む。グリッド、行のサムネ、全画面ビューア
import { decryptImage } from './crypto.js';
import { esc, h } from './util.js';

// data-enc 属性を持つ img を復号して表示。サムネは小さい（数KB）ので即時に、順に読み込む
let queue = Promise.resolve();
function load(img) {
  const url = img.dataset.enc; if (!url || img.dataset.loading) return;
  img.dataset.loading = '1';
  queue = queue.then(() => decryptImage(url).then(u => { img.src = u; img.classList.add('ok'); }).catch(e => { img.classList.add('ng'); console.warn('photo:', url, e.message); }));
}
export function hydrate(root = document) {
  root.querySelectorAll('img[data-enc]:not(.ok)').forEach(load);
}

// サムネ（行の右端など）。写真オブジェクト {thumb, full, w, h, caption}
export function thumb(p, cls = 'ph') {
  return h`<img class="${cls}" data-enc="${esc(p.thumb)}" data-full="${esc(p.full)}" alt="${esc(p.caption || '')}" width="${p.w}" height="${p.h}">`;
}

// グリッド（記録画面）。2列、縦横比を保つ
export function grid(photos, tripId) {
  if (!photos?.length) return '';
  return h`<div class="phgrid" data-trip="${tripId}">${photos.map((p, i) => h`<figure class="phcell" data-i="${i}">${thumb(p, 'ph')}${p.caption ? h`<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`)}</div>`;
}

// 全画面ビューア（左右にスワイプ／タップで閉じる）
let viewer = null;
export function openViewer(photos, idx = 0) {
  closeViewer();
  const v = document.createElement('div'); v.className = 'phview';
  let i = idx;
  const render = () => {
    const p = photos[i];
    v.innerHTML = h`<div class="phstage"><img data-enc="${esc(p.full)}" alt="${esc(p.caption || '')}"></div>
      <div class="phbar"><span class="mono">${i + 1} / ${photos.length}</span><span class="cap">${esc(p.caption || '')}</span><button class="x" aria-label="閉じる">×</button></div>`;
    hydrate(v);
    v.querySelector('.x').addEventListener('click', closeViewer);
  };
  render();
  let x0 = null;
  v.addEventListener('pointerdown', e => { x0 = e.clientX; });
  v.addEventListener('pointerup', e => {
    if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { i = (i + (dx < 0 ? 1 : -1) + photos.length) % photos.length; render(); }
    else if (e.target.closest('.phstage')) closeViewer();
  });
  document.body.appendChild(v); viewer = v;
  history.pushState({ viewer: true }, '');
  window.addEventListener('popstate', closeViewer, { once: true });
}
export function closeViewer() { if (viewer) { viewer.remove(); viewer = null; } }

// グリッドと行サムネのタップでビューアを開く
export function bindViewer(root, photos) {
  root.querySelectorAll('.phcell').forEach(c => c.addEventListener('click', () => openViewer(photos, Number(c.dataset.i))));
  root.querySelectorAll('img.ph.row').forEach(img => img.addEventListener('click', e => { e.stopPropagation(); const i = photos.findIndex(p => p.full === img.dataset.full); openViewer(photos, Math.max(0, i)); }));
}
