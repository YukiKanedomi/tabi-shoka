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
| `js/shelf.js` | 本棚: 足あとの地図（route/shelfPins）＋一覧（旅行中→予定→済） |
| `js/trip.js` | 手帳: DAY（地図＋行程シート、当日は「いま」を赤で追従）· 宿 · 準備（手配/やること/持ち物、チェックは localStorage）· 記録（費用/ひとこと/写真） |
| `js/maps.js` | Google Maps 読み込み · 淡いスタイル · HTMLマーカー（OverlayView）· 徒歩は DirectionsService で道なり |
| `js/util.js` | 日付/時刻/整形/ストレージ |
| `sw.js` | HTML と旅データは network-first（更新が即反映、圏外は手元）、CSS/JS は cache-first。CSS/JS 変更時は V と `?v=` を上げる |
| `tools/build-data.mjs` | 暗号化ビルド（検証つき: 場所キー・時刻書式） |

## 旅データの書式（private/trips/<id>.json）

- 必須: `id no title start end nights color`。任意: `sub area route shelfPins stayContext places days stays transport prep budget budgetNote memories`
- `places[key] = {name,lat,lng, kind:sta|pt|venue|stay, side:t|b|l|r, far:true（遠方＝地図の範囲に含めない）, q:'Googleマップ検索語'}`
- `days[].sched[] = {t:'HH:MM', t2:'頃', h, d, at:場所キー, mode:rail|walk|bus, hard:true, r:'右端の小さな注記', tips:[...], web}`。`mode:'walk'` の行は前の行の場所から道なりの点線を描く。`days[].focus` で地図の初期範囲を指定
- `tips` の「注意｜」で始まる項目は赤字
- 記録: `memories = {notes, highlights:[], next:[], photos:[{file,caption}]}`（旅の後に travel-desk から投入）
- **簡易の旅**（一覧にだけ入れる旅・過去の旅の追加）: `days` を持たない trip。必須項目＋ `area summary link:{label,url} abroad:true budget memories` だけで成立し、手帳は1枚の要約ページになる（例: 2026-09-australia.json）。過去の旅を足すときはこの書式で `private/trips/` に置いて再ビルド

## 画面の作法

- 地図と下のシートの割合は `js/sheet.js`（つまみのドラッグ、タップで巡回、右上の「地図 · 半々 · リスト」）。状態は localStorage `tabi_sheet` に記憶し、本棚・DAY・宿で共通
- 黒（--ink）で塗るのは「選択中のタブ」「主ボタン」「地図のピン」だけ。罫線・枠・補助ボタンは --line2/--line3 の灰。時間厳守タグは琥珀

## 設計上の決まりごと

- 絵文字をアイコンにしない。電話番号に tel: リンクを付けない（誤タップ防止）
- 「いま」は当日だけ出す（現在時刻以下の最後の行）。旅行前はカウントダウン
- 近鉄などの鉄道線は自分で描かない（Google が線路を描く）。徒歩だけ点線で描く
- DirectionsService は 2026-02 に非推奨。動くうちは使い、止まったら Routes（`google.maps.routes`）へ移行
- 本棚の地図は国内のみ。海外の旅は `abroad:true` で一覧側に出す（未実装）
