# tabi-shoka（旅の書架）

夫婦2人の旅の予定と記録を1冊ずつ積み上げるスマホWebアプリ。travel-desk（相談・調査・予約の編集室）で確定した旅程をここに投入し、旅の後は記録を残す。2026-09-06 着工。

- **公開URL**: https://yukikanedomi.github.io/tabi-shoka/ （GitHub Pages · main push で公開）
- **設計**: 案D「地図が入口」（Google Maps JavaScript API）。本棚＝足あとの地図＋旅の一覧、手帳＝DAY/宿/準備/記録。構成の経緯は travel-desk/knowledge/travel-book-concept.md
- **動かし方**: ビルド不要の素の HTML/CSS/ES modules。ローカル確認は `python -m http.server 8765` で http 配信（file:// では fetch が動かない）。**公開は `node tools/publish.mjs "メッセージ"`**（check → build → commit → push → Pages 完了待ち。データ変更なしなら `--no-build`）
- **画面の目視確認（Chrome 拡張が使えないとき）**: `private/dev-harness.html?to=%23/stats&h=900` を http 配信で開くと、合言葉を localStorage に入れてアプリを iframe で表示する（private なので公開されない）。ヘッドレス Chrome は `--timeout=9000 --screenshot`（harness が load を保留して起動を待つ。`--virtual-time-budget` では起動前に撮れてしまう）。Chrome は `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`、Git Bash から直接呼ぶ（PowerShell からの `cmd /c` は引用符で崩れる）。地図は referer 制限で出ないので、リスト系の画面だけ

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
| `js/app.js` | 起動 · 合言葉（localStorage `tabi_pass`）· ハッシュルーター（`#/` 本棚、`#/trip/<id>` は旅行中なら今日の DAY、それ以外は概要。`/overview|day/<n>|stay|prep|log`） |
| `js/shelf.js` | 本棚: 地図に旅ごとの色の点（shelfPins、線は引かない。2026-09-07 ユーザー指摘「線はごちゃごちゃ」）＋一覧（並び: 新しい順が既定／古い順／これから。localStorage `tabi_sort`） |
| `js/palettes.js` · `js/palette.js` | 配色の候補集（墨と紙／Happy Hues 8／日本の伝統色／Open Color／iOS 標準色／Tailwind／和田三造 配色総鑑）と `#/palette` の切替ページ。CSS 変数を :root で上書きし、旅の識別色は配色の4色を日付順に割り当て（localStorage `tabi_palette`）。色は「旅の識別色 --trip」「カテゴリ色 --c-*（絵記号の淡い円、券の地）」「いま --now」の3系統だけに使う |
| `js/geo.js` | 現在地ボタン（地図右下）。押したときだけ端末の位置情報を使い、藍の点と精度の輪を出す。外部送信なし。一度オンにすると次回も自動（localStorage `tabi_geo`）。ダブルタップでオフ |
| `js/trip.js` | 手帳: 概要（旅全体の地図＋日程表・宿・移動・費用。行をタップで各画面へ）· DAY（地図＋行程シート、当日は「いま」を赤で追従）· 宿 · 準備（手配/やること/持ち物、チェックは localStorage）· 記録（費用/ひとこと/写真） |
| `js/maps.js` | Google Maps 読み込み · 淡いスタイル · HTMLマーカー（OverlayView）· 徒歩は DirectionsService で道なり |
| `js/util.js` | 日付/時刻/整形/ストレージ |
| `sw.js` | 同一オリジンはすべて network-first かつ `cache:'no-cache'`（GitHub Pages の max-age=600 を回避して毎回 ETag 再検証）、圏外時だけキャッシュ。CSS/JS 変更時は念のため V と `?v=` を上げる |
| `tools/build-data.mjs` | 暗号化ビルド（検証つき: id 重複・日付・色・座標範囲・URL・場所キー・時刻書式・写真 id 重複。写真の日と行の自動割り当てもここ） |
| `tools/prep-photos.py` · `tools/import-travel-itinerary.mjs` | 写真の下ごしらえ（EXIF 除去・縮小）／旅の手帳 trip.js → 旅データの下書き変換（private/drafts/ へ。座標は未解決） |
| `tools/geocode.mjs` | 座標の解決（鍵不要）。駅は Overpass の railway=station を名前＋現在座標5km以内で、住所つきは国土地理院の住所検索、その他は Nominatim（3km以内・バス停除外）。`--write` で 50m 以上のずれを更新し `src/resolved` を付ける。`fixed:true` は触らない。Overpass は 429 になることがあるので少し待って再実行 |
| `js/icons.js` · `assets/icons/` | カテゴリ絵記号。画像12種（Codex gpt-image-2 生成、二色線画 B。`assets/icons/a/` は単色サイン風の予備）＋ note 用 SVG。行の `cat` で指定、無ければ mode/kind から推定 |

## 旅データの書式（private/trips/<id>.json）

- 必須: `id title start end nights color`（旅の通し番号は持たない。並びは start の日付順、識別は色の背表紙）。任意: `sub area route shelfPins stayContext places days stays transport prep budget budgetNote memories`
- `places[key] = {name,lat,lng, kind:sta|pt|venue|stay, side:t|b|l|r, far:true（遠方＝地図の範囲に含めない）, q:'検索語（Googleマップの経路と座標解決に使う）', addr:'住所（宿など。座標解決に使う）', fixed:true（手で決めた座標を守る）, short:'地図ラベル用の短い名前（長い宿名など。無ければ name。13字を超えると…で省略）'}`。新しい場所を足したら `node tools/geocode.mjs` で確認
- `days[].sched[] = {t:'HH:MM', t2:'頃', h, d, at:場所キー, mode:rail|walk|bus, hard:true, r:'右端の小さな注記', tips:[...], web}`。`mode:'walk'` の行は前の行の場所から道なりの点線を描く。`days[].focus` で地図の初期範囲を指定
- `tips` の「注意｜」で始まる項目は赤字
- 宿: `stays[] = {name, sub, at, nights, addr, tel, tags[], checkin, checkout, lastin, arrive, access[], timeline[{t,h,d}], facilities[{k,v}], room, bring[], nearby[{k,v}], booking[{k,v}], web(予約ページ), official}`。事実は公式サイトで裏取りしてから入れる（時間・料金は変わるので確認日をコミットメッセージに）
- 記録: `memories = {notes, highlights:[], next:[], photos:[{id, caption, day:'YYYY-MM-DD', at:場所キー}]}`、`cover: 写真id`。**写真の流れ（2026-09-10 から1コマンド化）**: 原本を `private/photos/<tripId>/` に置く → `python tools/prep-photos.py <tripId>`（EXIF の撮影日時と位置を index.json に控えてから EXIF を落とし 1600px と 480px に。HEIC は pillow-heif で可）→ `node tools/build-data.mjs`。**memories.photos を書かなければ photos_out の全部が撮影順に入り、日（撮影日）と行（位置が近い場所 1.5km 以内、なければ撮影時刻以前の最後の行）は自動で付く**。説明を付けたい写真や並びを変えたいときだけ memories.photos に `{id, caption}` を書く（day/at は省略可＝自動）。cover が無ければ最初の写真。撮影日時・位置は private に留まり公開されない（配信されるのは時刻 HH:MM だけ）。アプリ側は `js/photos.js` が表示時に復号（記録のグリッド、行程の行サムネ＝同じ日・同じ場所、本棚と概要の表紙、全画面ビューア）
- 過去の旅の追加（2026-09-07 九州で検証）: 詳細な旅程が残っていれば `days` つきで（時刻欄は「朝」「夜」などの短い語も可）、行った場所だけなら簡易の旅の書式で。地点は `q`/`addr` を付けて `node tools/geocode.mjs --write` で解決し、見つからないものは手で置いて `fixed:true`
- **簡易の旅**（一覧にだけ入れる旅・過去の旅の追加）: `days` を持たない trip。必須項目＋ `area summary link:{label,url} abroad:true budget memories` だけで成立し、手帳は1枚の要約ページになる（例: 2026-09-australia.json）。過去の旅を足すときはこの書式で `private/trips/` に置いて再ビルド

## 画面の作法

- 地図と下のシートの割合は `js/sheet.js`（つまみのドラッグ、タップで巡回、右上の「地図 · 半々 · リスト」）。状態は localStorage `tabi_sheet_<shelf|overview|day|stay>` に画面ごとに記憶（2026-09-08）
- 画面の後始末は `util.js` の `onDispose()` に登録し、ルーターが次の画面の前に `disposeAll()` で呼ぶ（GPS 監視・タイマー・window のイベント・Maps のリスナー）。新しい画面で addEventListener(window/document) や setInterval を使ったら必ず onDispose に解除を登録する
- 夜（端末のダークモード）は `palettes.js` の DARK で地・紙・墨・罫線・地図の縁取り（--halo）だけを暗く振り替える。夜専用の値は昼に戻るとき removeProperty で消す（2026-09-09 の滲みの不具合）
- 地図の色は設定 `#/settings` で「標準（Google のまま・既定）／淡い（配色に合わせる）」（localStorage `tabi_mapstyle`）。夜はどちらも暗い styled map
- 現在地の自動オンは旅行中の DAY 画面だけ。10 分操作がなければ GPS を止める（2026-09-09 電池対策）
- DAY はシート上の横スワイプで前後の日へ。持ち物は `tabi_pack_<trip>` にチェックを記憶。本棚の上に「○年前の今日」（過去の旅の同じ月日）
- 設定の「最新の版に更新」は SW とキャッシュを消して開き直す（GitHub Pages の 10 分キャッシュで版が混ざったときの逃げ道）
- **純黒は使わない**（2026-09-06 外部批評: Codex＋Claude の2系統、根拠は Google/Apple/Airbnb/iOS の実物）。墨は地色と同じ緑寄り（--ink #23261F）、紙は --paper #FBFBF8。画面で強い色は「いま」の朱（--now #C0442F）だけ
- 地図の描き込みは小さく墨色（--mark #414A3D）: 駅＝白丸に墨の縁 9px、地点＝墨の点 8px、宿＝二重丸、会場＝柿渋の角丸四角、いま＝朱＋薄い暈。ラベルは Google の地名と同じ白ハロー文字、会場と宿だけ紙色の札（左に色の縦罫）
- **既定の配色は Tailwind**（2026-09-08 ユーザー決定）: 地 stone-100 #F5F5F4、紙 #FFFFFF、墨 slate-800 #1E293B、いま red-600 #DC2626、旅の識別色は sky-600 #0284C7 / emerald-600 #059669 / amber-500 #F59E0B / rose-500 #F43F5E を日付順に。他の配色は `#/palette` で切替可（Google マップの地色も配色に追従）
- 徒歩の点線は細い点に白い縁 6px
- タブは面で塗らず下線。分割コントロールは iOS の溝つまみ型。行程リストは左に縦のタイムライン罫、現在行は薄い紙色＋朱の左罫。ベタ塗りバッジは使わない

## 設計上の決まりごと

- 絵文字をアイコンにしない。電話番号に tel: リンクを付けない（誤タップ防止）
- 「いま」は当日だけ出す（現在時刻以下の最後の行）。旅行前はカウントダウン。圏外では保存済みのデータと写真で動き、画面下に「圏外」の帯を出す（地図は出ない）
- 準備の「やること」は期限順、完了は下に折りたたみ。期限切れ・7日以内は朱
- 近鉄などの鉄道線は自分で描かない（Google が線路を描く）。徒歩だけ点線で描く
- DirectionsService は 2026-02 に非推奨。動くうちは使い、止まったら Routes（`google.maps.routes`）へ移行
- 本棚の地図は国内のみ。海外の旅は `abroad:true` で一覧側に出す（未実装）
