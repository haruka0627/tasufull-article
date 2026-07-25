# Business Directory — Verification Architecture SSOT

**最終更新:** 2026-07-01  
**種別:** 設計調査 · アーキテクチャ正本（**実装なし**）  
**スコープ:** 掲載カテゴリごとの本人確認 · 資格確認 · 許可確認 · 保険確認 · AI 審査補助  
**前提 AD:** [DECISIONS.md](../DECISIONS.md) **AD-006**（AI 非確定）· **AD-013**（BD サブスク · Self-Service · 運営審査）

**関連正本:**

| ドキュメント | 関係 |
| --- | --- |
| [business-directory-architecture.md](./business-directory-architecture.md) | 製品境界 · 状態 · ER 概要 |
| [business-directory-data-model-design.md](../business-directory-data-model-design.md) | 既存テーブル · RLS · `review_requests` |
| [business-directory-self-service-design.md](../business-directory-self-service-design.md) | Owner 申請 · 公開後編集 |
| [business-directory-ui-flow-design.md](../business-directory-ui-flow-design.md) | Admin 審査 UI · フィールド編集可否 |

**調査レポート（要約）:** [reports/business-directory-verification-architecture-investigation.md](../../reports/business-directory-verification-architecture-investigation.md)

---

## 0. Executive summary

Business Directory に **Verification レイヤー** を追加する。目的は信頼性 · 安全性 · 運営審査効率の向上であり、**課金プランのゲートではない**（AD-013 サブスクとは分離）。

| 原則 | 内容 |
| --- | --- |
| **最終承認** | 運営（Ops）のみ · AI は **補助** |
| **AI 禁止** | 自動公開 · 自動承認 · 法的真偽の断定（AD-006） |
| **API** | 今回設計のみ · provider adapter で将来接続 |
| **Builder** | Builder Engine / TASFUL AI Workspace と **統合しない** — BD 専用 Edge + Admin |
| **page_content / blocks_json** | **使用しない** — 既存 `profiles` · Storage · `review_requests` を拡張 |
| **既存フロー** | `review_requested` · `content_update` · `pending_updates` · `approve_listing` を **拡張**（置換しない） |

---

## 1. Verification の基本概念

### 1.1 `verification_level`（カテゴリ / ルール正本）

カテゴリ（または `listing_type` デフォルト）ごとに **1 つのレベル** を持つ。将来、API 照合が可能になった一般カテゴリは `optional` → `api_verified` へ昇格可能。

| Level | コード | 意味 | 典型対象 |
| --- | --- | --- | --- |
| 確認不要 | `none` | 追加 Verification なし（既存スパム/規約審査のみ） | 将来拡張 · テスト用 |
| 基本 | `basic` | 本人確認 · スパム · 利用規約 · 連絡先整合 | **一般店舗** デフォルト |
| 任意 | `optional` | 資格/許可/法人番号を **任意提出** · Verified badge 条件に利用可 | 一般店舗（法人番号任意）· API 準備前 |
| 必須 | `required` | 書類提出 + 運営確認 **必須** · 未完了では公開不可 | **業務サービス**（カテゴリ別） |
| API 照合 | `api_verified` | `required` + provider adapter による **機械照合** · 運営は例外/差戻しのみ | 法人番号 · インボイス · 許可 DB 連携後 |

**解釈:**

- `basic` ⊂ `optional` ⊂ `required` ⊂ `api_verified`（要求は単調増加）
- **プラン（Free/Standard/Pro）とは独立** — `verification_level` はカテゴリ/法令リスクで決定
- Public 表示は **結果バッジのみ**（§8）

### 1.2 確認項目タイプ（`check_type`）

ルールとリクエストの両方で参照する **安定キー**。

| check_type | 説明 | 一般店舗 | 業務サービス |
| --- | --- | --- | --- |
| `identity` | 本人/担当者確認（連絡先 · 規約同意） | ✅ 必須 | ✅ 必須 |
| `terms` | 利用規約 · 掲載規約 | ✅ | ✅ |
| `spam` | スパム · 外部誘導 · 不適切表現 | ✅ | ✅ |
| `business_name` | 屋号/店舗名と表示名の整合 | ✅ | ✅ |
| `corporate_number` | 法人番号（13 桁） | optional | optional/required |
| `invoice_registration` | インボイス登録番号 | optional | optional |
| `license` | 許認可（建設業 · 古物 · 運送等） | — | category 別 required |
| `qualification` | 国家資格 · 技能士等 | — | category 別 |
| `insurance` | 賠償責任保険 | — | 多く required/optional |
| `work_sample` | 実績写真（`photos.kind=work_sample`） | optional | recommended/required |
| `category_consistency` | 説明文 vs カテゴリ矛盾 | AI | AI + Ops |
| `antisocial` | 反社・規約違反キーワード | AI 補助 | AI 補助 |
| `ai_risk_score` | 総合リスクスコア | 軽量 | 必須 |

### 1.3 カテゴリ別 `verification_level` 初期案（seed 設計用）

> **未 migration** — 将来 `business_directory_verification_rules` に seed。

#### 一般店舗（`shop_retail`）

| category_code | 表示名 | verification_level | 必須 check | 任意 check |
| --- | --- | --- | --- | --- |
| `shop_food` | 飲食・食品 | `basic` | identity, terms, spam, business_name | corporate_number, invoice_registration |
| `shop_retail_general` | 小売・雑貨 | `basic` | 同上 | 同上 |
| `shop_beauty` | 美容・健康 | `basic` | 同上 | 同上 · 衛生関連は将来 `optional` 昇格可 |
| `shop_other` | その他店舗 | `basic` | 同上 | 同上 |

#### 業務サービス（`business_service`）

| category_code | 表示名 | verification_level | 必須 check（概要） |
| --- | --- | --- | --- |
| `biz_construction` | 建設・リフォーム | `required` | identity, terms, corporate_number(opt→req), license(建設業), insurance, work_sample, spam |
| `biz_cleaning` | 清掃・メンテナンス | `required` | identity, terms, insurance, work_sample, spam |
| `biz_it` | IT・Web | `optional`→`basic` | identity, terms, spam · 資格任意 |
| `biz_other` | その他業務 | `required` | identity, terms, spam · カテゴリ詳細は Admin テンプレ |

**将来拡張カテゴリ例（設計のみ）:** 電気工事 · 解体 · 古物 · 運送 · 害虫駆除 · 水道 — 各 `required` + 許可 `license` テンプレ。

---

## 2. カテゴリ別確認項目（詳細）

### 2.1 一般店舗 — 確認バンドル `basic`

| 項目 | 収集 | 審査 | AI 補助 |
| --- | --- | --- | --- |
| 本人確認 | 担当者名 · メール · 電話 · 規約同意 | Ops 目視 | 連絡先形式 · 重複掲載 |
| スパムチェック | 紹介文 · URL | Ops | 外部誘導 · 連絡先直書き · NG ワード |
| 利用規約 | `terms_accepted_at` | 必須列 | — |
| 法人/屋号 | `company_name` · 任意法人番号 | optional 提出時 Ops | 番号形式 · 屋号整合 |
| 写真 | logo/cover 1 枚 | Ops | 不適切画像（将来 Vision） |

**方針:** 資格確認は **重くしない**。API 照合可能になれば `optional` / `api_verified` へ段階昇格。

### 2.2 業務サービス — 確認バンドル `required`

| 項目 | 収集 | 審査 | AI 補助 |
| --- | --- | --- | --- |
| 本人確認 | 同上 | Ops | 同上 |
| 法人番号 | profiles 拡張 or verification 提出 | Ops · 将来 API | 13 桁チェック · 商号一致 |
| 必要資格 | 資格名 · 番号 · 有効期限 · 証明書画像 | Ops | 形式 · カテゴリ必須リスト照合 |
| 必要許可 | 許可種別 · 番号 · 管轄 · 証明書 | Ops · 将来 API | 形式 · 欠落指摘 |
| 賠責保険 | 加入有無 · 保険会社 · 証券番号 · 有効期限 | Ops | 未加入警告 · 期限切れ |
| 実績写真 | `work_sample` 写真 | Ops | カテゴリ不一致 |
| 反社/規約 | — | Ops | リスクスコア · 要確認フラグ |
| AI リスクスコア | — | **参考値のみ** | 0–100 + 推奨アクション |

既存 `profiles.licenses_text` は **表示用テキスト**。Verification は **構造化 + 書類** を正本とする（§3）。

---

## 3. DB 設計案（migration 前）

> **正本:** 本節。`business-directory-db-architecture.md` は **存在しない** — 列詳細は [business-directory-data-model-design.md](../business-directory-data-model-design.md) を継続正本とし、Verification は **追加テーブル群** として設計。

### 3.1 ER 拡張概要

```text
business_directory_categories
    └── business_directory_verification_rules (0..1 per category · fallback by listing_type)

business_directory_listings
    ├── business_directory_verification_requests (0..n · 初回 + 更新 + 更新審査)
    │       └── business_directory_verification_checks (0..n · 項目/API 単位)
    ├── business_directory_verification_documents (0..n · Storage 参照)
    └── business_directory_listings.verification_summary (cache · public badge 用)

business_directory_review_requests  … 既存 · verification_request_id でリンク（任意）
```

### 3.2 `business_directory_verification_rules`

カテゴリ（または type デフォルト）ごとの **要求定義マスタ**。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_type` | text | `shop_retail` · `business_service` |
| `category_id` | uuid FK nullable | NULL = type デフォルト |
| `category_code` | text | 安定キー（seed 用 · `categories.code` と同期） |
| `verification_level` | text | §1.1 |
| `required_checks` | text[] | `check_type` 列挙 |
| `optional_checks` | text[] | 同上 |
| `required_documents` | jsonb | `[{ "doc_type", "label", "max_files", "mime" }]` |
| `optional_documents` | jsonb | 同上 |
| `required_licenses` | jsonb | `[{ "license_code", "label", "jurisdiction" }]` |
| `api_providers` | text[] | 将来: `houjin`, `invoice`, `mlit`, … |
| `manual_review_required` | boolean | default true（`api_verified` でも例外時 true） |
| `risk_policy` | jsonb | `{ "auto_flag_threshold": 70, "block_threshold": null }` |
| `renewal_months` | int nullable | 許可/保険の再確認周期（Phase V4） |
| `is_active` | boolean | — |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |

**UNIQUE:** `(category_id)` where not null · `(listing_type)` where category_id is null（デフォルト 1 行）

### 3.3 `business_directory_verification_requests`

1 回の Verification サイクル（初回公開申請 · content_update 再審査 · 更新審査）。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_id` | uuid FK | — |
| `owner_user_id` | uuid FK | 冗長 · RLS 用 |
| `review_request_id` | uuid FK nullable | → `review_requests`（initial_publish / content_update と同期） |
| `trigger` | text | `initial_publish` · `content_update` · `renewal` · `ops_recheck` |
| `verification_level` | text | 申請時点のルールスナップショット |
| `status` | text | `draft` · `submitted` · `ai_reviewed` · `ops_review` · `approved` · `rejected` · `expired` |
| `submitted_at` | timestamptz | — |
| `submitted_payload` | jsonb | 構造化入力（資格番号 · 保険 · 法人番号等） |
| `submitted_document_ids` | uuid[] | → verification_documents |
| `ai_review_result` | jsonb | §4 · **非確定** |
| `ai_recommendation` | text | `publish_ready` · `needs_review` · `reject_suggested` |
| `risk_score` | smallint | 0–100 · AI 参考 |
| `missing_checks` | text[] | AI/Ops が算出 |
| `reviewer_notes` | text | Ops 内部 |
| `reviewed_by` | uuid | Ops |
| `reviewed_at` | timestamptz | — |
| `expires_at` | timestamptz | renewal 用（Phase V4） |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |

### 3.4 `business_directory_verification_checks`

項目単位 · API 照合単位の **実行結果**。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `verification_request_id` | uuid FK | — |
| `check_type` | text | §1.2 |
| `provider` | text | `manual` · `ai` · `houjin` · `invoice` · `mlit` · … |
| `status` | text | `pending` · `passed` · `failed` · `inconclusive` · `skipped` |
| `input_snapshot` | jsonb | 照合入力（マスク済み可） |
| `result_json` | jsonb | provider 応答 · AI 出力 |
| `confidence` | numeric(4,3) | 0–1 · AI/API |
| `error_code` | text | — |
| `checked_at` | timestamptz | — |
| `checked_by` | uuid nullable | Ops manual の場合 |

### 3.5 `business_directory_verification_documents`（追加推奨）

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `verification_request_id` | uuid FK | — |
| `listing_id` | uuid FK | — |
| `doc_type` | text | `license_cert` · `insurance_policy` · `id_document` · … |
| `storage_bucket` | text | **`business-directory-private`**（新 bucket · public 不可） |
| `storage_path` | text | `{listing_id}/verification/{request_id}/{uuid}.ext` |
| `file_name` | text | 表示用 |
| `mime_type` | text | — |
| `sha256` | text | 改ざん検知（将来） |
| `uploaded_by` | uuid | owner |
| `uploaded_at` | timestamptz | — |

### 3.6 `business_directory_listings` 拡張列（キャッシュ · Public badge）

| 列 | 型 | 説明 |
| --- | --- | --- |
| `verification_status` | text | `unverified` · `pending` · `verified` · `expired` · `revoked` |
| `verification_level_achieved` | text | 達成レベル |
| `verified_at` | timestamptz | 最終 Ops 承認 |
| `verification_badges` | text[] | public 表示: `identity` · `licensed` · `insured` · `api_verified` |
| `verification_expires_at` | timestamptz | renewal（Phase V4） |

**Public view** (`business_directory_listings_public`) に badge 列のみ追加 — **書類・番号は含めない**。

### 3.7 `profiles` 拡張（構造化 · optional）

既存 `licenses_text` は維持。Verification 通過後に **要約テキストを同期** 可能。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `corporate_number` | text nullable | 13 桁 · 将来 API |
| `invoice_registration_number` | text nullable | T+13 |
| `verification_public_summary` | text nullable | Public 向け要約（Ops 承認後） |

---

## 4. AI 審査補助フロー

**Surface:** Business Directory 専用 Edge action（将来）例: `run_verification_ai_review` — **`ai-model-gateway.js` 契約変更なし** · BD Edge 内で Gemini/DeepSeek を **BD 専用 adapter** 経由で呼ぶ（AD-005 · AD-002 回避）。

### 4.1 トリガー

```text
Owner: 公開申請 or content_update 申請
  → submit_listing_for_review (既存)
  → verification_request.status = submitted
  → Edge: run_verification_ai_review (async or sync)
  → verification_request.status = ai_reviewed
  → review_requests は open のまま · Ops キューに AI レポート付与
```

`content_update` 時: `pending_updates` の profile 変更が **license/insurance 関連** なら verification_request を **再 open**。

### 4.2 AI が行うこと（AD-006 準拠 · 下書き/参考）

| # | タスク | 出力 |
| --- | --- | --- |
| 1 | カテゴリから必要確認項目を提案 | `missing_checks[]` |
| 2 | 入力漏れ指摘 | `submitted_payload` vs `verification_rules` |
| 3 | 資格/許可番号 **形式** チェック | per-check `result_json` |
| 4 | 書類提出有無 | `required_documents` vs uploads |
| 5 | 説明文 vs カテゴリ矛盾 | `category_consistency` check |
| 6 | 外部誘導/スパム/不適切表現 | `spam` · `antisocial` |
| 7 | `risk_score` 生成 | 0–100 |
| 8 | 推奨アクション | `ai_recommendation`: `publish_ready` / `needs_review` / `reject_suggested` |

**UI 表示:** `common-ai-disclaimer.js` パターン — 「AI 提案 · 最終判断は運営」

### 4.3 AI が行わないこと

| 禁止 | 理由 |
| --- | --- |
| 自動 `approve_listing` | AD-006 · Self-Service 正本 |
| 自動 `published` 遷移 | 運営必須 |
| API なしで「本物」「有効」と断定 | 法的リスク |
| 書類画像の OCR 結果を **確定** として Ops UI に非表示 | 参考表示のみ |

### 4.4 フロー図

```text
┌──────────────┐     submit      ┌─────────────────────┐
│ Owner UI     │ ──────────────► │ verification_request │
│ 書類/番号入力 │                 │ status: submitted    │
└──────────────┘                 └──────────┬──────────┘
                                            │
                                 ┌──────────▼──────────┐
                                 │ BD Edge AI adapter   │
                                 │ (not Gateway merge)  │
                                 └──────────┬──────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
            verification_checks      ai_review_result          risk_score
            (ai provider rows)       (jsonb)                   (reference)
                    │                       │
                    └───────────┬───────────┘
                                ▼
                    ┌───────────────────────┐
                    │ Admin reviews.html     │
                    │ AI レポート + チェック │
                    │ 承認 / 差戻し (Ops)    │
                    └───────────┬───────────┘
                                ▼
                    approve_listing (既存)
                    verification_status = verified
                    public badges 更新
```

---

## 5. 外部 API 連携 — 将来設計（provider adapter）

**今回:** インターフェースと DB 列のみ。**接続 · 実装なし。**

### 5.1 Adapter 契約（TypeScript 設計案）

```text
supabase/functions/_shared/business-directory-verification-providers/
  types.ts          … VerificationProvider interface
  manual.ts         … 常に inconclusive → Ops
  houjin.ts         … 国税庁 法人番号 Web-API（将来）
  invoice.ts        … インボイス登録番号（将来）
  mlit.ts           … 建設業許可情報（将来）
  prefecture.ts     … 都道府県公開 DB（将来）
  digital_credentials.ts … デジタル資格者証（将来）
  registry.ts       … provider 名 → 実装
```

```typescript
// 設計案 · 未実装
interface VerificationProvider {
  readonly code: string; // houjin | invoice | mlit | ...
  supports(checkType: string, rule: VerificationRule): boolean;
  verify(input: ProviderVerifyInput): Promise<ProviderVerifyResult>;
}

interface ProviderVerifyResult {
  status: "passed" | "failed" | "inconclusive";
  confidence: number;
  resultJson: Record<string, unknown>;
  errorCode?: string;
}
```

### 5.2 候補 provider マップ

| provider | 照合対象 | check_type | 公開 API 例 |
| --- | --- | --- | --- |
| `houjin` | 法人番号 · 商号 | `corporate_number` | 国税庁 法人番号 Web-API |
| `invoice` | インボイス登録 | `invoice_registration` | 国税庁 適格請求書 |
| `mlit` | 建設業許可 | `license` | 国土交通省 許可情報 |
| `prefecture` | 古物商 · 届出 | `license` | 都道府県公開 DB |
| `digital_credentials` | 国家資格 | `qualification` | デジタル資格者証 API |
| `manual` | 書類 · 保険 | `insurance`, `work_sample` | — |

**原則:**

- API 結果も `inconclusive` を許容 — Ops 最終判断
- Rate limit · キャッシュ · `verification_checks` に audit
- Production / Staging で **別 API key**（[supabase-environments.md](../supabase-environments.md)）

---

## 6. UI / Admin 設計

### 6.1 Owner UI（`business-directory/`）

**新規画面/セクション（設計のみ）:** `verification.html` または `edit.html` タブ `verification`

| 要素 | 内容 |
| --- | --- |
| チェックリスト | カテゴリルールから動的生成 · 完了/未完了 |
| 書類アップロード | doc_type ごと · private bucket |
| 資格/許可番号入力 | 構造化フォーム · カテゴリテンプレ |
| 保険入力 | 加入有無 · 証券 · 期限 |
| AI 結果 | 不足項目 · 推奨修正 · **disclaimer** |
| CTA | 「審査に提出」→ 既存 `submit_listing_for_review` と連動 |

**公開申請前:** `verification_level >= required` の未完了項目がある場合 — 申請ボタン disabled + ガイド（**プラン无关**）。

**Phase 3 Builder Lite 整合:** [business-directory-page-renderer.js](../../business-directory/business-directory-page-renderer.js) は **公開ページ表示のみ**。Verification UI は Owner/Admin · **blocks_json / page_content 不使用**。

### 6.2 Admin UI（`business-directory/admin/`）

既存 `reviews.html` · `listing.html` を **拡張**（新レイアウト全面刷新は Phase V1 範囲外でも可）。

| 要素 | 内容 |
| --- | --- |
| AI 審査レポート | `ai_review_result` 要約 · risk_score · recommendation |
| 提出書類一覧 | signed URL（Ops · 短期） |
| チェックリスト | required_checks · manual チェックボックス |
| API 照合結果 | `verification_checks` 行表示（Phase V2+） |
| 操作 | 既存 `approve_listing` / `reject_listing` + `reviewer_notes` |
| 差戻し | 既存 `reject_reason_note` 必須 · Verification 不足をテンプレ化 |

**原則（Phase 4 継承）:** 運営は **読取 + 審査アクションのみ** · 入力代行フォームなし。

### 6.3 Public UI

| 表示 | 非表示 |
| --- | --- |
| `verification_badges`（例: 審査済 · 許可確認済） | 法人番号 · 許可証画像 · risk_score |
| `verification_public_summary`（Ops 承認テキスト） | 内部 reviewer_notes |

---

## 7. Plan / 掲載タイプとの関係

| 区分 | 方針 |
| --- | --- |
| **Verification 実施** | **カテゴリ/法令リスク** — Free でも `required` なら必須 |
| **サブスクプラン** | 課金ゲート **にしない**（AD-013 維持） |
| **プラン価値（将来）** | Standard+ / Pro / Premium で **表示強化** のみ |

| 機能 | Free | Standard+ | Pro+ | 備考 |
| --- | --- | --- | --- | --- |
| 必須 Verification 完了 | ✅ 公開条件 | ✅ | ✅ | プラン无关 |
| Verified badge 表示 | 基本 badge | + 詳細 badge | + 優先表示文案 | 表示差のみ |
| 検索 `search_boost_weight` | 既存 plan_features | 既存 | Verified 加点は **別係数** 検討 | fraud 防止のため自動 boost 禁止 |
| 「詳細審査済み」ラベル | — | ✅ | ✅ | marketing |

**禁止:** 「Pro しないと許可確認不要」— カテゴリ `required` は全プラン共通。

---

## 8. RLS / Security

### 8.1 データ分類

| 分類 | 例 | 公開 |
| --- | --- | --- |
| **Public** | badges · verified_at · public summary | ✅ anon |
| **Owner private** | submitted_payload · document paths | owner のみ |
| **Ops private** | reviewer_notes · full AI json · documents | ops + service_role |
| **Provider secret** | API keys | Edge secrets のみ |

### 8.2 Storage

| Bucket | 用途 |
| --- | --- |
| `business-directory`（既存 · public） | 掲載写真 |
| **`business-directory-private`**（新規 · 設計） | Verification 書類 · **anon/authenticated 直接 READ 禁止** |

Ops 書類閲覧: Edge `get_verification_document_url` — signed URL · 短期 · audit log。

### 8.3 RLS 方針（追加テーブル）

| テーブル | owner | anon | ops |
| --- | --- | --- | --- |
| `verification_rules` | SELECT active | ❌ | ALL |
| `verification_requests` | CRUD own listing · submit | ❌ | SELECT/UPDATE all |
| `verification_checks` | SELECT own request | ❌ | ALL |
| `verification_documents` | INSERT/SELECT own | ❌ | SELECT + signed URL via Edge |

**audit_logs 必須 action 追加（設計）:**

- `verification.submit` · `verification.ai_review` · `verification.approve` · `verification.reject` · `verification.document_upload` · `verification.api_check`

### 8.4 service_role

- Provider adapter 実行 · AI batch · signed URL 発行 — **Edge のみ**
- クライアントから service_role **禁止**

---

## 9. 既存設計との整合性

| 既存 | Verification との関係 |
| --- | --- |
| [business-directory-architecture.md](./business-directory-architecture.md) | Verification を §3 In Scope に **将来追加** · Builder/Platform AI Out of Scope 維持 |
| [business-directory-data-model-design.md](../business-directory-data-model-design.md) | `review_requests` · `audit_logs` · `profiles.licenses_text` を **拡張** · ER §10 将来表に本設計をリンク |
| **Phase 3 Builder Lite**（shared page renderer Phase 3a–3f） | 公開レンダリングのみ · Verification UI は別モジュール |
| `content_update` / `pending_updates` | 許可/保険/資格変更 → verification_request 再生成 · live は承認まで不変 |
| `review_requested` | 既存ステータス維持 · Verification 未完了も `review_requested` だが Ops キューでブロック |
| `approve_listing` / `reject_listing` | **正本のまま** · 承認時に `verification_status=verified` を更新 |
| Admin approval flow | Phase 4 原則維持 · AI レポート追加 |
| `page_content` / `blocks_json` | **不使用** — Phase 2a は profile 列 + renderer |
| Builder Engine | **統合しない**（AD-002） |
| TASFUL AI Workspace / Gateway | **統合しない** — BD Edge 内 adapter のみ（AD-005 非変更） |
| Stripe / plan_features | Verification は課金条件にしない · badge 表示のみプラン連動可 |

### 9.1 `review_requests` 連携

| request_type | verification_request.trigger |
| --- | --- |
| `initial_publish` | `initial_publish` |
| `content_update` | `content_update`（資格/許可/保険 diff 時） |
| `plan_upgrade` | Verification 通常スキップ（将来 fraud 時のみ recheck） |

`review_requests.snapshot_json` に **verification_summary のコピー** を含め Ops 差分比較可能に。

---

## 10. Phase 分け（実装ロードマップ）

| Phase | 名称 | 内容 | DB | Edge | UI |
| --- | --- | --- | --- | --- | --- |
| **V1** | Manual + AI checklist | rules seed · requests/checks · AI 補助 · Admin レポート · public badge（manual） | rules · requests · checks · listing 列 | `run_verification_ai_review` | Owner 提出 · Admin 拡張 |
| **V2** | Registry APIs | 法人番号 · インボイス adapter · risk_score 本番 tuning | documents 表 · private bucket | houjin · invoice providers | API 結果 Ops UI |
| **V3** | Sector APIs | 建設業 · 古物 · 資格 API · カテゴリテンプレ拡充 | license templates jsonb | mlit · prefecture · digital_credentials | カテゴリ別 Owner フォーム |
| **V4** | Renewal + fraud | 許可/保険期限 · renewal 審査 · fraud monitoring · **高スコアも Ops 必須**（自動承認は PoC のみ） | expires_at · renewal jobs | scheduled recheck | Owner 更新通知 |

**Commercial Launch との関係:** Launch Gate OB1–OB8 とは独立 Epic · **Launch 後 or 並行** で V1 から Staging 検証（[supabase-environments.md](../supabase-environments.md)）。

---

## 11. 未対応 / TODO

| # | 項目 | 優先 |
| --- | --- | --- |
| T1 | カテゴリ seed 拡張（電気 · 古物 · 運送等）と `required_licenses` 正本 | V1 前 |
| T2 | `business-directory-private` bucket migration 設計 · RLS | V1 |
| T3 | AI prompt 正本 · BD 専用（`docs/AI/` 新規ファイル） | V1 |
| T4 | Ops 差戻し理由テンプレ（Verification 不足コード） | V1 |
| T5 | Staging E2E — verification + content_update 交叉 | V1 |
| T6 | 法人番号 API 利用規約 · 保存ポリシー（Legal） | V2 前 |
| T7 | OCR/Vision 書類読取 — 参考表示ポリシー | V3 |
| T8 | `business-directory-data-model-design.md` §10 へ本 SSOT リンク | ドキュ |
| T9 | `business-directory-architecture.md` §9 Future 更新 | ドキュ |

---

## 12. 今回実施しなかったこと

- DB migration · SQL 実行 · Supabase 変更
- 外部 API 接続 · provider 実装
- AI Gateway / Builder Engine 変更
- Owner / Admin / Public UI 実装
- Stripe · plan_features 変更
- `page_content` / `blocks_json` 導入

---

*本ファイルは Business Directory Verification の設計 SSOT。実装は別 Epic · ADR · migration タスクで行う。*
