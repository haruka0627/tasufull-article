# Supabase MCP — Cursor 導入レポート

**実施日:** 2026-07-01  
**種別:** Cursor MCP 設定 · **Staging 専用 · read-only**  
**実装変更:** なし（`.cursor/mcp.json` と MCP ドキュメントのみ）

---

## 0. Executive summary

| 項目 | 内容 |
| --- | --- |
| **MCP URL** | `https://mcp.supabase.com/mcp?project_ref=ahlxuyvhzqdqaojiywmu&read_only=true` |
| **対象 project ref** | `ahlxuyvhzqdqaojiywmu`（Staging · `tasful-staging`） |
| **read-only** | **有効**（`read_only=true`） |
| **Production 接続** | **なし**（旧 Production ref 設定を **削除**） |
| **DB / migration / Edge 変更** | **なし** |
| **MCP 接続確認（table 一覧）** | ⏸ Agent セッション未接続 · **ユーザー OAuth 後に §10 チェックリスト** |
| **運用ルール** | ✅ `.cursor/mcp/README.md` §Supabase MCP 運用ルール · 本レポート §9 |

---

## 1. 実施した設定

### 1.1 `.cursor/mcp.json`

**変更:** `tasful-supabase`（npx · Production ref `ddojquacsyqesrjhcvmn`）を **削除**し、Remote HTTP Staging サーバーを **追加**。

```json
"tasful-supabase-staging": {
  "type": "http",
  "url": "https://mcp.supabase.com/mcp?project_ref=ahlxuyvhzqdqaojiywmu&read_only=true"
}
```

| パラメータ | 値 | 効果 |
| --- | --- | --- |
| `project_ref` | `ahlxuyvhzqdqaojiywmu` | Staging のみスコープ · 他 project ツール無効 |
| `read_only` | `true` | Postgres read-only role · mutating 操作抑制 |

**Transport:** Supabase Hosted MCP（OAuth · [公式ドキュメント](https://supabase.com/docs/guides/ai-tools/mcp)）

### 1.2 ドキュメント更新

| ファイル | 内容 |
| --- | --- |
| `.cursor/mcp/supabase.md` | Staging 専用 · OAuth · 手動承認手順 |
| `.cursor/mcp/README.md` | サーバー名 · Staging ref · 承認設定 |

---

## 2. Cursor 上での接続手順（ユーザー実施）

1. **Cursor Settings → Cursor Settings → Tools & MCP** を開く
2. **`tasful-supabase-staging`** を有効化
3. 初回: **Supabase OAuth ログイン**（ブラウザ）— Staging project を含む org へアクセス付与
4. **Reload Window** または Cursor 再起動
5. **Agents → Approvals & Execution**
   - **Run Mode:** `Allowlist`
   - **MCP allowlist:** **空**（tool call 毎回手動承認）
6. 確認プロンプトを Agent に送信（下記 §4）

**旧 `tasful-supabase`（Production）は無効 · 設定から削除済み。**

---

## 3. 接続確認結果（本セッション）

| 確認項目 | 結果 |
| --- | --- |
| `mcp.json` Staging URL 設定 | ✅ 完了 |
| Production ref が MCP 設定に存在しない | ✅ 確認（`ddojquacsyqesrjhcvmn` **未記載**） |
| Supabase MCP `list_tables` 実行 | ⏸ **未実施** — 本 Agent セッションに Supabase MCP ツール未ロード（OAuth 要） |
| migration / SQL / Edge deploy | ✅ **未実施** |
| CLI `supabase db query` | ✅ **未実施**（DB 非接触方針） |

**理由:** Remote MCP は Cursor 内 OAuth 完了後にツールが有効化される。設定ファイル投入のみでは Agent から MCP を呼べない。

**ユーザー確認後に記録する項目（テンプレート）:**

```text
[ ] Tools & MCP に tasful-supabase-staging 表示 · 緑/接続済
[ ] list_tables 実行 · tool call 手動承認ダイアログ表示
[ ] 返却 ref が ahlxuyvhzqdqaojiywmu であること
[ ] business_directory_* / tlv 等 Staging テーブルが一覧に含まれる
```

---

## 4. 実行する確認プロンプト

```text
Use Supabase MCP tools. List tables in the Staging project only. Do not modify anything.
```

**期待結果:**

- Staging の `public` / `tlv` 等テーブル一覧が返る
- `apply_migration` · mutating `execute_sql` は **read-only により拒否** またはツール制限
- Production データにはアクセスしない（`project_ref` 固定）

---

## 5. 取得できる範囲（read-only · project-scoped）

| カテゴリ | 例 |
| --- | --- |
| **Database** | `list_tables` · `list_migrations` · `execute_sql`（SELECT のみ） |
| **Debugging** | `get_logs` · `get_advisors` |
| **Development** | `get_project_url` · `generate_typescript_types` |
| **Edge Functions** | `list_edge_functions` · `get_edge_function`（**deploy 禁止運用**） |
| **Docs** | `search_docs` |
| **Account 横断** | **無効**（`project_ref` 指定時） |

詳細: [Supabase MCP Available tools](https://supabase.com/docs/guides/ai-tools/mcp#available-tools)

---

## 6. Production 未接続の確認

| チェック | 結果 |
| --- | --- |
| MCP URL の `project_ref` | `ahlxuyvhzqdqaojiywmu` のみ |
| 旧 npx `--project-ref=ddojquacsyqesrjhcvmn` | **削除済** |
| 本タスクでの Production SQL / link | **なし** |
| 正本 | [docs/supabase-environments.md](../docs/supabase-environments.md) |

---

## 7. 今後の注意点

1. **Production MCP 禁止** — `ddojquacsyqesrjhcvmn` を MCP URL に **追加しない**
2. **CLI link 混同** — ローカル CLI が Production link のままでも、MCP は Staging URL 固定。Staging 作業前は `supabase link --project-ref ahlxuyvhzqdqaojiywmu` を **人手**で実施（本タスクでは未実施）
3. **手動承認維持** — Run Mode `Allowlist` · MCP allowlist 空 · `Run Everything` 禁止
4. **read-only でもプロンプト注入リスクあり** — tool 結果は必ず目視確認（[Supabase Security](https://supabase.com/docs/guides/ai-tools/mcp#security-risks)）
5. **mutating ツール** — read-only でも `deploy_edge_function` 等が一覧に出る場合がある → **実行しない** · 必要なら `features=database,docs` で URL 制限可
6. **OAuth トークン** — PAT を `mcp.json` に **コミットしない**

---

## 8. 変更ファイル一覧

| ファイル | 操作 |
| --- | --- |
| `.cursor/mcp.json` | Production Supabase MCP **削除** · Staging Remote HTTP **追加** |
| `.cursor/mcp/supabase.md` | Staging 正本に更新 |
| `.cursor/mcp/README.md` | §Supabase MCP 運用ルール · 承認設定 |
| `.cursor/mcp/supabase.md` | 運用ルール要約 · 禁止事項追記 |
| `reports/supabase-mcp-cursor-setup.md` | §9 運用手順 · §10 接続確認 |

**触っていないもの:** migration · SQL · Edge · UI · Stripe · `chat-supabase-config.js` · Production DB

---

*OAuth 完了後、§3 チェックリストを埋めて本レポートに追記可能。*

---

## 9. 運用手順（初期設定完了後）

### 9.1 OAuth 接続確認方法

1. **Cursor Settings → Tools & MCP** を開く
2. **`tasful-supabase-staging`** の行を確認
   - **緑 / Connected** または **Needs login** 表示
3. **Needs login** の場合: **Connect** / **Login** → ブラウザで Supabase OAuth
   - Staging org / project `ahlxuyvhzqdqaojiywmu` へのアクセスを付与
4. OAuth 成功後: サーバー名横に **接続済** 表示 · エラーなし
5. Agent チャットで MCP ツール一覧に `list_tables` 等が **表示される** ことを確認

**設定 URL（変更禁止）:**

```text
https://mcp.supabase.com/mcp?project_ref=ahlxuyvhzqdqaojiywmu&read_only=true
```

### 9.2 Cursor 再起動が必要な場合

| 状況 | 手順 |
| --- | --- |
| 初回 OAuth 直後 | **Developer: Reload Window**（`Ctrl+Shift+P` → Reload Window） |
| MCP ツールが Agent に出ない | Reload Window → ダメなら **Cursor 完全終了 → 再起動** |
| OAuth 再認証後 | Reload Window |
| `mcp.json` 変更後 | Reload Window **必須** |

**再起動後:** Tools & MCP で `tasful-supabase-staging` が **有効 · 接続済** であることを再確認。

### 9.3 Tool Call 承認フロー

```text
1. Agent が Supabase MCP ツールを提案
      ↓
2. Cursor が承認ダイアログ表示（Allowlist + MCP allowlist 空）
      ↓
3. 人間がツール名 · 引数 · project ref を目視確認
      ↓
4. Staging ref のみ · read-only 操作のみ → 承認
      ↓
5. 結果を確認（Production データ · mutating 操作でないこと）
```

| 設定 | 値 |
| --- | --- |
| **Cursor Settings → Agents → Approvals & Execution** | |
| Run Mode | **Allowlist** |
| MCP allowlist | **空**（全 MCP tool を毎回確認） |
| Auto-review / Run Everything | **使用しない** |

**承認前チェック:**

- [ ] ツールが `tasful-supabase-staging` 由来
- [ ] URL / 引数に `ddojquacsyqesrjhcvmn` **なし**
- [ ] `list_*` / `get_*` / `search_*` / SELECT 草案のみ
- [ ] `apply_migration` · `deploy_*` · mutating SQL **拒否**

### 9.4 MCP 利用範囲

| 区分 | 内容 |
| --- | --- |
| **許可** | schema / table 一覧 · migration 一覧 · RLS 確認 · logs 参照 · docs 検索 · **SELECT 草案** の作成補助 |
| **禁止** | Migration 実行 · DDL · DML（INSERT/UPDATE/DELETE）· Edge deploy · Production 変更 · project 操作 |

**Phase 1 ポリシー:** MCP は **調査 · 確認 · SQL 作成補助** のみ。実行は **人手 · Runbook · 別タスク**。

### 9.5 Production 利用禁止

| 項目 | ルール |
| --- | --- |
| MCP 登録 | **Staging ref のみ** · Production ref **登録禁止** |
| Production ref | `ddojquacsyqesrjhcvmn` — MCP URL · `mcp.json` · 別サーバー名 **すべて禁止** |
| CLI 混同 | MCP 接続 ≠ `supabase link`。CLI が Production link でも MCP は Staging 固定 |
| データ | Production データの参照 · 変更は **MCP 経由禁止** |

正本: [docs/supabase-environments.md](../docs/supabase-environments.md)

### 9.6 トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| **OAuth 切れ / 401 / Unauthorized** | Tools & MCP → **Disconnect** → 再 **Connect** → OAuth 再ログイン → Reload Window |
| **接続失敗 / MCP server error** | `mcp.json` URL 確認（ref · `read_only=true`）→ Reload → Cursor 再起動 |
| **ツールが Agent に出ない** | サーバー有効化 · OAuth 完了 · Reload Window · `@tasful-supabase-staging` 明示 |
| **Needs login が消えない** | ブラウザ popup ブロック解除 · Supabase org 権限確認 · 別アカウントでログインしていないか確認 |
| **誤って Production 設定** | **即停止** — 当該 MCP エントリ削除 · `mcp.json` を Staging URL のみに復旧 · レポート記録 |
| **mutating ツールが表示される** | read-only でも一覧に出る場合あり → **実行しない** · URL に `features=database,docs` 追加検討 |

**再認証手順（短縮）:**

1. Tools & MCP → `tasful-supabase-staging` → Disconnect  
2. Connect → ブラウザ OAuth  
3. Reload Window  
4. 確認プロンプト（§4）で `list_tables` 再実行  

---

## 10. 接続確認結果（運用ルール整備 · 2026-07-01）

### 10.1 設定ファイル検証（Agent · DB 非接触）

| 確認 | 結果 |
| --- | --- |
| `mcp.json` Staging URL | ✅ `ahlxuyvhzqdqaojiywmu` · `read_only=true` |
| Production ref in `mcp.json` | ✅ **なし** |
| 旧 `tasful-supabase`（Production） | ✅ **削除済** |

### 10.2 MCP `list_tables` 実行（本 Agent セッション）

| 項目 | 結果 |
| --- | --- |
| OAuth 成功可否 | ⏸ **本 Agent セッションでは Supabase MCP ツール未ロード** — OAuth 状態は Cursor UI で要確認 |
| `list_tables` 実行 | ⏸ **未実行**（MCP ツールが Agent コンテキストに接続されていない） |
| Tool Call 手動承認 | ⏸ **要ユーザー確認**（OAuth 後 Agent で確認プロンプト実行時にダイアログ表示） |
| エラー | 設定ファイル検証のみ · **DB/CLI 操作なし** |

**ユーザー実施チェックリスト（初期設定完了後）:**

```text
[x] mcp.json Staging only（Agent 検証済）
[ ] Tools & MCP: tasful-supabase-staging 接続済（緑）
[ ] 確認プロンプト → list_tables → 手動承認ダイアログ
[ ] 返却が Staging tables（public / tlv / business_directory_* 等）
[ ] ddojquacsyqesrjhcvmn への接続なし
```

### 10.3 運用ルール反映

| ファイル | 内容 |
| --- | --- |
| `.cursor/mcp/README.md` | §Supabase MCP 運用ルール 追加 |
| `reports/supabase-mcp-cursor-setup.md` | §9 運用手順 · §10 接続確認 追記 |

**DB / Migration / Edge / Stripe / Cloudflare:** **変更なし**
