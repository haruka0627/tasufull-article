# TASFUL MCP — Phase 1

**Read First** — 接続設定のみ。AI による自由操作は Phase 1 では禁止。

## 目的

TASFUL AI 開発チームが以下を **安全に参照** できるようにする。

| MCP | 用途 |
| --- | --- |
| Filesystem | リポジトリ内ファイル読取 |
| GitHub | リポジトリ · ブランチ · コミット · PR 一覧の読取 |
| Supabase | スキーマ · RLS · Migration 一覧 · Project 情報の読取 |

## 接続先

| サーバー | 設定ファイル | 接続先 |
| --- | --- | --- |
| `tasful-filesystem` | `.cursor/mcp.json` | プロジェクトルート（`.`） |
| `tasful-github` | `.cursor/mcp.json` | `haruka0627/tasufull-article` |
| `tasful-supabase` | `.cursor/mcp.json` | `ddojquacsyqesrjhcvmn`（read-only） |

詳細: [filesystem.md](./filesystem.md) · [github.md](./github.md) · [supabase.md](./supabase.md)

## セットアップ（ローカル · 秘密情報はコミットしない）

1. Cursor Settings → **Tools & MCP** で 3 サーバーを有効化
2. 環境変数を設定（OS ユーザーまたは `.env` 相当 · **リポジトリに含めない**）

```text
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...   # repo 読取のみ推奨
SUPABASE_ACCESS_TOKEN=sbp_...          # Supabase Dashboard → Access Tokens
```

3. Cursor を Reload Window
4. Agent で `@tasful-filesystem` / `@tasful-github` / `@tasful-supabase` が表示されることを確認

Windows で npx が起動しない場合は [filesystem.md](./filesystem.md) の `cmd /c` 例を参照。

## Read Only 方針

| レイヤ | Phase 1 |
| --- | --- |
| **運用ポリシー** | 全 MCP — **Read First**。書込・変更・deploy は Agent 指示でも実行しない |
| **Supabase MCP** | `--read-only` + `--project-ref` でサーバー側も read-only |
| **GitHub MCP** | トークンは **read スコープ** のみ。PR 作成 · Push · Merge 禁止 |
| **Filesystem MCP** | ツール自体は write 可 — **Phase 1 では read ツールのみ使用**（ポリシー） |
| **Hooks** | `.cursor/hooks/` が `git add -A` · deploy · force push を deny |

## 禁止事項（Phase 1 · MCP 経由も Shell も）

```text
自動コミット / 自動 Push
PR 作成 / Issue 変更 / Merge
Supabase UPDATE / INSERT / DELETE
SQL 実行（mutating）
Migration 適用 / 本番 DB 変更
Deploy / wrangler publish
git add -A / git reset --hard / git clean
DROP / ALTER（DDL）
```

## AI 秘書との将来構成（Phase 2+ · まだ自動実行しない）

```text
AI 秘書（admin-ai-secretary / OPS triage）
        ↓ 参照依頼（Read First）
Filesystem MCP  … docs / reports / .cursor / ソース確認
        ↓
GitHub MCP        … 変更履歴 · PR 状態 · リリース tag 確認
        ↓
Supabase MCP      … スキーマ · RLS · migration 状態確認
        ↓
（Phase 2 以降）限定 write · staging 操作 · 承認付き triage
```

Phase 1 では **参照チェーンの設計のみ**。秘書が MCP を自動起動しない。

## Phase 2 以降で許可する内容（予定 · 未実装）

- GitHub: ドラフト PR 作成（人手承認後）
- Supabase: staging 限定 · read-only 以外のツール（feature flag + 承認）
- Filesystem: スコープ限定 write（単一ファイル · docs 更新提案）
- AI 秘書: triage 結果に基づく **承認付き** 次アクション提案

## 正本参照

- `docs/DECISIONS.md` AD-007（選別コミット）
- `.cursor/rules/_global.mdc`
- `.cursor/hooks/block-dangerous-shell.mjs`

## ファイル構成

```text
.cursor/mcp.json          ← Cursor MCP 登録（コミット可 · トークンなし）
.cursor/mcp/
  README.md               ← 本ファイル
  filesystem.md
  github.md
  supabase.md
```
