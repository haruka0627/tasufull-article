# /review — 実装差分レビュー

working tree / staged の差分を TASFUL 規約に照らしてレビューする。**修正は行わず報告のみ**（ユーザー指示時のみ修正）。

## 必ず実行・確認

```bash
git diff
git diff --cached
git status --short
```

## 必ず読む

- `docs/DECISIONS.md`
- `.cursor/rules/`（変更領域の `pkg-*.mdc`, `git.mdc`, `qa.mdc`）
- `.cursor/agents/`（該当 Subagent の担当境界）

必要時: `docs/KNOWN_ISSUES.md`, 該当 `docs/AI/*.md`

## レビュー観点

1. **スコープ外変更** — 依頼と無関係なファイル・リファクタ
2. **領域境界** — Builder / Platform / TLV / AI 秘書 / TASFUL AI（AD-001〜004）
3. **docs 矛盾** — DECISIONS / TODO / AI 仕様との不一致
4. **危険な削除** — 認可 · RLS · 免責 · Gateway 契約
5. **dist / reports 混入** — 意図通りか（AD-007, AD-009）
6. **凍結違反** — Production Ready / FEATURE FROZEN / RELEASE FROZEN（AD-008）
7. **Gateway** — `ai-model-gateway.js` 意図しない変更（AD-005, KI-001）

## 出力形式

### Blocking

マージ/コミット前に必須修正。ファイル · AD/規約 · 理由 · 推奨対応。

### High

要修正。同上。

### Medium

要確認・改善推奨。

### Low

任意改善。

### Go / No-Go

- **Go**: Blocking / High なし
- **No-Go**: Blocking または High あり

推奨 Subagent: `review-agent`, 領域違反時は該当 `*-agent`。
