# /build — 静的ページビルド

TASFUL 静的配信ビルドを実行し結果を報告する。**失敗時は勝手にコード修正しない** — 原因報告を優先。

## 事前確認

1. `package.json` の `scripts` — 正しい build script を確認
2. `docs/DECISIONS.md` AD-009 — `npm run build:pages` → `deploy/cloudflare/dist`

## 実行

```bash
npm run build:pages
```

（`package.json` に別 script が正本ならそれを使い、理由を明記）

## 成功時の確認

- `deploy/cloudflare/dist` に期待出力があるか
- ソース変更がある場合、dist ミラー整合の要否

## 出力形式

### 実行コマンド

実際に実行したコマンド（1 行）

### 結果

- **PASS** / **FAIL**
- 所要時間 · 警告の有無

### 失敗箇所

- エラーメッセージ抜粋
- 失敗ファイル/ステップ

### 次の修正候補

- 推定原因（根拠付き）
- 修正すべきファイル候補（修正はしない）

推奨 Subagent: `qa-agent`
