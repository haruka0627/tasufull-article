# 協力パートナー管理システム P1 — 本番適用前チェックリスト

| 項目 | 内容 |
|------|------|
| 文書バージョン | 1.0 |
| 制定日 | 2026-06-23 |
| 対象環境 | Supabase 本番（Project: `ddojquacsyqesrjhcvmn`） |
| 対象フェーズ | **P1 のみ** |
| 参照実装結果 | `reports/partner-system-p1-result.md` |
| 参照仕様 | `reports/partner-system-specification.md` |
| 参照計画 | `reports/partner-system-p1-implementation-plan.md` |

> **本書の位置づけ**  
> P1 を Supabase 本番へ安全に適用するための **最終確認資料**。  
> 実装作業は含まない。各項目を担当者が確認し、証跡（日時・実行者・結果）を残すこと。

---

## 適用フロー概要

```
[1] 適用前確認
      ↓
[2] バックアップ・Migration一覧確認
      ↓
[3] Migration 適用（20260623100000_partner_p1_schema.sql）
      ↓
[4] Edge Function デプロイ（5本）
      ↓
[5] JWT / partner_role 設定
      ↓
[6] 開発モード無効化確認（本番）
      ↓
[7] Live 検証 + Builder 手動確認
      ↓
[8] Go / No-Go 判定
```

---

# 1. 対象スコープ

## 1.1 データベース（P1）

| オブジェクト | 種別 | 備考 |
|-------------|------|------|
| `partner_profiles` | テーブル | 台帳マスタ |
| `partner_documents` | テーブル | 書類メタデータ |
| `partner_reviews` | テーブル | 審査履歴（INSERT のみ） |
| `partner_code_seq` | シーケンス | 申請コード採番 |
| `partner_set_updated_at()` | 関数 | updated_at トリガ |
| `generate_partner_code()` | 関数 | `PR-{YYYY}-{NNNN}` 採番 |
| `partner_ops_role()` | 関数 | RLS 用ロール解決 |
| `partner-documents` | Storage バケット | private |

**P1 で作成しないもの（混入防止）**

- `partner_audit_log`
- `partner_antisocial_checks`
- `partner_contracts`
- `partner_referrals` / `partner_evaluations` / `partner_suspensions`

## 1.2 Edge Function（P1）

| Function | メソッド | 権限 |
|----------|----------|------|
| `partner-create` | POST | 匿名可（公開登録フォーム） |
| `partner-list` | GET | admin / ops / reviewer |
| `partner-get` | GET | admin / ops / reviewer |
| `partner-review` | POST | admin / reviewer |
| `partner-document-verify` | POST | admin / reviewer |

## 1.3 フロント（Builder / 登録）

| 画面 | パス |
|------|------|
| 登録一覧 | `/builder/partner-management.html` |
| パートナー詳細 | `/builder/partner-detail.html` |
| IWASHO 登録 | `/iwasho/partner-register.html` |
| TASFUL 登録 | `/partner-register.html` |

---

# 2. 適用前確認

実施者: _______________　日時: _______________

| # | 確認項目 | OK | 備考 |
|---|----------|:--:|------|
| 2.1 | `reports/partner-system-specification.md` を読み、P1 範囲を理解した | □ | |
| 2.2 | `reports/partner-system-p1-result.md` を読み、実装内容・検証結果を確認した | □ | |
| 2.3 | P1 以外の機能（反社・電子契約・案件紹介・評価・停止/解除・通知・外部 API）が **コード・Migration に混入していない** | □ | |
| 2.4 | 本番 DB バックアップを取得した（Dashboard → Database → Backups、または `pg_dump`） | □ | バックアップ ID / 日時: |
| 2.5 | 現在の Migration 一覧を確認した（`supabase migration list` または Dashboard） | □ | 未適用分を把握 |
| 2.6 | Storage 作成計画を確認した（`partner-documents` = private、P1 はメタデータのみ） | □ | |
| 2.7 | RLS 方針を確認した（一般ユーザー直書き込み不可、Edge Function = service_role） | □ | |
| 2.8 | Edge Function 5 本のソース・`supabase/config.toml` の `verify_jwt = false` 設定を確認した | □ | 認証は Function 内で実施 |
| 2.9 | Cloudflare Pages（`deploy/cloudflare/dist`）に P1 フロント資産が同期済みである | □ | |
| 2.10 | 適用担当・ロールバック判断者・連絡先を決定した | □ | |

### P1 混入防止の確認ポイント（コードレビュー用）

- [ ] `partner_audit_log` への参照がない
- [ ] 反社 API・電子契約 API の呼び出しがない
- [ ] Builder 詳細の Coming soon タブが実装のみ（API 未接続）
- [ ] `contracted` ステータスの **更新処理** がない（表示のみ）

### Migration タイムスタンプ注意

`supabase/migrations/` に `20260623100000` 前缀のファイルが複数存在する可能性がある。

- `20260623100000_match_talk_room_bridge.sql`
- `20260623100000_partner_p1_schema.sql`

適用前に **適用順序・未適用状態** を Dashboard / CLI で確認すること。競合がある場合はタイムスタンプ調整または手動適用順の合意が必要。

---

# 3. Migration 適用

## 3.1 適用対象

```
supabase/migrations/20260623100000_partner_p1_schema.sql
```

## 3.2 推奨適用手順

```bash
# 1. リンク確認
npx supabase link --project-ref ddojquacsyqesrjhcvmn

# 2. 差分確認（本番への影響範囲）
npx supabase db diff

# 3. 適用（本番）
npx supabase db push

# または Dashboard SQL Editor でファイル内容をレビュー後に実行
```

## 3.3 Migration 確認項目

実施者: _______________　日時: _______________

| # | 確認項目 | OK | 確認方法 / SQL |
|---|----------|:--:|----------------|
| 3.1 | SQL 構文エラーなし（適用ログに ERROR なし） | □ | CLI / Dashboard ログ |
| 3.2 | `partner_profiles` 作成成功 | □ | `select count(*) from partner_profiles;` |
| 3.3 | `partner_documents` 作成成功 | □ | `select count(*) from partner_documents;` |
| 3.4 | `partner_reviews` 作成成功 | □ | `select count(*) from partner_reviews;` |
| 3.5 | Index 作成成功 | □ | 下記「Index 一覧」参照 |
| 3.6 | `partner_profiles` / `partner_documents` / `partner_reviews` で **RLS 有効** | □ | `select relname, relrowsecurity from pg_class where relname like 'partner_%';` |
| 3.7 | Policy 作成成功（3 テーブル + Storage） | □ | 下記「Policy 一覧」参照 |
| 3.8 | `partner-documents` バケット作成成功 | □ | Dashboard → Storage → Buckets |
| 3.9 | `partner_code_seq` / 採番関数が存在 | □ | `select generate_partner_code();` |
| 3.10 | 既存テーブル・既存 Function に副作用なし | □ | 代表テーブル spot check |

### Index 一覧（期待値）

| テーブル | Index |
|----------|-------|
| `partner_profiles` | `idx_partner_profiles_status`, `_source`, `_created_at`, `_partner_code`, `_business_types` (GIN) |
| `partner_documents` | `idx_partner_documents_partner_id`, `idx_partner_documents_verified` |
| `partner_reviews` | `idx_partner_reviews_partner_reviewed`, `idx_partner_reviews_new_status` |

### Policy 一覧（期待値）

| Policy 名 | 対象 | 操作 |
|-----------|------|------|
| `partner_profiles_ops_select` | `partner_profiles` | SELECT（authenticated + partner_role） |
| `partner_documents_ops_select` | `partner_documents` | SELECT |
| `partner_reviews_ops_select` | `partner_reviews` | SELECT |
| `partner_documents_storage_ops_select` | `storage.objects` | SELECT（bucket = partner-documents） |

### Policy 動作スモーク（任意・推奨）

```sql
-- service_role では全件参照可（RLS バイパス）
-- authenticated + partner_role なし JWT では 0 件（直接 REST 利用時）
```

---

# 4. Edge Function デプロイ

## 4.1 デプロイ対象

```
partner-create
partner-list
partner-get
partner-review
partner-document-verify
```

## 4.2 デプロイコマンド（例）

```bash
npx supabase functions deploy partner-create --project-ref ddojquacsyqesrjhcvmn
npx supabase functions deploy partner-list   --project-ref ddojquacsyqesrjhcvmn
npx supabase functions deploy partner-get    --project-ref ddojquacsyqesrjhcvmn
npx supabase functions deploy partner-review --project-ref ddojquacsyqesrjhcvmn
npx supabase functions deploy partner-document-verify --project-ref ddojquacsyqesrjhcvmn
```

## 4.3 必須 Environment Variables（Supabase Secrets）

| 変数名 | 必須 | 用途 |
|--------|:----:|------|
| `SUPABASE_URL` | ✅ | Supabase プロジェクト URL（通常自動注入） |
| `SUPABASE_ANON_KEY` | ✅ | JWT 検証・CORS 連携 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | DB 書き込み（**秘密・漏洩厳禁**） |
| `PARTNER_ALLOW_DEV_HEADER` | ❌ 本番 | `1` = 開発用 `X-Partner-Role` 許可。**本番では未設定または `0`** |
| `TASU_CORS_ALLOWED_ORIGINS` | 任意 | 本番ドメイン追加時（例: `https://tasful.jp`） |

実施者: _______________　日時: _______________

| # | 確認項目 | OK | 備考 |
|---|----------|:--:|------|
| 4.1 | 5 本すべて deploy 成功 | □ | Dashboard → Edge Functions |
| 4.2 | `SUPABASE_SERVICE_ROLE_KEY` が設定済み | □ | 未設定時は 500 `internal_error` |
| 4.3 | 本番で `PARTNER_ALLOW_DEV_HEADER` が **無効** | □ | Secrets に `1` が入っていないこと |
| 4.4 | `partner-create` — 匿名 POST が 201 を返す | □ | curl 例は §7 参照 |
| 4.5 | `partner-list` — ロールなしは 401/403 | □ | |
| 4.6 | `partner-review` — ops ロールは 403（P1 仕様） | □ | reviewer / admin のみ可 |
| 4.7 | Function ログに想定外の ERROR / 500 がない | □ | Dashboard → Logs |
| 4.8 | CORS — 本番オリジンから OPTIONS / POST が通る | □ | 登録フォーム・Builder |

### 手動スモーク（deploy 直後）

```bash
# partner-create（匿名可）
curl -s -X POST "https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/partner-create" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"source":"tasful","company_name":"Smoke Test","representative_name":"代表","contact_name":"担当","email":"smoke@example.test","phone":"03-0000-0000","address":"東京都","partner_type":"corporation","business_types":["電気工事"],"service_area":"東京都"}'
```

期待: HTTP 201、`{ "ok": true, "partner_id": "...", "partner_code": "PR-...", "status": "pending" }`

---

# 5. JWT / Role 設定

## 5.1 利用ロール

| ロール | 一覧閲覧 | 詳細閲覧 | 審査更新 | 書類確認 |
|--------|:--------:|:--------:|:--------:|:--------:|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `ops` | ✅ | ✅ | ❌ | ❌ |
| `reviewer` | ✅ | ✅ | ✅ | ✅ |
| 一般ユーザー / 匿名 | ❌（list/get） | ❌ | ❌ | ❌ |
| 匿名 | — | — | — | — |
| — | `partner-create` のみ可 | | | |

## 5.2 クレーム付与方針

P1 では JWT の **`app_metadata.partner_role`** を正とする。

- Edge Function: `resolvePartnerAuth()` が `app_metadata.partner_role` を参照
- RLS: `partner_ops_role()` が `auth.jwt() -> 'app_metadata' ->> 'partner_role'` を参照
- 既存 `custom_access_token_hook` は `talk_user_id` 等を付与。**`partner_role` は別途付与が必要**

### 付与方法（いずれかを本番前に決定・実施）

| 方式 | 内容 | 確認 |
|------|------|------|
| A. `auth.users.raw_app_meta_data` | 運営ユーザーに `"partner_role": "admin"` 等を設定し、hook で claims に反映するよう拡張 | □ |
| B. hook 拡張 Migration | `custom_access_token_hook` に `partner_role` 読み取りロジックを追加 | □ |
| C. 運営専用ユーザーのみ手動設定 | 少数アカウントの `raw_app_meta_data` 更新 + hook パススルー | □ |

> **重要**: `partner-api.js` は localhost 開発時に `X-Partner-Role` ヘッダを送るが、**本番では JWT のみで動作すること**。Builder 本番運用時は運営ユーザーの Supabase セッション JWT に `partner_role` が含まれる必要がある。

実施者: _______________　日時: _______________

| # | 確認項目 | OK | 確認方法 |
|---|----------|:--:|----------|
| 5.1 | JWT に `partner_role` が付与される | □ | jwt.io デコード / `/auth/v1/user` |
| 5.2 | `admin` ロールで `partner-list` / `partner-get` 成功 | □ | |
| 5.3 | `ops` ロールで一覧・詳細成功、審査は 403 | □ | |
| 5.4 | `reviewer` ロールで審査・書類確認成功 | □ | |
| 5.5 | `partner_role` なし JWT で `partner-list` が 401/403 | □ | |
| 5.6 | 匿名で `partner-review` / `partner-list` が拒否される | □ | |

### テスト用 JWT 取得（運営アカウントでログイン後）

```bash
# ブラウザ開発者ツール → Application → Supabase session → access_token
# または
curl -s "https://ddojquacsyqesrjhcvmn.supabase.co/auth/v1/user" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $OPS_USER_JWT"
```

---

# 6. 開発モード確認

開発専用機能: **`PARTNER_ALLOW_DEV_HEADER`**

| 環境 | `PARTNER_ALLOW_DEV_HEADER` | `X-Partner-Role` ヘッダ |
|------|---------------------------|---------------------------|
| ローカル / 検証 | `1`（任意） | 使用可 |
| **本番** | **未設定 or `0`** | **使用不可・無視されること** |

実施者: _______________　日時: _______________

| # | 確認項目 | OK | 備考 |
|---|----------|:--:|------|
| 6.1 | 開発環境のみ `PARTNER_ALLOW_DEV_HEADER=1` | □ | |
| 6.2 | **本番 Secrets に `PARTNER_ALLOW_DEV_HEADER=1` がない** | □ | セキュリティ必須 |
| 6.3 | 本番で `X-Partner-Role: reviewer` のみでは API が通らない | □ | ヘッダ偽装対策 |
| 6.4 | 本番 Builder は JWT `partner_role` のみで一覧・審査が動作 | □ | |

---

# 7. Live 検証

## 7.1 実行コマンド

```bash
# 前提: wrangler pages dev または本番 Pages URL
# Migration 適用済み + Edge Function デプロイ済み + JWT 設定済み

export SUPABASE_URL="https://ddojquacsyqesrjhcvmn.supabase.co"
export SUPABASE_ANON_KEY="<anon key>"
export SUPABASE_SERVICE_ROLE_KEY="<service role key>"   # document-verify テスト用
export PARTNER_FUNCTIONS_BASE="$SUPABASE_URL/functions/v1"
export PARTNER_P1_BASE="https://<本番またはプレビュー URL>"   # UI 検証時

PARTNER_P1_LIVE=1 node scripts/verify-partner-system-p1.mjs
```

> Live API 検証時、Function 側で dev header を使う場合のみ  
> `PARTNER_ALLOW_DEV_HEADER=1`（**本番プロジェクトでは検証後に必ず無効化**）

## 7.2 Live 検証確認項目

実施者: _______________　日時: _______________

| # | 確認項目 | OK | 期待結果 |
|---|----------|:--:|----------|
| 7.1 | `partner-create` 成功 | □ | HTTP 201、`partner_id` 返却 |
| 7.2 | `source=iwasho` / `tasful` 保存 | □ | DB `partner_profiles.source` |
| 7.3 | 必須項目未入力で 400 | □ | `validation_error` |
| 7.4 | `partner-list` 成功 | □ | `items[]` 返却 |
| 7.5 | `partner-get` 成功 | □ | `profile` + `reviews` + `documents` |
| 7.6 | `pending → hold` 成功 | □ | `reason_code` 必須（H01–H12） |
| 7.7 | `pending → approved` 成功 | □ | `approved_at` セット |
| 7.8 | `pending → rejected` 成功 | □ | `reason_code` 必須（R01–R12） |
| 7.9 | `partner_reviews` に履歴が残る | □ | INSERT のみ・複数行 |
| 7.10 | `partner-document-verify` 成功 | □ | `verified` / `verified_by` / `verified_at` |
| 7.11 | 権限なし `partner-list` 拒否 | □ | 401 or 403 |
| 7.12 | console error **0** | □ | Playwright 検証 |
| 7.13 | 390px PASS | □ | |
| 7.14 | 768px PASS | □ | |
| 7.15 | 1280px PASS | □ | |

検証結果 JSON: `reports/partner-system-p1-verify.json`（実行後に保管）

---

# 8. Builder 手動確認

実施者: _______________　日時: _______________

環境 URL: _______________

| # | URL | 確認項目 | OK |
|---|-----|----------|:--:|
| 8.1 | `/builder/partner-management.html` | 一覧が API から表示される（`?mock=1` なし） | □ |
| 8.2 | 同上 | `source` / `status` / キーワード絞り込み | □ |
| 8.3 | 同上 | 「詳細確認」→ `partner-detail.html?id={uuid}` へ遷移 | □ |
| 8.4 | `/builder/partner-detail.html?id={uuid}` | 基本情報タブ表示 | □ |
| 8.5 | 同上 | 審査タブ — approve / hold / reject | □ |
| 8.6 | 同上 | 審査後、履歴が更新表示される | □ |
| 8.7 | 同上 | 書類タブ — verified 切替 | □ |
| 8.8 | `/builder/partner-management.html?mock=1` | モック fallback 動作 | □ |
| 8.9 | `/builder/partner-detail.html?mock=1&id=PR-2026-001` | モック詳細表示 | □ |
| 8.10 | Coming soon タブ | 反社・契約等が **未実装のまま** | □ |

登録フォーム（任意・推奨）:

| # | URL | 確認項目 | OK |
|---|-----|----------|:--:|
| 8.11 | `/iwasho/partner-register.html` | 送信 → DB に `source=iwasho` で保存 | □ |
| 8.12 | `/partner-register.html` | 送信 → DB に `source=tasful` で保存 | □ |
| 8.13 | 各フォーム `?mock=1` | モック送信・完了メッセージ | □ |

---

# 9. ロールバック方針

障害発生時は **影響範囲を最小化** し、データ保全を最優先とする。

## 9.1 障害時チェックリスト

| # | 項目 | OK | 担当 |
|---|------|:--:|------|
| 9.1 | Edge Function を停止または前バージョンへロールバック | □ | |
| 9.2 | UI を `?mock=1` 運用へ切替（Builder 一覧・詳細） | □ | |
| 9.3 | 登録フォームを `?mock=1` または一時非公開に切替 | □ | |
| 9.4 | Migration の影響範囲を確認（既存機能への副作用） | □ | |
| 9.5 | `partner_profiles` 等のデータ保全を確認（誤削除・破損なし） | □ | |
| 9.6 | Function ログ・DB ログで原因調査 | □ | |
| 9.7 | 再適用 / 修正適用の Go・No-Go を判断 | □ | |

## 9.2 ロールバック手順（明文化）

### レベル 1 — フロントのみ影響（API エラー・表示不具合）

**目的**: 運営業務を継続しつつ、DB 変更は維持する。

1. Builder 運営者へ `?mock=1` URL を共有  
   - 一覧: `/builder/partner-management.html?mock=1`  
   - 詳細: `/builder/partner-detail.html?mock=1&id=PR-2026-001`
2. 登録フォーム URL に `?mock=1` を付与するか、一時的に「申請受付メンテナンス」表示へ切替
3. Edge Function ログで 4xx/5xx 原因を特定
4. 修正デプロイ後、mock なし URL で再確認

**データ影響**: なし（DB はそのまま）

---

### レベル 2 — Edge Function のみロールバック

**目的**: 誤デプロイ・認証不具合の切り戻し。

1. Dashboard → Edge Functions → 該当 Function → **Previous deployment** へロールバック  
   または Git タグから再デプロイ:
   ```bash
   git checkout <last-known-good> -- supabase/functions/partner-*
   npx supabase functions deploy partner-create ...
   ```
2. Secrets 確認（`SUPABASE_SERVICE_ROLE_KEY` 誤設定の有無）
3. `PARTNER_ALLOW_DEV_HEADER` が本番で有効になっていないか確認
4. Live スモーク（§7）を再実行

**データ影響**: なし（スキーマ変更なし）

---

### レベル 3 — Migration 起因の障害

**目的**: スキーマ変更による既存機能破壊への対応。

> **原則**: 本番 Migration の **DOWN（削除）は最終手段**。必ずバックアップ復元手順と合わせて実施。

1. 影響調査  
   - 新規テーブルのみか、既存オブジェクトの `CREATE OR REPLACE` か  
   - `partner_ops_role()` 等が他ポリシーと競合していないか
2. 軽微な場合 — 補正 Migration を作成・適用（DROP POLICY → 再 CREATE 等）
3. 重大な場合 — **バックアップからの Point-in-Time Recovery**（Supabase Pro 以上）または事前 `pg_dump` からのリストア
4. テーブル削除が必要な場合（**データ消失**）:
   ```sql
   -- 最終手段・承認必須
   drop table if exists public.partner_reviews cascade;
   drop table if exists public.partner_documents cascade;
   drop table if exists public.partner_profiles cascade;
   drop sequence if exists public.partner_code_seq;
   -- 関数・Storage バケットは別途判断
   ```
5. ロールバック後、§2 から再実施

**データ影響**: レベル 3 は `partner_*` データが失われる可能性あり。申請データがある場合は **エクスポート後** に実施。

---

### レベル 4 — JWT / 権限設定の障害

1. `custom_access_token_hook` の変更をロールバック（直前 Migration / 関数定義）
2. 誤った `partner_role` 付与を `auth.users.raw_app_meta_data` から修正
3. 運営ユーザーに再ログイン（トークンリフレッシュ）を依頼
4. §5 のロール別スモークを再実行

---

## 9.3 ロールバック後の運用状態

| コンポーネント | 推奨状態 |
|----------------|----------|
| 登録フォーム | `?mock=1` またはメンテナンス |
| Builder | `?mock=1` で審査 UI 確認のみ |
| Edge Function | 停止 or 前バージョン |
| DB | データ保持（可能な限り） |

---

# 10. Go / No-Go 判定

判定者: _______________　日時: _______________

**すべて YES で本番運用開始可**

| # | Go 条件 | YES | NO | 備考 |
|---|---------|:---:|:---:|------|
| 10.1 | Migration 成功（§3 全項目） | □ | □ | |
| 10.2 | Edge Function 5 本 deploy 成功（§4） | □ | □ | |
| 10.3 | JWT `partner_role` 付与・ロール別動作確認（§5） | □ | □ | |
| 10.4 | Live 検証 PASS（§7、`PARTNER_P1_LIVE=1`） | □ | □ | |
| 10.5 | Builder 手動確認 PASS（§8） | □ | □ | |
| 10.6 | console error **0** | □ | □ | |
| 10.7 | 致命的不具合なし（データ破損・権限抜け・秘密鍵漏洩なし） | □ | □ | |
| 10.8 | 本番で `PARTNER_ALLOW_DEV_HEADER` 無効 | □ | □ | |
| 10.9 | ロールバック手順・担当者の合意 | □ | □ | |

### 判定

- [ ] **Go** — 本番運用開始
- [ ] **No-Go** — 差戻し（理由: _________________________________）

---

# 11. P2 移行条件

P1 本番運用開始後、**P1 が安定稼働してから** P2 に着手する。

## 11.1 P1 安定稼働の定義（着手前提）

| # | 条件 | 目安 |
|---|------|------|
| 11.1.1 | 登録フォームからの本番申請がエラーなく DB 保存される | 1 週間以上 |
| 11.1.2 | Builder 一覧・詳細・審査が運営フローで利用されている | 実運用フィードバックあり |
| 11.1.3 | Live 検証相当の API エラー率が許容範囲 | 5xx なし |
| 11.1.4 | ロールバックが不要だった | 障害インシデントなし |
| 11.1.5 | `partner_reviews` による監査証跡が運用上問題ない | 監査観点で確認 |

## 11.2 P2 着手対象（P1 では未実装）

| 領域 | 主な追加オブジェクト / 機能 |
|------|----------------------------|
| 反社チェック | `partner_antisocial_checks`、反社 API 連携、Builder「反社」タブ |
| 電子契約 | `partner_contracts`、契約送付・締結フロー、Builder「契約」タブ |
| 監査強化 | `partner_audit_log`（書類確認・設定変更の専用証跡） |
| 通知 | 審査結果メール、Builder 通知 |
| Storage 実アップロード | 登録フォーム file → `partner-documents` 署名付き URL |
| ステータス拡張 | `contracted` 更新、停止 / 解除 |

## 11.3 P2 着手前の設計確認ドキュメント

- `reports/partner-anti-social-checklist.md`
- `reports/partner-electronic-contract-operation.md`
- `reports/partner-system-specification.md`（P2 章）

> **明記**: P2 は P1 の Migration・Function・Builder が本番で安定してから着手すること。P1 と同時リリースしない。

---

# 付録 A — 関連ファイル一覧

| 種別 | パス |
|------|------|
| Migration | `supabase/migrations/20260623100000_partner_p1_schema.sql` |
| Shared | `supabase/functions/_shared/partner.ts` |
| API Client | `partner-api.js` |
| 検証 | `scripts/verify-partner-system-p1.mjs` |
| 実装結果 | `reports/partner-system-p1-result.md` |

---

# 付録 B — 証跡記録テンプレート

```
実施日時:
実施者:
環境（本番 / ステージング）:
Migration バージョン:
Function デプロイ SHA:
Live 検証結果（PASS/FAIL）:
Go / No-Go:
署名:
```

---

*本チェックリストは P1 本番適用前の最終確認専用です。適用後の変更は `partner-system-p1-result.md` および本書の改版で管理してください。*
