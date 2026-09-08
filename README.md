# 旅の書架 / Tabi no Shoka

ふたりの旅の予定と記録を、一冊ずつ積み上げる私的な旅の手帳（PWA）。

- 地図: Google Maps Platform（Maps JavaScript API）
- 旅データは合言葉で暗号化（AES-GCM）して配信。平文はリポジトリに含まれません
- ビルド不要。`index.html` を http 配信すれば動きます

```
node tools/build-data.mjs   # private/ → data/bundle.enc.json
```

## 出典

- `assets/japan.svg`（まとめの都道府県地図）: [geolonia/japanese-prefectures](https://github.com/geolonia/japanese-prefectures) の map-mobile.svg。Wikipedia の Japan map（GFDL）に基づく
