// 配色ページ（#/palette）: 候補を見本つきで並べ、「使う」で即座に切り替え。実データの画面で比べるための仕組み
import { PALETTES, currentPaletteId, setPaletteId, applyPalette } from './palettes.js';
import { esc, h } from './util.js';

export function renderPalette(app, state) {
  const cur = currentPaletteId();
  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">Palette</span></div>
    <h1>配色<span>候補から選ぶ</span></h1>
  </div>
  <div class="pane">
    <div class="empty">「使う」を押すとすぐ全画面に反映されます。書架や行程を見て回って、しっくりくるものを残してください。旅の識別色（背表紙）も配色ごとの4色に置き換わります。</div>
    ${PALETTES.map(p => h`<div class="card pal${p.id === cur ? ' cur' : ''}">
      <div class="swatches">
        <span style="background:${p.vars.bg}" title="地"></span><span style="background:${p.vars.paper}" title="紙"></span><span style="background:${p.vars.ink}" title="墨"></span><span style="background:${p.vars.now}" title="いま"></span>
        ${(p.trips || ['#3C5A72', '#55704F', '#A25A33', '#6D6675']).map(c => h`<span class="tr" style="background:${c}"></span>`)}
        <span style="background:${p.vars['c-transit']}" class="sm"></span><span style="background:${p.vars['c-stay']}" class="sm"></span><span style="background:${p.vars['c-food']}" class="sm"></span><span style="background:${p.vars['c-spot']}" class="sm"></span>
      </div>
      <h3>${esc(p.name)}${p.id === cur ? '<span class="chip">使用中</span>' : ''}</h3>
      <div class="meta">${esc(p.source)}</div>
      <p>${esc(p.note)}</p>
      <div class="sample" style="background:${p.vars.paper};color:${p.vars.ink};border-color:${p.vars.line2}">
        <div class="srow"><span class="st" style="color:${p.vars.ink2}">11:37</span><span class="sic" style="background:${p.vars['c-transit']}22"></span><span><b>新横浜 発 のぞみ373号</b><small style="color:${p.vars.ink2}">新大阪行 · 指定席</small></span></div>
        <div class="srow on" style="background:${p.vars.now}12;box-shadow:inset 3px 0 0 ${p.vars.now}"><span class="st">14:45</span><span class="snum" style="border-color:${(p.trips || ['#3C5A72'])[0]};color:${(p.trips || ['#3C5A72'])[0]}">3</span><span><b>朱雀門ひろば</b><small style="color:${p.vars.ink2}">散楽フェスタの屋台で軽食</small></span><span class="sd" style="color:${p.vars.ink3}">徒歩 15分</span></div>
        <div class="srow"><span class="st" style="color:${p.vars.ink2}">15:30</span><span class="sic" style="background:${p.vars['c-venue']}22"></span><span><b>開場</b><small style="color:${p.vars.ink2}">ブロック別 · 整理番号順に入場</small></span></div>
      </div>
      <div class="links"><button class="btn${p.id === cur ? '' : ' fill'}" data-use="${p.id}">${p.id === cur ? '使用中' : 'この配色を使う'}</button></div>
    </div>`)}
  </div>`;
  app.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => {
    setPaletteId(b.dataset.use); applyPalette(state.data, b.dataset.use); location.hash = '#/';
  }));
}
