# /status — TASFUL 開発状況確認

TASFUL 開発の現在地を docs 正本と git 状態から要約する。**コード変更は行わない。**

## 必ず読む

1. `docs/README.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/TODO.md`
4. `docs/KNOWN_ISSUES.md`
5. `docs/CHANGELOG.md`
6. `docs/DECISIONS.md`

## 必ず実行

```bash
git status --short
git log --oneline -5
```

## 参照（必要時）

- `.cursor/rules/_global.mdc`
- `.cursor/agents/` — 担当 Subagent の選定に使う

## 出力形式（この見出し順・必須）

### 現在地

- HEAD コミット（hash · メッセージ）
- 製品別ステータス（Builder / Platform / TLV / Secretary / TASFUL AI）
- Production Ready / 凍結状態（AD-008）

### 未コミット変更

- `git status --short` の要約（件数 · 主要カテゴリ）
- 意図した作業中の変更 vs 混在リスク

### 優先タスク

- `docs/TODO.md` P0 → P1 の上位 3 件

### 注意点

- `docs/KNOWN_ISSUES.md` の未解決（KI 番号付き）
- `docs/DECISIONS.md` 違反リスク（AD 番号付き）

### 次にやるべきこと

- 1 件の具体アクション（領域 · 参照 doc · 推奨 Subagent）

### Go / No-Go

- **Go**: 次タスク着手可能
- **No-Go**: ブロッカーと理由

推測で「完了」と書かない。根拠（doc · commit · test）がなければ「未確認」と明記。
