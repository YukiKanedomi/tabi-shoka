// 設定ページ（#/settings、旧 #/palette）: 地図の色、合言葉の記憶、配色の候補
import { PALETTES, currentPaletteId, setPaletteId, applyPalette, mapStyleId, setMapStyleId } from './palettes.js';
import { esc, h, store } from './util.js';

export function renderSettings(app, state) {
  const cur = currentPaletteId();
  const ms = mapStyleId();
  app.innerHTML = h`
  <div class="hd">
    <div class="row"><a class="back" href="#/">← 書架</a><span class="k">Settings</span></div>
    <h1>設定</h1>
  </div>
  <div class="pane">
    <div class="card">
      <h3>地図の色<small>MAP</small></h3>
      <div class="pill" id="mapstyle" style="margin-top:10px"><button data-ms="google"${ms === 'google' ? ' class="on"' : ''}>標準（Google のまま）</button><button data-ms="soft"${ms === 'soft' ? ' class="on"' : ''}>淡い（配色に合わせる）</button></div>
      <div class="empty">夜間（端末のダークモード）は、どちらでも暗い地図になります。</div>
    </div>
    <div class="card">
      <h3>合言葉<small>LOCK</small></h3>
      <div class="empty">この端末に記憶した合言葉を消して閉じます。次に開くときに合言葉を聞かれます。</div>
      <div class="links"><button class="btn" id="lock">合言葉の記憶を消す</button></div>
    </div>
    <h3 class="sec">配色<small>PALETTE</small></h3>
    <div class="empty">「使う」を押すとすぐ全画面に反映されます。旅の識別色（背表紙）も配色ごとの色に置き換わります。</div>
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
  app.querySelectorAll('[data-ms]').forEach(b => b.addEventListener('click', () => {
    setMapStyleId(b.dataset.ms); app.querySelectorAll('[data-ms]').forEach(x => x.classList.toggle('on', x === b));
  }));
  document.getElementById('lock').addEventListener('click', () => { if (confirm('合言葉の記憶を消して閉じますか？')) { store.del('tabi_pass'); location.hash = '#/'; location.reload(); } });
}
export const renderPalette = renderSettings;
