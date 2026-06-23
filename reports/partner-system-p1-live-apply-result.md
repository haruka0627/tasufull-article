# 協力パートナー P1 — 本番適用結果レポート

| 項目 | 内容 |
|------|------|
| 実施日時 | 2026-06-23 |
| 対象プロジェクト | `ddojquacsyqesrjhcvmn` (tasful-ai) |
| 事前確認 | `reports/partner-system-p1-pre-apply.md` |
| チェックリスト | `reports/partner-system-p1-live-checklist.md` |

---

## 1. 適用サマリー

| 区分 | 結果 |
|------|:----:|
| Migration 適用 | ✅ 成功 |
| Auth hook 更新 | ✅ 成功 |
| Edge Function デプロイ（5本） | ✅ 成功 |
| Live 検証（`PARTNER_P1_LIVE=1`） | ✅ **53/53 PASS** |
| `PARTNER_ALLOW_DEV_HEADER` 本番無効化 | ✅ unset 済み |
| **本番運用開始** | ✅ **Go** |

---

## 2. 適用前確認（実施済み）

### Migration 重複

- `20260623100000` 重複を検出 → `20260630100000_partner_p1_schema.sql` にリネーム
- 全件 `db push` は **未実施**（本番は手動構築済み・`schema_migrations` 空のため）
- P1 SQL のみ個別適用

### バックアップ

- WALG: 有効 / PITR: 無効
- 適用前インベントリ: profiles=4, match_pairs=2, transaction_rooms=14, listings=27
- P1 は新規テーブル追加のみ（既存 DROP なし）

### Live 検証準備

- `.env` に Supabase 認証情報あり
- 本番 partner オブジェクト未作成を確認後、適用実施

---

## 3. 本番適用内容

### 3.1 Migration

| バージョン | ファイル | 内容 |
|-----------|----------|------|
| `20260630100000` | `partner_p1_schema.sql` | テーブル3、RLS、Storage、採番 |
| `20260630100001` | `partner_p1_auth_hook.sql` | JWT に `partner_role` 反映 |

適用後確認:

| オブジェクト | 状態 |
|-------------|:----:|
| `partner_profiles` | ✅ |
| `partner_documents` | ✅ |
| `partner_reviews` | ✅ |
| `partner-documents` bucket | ✅ |
| RLS (`partner_profiles`) | ✅ enabled |

### 3.2 Edge Functions

| Function | デプロイ |
|----------|:--------:|
| `partner-create` | ✅ |
| `partner-list` | ✅ |
| `partner-get` | ✅ |
| `partner-review` | ✅ |
| `partner-document-verify` | ✅ |

Dashboard: https://supabase.com/dashboard/project/ddojquacsyqesrjhcvmn/functions

### 3.3 Secrets

| Secret | 本番状態 |
|--------|----------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | 既存（自動注入） |
| `PARTNER_ALLOW_DEV_HEADER` | **unset**（検証後に削除済み） |

---

## 4. Live 検証結果

```bash
PARTNER_P1_LIVE=1 node --env-file=.env scripts/verify-partner-system-p1.mjs
```

| 区分 | 結果 |
|------|------|
| 構造チェック | 16 PASS |
| UI（390/768/1280px） | 12 PASS · console error 0 |
| Live API | 11 PASS |
| **合計** | **53/53 PASS** |

検証ログ: `reports/partner-system-p1-verify.json`

### Live API 確認済み項目

- `partner-create`（iwasho / tasful、バリデーション 400）
- `partner-list` / `partner-get`
- 審査遷移: pending → hold / approved / rejected
- `partner_reviews` 履歴永続化
- `partner-document-verify`
- 権限なし拒否（401/403）

> 検証により本番 DB にスモークテスト用 `partner_profiles` レコードが数件作成されています（`@example.test` ドメイン等）。必要に応じて運営画面から整理してください。

---

## 5. 運用開始後の必須作業

### 5.1 運営ユーザーの `partner_role` 付与

Auth hook は `auth.users.raw_app_meta_data.partner_role` を JWT に反映します。  
Builder 本番で API 一覧・審査を使う運営ユーザーに、以下いずれかを設定してください。

```json
{ "partner_role": "admin" }
```

または `"ops"` / `"reviewer"`

設定後、対象ユーザーは **再ログイン**（トークンリフレッシュ）が必要です。

### 5.2 Builder 本番 URL

| 画面 | URL |
|------|-----|
| 一覧 | `/builder/partner-management.html` |
| 詳細 | `/builder/partner-detail.html?id={uuid}` |
| 障害時 fallback | `?mock=1` |

### 5.3 登録フォーム

| 画面 | URL |
|------|-----|
| IWASHO | `/iwasho/partner-register.html` |
| TASFUL | `/partner-register.html` |

`partner-create` 本番接続済み（`?mock=1` でモック送信可）。

---

## 6. ロールバック参照

障害時は `reports/partner-system-p1-live-checklist.md` §9 に従う。

| レベル | 手順 |
|--------|------|
| L1 | UI を `?mock=1` に切替 |
| L2 | Edge Function を前バージョンへロールバック |
| L3 | 補正 Migration またはバックアップリストア |

---

## 7. P2 着手条件

P1 安定稼働（実運用フィードバック・障害なし）後に着手:

- `partner_antisocial_checks` / 反社管理
- `partner_contracts` / 電子契約
- 通知・Storage 実アップロード
- `partner_audit_log`

---

## 8. Go 判定

| 条件 | 結果 |
|------|:----:|
| Migration 成功 | ✅ |
| Function 成功 | ✅ |
| JWT hook 更新 | ✅ |
| Live 検証 PASS | ✅ |
| console error 0 | ✅ |
| 致命的不具合なし | ✅ |
| DEV_HEADER 本番無効 | ✅ |

**判定: Go — 本番運用開始可**

---

*証跡: `reports/partner-system-p1-pre-apply.md` / `reports/partner-system-p1-verify.json`*
