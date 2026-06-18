# ランクネームプレート画像

## 本番ファイル

| rank | ファイル |
|------|----------|
| new, bronze, silver, gold, platinum | `{rank}.webp`（透過） |
| legend | 出品者カードは **枠色・名前色**（`seller-rank-plate.css`）。画像は他画面向け |

表示パスは `listing-seller-profile.js` → `images/rank/${rank}.webp`（拡張子は `RANK_PLATE_FILE_EXT` で上書き可能）。

## LEGEND 再生成（カード背景統合）

黒背景のマスター PNG を `assets` に置き、オーロラ背景 (#f8f6f1) へ合成:

```bash
npm run build:legend-card
```

透過のみの LEGEND は使わない（白カードで黒浮きするため）。
