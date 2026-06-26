# TASFUL Cursor Hooks

TASFUL 開発の品質ゲート（**チェック専用 / 報告専用**）。

```text
変更検知 → Build → スコープ判定 → 回帰候補 → docs要否 → Go/No-Go
```

## 配置

| ファイル | 役割 |
| --- | --- |
| `.cursor/hooks.json` | Hook 登録（Cursor 正本） |
| `.cursor/hooks/*.md` | Hook 仕様 · Command 対応表 |
| `.cursor/hooks/*.mjs` | 読み取り専用チェック実装 |
| `.cursor/hooks/lib/` | 共有 git 解析 |

## Commands 対応表

| Slash Command | Hook | イベント |
| --- | --- | --- |
| `/finish` | `pre-finish` | `beforeSubmitPrompt` |
| `/review` | `pre-review` | `beforeSubmitPrompt` |
| `/release` | `pre-release` | `beforeSubmitPrompt` |
| `/build` | `post-build` | `afterShellExecution`（`build:pages` 後） |

Commands（`.cursor/commands/`）は変更せず、Hooks が追加ゲートとして動作する。

## 共通ルール

1. 実行内容を最初に表示（stderr → Cursor **Hooks** 出力チャネル）
2. **変更は加えない**
3. **自動 stage しない**
4. **自動 commit しない**
5. **自動 deploy しない**
6. 失敗時は原因候補と次の対応を出す
7. 最後に **Go / No-Go** を明記

## 安全ゲート（全シェル）

`block-dangerous-shell.mjs`（`beforeShellExecution`）が以下を **deny**:

- `git add -A` / `git add .`（AD-007）
- `wrangler publish` / `wrangler pages deploy`
- `git push --force` / `-f`

## 確認方法

1. Cursor Settings → **Hooks** タブ
2. Output パネル → **Hooks** チャネル
3. `/finish` 送信 · `npm run build:pages` 実行でレポート確認

## 正本参照

- `docs/DECISIONS.md`
- `.cursor/rules/git.mdc`, `.cursor/rules/qa.mdc`
- `.cursor/agents/release-agent.md`, `.cursor/agents/review-agent.md`
