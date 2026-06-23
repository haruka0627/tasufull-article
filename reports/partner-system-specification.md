# 協力パートナー管理システム 実装仕様書（IWASHO / TASFUL 共通）

| 項目 | 内容 |
|------|------|
| 文書バージョン | 1.0 |
| 制定日 | 2026-06-23 |
| ステータス | **実装前最終仕様（Draft for Implementation）** |
| 技術スタック | Supabase（PostgreSQL + Storage + Edge Functions）/ Builder Admin（静的→SPA化） |
| 関連運用文書 | `partner-review-criteria.md` / `partner-anti-social-checklist.md` / `partner-electronic-contract-operation.md` / `partner-operation-management.md` |
| 現行モック | `/builder/partner-management.html` |

---

# 1. 対象システム

## 1.1 名称

**協力パートナー管理システム**（Partner Management System / PMS）

## 1.2 対象プラットフォーム

| プラットフォーム | 役割 |
|-----------------|------|
| **IWASHO** | 登録フォーム（`/iwasho/partner-register.html`）、IWASHO向け契約 |
| **TASFUL** | 登録フォーム（`/partner-register.html`）、TASFUL向け契約 |
| **Builder** | 運営管理画面（審査・反社・契約・紹介・停止・解除） |

## 1.3 システム目的

| 機能領域 | 説明 |
|----------|------|
| 登録管理 | Webフォーム申請の受付・台帳化 |
| 審査管理 | 承認・保留・否認ワークフロー |
| 反社管理 | 反社チェック記録・判定 |
| 契約管理 | 電子契約送付・締結・期限 |
| 案件紹介管理 | 紹介履歴・受注・完了 |
| 更新期限管理 | 保険・労災・許可・インボイス |
| 停止管理 | 一時停止・解除 |
| 解除管理 | 契約終了・再登録可否 |

## 1.4 アーキテクチャ概要

```
[登録フォーム IWASHO/TASFUL]
        │ POST (将来)
        ▼
[Edge Function: partner-create]
        │
        ▼
[Supabase DB]  ←── [Edge Functions: review / antisocial / contract / …]
        │
        ▼
[Builder Admin UI]  ──→  [Storage: 書類・契約PDF]
        │
        ▼
[通知] メール / Builder通知（将来）
```

## 1.5 非機能要件（概要）

| 項目 | 方針 |
|------|------|
| 認証 | Builder Admin は既存運営認証 + Supabase JWT（`ops` ロール） |
| 監査 | 全ステータス変更を `partner_audit_log` に記録 |
| 個人情報 | RLS によるアクセス制御、保管期間は契約終了後5年 |
| 可用性 | P1 は手動フォールバック可（現行静的モックと並行運用） |

---

# 2. Supabaseテーブル設計

スキーマ: `public`  
命名: `snake_case`、PK は `uuid`（`gen_random_uuid()`）、コード類は `text` + CHECK 制約  
共通: `created_at timestamptz default now()`, `updated_at timestamptz default now()` + トリガ `partner_set_updated_at()`

## 2.1 ER概要

```
partner_profiles (1)
  ├── partner_documents (N)
  ├── partner_reviews (N)
  ├── partner_antisocial_checks (N)
  ├── partner_contracts (N)
  ├── partner_referrals (N)
  ├── partner_evaluations (N)
  ├── partner_incidents (N)
  ├── partner_suspensions (N)      … 補助テーブル
  ├── partner_expiry_items (N)     … 補助テーブル
  └── partner_audit_log (N)        … 補助テーブル
```

---

## 2.2 partner_profiles

協力パートナー台帳マスタ。1申請 = 1レコード。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | 内部ID |
| `partner_code` | `text` | NOT NULL UNIQUE | 表示用ID。例: `PR-2026-0001` |
| `source` | `text` | NOT NULL | `iwasho` / `tasful` / `builder` |
| `company_name` | `text` | NOT NULL | 会社名・屋号 |
| `representative_name` | `text` | NOT NULL | 代表者名 |
| `contact_name` | `text` | NOT NULL | 担当者名 |
| `email` | `text` | NOT NULL | メール |
| `phone` | `text` | NOT NULL | 電話 |
| `postal_code` | `text` | | 郵便番号 |
| `address` | `text` | NOT NULL | 住所 |
| `partner_type` | `text` | NOT NULL | `corporation` / `sole_proprietor` / `solo_contractor` / `freelance` |
| `corporate_number` | `text` | | 法人番号（法人のみ） |
| `website_url` | `text` | | HP URL |
| `sns_url` | `text` | | SNS URL |
| `business_types` | `text[]` | NOT NULL DEFAULT '{}' | 業種（複数） |
| `service_area` | `text` | NOT NULL | 対応エリア |
| `monthly_capacity` | `text` | | 月間対応可能件数 |
| `available_schedule` | `text` | | 対応曜日・時間帯 |
| `achievements` | `text` | | 主な実績 |
| `status` | `text` | NOT NULL DEFAULT 'pending' | 審査ステータス（第3章） |
| `contract_status` | `text` | | 契約有効性: `active` / `suspended` / `terminated`（未契約時 NULL） |
| `contract_progress` | `text` | | 契約進捗: `not_sent` / `sent` / `viewed` / `awaiting_signature` / `completed` / `declined` |
| `invoice_number` | `text` | | T+13桁 |
| `invoice_status` | `text` | DEFAULT 'checking' | `valid` / `checking` / `cancelled` / `expired` |
| `insurance_status` | `text` | | `joined` / `not_joined` / `planned` |
| `insurance_expiry` | `date` | | 保険満了日 |
| `insurance_personal_limit` | `text` | | 対人補償額 |
| `insurance_property_limit` | `text` | | 対物補償額 |
| `workers_comp_type` | `text` | | `corporate` / `solo_special` / `not_joined` |
| `workers_comp_expiry` | `date` | | 労災確認・更新期限 |
| `antisocial_status` | `text` | DEFAULT 'unchecked' | `unchecked` / `clear` / `review` / `hit`（キャッシュ） |
| `referral_eligible` | `boolean` | NOT NULL DEFAULT false | 案件紹介可否（計算キャッシュ） |
| `referral_block_code` | `text` | | N01〜N12 |
| `evaluation_rank` | `text` | | `S` / `A` / `B` / `C` / `suspend_review` |
| `referral_count` | `integer` | DEFAULT 0 | 紹介回数キャッシュ |
| `order_count` | `integer` | DEFAULT 0 | 受注回数キャッシュ |
| `trouble_count` | `integer` | DEFAULT 0 | トラブル件数キャッシュ |
| `last_referral_at` | `date` | | 最終紹介日 |
| `last_active_at` | `date` | | 最終稼働日 |
| `approved_at` | `timestamptz` | | 審査承認日時 |
| `contracted_at` | `timestamptz` | | 契約締結日時 |
| `suspended_at` | `timestamptz` | | 直近停止日時 |
| `terminated_at` | `timestamptz` | | 解除日時 |
| `notes` | `text` | | 運用メモ |
| `raw_application` | `jsonb` | DEFAULT '{}' | フォーム生データ（将来の項目追加用） |
| `created_at` | `timestamptz` | NOT NULL | 登録日時 |
| `updated_at` | `timestamptz` | NOT NULL | 更新日時 |

**インデックス**

- `idx_partner_profiles_status` ON (`status`)
- `idx_partner_profiles_contract_status` ON (`contract_status`)
- `idx_partner_profiles_source` ON (`source`)
- `idx_partner_profiles_referral_eligible` ON (`referral_eligible`)
- `idx_partner_profiles_insurance_expiry` ON (`insurance_expiry`)
- `GIN idx_partner_profiles_business_types` ON (`business_types`)

**CHECK制約（代表）**

```sql
check (source in ('iwasho', 'tasful', 'builder'))
check (status in ('pending', 'hold', 'approved', 'rejected', 'contracted'))
check (contract_status is null or contract_status in ('active', 'suspended', 'terminated'))
```

---

## 2.3 partner_documents

提出書類・添付ファイル管理。Storage パスと連携。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | |
| `partner_id` | `uuid` | NOT NULL FK → partner_profiles | |
| `document_type` | `text` | NOT NULL | 下表参照 |
| `file_url` | `text` | NOT NULL | Storage 公開URLまたは署名付きパス |
| `file_name` | `text` | | 元ファイル名 |
| `file_size` | `integer` | | バイト |
| `verified` | `boolean` | NOT NULL DEFAULT false | 確認済み |
| `verified_by` | `text` | | 確認者（user_id または氏名） |
| `verified_at` | `timestamptz` | | 確認日時 |
| `expires_at` | `date` | | 書類の有効期限 |
| `notes` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | |
| `updated_at` | `timestamptz` | NOT NULL | |

**document_type 一覧**

| 値 | 説明 |
|----|------|
| `insurance_policy` | 保険証券 |
| `workers_comp_proof` | 労災加入証明 |
| `construction_license` | 建設業許可証 |
| `qualification` | 資格証 |
| `company_profile` | 会社案内 |
| `registry` | 登記情報 |
| `opening_notice` | 開業届 |
| `other` | その他 |

**インデックス**: `(partner_id)`, `(document_type)`, `(expires_at)`

---

## 2.4 partner_reviews

審査履歴。ステータス変更のたびに1行追加（履歴型）。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | |
| `partner_id` | `uuid` | NOT NULL FK | |
| `review_status` | `text` | NOT NULL | `pending` / `hold` / `approved` / `rejected` / `contracted` |
| `review_result` | `text` | | `pass` / `hold` / `reject` |
| `review_reason_code` | `text` | | H01〜H12 / R01〜R12 |
| `reviewer_id` | `text` | NOT NULL | 審査担当者ID |
| `reviewed_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `checklist` | `jsonb` | DEFAULT '{}' | 審査基準第9章 YES/NO |
| `notes` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | |

**インデックス**: `(partner_id, reviewed_at DESC)`, `(review_status)`

---

## 2.5 partner_antisocial_checks

反社チェック記録。実施のたびに1行追加。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | |
| `partner_id` | `uuid` | NOT NULL FK | |
| `result` | `text` | NOT NULL | `clear` / `review` / `hit` |
| `result_code` | `text` | | A01〜A08（要確認）/ B01〜B06（該当） |
| `checked_by` | `text` | NOT NULL | 担当者 |
| `checked_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `check_methods` | `text[]` | DEFAULT '{}' | `manual_search` / `phone` / `sns` / `registry` / `api` |
| `evidence_url` | `text` | | 証跡URL（改行区切り可） |
| `checklist` | `jsonb` | DEFAULT '{}' | 反社チェックシート YES/NO |
| `api_inquiry_id` | `text` | | 将来: 外部API照会ID |
| `notes` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | |

**インデックス**: `(partner_id, checked_at DESC)`, `(result)`

---

## 2.6 partner_contracts

契約管理。1パートナーに複数契約（更新・覚書）を想定。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | |
| `partner_id` | `uuid` | NOT NULL FK | |
| `contract_number` | `text` | NOT NULL UNIQUE | `CNT-IW-2026-0001` |
| `contract_type` | `text` | NOT NULL | `iwasho` / `tasful` |
| `contract_status` | `text` | NOT NULL | `not_sent` / `sent` / `viewed` / `awaiting_signature` / `completed` / `declined` |
| `validity_status` | `text` | | `active` / `suspended` / `terminated` |
| `sent_at` | `timestamptz` | | 送付日時 |
| `sent_by` | `text` | | 送付担当者 |
| `viewed_at` | `timestamptz` | | 閲覧日時 |
| `signed_at` | `timestamptz` | | 締結日時 |
| `expires_at` | `date` | | 契約満了・更新期限 |
| `contract_file_url` | `text` | | 署名済みPDF Storage URL |
| `storage_path` | `text` | | Storage 内部パス |
| `external_contract_id` | `text` | | 電子契約サービスID（将来） |
| `termination_code` | `text` | | T01〜T10（解除時） |
| `notes` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | |
| `updated_at` | `timestamptz` | NOT NULL | |

**インデックス**: `(partner_id)`, `(contract_status)`, `(signed_at)`

---

## 2.7 partner_referrals

案件紹介管理。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | |
| `partner_id` | `uuid` | NOT NULL FK | |
| `referral_code` | `text` | UNIQUE | `REF-2026-00123` |
| `referral_date` | `date` | NOT NULL | 紹介日 |
| `project_id` | `text` | NOT NULL | 案件ID |
| `project_type` | `text` | | 案件種別 |
| `project_area` | `text` | | 案件エリア |
| `referrer_id` | `text` | | 紹介担当者 |
| `result` | `text` | NOT NULL DEFAULT 'pending' | `pending` / `accepted` / `declined` / `no_response` / `matched` / `lost` / `completed` / `cancelled` |
| `accepted` | `boolean` | DEFAULT false | 受諾 |
| `order_received` | `boolean` | DEFAULT false | 受注 |
| `completed` | `boolean` | DEFAULT false | 完了 |
| `trouble_flag` | `boolean` | DEFAULT false | トラブル発生 |
| `decline_reason` | `text` | | 辞退理由 |
| `notes` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | |
| `updated_at` | `timestamptz` | NOT NULL | |

**インデックス**: `(partner_id, referral_date DESC)`, `(project_id)`, `(result)`

---

## 2.8 partner_evaluations

稼働評価。評価実施のたびに1行（最新を profiles.evaluation_rank に反映）。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | |
| `partner_id` | `uuid` | NOT NULL FK | |
| `evaluation_period` | `text` | | 例: `2026-Q2` |
| `communication_score` | `smallint` | | 連絡速度 1〜5 |
| `estimate_score` | `smallint` | | 見積対応 1〜5 |
| `quality_score` | `smallint` | | 施工品質 1〜5 |
| `customer_score` | `smallint` | | 顧客対応 1〜5 |
| `schedule_score` | `smallint` | | 納期遵守 1〜5 |
| `report_score` | `smallint` | | 報告品質 1〜5 |
| `trouble_score` | `smallint` | | トラブル率（逆評価）1〜5 |
| `total_score` | `numeric(3,2)` | | 総合平均 |
| `rank` | `text` | NOT NULL | `S` / `A` / `B` / `C` / `suspend_review` |
| `evaluator_id` | `text` | | 評価者 |
| `notes` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | |

**CHECK**: 各 score は 1〜5

---

## 2.9 partner_incidents

クレーム・トラブル管理。

| カラム | 型 | NULL | 説明 |
|--------|-----|------|------|
| `id` | `uuid` | PK | |
| `partner_id` | `uuid` | NOT NULL FK | |
| `incident_code` | `text` | UNIQUE | `TRB-2026-0042` |
| `referral_id` | `uuid` | FK → partner_referrals | 関連紹介（任意） |
| `project_id` | `text` | | 案件ID |
| `severity` | `text` | NOT NULL | `low` / `medium` / `high` / `critical` |
| `title` | `text` | NOT NULL | 件名 |
| `detail` | `text` | NOT NULL | 内容 |
| `responsibility` | `text` | | `partner` / `company` / `both` / `unknown` |
| `status` | `text` | NOT NULL DEFAULT 'open' | `open` / `investigating` / `in_progress` / `resolved` |
| `prevention` | `text` | | 再発防止策 |
| `occurred_at` | `date` | NOT NULL | 発生日 |
| `resolved_at` | `date` | | 対応完了日 |
| `handler_id` | `text` | | 対応担当者 |
| `notes` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | |
| `updated_at` | `timestamptz` | NOT NULL | |

---

## 2.10 補助テーブル（推奨）

### partner_suspensions

| カラム | 説明 |
|--------|------|
| `id`, `partner_id`, `suspension_code` (S02〜S10), `suspended_at`, `suspended_by`, `lifted_at`, `lifted_by`, `notes` |

### partner_expiry_items

| カラム | 説明 |
|--------|------|
| `id`, `partner_id`, `item_type` (`insurance`/`workers_comp`/`license`/`qualification`/`contract`/`invoice`), `expires_at`, `alert_stage`, `last_notified_at` |

### partner_audit_log

| カラム | 説明 |
|--------|------|
| `id`, `partner_id`, `action`, `actor_id`, `before_json`, `after_json`, `created_at` |

### partner_notifications

| カラム | 説明 |
|--------|------|
| `id`, `partner_id`, `notification_type`, `channel`, `recipient`, `sent_at`, `status`, `payload jsonb` |

---

## 2.11 Storage バケット

| バケット | 用途 | アクセス |
|----------|------|----------|
| `partner-documents` | 保険証券・許可証等 | RLS: ops以上のみ |
| `partner-contracts` | 署名済み契約PDF | RLS: ops以上のみ |

パス規則: `{partner_id}/{document_type}/{timestamp}_{filename}`

---

## 2.12 採番（DB関数またはEdge Function）

```sql
-- 例: partner_code 採番
-- PR-{year}-{4桁連番} を partner_profiles_partner_code_seq から生成
```

Edge Function `partner-create` 内でトランザクション採番を推奨。

---

# 3. ステータス設計

## 3.1 審査ステータス（partner_profiles.status）

| 値 | 表示名 | 説明 | 遷移元 | 遷移先 |
|----|--------|------|--------|--------|
| `pending` | 審査待ち | 登録直後 | — | hold, approved, rejected |
| `hold` | 保留 | 書類不足・確認中 | pending, hold | pending, approved, rejected |
| `approved` | 承認 | 審査合格・契約待ち | pending, hold | contracted, rejected |
| `rejected` | 否認 | 登録不可 | pending, hold, approved | — |
| `contracted` | 契約済み | 電子契約完了 | approved | （contract_status で運用） |

## 3.2 契約有効性（partner_profiles.contract_status）

| 値 | 表示名 | 説明 |
|----|--------|------|
| `active` | 有効 | 案件紹介可（他条件OK時） |
| `suspended` | 停止 | 一時停止・紹介不可 |
| `terminated` | 解除 | 契約終了・紹介不可 |

未契約時は `NULL`。

## 3.3 契約進捗（partner_profiles.contract_progress / partner_contracts.contract_status）

`not_sent` → `sent` → `viewed` → `awaiting_signature` → `completed` | `declined`

## 3.4 反社判定（partner_profiles.antisocial_status）

`unchecked` → `clear` | `review` | `hit`

## 3.5 案件紹介可否（計算ルール）

`partner_recalculate_eligibility(partner_id)` 関数（または Edge Function）で更新:

```
referral_eligible = true WHEN
  status = 'contracted'
  AND contract_status = 'active'
  AND antisocial_status = 'clear'
  AND invoice_status = 'valid'
  AND insurance_expiry >= current_date
  AND workers_comp_expiry >= current_date (または業種上不要)
  AND evaluation_rank != 'suspend_review'
```

否認時は `referral_block_code` を優先順位（N07 > N06 > …）で設定。

---

# 4. Builder管理画面設計

ベースURL: `/builder/partner-*`（Builder Admin 配下）  
認証: 運営ロール必須。既存 `builder-admin/admin-index.html` から導線。

## 4.1 メニュー構成

```
協力パートナー管理
├ 登録一覧          /builder/partner-management.html（現行拡張）
├ 審査待ち          /builder/partner-reviews.html
├ 反社確認          /builder/partner-antisocial.html
├ 契約管理          /builder/partner-contracts.html
├ 案件紹介管理      /builder/partner-referrals.html
├ 更新期限管理      /builder/partner-expiries.html
├ 停止管理          /builder/partner-suspensions.html
├ 解除履歴          /builder/partner-terminations.html
└ トラブル管理      /builder/partner-incidents.html
```

詳細: `/builder/partner-detail.html?id={uuid}`

---

## 4.2 登録一覧

| 項目 | 内容 |
|------|------|
| **一覧項目** | 登録日、流入元、partner_code、会社名、区分、業種、対応エリア、審査ステータス、契約状態、反社、インボイス、保険期限、案件紹介可否、評価ランク |
| **フィルター** | 流入元、審査ステータス、契約状態、紹介可否、反社判定、評価ランク |
| **検索** | 会社名、代表者、担当者、メール、電話、partner_code（部分一致） |
| **操作** | 詳細へ、CSVエクスポート（将来）、一括期限アラート（将来） |
| **API** | `GET /functions/v1/partner-list` |

---

## 4.3 審査待ち

| 項目 | 内容 |
|------|------|
| **表示対象** | `status IN ('pending', 'hold')` |
| **一覧項目** | 登録日、partner_code、会社名、区分、業種、ステータス、保留理由コード、担当者、経過日数 |
| **フィルター** | ステータス（pending/hold）、流入元、保留理由コード、担当者未割当 |
| **検索** | 会社名、代表者 |
| **操作** | 審査開始、承認、保留、否認、チェックリスト入力、書類確認 |
| **API** | `POST /functions/v1/partner-review` |

---

## 4.4 反社確認

| 項目 | 内容 |
|------|------|
| **表示対象** | `antisocial_status IN ('unchecked', 'review')` または全件 |
| **一覧項目** | 会社名、代表者、反社判定、最終チェック日、担当者、要確認コード |
| **フィルター** | 判定（unchecked/review/clear/hit）、流入元、チェック日範囲 |
| **検索** | 会社名、代表者 |
| **操作** | チェック記録票入力、判定更新（clear/review/hit）、証跡URL登録 |
| **API** | `POST /functions/v1/partner-antisocial-review` |

---

## 4.5 契約管理

| 項目 | 内容 |
|------|------|
| **表示対象** | `status IN ('approved', 'contracted')` |
| **一覧項目** | 会社名、承認日、契約番号、契約進捗、送付日、締結日、満了日、催促回数 |
| **フィルター** | 契約進捗、契約種別（iwasho/tasful）、締結日範囲、未送付のみ |
| **検索** | 会社名、契約番号 |
| **操作** | 送付記録、リマインド記録、締結完了、失効、契約PDFアップロード |
| **API** | `POST /functions/v1/partner-contract-update` |

---

## 4.6 案件紹介管理

| 項目 | 内容 |
|------|------|
| **一覧項目** | 紹介日、パートナー名、案件ID、種別、エリア、結果、受注、完了、トラブル |
| **フィルター** | 結果、受注有無、トラブル有無、紹介日範囲 |
| **検索** | パートナー名、案件ID |
| **操作** | 新規紹介（`referral_eligible=true` のみ）、結果更新、トラブル起票 |
| **制御** | 紹介不可パートナーは新規ボタン disabled + Nコード表示 |
| **API** | `POST /functions/v1/partner-referral-create` |

---

## 4.7 更新期限管理

| 項目 | 内容 |
|------|------|
| **一覧項目** | 会社名、保険期限、労災期限、許可期限、インボイス状態、残日数、アラート段階 |
| **フィルター** | 期限切れ / 14日以内 / 30日以内 / 60日以内、項目種別 |
| **検索** | 会社名 |
| **操作** | 更新依頼送信記録、書類再確認、期限日更新 |
| **API** | `POST /functions/v1/partner-expiry-update`（将来） |

---

## 4.8 停止管理

| 項目 | 内容 |
|------|------|
| **表示対象** | `contract_status = 'suspended'` |
| **一覧項目** | 会社名、停止日、停止コード、停止担当、経過日数、進行中案件数 |
| **フィルター** | 停止コード、停止日範囲 |
| **操作** | 停止解除、解除へエスカレーション、備考 |
| **API** | `POST /functions/v1/partner-suspend` / `partner-suspend-lift` |

---

## 4.9 解除履歴

| 項目 | 内容 |
|------|------|
| **表示対象** | `contract_status = 'terminated'` |
| **一覧項目** | 会社名、解除日、解除コード、担当者、再登録可否 |
| **フィルター** | 解除コード、解除日範囲、再登録可否 |
| **操作** | 詳細・証跡参照 |
| **API** | `POST /functions/v1/partner-terminate` |

---

## 4.10 トラブル管理

| 項目 | 内容 |
|------|------|
| **一覧項目** | 発生日、パートナー名、案件ID、重大度、ステータス、責任区分 |
| **フィルター** | 重大度、ステータス、未完了のみ |
| **検索** | パートナー名、案件ID、タイトル |
| **操作** | 新規、対応更新、停止/解除エスカレーション |
| **API** | `POST /functions/v1/partner-incident-create` / `partner-incident-update` |

---

# 5. パートナー詳細画面

URL: `/builder/partner-detail.html?id={uuid}`

## 5.1 タブ構成と表示項目

### タブ1: 基本情報

| 表示項目 | データソース |
|----------|-------------|
| partner_code、流入元、登録日 | partner_profiles |
| 会社名、区分、代表者、担当者 | partner_profiles |
| 電話、メール、住所、郵便番号 | partner_profiles |
| 法人番号、HP、SNS | partner_profiles |
| 業種（タグ）、対応エリア | partner_profiles |
| 月間対応件数、対応時間帯、実績 | partner_profiles |
| 審査ステータス、契約状態、紹介可否 | partner_profiles |
| 紹介不可コード（該当時） | partner_profiles |
| 評価ランク、集計（紹介/受注/トラブル） | partner_profiles |
| 備考 | partner_profiles |

**操作**: 基本情報編集（ops以上）、メモ追加

---

### タブ2: 審査

| 表示項目 | データソース |
|----------|-------------|
| 現在ステータス、承認日 | partner_profiles |
| 審査履歴一覧 | partner_reviews |
| 保留/否認理由コード | partner_reviews |
| 審査チェックリスト（第9章） | partner_reviews.checklist |
| 提出書類一覧・確認状態 | partner_documents |

**操作**: 承認、保留、否認、チェックリスト保存

---

### タブ3: 反社

| 表示項目 | データソース |
|----------|-------------|
| 現在判定、最終チェック日 | partner_profiles / partner_antisocial_checks |
| チェック履歴 | partner_antisocial_checks |
| 要確認/該当コード | partner_antisocial_checks |
| 証跡URL、確認方法 | partner_antisocial_checks |
| チェックリスト（反社シート） | partner_antisocial_checks.checklist |

**操作**: 新規チェック記録、判定更新

---

### タブ4: 契約

| 表示項目 | データソース |
|----------|-------------|
| 契約番号、契約種別 | partner_contracts |
| 契約進捗、送付日、締結日、満了日 | partner_contracts |
| 署名済みPDFリンク | partner_contracts.contract_file_url |
| 電子契約ID（将来） | partner_contracts.external_contract_id |
| 解除情報（該当時） | partner_contracts |

**操作**: 送付記録、締結完了、失効、PDFアップロード

---

### タブ5: 案件紹介

| 表示項目 | データソース |
|----------|-------------|
| 紹介履歴テーブル | partner_referrals |
| 紹介回数、受注率、完了件数 | partner_profiles（集計） |
| 最終紹介日、最終稼働日 | partner_profiles |

**操作**: 新規紹介登録、結果更新

---

### タブ6: 評価

| 表示項目 | データソース |
|----------|-------------|
| 現在ランク | partner_profiles.evaluation_rank |
| 評価履歴（7項目スコア・総合） | partner_evaluations |
| 評価コメント | partner_evaluations.notes |

**操作**: 新規評価登録、ランク更新

---

### タブ7: 期限管理

| 表示項目 | データソース |
|----------|-------------|
| 保険期限、対人/対物補償 | partner_profiles / partner_documents |
| 労災期限、加入種別 | partner_profiles |
| インボイス番号・状態 | partner_profiles |
| 許可証・資格期限 | partner_expiry_items / partner_documents |
| 契約更新期限 | partner_contracts.expires_at |
| アラート段階 | partner_expiry_items |

**操作**: 期限更新、更新依頼記録、書類再アップロード

---

### タブ8: トラブル

| 表示項目 | データソース |
|----------|-------------|
| トラブル一覧 | partner_incidents |
| 重大度、ステータス、責任区分 | partner_incidents |
| 再発防止策、対応完了日 | partner_incidents |

**操作**: 新規起票、対応更新、停止エスカレーション

---

### タブ9: 履歴

| 表示項目 | データソース |
|----------|-------------|
| 操作ログ（ステータス変更、停止、解除等） | partner_audit_log |
| 通知送信履歴 | partner_notifications |
| 変更前後JSON | partner_audit_log |

**操作**: 参照のみ（admin）

---

# 6. Edge Function設計

ベースパス: `supabase/functions/`  
認証: `Authorization: Bearer {service_role or ops JWT}`  
共通: 入力バリデーション → DB操作 → audit_log → `partner_profiles` キャッシュ更新 → 通知キュー

| Function | メソッド | 役割 |
|----------|----------|------|
| **partner-create** | POST | 登録フォームからの新規申請。`partner_profiles` 作成、書類アップロードURL発行、`partner_reviews` 初回行、`status=pending`、通知「新規登録」 |
| **partner-list** | GET | 一覧・検索・フィルタ。ページネーション、集計サマリー |
| **partner-get** | GET | 詳細取得（プロフィール + 関連テーブル） |
| **partner-review** | POST | 審査操作（approve/hold/reject）。`partner_reviews` 追加、`status` 更新、チェックリスト保存、H/Rコード記録 |
| **partner-antisocial-review** | POST | 反社チェック記録・判定更新。`partner_antisocial_checks` 追加、`antisocial_status` 更新、hit時は reject 連動 |
| **partner-contract-update** | POST | 契約送付・進捗・締結・失効。`partner_contracts` 更新、`contract_progress` 同期、締結時 `status=contracted` |
| **partner-referral-create** | POST | 案件紹介登録。`referral_eligible` 検証、否なら 403 + Nコード |
| **partner-referral-update** | POST | 紹介結果・受注・完了更新。集計キャッシュ更新 |
| **partner-evaluation-update** | POST | 評価登録・ランク更新。`partner_evaluations` 追加、`evaluation_rank` 反映 |
| **partner-suspend** | POST | 停止登録。`contract_status=suspended`、`partner_suspensions` 追加、紹介可否再計算 |
| **partner-suspend-lift** | POST | 停止解除。条件確認後 `active` 復帰 |
| **partner-terminate** | POST | 契約解除。`contract_status=terminated`、Tコード記録 |
| **partner-incident-create** | POST | トラブル起票。重大度 critical 時は停止エスカレーション通知 |
| **partner-incident-update** | POST | トラブル対応更新 |
| **partner-document-verify** | POST | 書類確認済み更新 |
| **partner-recalculate-eligibility** | POST | 紹介可否・Nコードの再計算（バッチからも呼出） |
| **partner-expiry-scan** | POST (cron) | 期限スキャン・通知キュー投入（将来） |
| **partner-invoice-sync** | POST (cron) | インボイス一括照合（将来） |

### partner-create リクエスト例

```json
{
  "source": "iwasho",
  "company_name": "株式会社サンプル",
  "representative_name": "山田 太郎",
  "contact_name": "佐藤 花子",
  "email": "info@example.co.jp",
  "phone": "03-1234-5678",
  "address": "東京都...",
  "partner_type": "corporation",
  "business_types": ["内装工事", "大工工事"],
  "service_area": "東京都・神奈川県",
  "raw_application": { }
}
```

### partner-review リクエスト例

```json
{
  "partner_id": "uuid",
  "action": "approve",
  "review_reason_code": null,
  "checklist": { "antisocial": true, "invoice": true, "insurance": true },
  "notes": "全項目確認済み"
}
```

---

# 7. 通知設計

## 7.1 通知イベント一覧

| イベント | notification_type | トリガー | 通知先 |
|----------|-------------------|----------|--------|
| 新規登録 | `partner_registered` | partner-create 完了 | ops, reviewer |
| 審査待ちリマインド | `review_pending` | 登録後2営業日超過 | reviewer |
| 審査承認 | `review_approved` | partner-review approve | contract_manager, 申請者 |
| 審査否認 | `review_rejected` | partner-review reject | 申請者 |
| 反社要確認 | `antisocial_review` | antisocial result=review | ops, admin |
| 契約送付 | `contract_sent` | contract-update sent | 申請者 |
| 契約催促 | `contract_reminder` | 送付後7日/14日 | 申請者, contract_manager |
| 契約締結 | `contract_completed` | signed_at 記録 | ops, 申請者 |
| 保険期限 | `insurance_expiry` | 60/30/14日前、当日 | contract_manager, パートナー |
| 労災期限 | `workers_comp_expiry` | 同上 | 同上 |
| 契約期限 | `contract_expiry` | 同上 | contract_manager |
| インボイス失効 | `invoice_invalid` | invoice-sync 検知 | contract_manager, ops |
| 停止 | `partner_suspended` | partner-suspend | ops, admin, パートナー |
| 解除 | `partner_terminated` | partner-terminate | ops, admin, パートナー |
| トラブル重大 | `incident_critical` | severity=critical | admin |

## 7.2 通知チャネル

| チャネル | 用途 | フェーズ |
|----------|------|----------|
| Builder 内通知 | 運営ダッシュボードバッジ | P2 |
| メール | 申請者・担当者への正式通知 | P2 |
| Slack/Webhook（任意） | 運営チーム即時連絡 | P3 |

## 7.3 通知テーブル

`partner_notifications` に送信履歴を記録。再送・失敗リトライは P3。

---

# 8. RLS方針

## 8.1 ロール定義

JWT `app_metadata.role` または `partner_ops_roles` テーブルで管理。

| ロール | 説明 |
|--------|------|
| **admin** | 全権限。停止・解除・否認の最終承認 |
| **ops** | 運営全般。紹介・期限・トラブル管理 |
| **reviewer** | 審査・反社チェック |
| **contract_manager** | 契約送付・締結・更新管理 |

## 8.2 権限マトリクス

| リソース | admin | ops | reviewer | contract_manager |
|----------|-------|-----|----------|------------------|
| partner_profiles 閲覧 | ○ | ○ | ○ | ○ |
| partner_profiles 作成 | ○ | — | — | — |
| partner_profiles 基本編集 | ○ | ○ | — | — |
| partner_reviews 閲覧 | ○ | ○ | ○ | — |
| partner_reviews 更新（審査） | ○ | — | ○ | — |
| partner_antisocial_checks 閲覧 | ○ | ○ | ○ | — |
| partner_antisocial_checks 更新 | ○ | — | ○ | — |
| partner_contracts 閲覧 | ○ | ○ | — | ○ |
| partner_contracts 更新 | ○ | — | — | ○ |
| partner_referrals 閲覧 | ○ | ○ | — | — |
| partner_referrals 作成・更新 | ○ | ○ | — | — |
| partner_evaluations 閲覧・更新 | ○ | ○ | — | — |
| partner_incidents 閲覧・更新 | ○ | ○ | — | — |
| partner_suspensions | ○ | ○（解除提案） | — | ○（保険系停止） |
| partner_terminate | ○ | — | — | — |
| partner_documents 閲覧 | ○ | ○ | ○ | ○ |
| partner_documents 確認 | ○ | ○ | ○ | ○ |
| partner_audit_log 閲覧 | ○ | — | — | — |
| Storage 書類・契約 | ○ | ○ | ○ | ○ |

## 8.3 RLSポリシー方針

```sql
-- 原則: 認証済み ops ロールのみ SELECT
-- INSERT/UPDATE は Edge Function（service_role）経由を推奨
-- 直接クライアントからの書き込みは P3 まで禁止

create policy "ops_select_partner_profiles"
  on public.partner_profiles for select
  to authenticated
  using (auth.jwt() ->> 'role' in ('admin', 'ops', 'reviewer', 'contract_manager'));
```

**推奨**: Builder UI は **Edge Function 経由のみ** で書き込み。Supabase 直アクセスは読取専用。

## 8.4 申請者（パートナー本人）の権限

- 現フェーズでは **自己申請の閲覧不可**（運営がメールで連絡）
- 将来: `partner_portal` ロールで自社データ・書類再提出のみ可

---

# 9. 実装優先順位

## P1 — 基盤（登録・審査・書類）

| 順序 | 成果物 | 内容 |
|------|--------|------|
| P1-1 | Migration | `partner_profiles`, `partner_reviews`, `partner_documents`, `partner_audit_log` |
| P1-2 | Storage | `partner-documents` バケット + RLS |
| P1-3 | Edge | `partner-create`, `partner-list`, `partner-get`, `partner-review`, `partner-document-verify` |
| P1-4 | Builder | 登録一覧拡張、審査待ち画面、詳細（基本・審査・書類タブ） |
| P1-5 | フォーム連携 | `partner-register-form.js` → `partner-create` API 接続 |
| P1-6 | 移行 | 現行 MOCK_DATA の手動移行手順 |

**P1完了条件**: フォーム申請 → DB保存 → Builder で審査承認/保留/否認まで一通り。

---

## P2 — 反社・契約

| 順序 | 成果物 | 内容 |
|------|--------|------|
| P2-1 | Migration | `partner_antisocial_checks`, `partner_contracts`, `partner_notifications` |
| P2-2 | Storage | `partner-contracts` バケット |
| P2-3 | Edge | `partner-antisocial-review`, `partner-contract-update`, `partner-recalculate-eligibility` |
| P2-4 | Builder | 反社確認、契約管理、詳細（反社・契約タブ） |
| P2-5 | 通知 | メール基本通知（新規・承認・契約送付・締結） |
| P2-6 | Cron | 契約催促（7日/14日）、承認後未送付3日 |

**P2完了条件**: 承認 → 反社クリア → 契約送付記録 → 締結 → `contracted` まで。

---

## P3 — 運用（紹介・評価・トラブル・期限）

| 順序 | 成果物 | 内容 |
|------|--------|------|
| P3-1 | Migration | `partner_referrals`, `partner_evaluations`, `partner_incidents`, `partner_suspensions`, `partner_expiry_items` |
| P3-2 | Edge | `partner-referral-*`, `partner-evaluation-update`, `partner-incident-*`, `partner-suspend`, `partner-terminate`, `partner-expiry-scan` |
| P3-3 | Builder | 案件紹介、更新期限、停止、解除、トラブル各画面 + 詳細全タブ |
| P3-4 | 通知 | 保険・労災・インボイス期限アラート |
| P3-5 | Cron | 月次インボイス照合、年次評価リマインド |

**P3完了条件**: 契約済みパートナーへの案件紹介 → 評価 → 期限切れ停止 → 解除まで一連運用可能。

---

## P4 — 自動化・外部連携（将来）

| 項目 | 内容 |
|------|------|
| 電子契約API | CloudSign 等 Webhook → `partner-contract-update` |
| 反社チェックAPI | 照会結果 → `partner-antisocial-review` |
| インボイス自動照会 | 国税庁 → `partner-invoice-sync` |
| AI推薦 | 案件紹介マッチング補助 |
| パートナーポータル | 申請者向けステータス・書類再提出 |

---

## 9.1 現行モックからの移行

| 現行 | P1以降 |
|------|--------|
| `partner-management.js` MOCK_DATA | `partner-list` API |
| 手動ステータス変更 | `partner-review` API |
| 備考フィールドのみ | `partner_audit_log` |
| 静的HTML 1画面 | 第4章メニュー10画面 + 詳細 |

---

## 改訂履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| 1.0 | 2026-06-23 | 初版。運用設計4文書と整合した実装前最終仕様 |

---

## 関連ドキュメント

| 文書 | 内容 |
|------|------|
| `reports/partner-review-criteria.md` | 審査ステータス・R/Hコード・チェックリスト |
| `reports/partner-anti-social-checklist.md` | 反社判定・A/Bコード |
| `reports/partner-electronic-contract-operation.md` | 契約フロー・S/Tコード・催促 |
| `reports/partner-operation-management.md` | 台帳・紹介可否・画面設計・運用チェックリスト |
| `reports/partner-register-implementation-result.md` | 現行登録フォーム・Builderモック |
