# Filesystem MCP — TASFUL Phase 1

**サーバー名:** `tasful-filesystem`  
**パッケージ:** `@modelcontextprotocol/server-filesystem`

## 目的

ワークスpace 内のファイルを **Read First** で参照する。

## 接続先

| 項目 | 値 |
| --- | --- |
| ルート | プロジェクトルート（`.`） |
| リポジトリ | `tasufull-article` |

### 参照対象（ルート配下すべて · 重点ディレクトリ）

```text
docs/           … 正本
.cursor/        … rules / agents / commands / hooks / mcp
builder/        … Builder
live/           … TLV
reports/        … フェーズレポート
deploy/         … Cloudflare ステージング
platform-* 等  … Platform ソース（ルート直下）
supabase/       … migrations · functions（読取のみ）
```

## Read Only 方針（Phase 1）

Filesystem MCP のツールには **write / edit** が含まれる。

Phase 1 では **read 系ツールのみ使用**:

- `read_file` / `read_text_file` / `read_media_file`
- `read_multiple_files`
- `list_directory` / `directory_tree`
- `search_files`
- `list_allowed_directories`
- `get_file_info`

**使用禁止（Phase 1）:** `write_file` · `edit_file` · `move_file` · `create_directory`

## 禁止事項

- MCP 経由のソース自動修正
- `docs/` · `.cursor/` への無承認書込
- 秘密情報ファイルの外部出力（`.env` · service role key 等）

## セットアップ確認

1. `.cursor/mcp.json` に `tasful-filesystem` が定義されている
2. Cursor Settings → MCP → `tasful-filesystem` 有効
3. Agent で `@tasful-filesystem` → `list_allowed_directories` が `.` を返す

### Windows 代替（npx 起動失敗時）

`.cursor/mcp.json` の `tasful-filesystem` を一時的に:

```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-filesystem@latest", "."]
}
```

## Phase 2 以降

- glob 限定 write（例: `docs/TODO.md` の提案パッチのみ）
- AI 秘書からの read 依頼テンプレート化
