# GitHub MCP — TASFUL Phase 1

**サーバー名:** `tasful-github`  
**パッケージ:** `@modelcontextprotocol/server-github`

## 目的

GitHub リポジトリ情報を **読取専用** で参照する。

## 接続先

| 項目 | 値 |
| --- | --- |
| Repository | `haruka0627/tasufull-article` |
| Remote | `origin` → `https://github.com/haruka0627/tasufull-article.git` |

## 認証

環境変数（**コミット禁止**）:

```text
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

### 推奨トークン権限（Fine-grained または classic read）

| 操作 | Phase 1 |
| --- | --- |
| Repository 読取 | 許可 |
| Branch / Commit / Tag 確認 | 許可 |
| PR 一覧 · diff 読取 | 許可 |
| PR 作成 | **禁止** |
| Push | **禁止** |
| Merge | **禁止** |
| Issue 作成 · 更新 | **禁止** |

classic PAT の場合: `repo` フルではなく **public_repo** または fine-grained **Contents: Read**, **Pull requests: Read**, **Metadata: Read** のみ。

## Read Only 方針（Phase 1）

許可する MCP 利用例:

- ブランチ一覧 · 最新 commit
- tag / release 参照
- open PR 一覧 · PR diff 読取
- file contents at ref（GitHub API 経由）

禁止:

- `create_pull_request` · `merge_pull_request`
- `push_files` · `create_or_update_file`
- issue / label / review の mutating 操作

Agent・Subagent は **read ツールのみ** 使用。`.cursor/hooks/block-dangerous-shell.mjs` が `git push` も deny。

## セットアップ確認

1. `GITHUB_PERSONAL_ACCESS_TOKEN` を OS 環境変数に設定
2. Cursor Reload
3. `@tasful-github` で repository / branch 情報が取得できる

## Phase 2 以降

- 人手承認後のドラフト PR 作成
- Release Agent 連携（Go/No-Go 前の PR 状態確認自動化）

## AI 秘書連携（将来）

OPS triage 時に PR · commit · tag を参照し、**報告のみ**（Phase 1）。
