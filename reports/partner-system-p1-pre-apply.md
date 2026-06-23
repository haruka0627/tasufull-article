# 協力パートナー P1 — 本番適用前確認レポート

| 項目 | 内容 |
|------|------|
| 実施日時 | 2026-06-23 |
| 対象プロジェクト | `ddojquacsyqesrjhcvmn` (tasful-ai) |
| 実施者 | Cursor Agent（ユーザー依頼） |

---

## 1. Migration 重複確認

### 1.1 検出された重複

| ファイル | タイムスタンプ | 状態 |
|----------|---------------|------|
| `20260623100000_match_talk_room_bridge.sql` | `20260623100000` | ローカル存在 |
| ~~`20260623100000_partner_p1_schema.sql`~~ | `20260623100000` | **リネーム済み** |

### 1.2 対応

- `partner_p1_schema` を **`20260630100000_partner_p1_schema.sql`** にリネーム（タイムスタンプ一意化）
- JWT 用 hook 更新を **`20260630100001_partner_p1_auth_hook.sql`** として追加

### 1.3 本番 Migration 履歴

```
supabase_migrations.schema_migrations → 0 件（CLI 未追跡）
```

本番 DB は **手動 / 別経路で構築済み**。`npx supabase db push`（全20件一括）は **実施しない**。

| 方針 | 内容 |
|------|------|
| 適用方法 | P1 対象 SQL のみ `supabase db query --linked -f` で適用 |
| 除外 | 既存適用済みの match / talk 等 migration は再適用しない |
| 根拠 | `transaction_rooms.match_pair_id` 列が本番に存在（talk_room_bridge 適用済み） |

### 1.4 本番 P1 オブジェクト（適用前）

| オブジェクト | 存在 |
|-------------|:----:|
| `partner_profiles` | ❌ |
| `partner_documents` | ❌ |
| `partner_reviews` | ❌ |
| `partner-documents` bucket | ❌ |

---

## 2. バックアップ確認

### 2.1 Supabase バックアップ設定

| 項目 | 値 |
|------|-----|
| Region | Northeast Asia (Tokyo) |
| WALG | **true** |
| PITR | false |
| 自動バックアップ | WALG 有効（物理バックアップ） |

> PITR 無効のため、障害時は Dashboard → Database → Backups からのリストアが主手段。

### 2.2 適用前データインベントリ（本番・読取のみ）

| テーブル | 行数 |
|----------|-----:|
| `profiles` | 4 |
| `match_pairs` | 2 |
| `transaction_rooms` | 14 |
| `listings` | 27 |

`partner_profiles` 適用前: **null（未作成）**

### 2.3 バックアップ判定

| # | 項目 | 結果 |
|---|------|:----:|
| 2.1 | WALG バックアップ有効 | ✅ |
| 2.2 | 適用前インベントリ取得 | ✅ |
| 2.3 | P1 は新規テーブル追加のみ（既存テーブル DROP なし） | ✅ |
| 2.4 | ロールバック手順確認済み（`partner-system-p1-live-checklist.md` §9） | ✅ |

**判定: バックアップ確認 OK — P1 適用可能**

---

## 3. Live 検証準備

### 3.1 環境変数（ローカル `.env`）

| 変数 | 状態 |
|------|:----:|
| `SUPABASE_URL` | 設定済み |
| `SUPABASE_ANON_KEY` | 設定済み |
| `SUPABASE_SERVICE_ROLE_KEY` | 設定済み |

### 3.2 検証コマンド

```bash
# API 検証（本番 Function デプロイ後）
export PARTNER_P1_LIVE=1
export PARTNER_FUNCTIONS_BASE="https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1"
node scripts/verify-partner-system-p1.mjs

# UI 検証（Pages dev または本番 URL）
export PARTNER_P1_BASE="http://127.0.0.1:8788"
```

### 3.3 Edge Function デプロイ対象（適用前: 未デプロイ）

- `partner-create`
- `partner-list`
- `partner-get`
- `partner-review`
- `partner-document-verify`

### 3.4 本番セキュリティ設定

| 設定 | 本番方針 |
|------|----------|
| `PARTNER_ALLOW_DEV_HEADER` | **無効**（検証時のみ一時有効化可） |
| `verify_jwt` | `false`（Function 内で認証） |
| JWT `partner_role` | `20260630100001` hook で `raw_app_meta_data.partner_role` を claims に反映 |

### 3.5 Live 検証準備判定

| # | 項目 | 結果 |
|---|------|:----:|
| 3.1 | 検証スクリプト存在 | ✅ |
| 3.2 | Supabase 認証情報 | ✅ |
| 3.3 | 本番 partner テーブル未作成（クリーン適用） | ✅ |
| 3.4 | ロールバック: `?mock=1` fallback 利用可 | ✅ |

**判定: Live 検証準備 OK**

---

## 4. 適用計画（本番）

| 順序 | 作業 | コマンド / ファイル |
|:----:|------|---------------------|
| 1 | P1 スキーマ適用 | `20260630100000_partner_p1_schema.sql` |
| 2 | Auth hook 更新 | `20260630100001_partner_p1_auth_hook.sql` |
| 3 | Migration 履歴記録 | `schema_migrations` INSERT（2件） |
| 4 | Edge Function デプロイ | 5 本 |
| 5 | Live 検証 | `PARTNER_P1_LIVE=1 node scripts/verify-partner-system-p1.mjs` |

---

## 5. Go / 適用前総合判定

| 区分 | 判定 |
|------|:----:|
| Migration 重複確認 | ✅ 解消済み |
| バックアップ確認 | ✅ OK |
| Live 検証準備 | ✅ OK |
| **本番 P1 適用** | **▶ 実施する** |

---

*次ステップ: 上記 §4 の順で本番適用を実行し、結果を `reports/partner-system-p1-live-apply-result.md` に記録する。*
