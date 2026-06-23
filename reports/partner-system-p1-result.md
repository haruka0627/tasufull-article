# 協力パートナー管理システム P1 実装結果レポート

| 項目 | 内容 |
|------|------|
| 実施日 | 2026-06-23 |
| 対象フェーズ | P1（最小実装） |
| 参照計画 | `reports/partner-system-p1-implementation-plan.md` |
| 検証スクリプト | `scripts/verify-partner-system-p1.mjs` |

---

## 1. 実装概要

P1 範囲として、協力パートナー登録から審査・書類確認までの縦断スライスを実装した。

```
登録フォーム（IWASHO / TASFUL）
    ↓ partner-create（匿名可）
partner_profiles / partner_documents / partner_reviews
    ↓ partner-list / partner-get（ops以上）
Builder 一覧・詳細
    ↓ partner-review / partner-document-verify（reviewer以上）
審査・書類確認
```

- `?mock=1` 指定時は従来のモック表示・モック送信にフォールバック
- API 未設定時も登録フォームはモック送信で完了表示
- P2 以降（反社・電子契約・案件紹介・評価・停止/解除・自動通知・外部 API）は未実装

---

## 2. 作成 / 修正ファイル一覧

### 新規作成

| パス | 内容 |
|------|------|
| `supabase/migrations/20260623100000_partner_p1_schema.sql` | P1 テーブル・RLS・Storage バケット |
| `supabase/functions/_shared/partner.ts` | 認証・バリデーション・DB ヘルパ |
| `supabase/functions/partner-create/index.ts` | 登録 API |
| `supabase/functions/partner-list/index.ts` | 一覧 API |
| `supabase/functions/partner-get/index.ts` | 詳細 API |
| `supabase/functions/partner-review/index.ts` | 審査 API |
| `supabase/functions/partner-document-verify/index.ts` | 書類確認 API |
| `partner-api.js` | フロント API クライアント |
| `builder/partner-detail.html` | 詳細画面 |
| `builder/partner-detail.js` | 詳細画面ロジック |
| `scripts/verify-partner-system-p1.mjs` | P1 検証スクリプト |
| `reports/partner-system-p1-result.md` | 本レポート |

### 修正

| パス | 内容 |
|------|------|
| `partner-register-form.js` | `partner-create` 連携・エラー表示・`?mock=1` フォールバック |
| `partner-register.css` | フォームエラー表示スタイル |
| `partner-register.html` | `partner-api.js` 読込 |
| `iwasho/partner-register.html` | 同上 |
| `builder/partner-management.html` | API 読込・P1 表記 |
| `builder/partner-management.js` | `partner-list` 連携・詳細ページ遷移・`?mock=1` |
| `supabase/config.toml` | partner 系 Function の `verify_jwt = false` |
| `supabase/functions/_shared/cors.ts` | `X-Partner-Role` ヘッダ許可 |

### deploy/cloudflare/dist 同期

上記フロント資産 + `chat-supabase-config.js` を `deploy/cloudflare/dist/` にコピー済み。

---

## 3. Migration 内容

### テーブル

| テーブル | 役割 |
|----------|------|
| `partner_profiles` | 台帳マスタ。`source`（iwasho/tasful/builder）、`status`（pending/hold/approved/rejected/contracted）、`contracted`（P1 表示のみ） |
| `partner_documents` | 書類メタデータ。`document_type`, `file_url`, `verified`, `verified_by`, `verified_at`, `expires_at` |
| `partner_reviews` | 審査履歴（INSERT のみ）。`action`, `previous_status`, `new_status`, `reason_code`, `checklist_json`, `notes`, `reviewer_id`, `reviewed_at` |

### 作成しないもの（P1）

- `partner_audit_log` — `partner_reviews` で代替

### Storage

- バケット `partner-documents`（private）を migration で登録
- P1 ではアップロード UI はモック。`file_url` は `pending://...` プレースホルダ

### RLS

- `partner_profiles` / `partner_documents` / `partner_reviews`: authenticated かつ `app_metadata.partner_role` が admin/ops/reviewer の SELECT のみ
- 書き込みは Edge Function（service_role）経由

---

## 4. Edge Function 一覧

| Function | メソッド | 権限 | 概要 |
|----------|----------|------|------|
| `partner-create` | POST | 匿名可 | 登録フォーム → `partner_profiles` INSERT、任意で `partner_documents` プレースホルダ |
| `partner-list` | GET | admin / ops / reviewer | 一覧。`source` / `status` / `q` フィルタ |
| `partner-get` | GET | admin / ops / reviewer | 詳細（profile + reviews + documents） |
| `partner-review` | POST | admin / reviewer | approve / hold / reject。H01–H12 / R01–R12 対応 |
| `partner-document-verify` | POST | admin / reviewer | `verified` / `verified_by` / `verified_at` 更新 |

### 開発用認証

Edge Function 環境変数 `PARTNER_ALLOW_DEV_HEADER=1` 時、リクエストヘッダ `X-Partner-Role` / `X-Partner-User-Id` でロール検証（ローカル・検証用）。

本番は JWT `app_metadata.partner_role` を使用。

---

## 5. Builder 画面 URL

| 画面 | URL |
|------|-----|
| 登録一覧 | `/builder/partner-management.html` |
| 一覧（モック） | `/builder/partner-management.html?mock=1` |
| パートナー詳細 | `/builder/partner-detail.html?id={uuid}` |
| 詳細（モック） | `/builder/partner-detail.html?mock=1&id=PR-2026-001` |

### P1 タブ（詳細画面）

- **実装済み**: 基本情報 / 審査 / 書類
- **Coming soon**: 反社 / 契約 / 案件紹介 / 評価 / 期限 / トラブル / 履歴

### 登録フォーム

| 画面 | URL | source |
|------|-----|--------|
| IWASHO | `/iwasho/partner-register.html` | `iwasho` |
| TASFUL | `/partner-register.html` | `tasful` |
| モック送信 | 各 URL に `?mock=1` | — |

---

## 6. 検証結果

### 実行コマンド

```bash
# 静的 + UI（デフォルト）
node scripts/verify-partner-system-p1.mjs

# ライブ API 検証（migration 適用・Function デプロイ後）
PARTNER_P1_LIVE=1 PARTNER_ALLOW_DEV_HEADER=1 node scripts/verify-partner-system-p1.mjs
```

### 2026-06-23 実行結果（ローカル wrangler pages dev :8788）

| 区分 | 結果 |
|------|------|
| ファイル構造 / migration | PASS（16 項目） |
| UI 390 / 768 / 1280px | PASS（12 ページビュー） |
| console error | 0 |
| 合計 | **42 / 42 PASS** |

検証 JSON: `reports/partner-system-p1-verify.json`  
UI 詳細: `reports/partner-system-p1-ui.json`

### ライブ API 検証（要デプロイ）

以下は `PARTNER_P1_LIVE=1` かつ Supabase migration + Edge Function デプロイ後に実行:

- 登録フォームから DB 保存
- source=iwasho / tasful 保存
- 必須項目未入力で 400
- partner-list / partner-get
- pending → hold / approved / rejected
- partner_reviews 履歴
- partner-document-verify
- 権限なし拒否

---

## 7. P1 対象外として残したもの

| 項目 | フェーズ |
|------|----------|
| `partner_audit_log` 専用テーブル | P2 |
| 反社チェック実処理 | P2 |
| 電子契約送付・締結 | P2 |
| 案件紹介管理 | P3 |
| 評価管理 | P3 |
| 停止 / 解除 | P3 |
| 自動通知（メール等） | P2–P3 |
| 外部 API 連携 | P4 |
| 実ファイル Storage アップロード UI | P1.1 |
| `contracted` ステータスの更新 | P2 |
| ops ロールによる審査更新（P1 は閲覧のみ） | 仕様どおり |

---

## 8. P2 への引き継ぎ事項

1. **Migration 適用**: `supabase db push` または Dashboard で `20260623100000_partner_p1_schema.sql` を適用
2. **Edge Function デプロイ**: 5 本 + `PARTNER_ALLOW_DEV_HEADER=1`（開発環境のみ）
3. **JWT カスタムクレーム**: `custom_access_token_hook` に `partner_role` 付与（admin / ops / reviewer）
4. **Storage アップロード**: `partner-create` に signed URL 発行を追加し、フォーム file input と連携
5. **partner_audit_log**: 書類確認・設定変更の監査を専用テーブルへ移行検討
6. **反社チェックタブ**: `partner_antisocial_checks` + 外部 API
7. **電子契約タブ**: `partner_contracts` + ベンダー連携
8. **通知**: 審査結果メール・Builder 通知
9. **本番 CORS / rate limit**: `partner-create` の悪用対策強化

---

## 9. 完了条件チェックリスト

| 条件 | 状態 |
|------|------|
| P1 範囲のみ実装 | ✅ |
| P2 以降機能を混在させない | ✅ |
| `?mock=1` フォールバック | ✅ |
| deploy/cloudflare/dist 同期 | ✅ |
| 検証スクリプト PASS | ✅（42/42） |
| console error 0 | ✅ |
