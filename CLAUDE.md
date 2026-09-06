# tabi-shoka（旅の書架）

夫婦2人の旅の予定と記録を1冊ずつ積み上げるスマホWebアプリ。travel-desk（相談・調査・予約の編集室）で確定した旅程をここに投入し、旅の後は記録を残す。2026-09-06 着工。

- **公開URL**: https://yukikanedomi.github.io/tabi-shoka/ （GitHub Pages · main push で公開）
- **設計**: 案D「地図が入口」（Google Maps JavaScript API）。本棚＝足あとの地図＋旅の一覧、手帳＝DAY/宿/準備/記録。構成の経緯は travel-desk/knowledge/travel-book-concept.md
- **動かし方**: ビルド不要の素の HTML/CSS/ES modules。ローカル確認は `python -m http.server` で http 配信（file:// では fetch が動かない）

## 機微情報と暗号化（最重要）

- 旅データ・合言葉・Google Maps キーの平文は **`private/`（.gitignore済）** にのみ置く。公開リポジトリに載るのは暗号化済み `data/bundle.enc.json` だけ
- `node tools/build-data.mjs` で `private/config.json` + `private/trips/*.json` → `data/bundle.enc.json`（PBKDF2-SHA256 200k → AES-GCM 256）。**データを変えたら必ず再ビルドしてから push**
- 合言葉・キーの控えは travel-desk の `参考資料/`（gitignore済）にもある
- 予約番号・会員番号・住所は旅データにも入れない（座席番号・便名・宿名は可）
- Google Maps キーは HTTP リファラー `https://yukikanedomi.github.io/*` に限定。月1万表示の無料枠内で運用

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | シェル。CSS/JS の `?v=` を sw.js の V と揃える |
| `js/app.js` | 起動 · 合言葉（localStorage `tabi_pass`）· ハッシュルーター（`#/` 本棚、`#/trip/<id>/day/<n>|stay|prep|log`） |
| `js/shelf.js` | 本棚: 地図に旅ごとの色の点（shelfPins、線は引かない。2026-09-07 ユーザー指摘「線はごちゃごちゃ」）＋一覧（日付順） |
| `js/geo.js` | 現在地ボタン（地図右下）。押したときだけ端末の位置情報を使い、藍の点と精度の輪を出す。外部送信なし。一度オンにすると次回も自動（localStorage `tabi_geo`）。ダブルタップでオフ |
| `js/trip.js` | 手帳: DAY（地図＋行程シート、当日は「いま」を赤で追従）· 宿 · 準備（手配/やること/持ち物、チェックは localStorage）· 記録（費用/ひとこと/写真） |
| `js/maps.js` | Google Maps 読み込み · 淡いスタイル · HTMLマーカー（OverlayView）· 徒歩は DirectionsService で道なり |
| `js/util.js` | 日付/時刻/整形/ストレージ |
| `sw.js` | 同一オリジンはすべて network-first かつ `cache:'no-cache'`（GitHub Pages の max-age=600 を回避して毎回 ETag 再検証）、圏外時だけキャッシュ。CSS/JS 変更時は念のため V と `?v=` を上げる |
| `tools/build-data.mjs` | 暗号化ビルド（検証つき: 場所キー・時刻書式） |
| `tools/geocode.mjs` | 座標の解決（鍵不要）。駅は Overpass の railway=station を名前＋現在座標5km以内で、住所つきは国土地理院の住所検索、その他は Nominatim（3km以内・バス停除外）。`--write` で 50m 以上のずれを更新し `src/resolved` を付ける。`fixed:true` は触らない。Overpass は 429 になることがあるので少し待って再実行 |
| `js/icons.js` · `assets/icons/` | カテゴリ絵記号。画像12種（Codex gpt-image-2 生成、二色線画 B。`assets/icons/a/` は単色サイン風の予備）＋ note 用 SVG。行の `cat` で指定、無ければ mode/kind から推定 |

## 旅データの書式（private/trips/<id>.json）

- 必須: `id title start end nights color`（旅の通し番号は持たない。並びは start の日付順、識別は色の背表紙）。任意: `sub area route shelfPins stayContext places days stays transport prep budget budgetNote memories`
- `places[key] = {name,lat,lng, kind:sta|pt|venue|stay, side:t|b|l|r, far:true（遠方＝地図の範囲に含めない）, q:'検索語（Googleマップの経路と座標解決に使う）', addr:'住所（宿など。座標解決に使う）', fixed:true（手で決めた座標を守る）}`。新しい場所を足したら `node tools/geocode.mjs` で確認
- `days[].sched[] = {t:'HH:MM', t2:'頃', h, d, at:場所キー, mode:rail|walk|bus, hard:true, r:'右端の小さな注記', tips:[...], web}`。`mode:'walk'` の行は前の行の場所から道なりの点線を描く。`days[].focus` で地図の初期範囲を指定
- `tips` の「注意｜」で始まる項目は赤字
- 宿: `stays[] = {name, sub, at, nights, addr, tel, tags[], checkin, checkout, lastin, arrive, access[], timeline[{t,h,d}], facilities[{k,v}], room, bring[], nearby[{k,v}], booking[{k,v}], web(予約ページ), official}`。事実は公式サイトで裏取りしてから入れる（時間・料金は変わるので確認日をコミットメッセージに）
- 記録: `memories = {notes, highlights:[], next:[], photos:[{file,caption}]}`（旅の後に travel-desk から投入）
- 過去の旅の追加（2026-09-07 九州で検証）: 詳細な旅程が残っていれば `days` つきで（時刻欄は「朝」「夜」などの短い語も可）、行った場所だけなら簡易の旅の書式で。地点は `q`/`addr` を付けて `node tools/geocode.mjs --write` で解決し、見つからないものは手で置いて `fixed:true`
- **簡易の旅**（一覧にだけ入れる旅・過去の旅の追加）: `days` を持たない trip。必須項目＋ `area summary link:{label,url} abroad:true budget memories` だけで成立し、手帳は1枚の要約ページになる（例: 2026-09-australia.json）。過去の旅を足すときはこの書式で `private/trips/` に置いて再ビルド

## 画面の作法

- 地図と下のシートの割合は `js/sheet.js`（つまみのドラッグ、タップで巡回、右上の「地図 · 半々 · リスト」）。状態は localStorage `tabi_sheet` に記憶し、本棚・DAY・宿で共通
- **純黒は使わない**（2026-09-06 外部批評: Codex＋Claude の2系統、根拠は Google/Apple/Airbnb/iOS の実物）。墨は地色と同じ緑寄り（--ink #23261F）、紙は --paper #FBFBF8。画面で強い色は「いま」の朱（--now #C0442F）だけ
- 地図の描き込みは小さく墨色（--mark #414A3D）: 駅＝白丸に墨の縁 9px、地点＝墨の点 8px、宿＝二重丸、会場＝柿渋の角丸四角、いま＝朱＋薄い暈。ラベルは Google の地名と同じ白ハロー文字、会場と宿だけ紙色の札（左に色の縦罫）
- 徒歩の点線は #5A6356 の細い点（scale 2 / 9px 間隔）に白い縁 6px。旅の線は白縁 5.5px の上に 2.5px、済んだ旅は opacity .45。旅の色は低彩度4色（藍 #3C5A72 / 松葉 #55704F / 柿渋 #A25A33 / 鳩羽 #6D6675）
- タブは面で塗らず下線。分割コントロールは iOS の溝つまみ型。行程リストは左に縦のタイムライン罫、現在行は薄い紙色＋朱の左罫。ベタ塗りバッジは使わない

## 設計上の決まりごと

- 絵文字をアイコンにしない。電話番号に tel: リンクを付けない（誤タップ防止）
- 「いま」は当日だけ出す（現在時刻以下の最後の行）。旅行前はカウントダウン
- 近鉄などの鉄道線は自分で描かない（Google が線路を描く）。徒歩だけ点線で描く
- DirectionsService は 2026-02 に非推奨。動くうちは使い、止まったら Routes（`google.maps.routes`）へ移行
- 本棚の地図は国内のみ。海外の旅は `abroad:true` で一覧側に出す（未実装）
