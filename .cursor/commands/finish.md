# /finish — 作業完了前整理

コミット前の整理・Go/No-Go 判定。**`git add -A` 禁止。** 選別ステージング前提で提案する。

## 必ず実行・確認

```bash
git status --short
git diff
git diff --cached
```

## 必ず読む

- `docs/DECISIONS.md` AD-007, AD-009
- `.cursor/rules/git.mdc`, `.cursor/rules/docs.mdc`
- `.cursor/agents/release-agent.md`

## 確認項目

1. 今回の作業スコープと diff の一致
2. docs 更新要否（`docs.mdc` タイミング表）
3. build 結果 — 未実行なら `/build` 相当を提案
4. test 結果 — 未実行なら `/test` 相当を提案
5. dist ミラー要否（ソース変更時）
6. 秘密情報 · probe · 意図しない gateway 含有

## 出力形式

### 完了内容

- 実装/作業の要約（1–3 文）

### 残タスク

- スコープ外に残したもの · follow-up

### docs 更新が必要か

- **要** / **不要** — 対象ファイルと理由

### コミットに含めるべきファイル

- 明示パス一覧（`git add <path>` 用）

### コミットに含めないファイル

- 混在ファイル · dist 全 tree · reports · 無関係変更

### 推奨コミットメッセージ

- 1–2 文（why 重視 · 領域プレフィックス）

### Go / No-Go

- **Go**: 選別 stage · build/test PASS · AD 違反なし
- **No-Go**: 理由と unblock 手順

**commit / push はユーザー明示指示まで実行しない。**

推奨 Subagent: `release-agent`
