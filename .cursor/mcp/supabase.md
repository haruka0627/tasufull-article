# Supabase MCP — TASFUL Phase 1

**サーバー名:** `tasful-supabase`  
**パッケージ:** `@supabase/mcp-server-supabase`

## 目的

Supabase プロジェクトの **メタデータ・スキーマ情報を読取専用** で参照する。

## 接続先

| 項目 | 値 |
| --- | --- |
| Project ref | `ddojquacsyqesrjhcvmn` |
| URL | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| 根拠 | リポジトリ内 `partner-api.js` · `reports/auth-step8b-post-inventory.json` |

## 認証

環境変数（**コミット禁止**）:

```text
SUPABASE_ACCESS_TOKEN=sbp_...
```

Supabase Dashboard → Account → **Access Tokens** で発行。

## サーバー側 Read Only（必須）

`.cursor/mcp.json` で以下を **固定**:

```json
"args": [
  "-y",
  "@supabase/mcp-server-supabase@latest",
  "--read-only",
  "--project-ref=ddojquacsyqesrjhcvmn"
]
```

`--read-only` により mutating ツール無効（公式 Supabase MCP）:

- `apply_migration` · branch 操作 · `deploy_edge_function`
- mutating SQL（INSERT / UPDATE / DELETE / DDL）
- project pause / restore 等

## Phase 1 で取得してよい情報

| 種別 | 例 |
| --- | --- |
| Table 一覧 | public スキーマ tables |
| View 一覧 | views |
| Function 一覧 | Edge Functions · DB functions |
| RLS 一覧 | policies · 有効化状態 |
| Migration 一覧 | `supabase/migrations/` 対応状態 |
| Project 情報 | ref · region · 設定概要 |

読取は **list / describe / execute_sql（SELECT のみ · read-only role）** 程度。

## 禁止事項（Phase 1）

```text
SQL 実行（mutating）
Migration 適用 / 作成
UPDATE / INSERT / DELETE
DROP / ALTER
本番 DB データ変更
Edge Function deploy
Branch create / merge
```

## セットアップ確認

1. `SUPABASE_ACCESS_TOKEN` 設定
2. Cursor Reload → `@tasful-supabase` 有効
3. list tables / migrations が read-only で返る
4. write 系ツールが **利用不可** であること

### Windows 代替

```json
{
  "command": "cmd",
  "args": [
    "/c", "npx", "-y", "@supabase/mcp-server-supabase@latest",
    "--read-only", "--project-ref=ddojquacsyqesrjhcvmn"
  ],
  "env": { "SUPABASE_ACCESS_TOKEN": "${env:SUPABASE_ACCESS_TOKEN}" }
}
```

## Phase 2 以降

- **staging のみ** · feature flag 付き limited write
- Builder AI P2-C: migration 適用は **人手 + release-agent** 承認後
- AI 秘書: RLS / schema 参照で triage 根拠を付与（read のみ）

## AI 秘書連携（将来）

```text
AI 秘書 triage 質問
  → Supabase MCP（RLS / table / migration 状態確認）
  → 報告のみ（自動 SQL / migration 禁止）
```

## 正本

- `docs/DECISIONS.md` — 本番 DB 操作は AD と TODO で人手管理
- `supabase/migrations/` — migration 正本（Filesystem MCP でも参照可）
