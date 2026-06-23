# 協力パートナー管理システム P1 実装計画書

| 項目 | 内容 |
|------|------|
| 文書バージョン | 1.0 |
| 制定日 | 2026-06-23 |
| 対象フェーズ | **P1（最小実装）** |
| 親仕様 | `reports/partner-system-specification.md` |
| 関連運用文書 | `partner-operation-management.md` / `partner-review-criteria.md` |
| 現行資産 | `partner-register-form.js` / `builder/partner-management.html`（静的モック） |

---

# 1. P1の目的

## 1.1 P1で実現すること

協力パートナー管理の **最小縦断スライス** を実装し、登録から審査・書類確認までを Supabase 上で完結させる。

```
登録フォーム（IWASHO / TASFUL）
        ↓
Edge Function: partner-create
        ↓
Supabase（partner_profiles / partner_documents）
        ↓
Builder 登録一覧（partner-list）
        ↓
審査待ち一覧・詳細（partner-get）
        ↓
審査結果更新（partner-review）
        ↓
書類確認（partner-document-verify）
```

## 1.2 P1のスコープ外（P2以降）

| 対象外 | 移行先フェーズ |
|--------|---------------|
| 反社チェック実処理（`partner_antisocial_checks`、判定ワークフロー） | P2 |
| 電子契約送付・締結（`partner_contracts`） | P2 |
| 案件紹介管理（`partner_referrals`） | P3 |
| 評価管理（`partner_evaluations`） | P3 |
| 停止 / 解除管理（`partner_suspensions`、terminate） | P3 |
| 自動通知（メール・Builder通知） | P2〜P3 |
| 外部API連携（反社・インボイス・電子契約） | P4 |
| `partner_audit_log` 専用テーブル | P2（P1は `partner_reviews` で履歴代替） |
| 紹介可否自動計算（`partner-recalculate-eligibility`） | P2 |

## 1.3 P1の設計方針

- **テーブルは将来拡張を見据えたカラム定義** とするが、**UI・APIで触る範囲は最小** に絞る
- `partner_profiles` には P2以降用カラムを **NULL許容で先行定義** してもよい（migration 1回で済ませる）
- Builder は現行 `partner-management.html` を **段階的にAPI駆動化**（フォールバック: モック併用可）
- 登録フォームの file input は **P1ではアップロードUIモック可**（DB行は `file_url` プレースホルダまたは後追い）

---

# 2. P1対象テーブル

Migration ファイル案: `supabase/migrations/YYYYMMDDHHMMSS_partner_p1_schema.sql`

共通前提:

- PK: `uuid` default `gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` + トリガ `partner_set_updated_at()`
- 監査: P1では **`partner_reviews` のINSERT履歴** を監査の主ソースとする（専用 audit テーブルは P2）

---

## 2.1 partner_profiles

### 目的

協力パートナー申請の **マスタ台帳**。登録フォーム1件 = 1レコード。審査ステータスの現在値を保持する。

### 必須カラム（P1）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | uuid PK | 内部ID |
| `partner_code` | text UNIQUE NOT NULL | `PR-{YYYY}-{NNNN}` |
| `source` | text NOT NULL | `iwasho` / `tasful` / `builder` |
| `company_name` | text NOT NULL | 会社名・屋号 |
| `representative_name` | text NOT NULL | 代表者名 |
| `contact_name` | text NOT NULL | 担当者名 |
| `email` | text NOT NULL | メール |
| `phone` | text NOT NULL | 電話 |
| `address` | text NOT NULL | 住所 |
| `partner_type` | text NOT NULL | 区分（下記 enum） |
| `business_types` | text[] NOT NULL | 業種（複数） |
| `service_area` | text NOT NULL | 対応エリア |
| `status` | text NOT NULL DEFAULT `pending` | 審査ステータス（P1は4値+表示用contracted） |
| `created_at` | timestamptz NOT NULL | 登録日時 |
| `updated_at` | timestamptz NOT NULL | 更新日時 |

### 任意カラム（P1で保存するが一覧非表示可）

| カラム | 型 | 説明 |
|--------|-----|------|
| `postal_code` | text | 郵便番号 |
| `corporate_number` | text | 法人番号 |
| `website_url` | text | HP |
| `sns_url` | text | SNS |
| `monthly_capacity` | text | 月間対応件数 |
| `available_schedule` | text | 対応曜日・時間帯 |
| `achievements` | text | 主な実績 |
| `invoice_number` | text | インボイス番号 |
| `insurance_status` | text | 保険加入申告 |
| `insurance_personal_limit` | text | 対人補償額 |
| `insurance_property_limit` | text | 対物補償額 |
| `workers_comp_type` | text | 労災申告 |
| `notes` | text | 運用メモ |
| `raw_application` | jsonb DEFAULT `{}` | フォーム全項目スナップショット |
| `approved_at` | timestamptz | 承認日時（approve時セット） |

### P2以降用（P1 migration に含めてよい・常にNULL）

`contract_status`, `contract_progress`, `invoice_status`, `insurance_expiry`, `workers_comp_expiry`, `antisocial_status`, `referral_eligible`, `referral_block_code`, `evaluation_rank`, 集計カラム, `contracted_at`, `suspended_at`, `terminated_at`

### status / enum / CHECK

```sql
-- source
check (source in ('iwasho', 'tasful', 'builder'))

-- partner_type
check (partner_type in (
  'corporation', 'sole_proprietor', 'solo_contractor', 'freelance'
))

-- status（P1更新対象は pending/hold/approved/rejected）
check (status in ('pending', 'hold', 'approved', 'rejected', 'contracted'))
```

### indexes（P1）

| インデックス | 用途 |
|-------------|------|
| `idx_partner_profiles_status` ON (`status`) | 審査待ち一覧 |
| `idx_partner_profiles_source` ON (`source`) | 流入元フィルタ |
| `idx_partner_profiles_created_at` ON (`created_at` DESC) | 登録一覧ソート |
| `idx_partner_profiles_partner_code` ON (`partner_code`) | コード検索 |
| GIN `idx_partner_profiles_business_types` ON (`business_types`) | 業種検索（任意） |

### updated_at

`partner_set_updated_at()` トリガで `UPDATE` 時に自動更新。

### audit前提

- ステータス変更時は **必ず** `partner_reviews` に1行追加
- `partner_profiles.status` は現在値のキャッシュ

---

## 2.2 partner_documents

### 目的

提出書類（保険証券等）の **メタデータ管理**。ファイル本体は Storage `partner-documents`。

### 必須カラム（P1）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | uuid PK | |
| `partner_id` | uuid FK NOT NULL | → partner_profiles.id ON DELETE CASCADE |
| `document_type` | text NOT NULL | 下記 enum |
| `file_url` | text NOT NULL | Storage path または署名付きURL |
| `verified` | boolean NOT NULL DEFAULT false | 確認済みフラグ |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

### 任意カラム（P1）

| カラム | 型 | 説明 |
|--------|-----|------|
| `file_name` | text | 元ファイル名 |
| `file_size` | integer | バイト |
| `verified_by` | text | 確認者 |
| `verified_at` | timestamptz | 確認日時 |
| `expires_at` | date | 有効期限 |
| `notes` | text | |

### document_type / CHECK

```sql
check (document_type in (
  'insurance_policy',        -- 保険証券
  'workers_comp_proof',      -- 労災加入証明
  'construction_license',    -- 建設業許可証
  'qualification',           -- 資格証
  'company_profile',         -- 会社案内
  'registry', 'opening_notice', 'other'  -- P1では未使用可
))
```

### indexes（P1）

| インデックス | 用途 |
|-------------|------|
| `idx_partner_documents_partner_id` ON (`partner_id`) | 詳細の書類一覧 |
| `idx_partner_documents_verified` ON (`partner_id`, `verified`) | 未確認書類フィルタ |

### P1での作成タイミング

| パターン | 説明 |
|----------|------|
| A（推奨） | `partner-create` 時、フォームの file 項目があれば **プレースホルダ行** を作成（`file_url='pending://...'`） |
| B（最小） | P1初期は書類行なし。審査担当が手動登録または P1後半でアップロード連携 |

### audit前提

`partner-document-verify` 実行時に `verified` / `verified_by` / `verified_at` を更新。変更履歴は P2で audit_log へ。

---

## 2.3 partner_reviews

### 目的

**審査操作の履歴**。承認・保留・否認のたびに1行追加（削除・更新しない）。

### 必須カラム（P1）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | uuid PK | |
| `partner_id` | uuid FK NOT NULL | |
| `review_status` | text NOT NULL | 変更後ステータス |
| `review_result` | text NOT NULL | `pass` / `hold` / `reject` |
| `reviewer_id` | text NOT NULL | 審査担当者（JWT sub または運営ID） |
| `reviewed_at` | timestamptz NOT NULL DEFAULT now() | |
| `created_at` | timestamptz NOT NULL | |

### 任意カラム（P1）

| カラム | 型 | 説明 |
|--------|-----|------|
| `review_reason_code` | text | H01〜H12 / R01〜R12 |
| `checklist` | jsonb | 審査基準第9章 YES/NO（簡易版可） |
| `notes` | text | 審査メモ |

### review_status / review_result / CHECK

```sql
check (review_status in ('pending', 'hold', 'approved', 'rejected', 'contracted'))
check (review_result in ('pass', 'hold', 'reject'))
```

| 操作 | review_status | review_result | reason_code例 |
|------|---------------|---------------|---------------|
| 保留 | `hold` | `hold` | H01, H02, … |
| 承認 | `approved` | `pass` | null |
| 否認 | `rejected` | `reject` | R03, R04, … |

### indexes（P1）

| インデックス | 用途 |
|-------------|------|
| `idx_partner_reviews_partner_reviewed` ON (`partner_id`, `reviewed_at` DESC) | 詳細の審査履歴 |
| `idx_partner_reviews_status` ON (`review_status`) | 分析用（任意） |

### audit前提

P1の **唯一の公式監査証跡**。`partner-review` は必ず INSERT のみ。

---

## 2.4 採番（P1）

`partner_code` は DB シーケンスまたは Edge Function 内トランザクションで採番。

```sql
create sequence if not exists partner_code_seq start 1;
-- partner-create 内: 'PR-' || to_char(now(),'YYYY') || '-' || lpad(nextval(...)::text, 4, '0')
```

---

# 3. P1対象Storage

## 3.1 バケット

| バケット名 | 公開 | 用途 |
|-----------|------|------|
| `partner-documents` | **private** | 提出書類 |

## 3.2 P1対象 document_type とフォーム対応

| document_type | フォーム name | P1 |
|---------------|---------------|-----|
| `insurance_policy` | `file_insurance` | 対象 |
| `workers_comp_proof` | `file_workers_comp` | 対象 |
| `construction_license` | `file_construction_license` | 対象 |
| `qualification` | `file_qualification` | 対象 |
| `company_profile` | `file_company_profile` | 対象 |

## 3.3 パス規則

```
partner-documents/{partner_id}/{document_type}/{timestamp}_{sanitized_filename}
```

## 3.4 P1アップロード方針

| 項目 | P1方針 |
|------|--------|
| 登録フォーム | file input UI は **現状維持（モック可）**。送信時はメタデータのみ or スキップ |
| 実ファイルアップロード | **P1後半またはP1.1** で `partner-create` に signed upload URL 発行を追加可 |
| DB | `partner_documents.file_url` に storage path を保存する設計は **先行定義** |
| RLS | バケットは **authenticated ops/reviewer/admin のみ read**。匿名アップロードは signed URL 経由 |

## 3.5 Storage RLS（方針）

- `INSERT`: Edge Function（service_role）のみ
- `SELECT`: ops / reviewer / admin ロール
- 申請者本人の閲覧: P2以降（パートナーポータル）

---

# 4. P1対象Edge Function

配置: `supabase/functions/{name}/index.ts`  
認証: Supabase JWT + ロール検証ヘルパ `requirePartnerRole(roles[])`

---

## 4.1 partner-create

| 項目 | 内容 |
|------|------|
| **目的** | 登録フォームからの新規申請を `partner_profiles` に保存。初期 `partner_reviews`（受付記録）を任意で追加 |
| **メソッド** | POST |
| **権限** | **匿名可**（公開フォーム）または rate limit + CORS。悪用対策: honeypot / 同一email制限は P1.1 |
| **入力** | フォーム全項目 + `source`（hidden） |
| **出力** | `{ partner_id, partner_code, status: "pending" }` |
| **更新テーブル** | `partner_profiles` INSERT。任意: `partner_documents` プレースホルダ、`partner_reviews`（`review_status=pending`, `review_result=hold` は不要・受付ログのみ） |
| **エラー** | 400 バリデーション失敗、409 重複（同一email+company P1.1）、500 DB |

**必須バリデーション**

- `company_name`, `representative_name`, `contact_name`, `email`, `phone`, `address`
- `partner_type`, `business_types`（1件以上）, `service_area`
- `source` in (`iwasho`,`tasful`,`builder`)
- `email` 形式

---

## 4.2 partner-list

| 項目 | 内容 |
|------|------|
| **目的** | Builder 登録一覧・審査待ち一覧のデータ取得 |
| **メソッド** | GET |
| **権限** | `admin`, `ops`, `reviewer` |
| **入力（query）** | `status`, `source`, `q`（キーワード）, `page`, `limit`, `sort`（created_at desc） |
| **出力** | `{ items: PartnerProfileSummary[], total, page }` |
| **更新テーブル** | なし（読取のみ） |
| **エラー** | 401 未認証、403 権限不足 |

**PartnerProfileSummary（P1）**

`id`, `partner_code`, `source`, `company_name`, `partner_type`, `business_types`, `service_area`, `status`, `email`, `phone`, `created_at`, `approved_at`

---

## 4.3 partner-get

| 項目 | 内容 |
|------|------|
| **目的** | パートナー詳細（基本 + 審査履歴 + 書類） |
| **メソッド** | GET |
| **権限** | `admin`, `ops`, `reviewer` |
| **入力** | `partner_id`（path または query） |
| **出力** | `{ profile, reviews[], documents[] }` |
| **更新テーブル** | なし |
| **エラー** | 404 not found、401/403 |

---

## 4.4 partner-review

| 項目 | 内容 |
|------|------|
| **目的** | 審査状態の更新（承認・保留・否認） |
| **メソッド** | POST |
| **権限** | `admin`, `reviewer`（`ops` は P1では閲覧のみ、更新不可） |
| **入力** | `{ partner_id, action: "approve"|"hold"|"reject", review_reason_code?, checklist?, notes? }` |
| **出力** | `{ profile, review }` 更新後 |
| **更新テーブル** | `partner_profiles.status`（+ `approved_at` on approve）、`partner_reviews` INSERT |
| **エラー** | 400 不正遷移（例: rejected→approved）、404、403 |

**P1許可する状態遷移**

```
pending  → hold | approved | rejected
hold     → hold | approved | rejected
approved → （P1では変更不可、エラー）
rejected → （P1では変更不可）
contracted → （P1では更新不可・表示のみ）
```

**トランザクション**

1. 現在 `status` を FOR UPDATE 取得
2. 遷移可否検証
3. `partner_profiles` 更新
4. `partner_reviews` INSERT
5. コミット

---

## 4.5 partner-document-verify

| 項目 | 内容 |
|------|------|
| **目的** | 提出書類の確認済みフラグ更新 |
| **メソッド** | POST |
| **権限** | `admin`, `reviewer` |
| **入力** | `{ document_id, verified: true|false, notes? }` |
| **出力** | `{ document }` |
| **更新テーブル** | `partner_documents.verified`, `verified_by`, `verified_at`, `notes` |
| **エラー** | 404 document、403 |

---

# 5. P1 Builder画面

## 5.1 対象画面

| 画面 | パス | P1作業 |
|------|------|--------|
| 登録一覧 | `/builder/partner-management.html` | MOCK → `partner-list` API |
| 審査待ち | 同一画面タブ or `?status=pending,hold` フィルタ | フィルタ固定ビュー追加 |
| パートナー詳細 | `/builder/partner-detail.html`（新規） | `partner-get` 表示 |

**導線**: `builder-admin/admin-index.html` → 協力パートナー管理（現行維持）

## 5.2 登録一覧（拡張）

| 項目 | P1 |
|------|-----|
| データソース | `partner-list` |
| 列 | 受付日、流入元、partner_code、会社名、区分、業種、エリア、ステータス、メール、操作 |
| フィルタ | ステータス、流入元 |
| 検索 | 会社名・コード・メール |
| 操作 | 「詳細」リンク |

## 5.3 審査待ち一覧

| 項目 | P1 |
|------|-----|
| 表示条件 | `status in (pending, hold)` |
| 追加表示 | 保留理由コード（hold時）、経過日数 |
| 操作 | 詳細へ、クイック承認は **P1では詳細画面内のみ**（誤操作防止） |

## 5.4 パートナー詳細 — P1タブ

### タブ1: 基本情報

- `partner-get.profile` の全フィールド表示
- `raw_application` の折りたたみ表示（デバッグ・審査補助）
- P1: **編集不可**（閲覧のみ）

### タブ2: 審査

- 現在ステータス
- 審査履歴テーブル（`reviews[]`）
- アクション: **承認 / 保留 / 否認** ボタン + 理由コード選択 + メモ
- 簡易チェックリスト（任意・jsonb）

### タブ3: 書類

- `documents[]` 一覧（種別、ファイル名、確認済み、確認者、日時）
- アクション: **確認済みにする / 未確認に戻す**（`partner-document-verify`）
- ファイルプレビュー: signed URL があれば表示、なければ「未アップロード」

### Coming soon タブ（P1）

反社 / 契約 / 案件紹介 / 評価 / 期限 / トラブル / 履歴 — タブは表示し **disabled + 「P2で実装」** ラベル、または非表示

## 5.5 フロント実装方針

| 項目 | 方針 |
|------|------|
| JS | `builder/partner-management-api.js`（新規）で fetch ラッパ |
| 認証 | 既存運営セッション + Supabase anon key で JWT 付与（`auth-current-user.js` 連携調査） |
| フォールバック | `?mock=1` で現行 MOCK_DATA 表示（開発用） |
| deploy | `deploy/cloudflare/dist/builder/` に同期 |

---

# 6. ステータス設計

## 6.1 P1で扱う審査ステータス

| status | 表示名 | P1更新 |
|--------|--------|--------|
| `pending` | 審査待ち | ○（初期値） |
| `hold` | 保留 | ○ |
| `approved` | 承認 | ○ |
| `rejected` | 否認 | ○ |
| `contracted` | 契約済み | **×（表示のみ・手動seed可）** |

## 6.2 審査結果（UIラベル）

| アクション | 結果 | profile.status |
|-----------|------|----------------|
| 承認 | pass | `approved` |
| 保留 | hold | `hold` |
| 否認 | reject | `rejected` |

## 6.3 P1で使う主要理由コード

### 保留（H）— P1でよく使うもの

| コード | 内容 | 使用場面 |
|--------|------|----------|
| H01 | 添付書類不足 | 書類タブで未提出 |
| H02 | 保険証券未提出 | |
| H04 | インボイス番号確認中 | |
| H05 | 実績確認中 | |
| H06 | 電話確認未実施 | |
| H09 | 反社チェック追加確認中 | P1では手動メモ用（実処理はP2） |
| H12 | 労災加入証明待ち | |

### 否認（R）— P1でよく使うもの

| コード | 内容 | 使用場面 |
|--------|------|----------|
| R03 | インボイス未登録 | |
| R04 | 保険未加入 | |
| R06 | 労災未加入 | |
| R07 | 連絡不能 | |
| R10 | 同意事項違反 | |
| R01 | 反社該当 | P2まで手動判断メモ用 |

P1 UI では **よく使うコードをドロップダウン**、その他は `その他（備考）` で対応。全 H01〜H12 / R01〜R12 はバリデーション上は許容。

---

# 7. RLS / 権限

## 7.1 P1ロール

| ロール | 説明 |
|--------|------|
| `admin` | 全操作 |
| `ops` | 一覧・詳細閲覧（P1では審査更新不可） |
| `reviewer` | 閲覧 + 審査更新 + 書類確認 |

JWT: `auth.jwt() -> 'app_metadata' -> 'partner_role'` または既存運営ロールマッピング。

## 7.2 原則

| 主体 | 権限 |
|------|------|
| **一般ユーザー（匿名）** | `partner-create` のみ（自分の申請作成）。profiles 直読取不可 |
| **Builder ops以上** | `partner-list`, `partner-get` |
| **reviewer以上** | `partner-review`, `partner-document-verify` |
| **admin** | 上記すべて + 将来の削除・強制更新 |

## 7.3 RLSポリシー（P1最小）

```sql
-- partner_profiles: 認証済み ops 系のみ SELECT
-- INSERT: service_role のみ（Edge Function 経由）
-- UPDATE: service_role のみ（Edge Function 経由）

alter table public.partner_profiles enable row level security;
alter table public.partner_documents enable row level security;
alter table public.partner_reviews enable row level security;

-- 直接クライアントからの INSERT/UPDATE/DELETE は拒否
-- Builder は Edge Function 経由のみ書き込み
```

## 7.4 登録フォームの権限

- 公開フォーム → `partner-create` は **anon key + Edge Function**（Function 内で service_role 使用）
- CORS: `iwasho` / `tasful` 本番ドメインのみ許可

---

# 8. 実装順序

| 順序 | タスク | 成果物 | 依存 |
|------|--------|--------|------|
| **1** | Migration作成 | `supabase/migrations/*_partner_p1_schema.sql` | — |
| **2** | Storage bucket準備 | `partner-documents` + ポリシー | 1 |
| **3** | Edge: `partner-create` | function + 単体テスト | 1, 2 |
| **4** | フォーム送信をDB保存へ | `partner-register-form.js` 修正 | 3 |
| **5** | Edge: `partner-list` / `partner-get` | functions | 1 |
| **6** | Builder一覧をDB表示 | `partner-management-api.js` + HTML/JS | 5 |
| **7** | Edge: `partner-review` | function | 1 |
| **8** | Builder詳細・審査UI | `partner-detail.html` + JS | 5, 7 |
| **9** | Edge: `partner-document-verify` | function | 1 |
| **10** | Builder書類タブ | detail JS | 8, 9 |
| **11** | P1検証スクリプト | `scripts/verify-partner-p1.mjs` | 4〜10 |
| **12** | 実装結果レポート | `reports/partner-system-p1-implementation-result.md` | 11 |
| **13** | dist同期 | `deploy/cloudflare/dist/` | 4, 6, 8 |

**並行可能**: 5と7、9は 6の後でも可（モックで一覧先行）

**推奨マイルストーン**

- **M1（タスク1-4）**: フォーム → DB 保存まで
- **M2（タスク5-6）**: Builder 一覧表示
- **M3（タスク7-8）**: 審査更新
- **M4（タスク9-12）**: 書類確認 + 検証完了

---

# 9. 検証項目

検証スクリプト: `scripts/verify-partner-p1.mjs`（API + 任意で Playwright）

## 9.1 API / DB

| # | 検証項目 | 期待結果 |
|---|----------|----------|
| 1 | 登録フォームからDB保存 | `partner_profiles` に1行、status=pending |
| 2 | source=iwasho 保存 | source 列が `iwasho` |
| 3 | source=tasful 保存 | source 列が `tasful` |
| 4 | 必須項目未入力 | 400 エラー、DB行なし |
| 5 | business_types 空 | 400 エラー |
| 6 | partner-list | 登録件が返る |
| 7 | partner-get | profile + reviews + documents |
| 8 | pending → hold | status=hold、reviews に1行、reason_code 記録 |
| 9 | pending → approved | status=approved、approved_at 設定 |
| 10 | pending → rejected | status=rejected |
| 11 | rejected → approved | 400（不正遷移） |
| 12 | partner-document-verify | verified=true、verified_at 設定 |
| 13 | 権限なし（ops が review） | 403 |
| 14 | 未認証で list | 401 |

## 9.2 UI（実装後・別途UIレビュー前のスモーク）

| # | 検証項目 |
|---|----------|
| 15 | Builder一覧にDBデータ表示 |
| 16 | 詳細画面で審査操作可能 |
| 17 | 390 / 768 / 1280px 表示崩れなし |
| 18 | console error 0 |

## 9.3 回帰

| # | 検証項目 |
|---|----------|
| 19 | 既存 `partner-register-form.js` モック送信（API未設定時）が壊れない |
| 20 | `partner-management.html?mock=1` で従来モック表示 |

---

# 10. 完了条件

以下をすべて満たした時点で **P1完了** とする。

| # | 完了条件 |
|---|----------|
| 1 | 登録フォーム（IWASHO / TASFUL）が Supabase に保存される |
| 2 | Builder で登録一覧を DB データから確認できる |
| 3 | Builder で審査状態（承認・保留・否認）を更新できる |
| 4 | 審査履歴が `partner_reviews` に残る |
| 5 | 書類の確認状態を `partner-document-verify` で変更できる |
| 6 | RLS / 権限が最低限機能（匿名は create のみ、reviewer が審査更新） |
| 7 | P2 テーブル（antisocial, contracts 等）を **破壊せず** 追加できる migration 構成 |
| 8 | `scripts/verify-partner-p1.mjs` が pass |
| 9 | `reports/partner-system-p1-implementation-result.md` に結果記載 |

## 10.1 P2への引き継ぎ事項（P1完了時に文書化）

- `partner_antisocial_checks` 追加 migration
- `antisocial_status` の更新フロー
- `partner_contracts` + 契約画面
- `partner_audit_log` 導入（reviews と併用）
- 登録フォームの **実ファイルアップロード** 完成
- `partner-create` レート制限・重複チェック

---

## 改訂履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| 1.0 | 2026-06-23 | 初版。partner-system-specification.md P1節の詳細化 |

---

## 関連ドキュメント

| 文書 | 関係 |
|------|------|
| `reports/partner-system-specification.md` | 全体仕様・全テーブル定義 |
| `reports/partner-operation-management.md` | 運用ルール・画面案 |
| `reports/partner-review-criteria.md` | 審査ステータス・H/Rコード |
| `reports/partner-register-implementation-result.md` | 現行フォーム・モック |
