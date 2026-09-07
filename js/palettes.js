// 配色の候補集。アプリ内の「配色」ページで切り替えて、実データの画面で比べる（localStorage tabi_palette）。
// 各配色: 地色系（bg/paper/paper2）、墨（ink/ink2/ink3）、罫線、地図の描き込み（mark）、朱＝いま（now）、会場（venue）、
// カテゴリ色（transit/walk/stay/food/spot/venue）、旅の識別色4色（trips）。出典は各 source。
export const PALETTES = [
  {
    id: 'sumi', name: '墨と紙（現行）', source: 'デザイン批評2系統から起こした自前の配色（2026-09-06）', note: '純黒を使わず緑寄りの墨。落ち着くが渋い',
    vars: { bg: '#EEF0EA', paper: '#FBFBF8', paper2: '#F2F4EC', ink: '#23261F', ink2: '#55594E', ink3: '#6F7368', line: '#E3E6DC', line2: '#D2D6C9', line3: '#BCC1B2', mark: '#414A3D', now: '#C0442F', venue: '#A25A33',
      'c-transit': '#3C5A72', 'c-walk': '#6D6675', 'c-stay': '#55704F', 'c-food': '#A25A33', 'c-spot': '#B8862F', 'c-venue': '#C0442F' },
    trips: null
  },
  {
    id: 'hues8', name: 'ティールと珊瑚', source: 'Happy Hues palette 8（happyhues.co）', note: '生成りの地にティール #078080 と珊瑚 #f45d48。温かく、彩度は控えめ',
    vars: { bg: '#F3EFEA', paper: '#FFFFFE', paper2: '#F8F5F2', ink: '#232323', ink2: '#4A4A4A', ink3: '#7A7A7A', line: '#ECE7E1', line2: '#DDD6CE', line3: '#C9C1B7', mark: '#078080', now: '#F45D48', venue: '#F45D48',
      'c-transit': '#078080', 'c-walk': '#8A8A8A', 'c-stay': '#2E9C8C', 'c-food': '#F45D48', 'c-spot': '#E0A526', 'c-venue': '#F45D48' },
    trips: ['#078080', '#F45D48', '#3E7CB1', '#8A6FBF']
  },
  {
    id: 'nippon', name: '日本の伝統色', source: 'NIPPON COLORS（nipponcolors.com）に掲載の伝統色', note: '生成り #FBFAF5 の地に 群青・若竹・柿・藤。朱 #EB6101 で「いま」',
    vars: { bg: '#F4F1E8', paper: '#FBFAF5', paper2: '#F3EFE3', ink: '#1C1C1C', ink2: '#4B4B4B', ink3: '#7D7D7D', line: '#EAE5D9', line2: '#DAD3C3', line3: '#C4BCA8', mark: '#17184B', now: '#EB6101', venue: '#ED6D3D',
      'c-transit': '#4C6CB3', 'c-walk': '#8B81C3', 'c-stay': '#006E54', 'c-food': '#ED6D3D', 'c-spot': '#F8B500', 'c-venue': '#EB6101' },
    trips: ['#4C6CB3', '#68BE8D', '#ED6D3D', '#8B81C3']
  },
  {
    id: 'opencolor', name: 'Open Color', source: 'Open Color（yeun.github.io/open-color）の 6 段目', note: 'UI 用に調整された明るい原色系。青・ティール・橙・葡萄',
    vars: { bg: '#F1F3F5', paper: '#FFFFFF', paper2: '#F8F9FA', ink: '#212529', ink2: '#495057', ink3: '#868E96', line: '#E9ECEF', line2: '#DEE2E6', line3: '#CED4DA', mark: '#343A40', now: '#FA5252', venue: '#FD7E14',
      'c-transit': '#228BE6', 'c-walk': '#868E96', 'c-stay': '#12B886', 'c-food': '#FD7E14', 'c-spot': '#FAB005', 'c-venue': '#FA5252' },
    trips: ['#228BE6', '#12B886', '#FD7E14', '#BE4BDB']
  },
  {
    id: 'ios', name: 'iOS の標準色', source: 'Apple Human Interface Guidelines の system colors（Light）', note: 'iPhone の純正アプリと同じ色。地は iOS のグループ背景 #F2F2F7',
    vars: { bg: '#F2F2F7', paper: '#FFFFFF', paper2: '#F2F2F7', ink: '#1C1C1E', ink2: '#3A3A3C', ink3: '#8E8E93', line: '#E5E5EA', line2: '#D1D1D6', line3: '#C7C7CC', mark: '#3A3A3C', now: '#FF3B30', venue: '#FF9500',
      'c-transit': '#007AFF', 'c-walk': '#8E8E93', 'c-stay': '#34C759', 'c-food': '#FF9500', 'c-spot': '#FFCC00', 'c-venue': '#FF3B30' },
    trips: ['#007AFF', '#34C759', '#FF9500', '#AF52DE']
  },
  {
    id: 'tailwind', name: 'Tailwind（空・翠・琥珀・薔薇）', source: 'Tailwind CSS v3 の既定パレット', note: 'Web アプリで最も使われている色体系。stone の地に sky / emerald / amber / rose',
    vars: { bg: '#F5F5F4', paper: '#FFFFFF', paper2: '#FAFAF9', ink: '#1E293B', ink2: '#475569', ink3: '#64748B', line: '#E7E5E4', line2: '#D6D3D1', line3: '#A8A29E', mark: '#334155', now: '#DC2626', venue: '#F97316',
      'c-transit': '#0284C7', 'c-walk': '#78716C', 'c-stay': '#059669', 'c-food': '#F97316', 'c-spot': '#F59E0B', 'c-venue': '#F43F5E' },
    trips: ['#0284C7', '#059669', '#F59E0B', '#F43F5E']
  },
  {
    id: 'wada', name: '和田三造 配色総鑑', source: 'A Dictionary of Color Combinations 組み合わせ #260・#330（wadacolors.com）', note: '1930年代の配色辞典から。海緑 #00AC95・古薔薇 #D56A75・肉桂 #EFAE8D・鼠青 #A2B2CD。温かく明るい',
    vars: { bg: '#F2EEE6', paper: '#FBF8F2', paper2: '#F4EFE5', ink: '#2B2A26', ink2: '#5A5650', ink3: '#7E7970', line: '#E8E2D6', line2: '#D8D0C0', line3: '#C2B8A4', mark: '#3A6B67', now: '#D56A75', venue: '#D56A75',
      'c-transit': '#008F97', 'c-walk': '#A2B2CD', 'c-stay': '#00AC95', 'c-food': '#EFAE8D', 'c-spot': '#CED19B', 'c-venue': '#D56A75' },
    trips: ['#00AC95', '#D56A75', '#008F97', '#A2B2CD']
  }
];

const KEY = 'tabi_palette';
export function currentPaletteId() { try { return JSON.parse(localStorage.getItem(KEY)) || 'sumi'; } catch { return 'sumi'; } }
export function setPaletteId(id) { try { localStorage.setItem(KEY, JSON.stringify(id)); } catch {} }
export function getPalette(id = currentPaletteId()) { return PALETTES.find(p => p.id === id) || PALETTES[0]; }

// :root の CSS 変数を上書きし、旅の識別色を配色の4色に割り当てる（データの色は palette.trips が null のときだけ使う）
export function applyPalette(data, id = currentPaletteId()) {
  const p = getPalette(id);
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(p.vars)) root.setProperty('--' + k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.vars.bg);
  if (data?.trips) {
    const sorted = data.trips.slice().sort((a, b) => a.start.localeCompare(b.start));
    sorted.forEach((t, i) => { if (!t._color0) t._color0 = t.color; t.color = p.trips ? p.trips[i % p.trips.length] : t._color0; });
  }
  return p;
}
