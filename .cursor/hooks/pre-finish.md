# pre-finish — 作業完了前チェック

**対応 Command:** `/finish`  
**種別:** チェック専用 · 報告専用（変更・stage・commit・deploy なし）

## 実行内容

1. `git status --short`
2. `git diff --name-status`
3. `git diff --cached --name-status`

## 確認

- スコープ外変更が混ざっていないか
- `deploy/cloudflare/dist/` · `reports/` · `.tmp` · `.wrangler` が混ざっていないか
- docs 更新が必要そうか（`docs/` 変更 · フェーズ完了 · 方針決定）
- `git add -A` を使うべきでない状態か（AD-007）

## 参照

- `docs/DECISIONS.md` AD-007, AD-009
- `.cursor/rules/git.mdc`, `.cursor/rules/docs.mdc`
- `.cursor/commands/finish.md`

## 出力

- Finish Go / No-Go
- 含めるべきファイル
- 含めないファイル
- docs 更新要否
- 推奨コミットメッセージ

## 禁止

- 自動 stage / commit / deploy
- ソース・docs の自動修正
