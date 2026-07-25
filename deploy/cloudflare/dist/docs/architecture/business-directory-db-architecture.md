# Business Directory — Database Architecture SSOT

**最終更新:** 2026-07-01  
**種別:** DB 設計 · アーキテクチャ正本（**本ファイルは migration / コードを含まない**）  
**前提 AD:** [DECISIONS.md](../DECISIONS.md) **AD-013** · **AD-006**（AI 非確定）

---

## ステータス凡例

| 記号 | 意味 |
| --- | --- |
| **実装済み** | migration 存在 · Production または Staging に適用済（環境別に注記） · Edge/UI が参照 |
| **設計済み** | SSOT ドキュメント · migration 未作成または未適用 |
| **未実装** | 将来 Epic · 本 SSOT では方向性のみ |

**列・型・RLS ポリシーの詳細正本:** [business-directory-data-model-design.md](../business-directory-data-model-design.md)  
**製品境界 · 状態遷移概要:** [business-directory-architecture.md](./business-directory-architecture.md)  
**Verification 拡張:** [business-directory-verification-architecture.md](./business-directory-verification-architecture.md)  
**Supabase 環境:** [supabase-environments.md](../supabase-environments.md)

---

# Overview

Business Directory（店舗・販売 / 業務サービス掲載）は、Marketplace `listings` とは **別名前空間** `business_directory_*` で Postgres に保持する。  
ライフサイクル正本は `business_directory_listings`、詳細は 1:1 の `business_directory_profiles`、公開向けは anon 安全な view と Edge `business-directory` が仲介する。

```text
┌──────────────────────────────────────────────────────────────────┐
│  Client（Owner / Admin / Public HTML）                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ JWT（Owner/Admin）· anon（Public）
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Edge: business-directory · stripe-webhook                       │
│  service_role — pending_updates · quota RPC · 状態遷移           │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Postgres（public）                                              │
│  listings · profiles · 子テーブル · review_requests              │
│  pending_updates · ai_draft_usage_daily                          │
│  listings_public（view）· RLS · RPC                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │ Storage: business-directory    │  Stripe（listings 列）
              └───────────────────────────────┘
```

**Commercial Launch:** DB 基盤は **Production Ready Go**（2026-07-01 controlled apply）。**Commercial Launch は Conditional** — Stripe E2E · Launch 最終確認が残る（[PROJECT_STATUS.md](../PROJECT_STATUS.md) · [apply result](../../reports/business-directory-production-controlled-apply-result.md)）。

---

## Production DB 状態（固定 · 2026-07-01）

> **正本 ref:** `ddojquacsyqesrjhcvmn` · 以降、本節を **Production DB スナップショット** として参照する（再 apply 不要）。

| 項目 | 状態 |
| --- | --- |
| Production Controlled Apply | **完了** |
| `20260715110000` | **partial apply 済**（view block **未実行**） |
| `20260716100000` | **full apply 済** |
| `20260717120000` | **適用済**（Phase 2a · view 6 列維持） |
| VERIFY | **全 PASS** |
| Smoke S2 / S3 | **16/0** · **15/0** |
| Rollback | **不要** |
| **DB 依存 Production Ready** | **Go** |
| **Commercial Launch** | **Conditional** |

詳細: [business-directory-production-controlled-apply-result.md](../../reports/business-directory-production-controlled-apply-result.md)

---

# Database Architecture

## ER 概要

**実装済み（Phase 1 + 拡張 migration）:**

```text
auth.users
    │
    ├── business_directory_listings (1..n · MVP は 1 想定)
    │       ├── business_directory_profiles (1:1)
    │       ├── business_directory_photos (0..n)
    │       ├── business_directory_business_hours (0..n)
    │       ├── business_directory_social_links (0..n)
    │       ├── business_directory_tlv_videos (0..n)
    │       ├── business_directory_review_requests (0..n)
    │       ├── business_directory_audit_logs (0..n · append-only)
    │       └── business_directory_pending_updates (0..1 · content_update) 【15110000】
    │
    ├── business_directory_ai_draft_usage_daily (0..n rows/user/day) 【16100000】
    │
    ├── business_directory_categories (マスタ)
    └── business_directory_plan_features (マスタ)

business_directory_listings_public (VIEW · anon 安全メタデータ)
consume_business_directory_ai_draft_quota (RPC) 【16100000】
business_directory_is_ops_admin() (RLS ヘルパ)
business_directory_set_updated_at() (trigger 関数)
```

**設計済み · 未 migration（Verification Epic）:**

```text
business_directory_categories
    └── business_directory_verification_rules (0..1 per category)

business_directory_listings
    ├── business_directory_verification_requests (0..n)
    │       └── business_directory_verification_checks (0..n)
    ├── business_directory_verification_documents (0..n)
    └── listings.verification_* 列（cache / badge 用）
```

詳細 ER · カラム定義 → [business-directory-verification-architecture.md](./business-directory-verification-architecture.md) §3。

## 主要テーブルと責務

| テーブル / オブジェクト | 責務 | ステータス |
| --- | --- | --- |
| `business_directory_listings` | ライフサイクル · プラン · 検索キー · Stripe 鏡像 | **実装済み** |
| `business_directory_profiles` | 掲載詳細 · Phase 2a SEO/FAQ 列 | **実装済み** |
| `business_directory_pending_updates` | 公開後編集の pending JSON（live 非更新） | **実装済み** · **Production apply 済**（2026-07-01 partial） |
| `business_directory_review_requests` | Ops 審査キュー · スナップショット | **実装済み** |
| `business_directory_audit_logs` | 状態変更監査 | **実装済み** |
| `business_directory_ai_draft_usage_daily` | AI 下書き日次 quota | **実装済み** · **Production apply 済**（2026-07-01） |
| `business_directory_listings_public` | Public 一覧/検索用 anon 安全 view | **実装済み** |
| `business_directory_verification_*` | 本人/資格/許可/保険 | **設計済み** |
| `search_text` / pgvector | 全文 · ベクトル検索 | **未実装**（列のみ / 将来） |

## データフロー（概要）

| フロー | 経路 |
| --- | --- |
| Owner CRUD | Browser → Edge（JWT）→ listings/profiles/子表 · RLS owner |
| 公開申請 | Edge → `review_requests` insert · status=`review_requested` |
| Ops 承認 | Edge（service_role）→ live 更新 · audit · pending clear |
| Public 閲覧 | anon → view / Edge `get_public_*` · **published のみ** |
| content_update | Edge → `pending_updates` · live 維持 · 承認で apply |
| AI 下書き | Edge → RPC quota → profiles 反映（Owner 保存） |
| Stripe | webhook → listings サブスク列 · Edge checkout |

**Builder AI / TASFUL AI Workspace とは DB 非共有**（AD-002 · AD-013）。

---

# Table Design

> 全列定義は [business-directory-data-model-design.md](../business-directory-data-model-design.md) を参照。以下は DB SSOT としての要約と実装状態。

## `business_directory_listings` — **実装済み**

| 要点 | 内容 |
| --- | --- |
| PK | `id uuid` |
| 所有者 | `owner_user_id` → `auth.users` |
| 状態 | `draft` · `review_requested` · `published` · `rejected` · `suspended` · `unpublished` · `archived` |
| 種別 | `shop_retail` · `business_service` |
| プラン | `plan_code` → `plan_features` |
| Stripe | `stripe_*` · `subscription_status` 等（Phase 6 migration） |
| 検索 | `search_text tsvector`（**列のみ · トリガ未実装**） |

Migration: `20260711100000` · `20260712100000`

## `business_directory_profiles` — **実装済み**

1:1 · 連絡先 · 所在地 · 種別別テキスト列。

**Phase 2a 追加列（実装済み · migration `20260717120000`）:**

| 列 | 用途 |
| --- | --- |
| `seo_title` | SEO タイトル |
| `meta_description` | meta description |
| `faq_items` | jsonb `[{q,a}]` max 5 |
| `recommended_uses` | text[] おすすめ用途 |

**採用方針:** `blocks_json` / `page_content` テーブルは **使わない**（Phase 2a = 固定列 · AD-012 単純 UI）。将来拡張は §Future 参照。

## `business_directory_pending_updates` — **実装済み**

| 列 | 型 | 説明 |
| --- | --- | --- |
| `listing_id` | uuid PK/FK | → listings ON DELETE CASCADE |
| `content_json` | jsonb | `ContentBundle`（listing · profile · photos · business_hours） |
| `updated_at` | timestamptz | Edge upsert 時更新 |

- RLS: **ENABLED** · named policy **なし** · `REVOKE` anon/authenticated · `GRANT` service_role のみ  
- Edge: `loadPendingContent` / `savePendingContent` / `clearPendingContent`

Migration: `20260715110000` — Production **partial apply 済**（2026-07-01 · view 除外。正本: [reports/sql/business-directory-15110000-partial-apply.sql](../../reports/sql/business-directory-15110000-partial-apply.sql)）

## `business_directory_review_requests` — **実装済み**

| 列 | 備考 |
| --- | --- |
| `request_type` | `initial_publish` · `content_update` · `plan_upgrade` |
| `snapshot_json` | 申請時 pending / draft スナップショット |
| `published_snapshot_json` | **15110000** · content_update 時の **live** スナップショット |

## `business_directory_ai_draft_usage_daily` — **実装済み**

| 列 | 説明 |
| --- | --- |
| `(user_id, date_jst)` | PK · JST 日付キー |
| `used_count` | 当日利用回数 |

- RLS: policy `bd_ai_draft_usage_daily_deny_all`（全 deny）· Edge service_role + RPC のみ

Migration: `20260716100000`

## 子テーブル · マスタ — **実装済み**

| テーブル | 用途 |
| --- | --- |
| `business_directory_photos` | Storage `business-directory` bucket 参照 |
| `business_directory_business_hours` | 営業時間 |
| `business_directory_social_links` | SNS（Standard+） |
| `business_directory_tlv_videos` | TLV embed 参照（Pro+） |
| `business_directory_categories` | カテゴリ木 |
| `business_directory_plan_features` | プラン機能マスタ |
| `business_directory_audit_logs` | append-only 監査 |

Storage bucket: `20260715100000` · public · 5MB · jpeg/png/webp

## Verification 系 — **設計済み · 未 migration**

| テーブル | 責務 |
| --- | --- |
| `business_directory_verification_rules` | カテゴリ別 `verification_level` · 必須 check |
| `business_directory_verification_requests` | 初回/更新/再審査の Verification 申請 |
| `business_directory_verification_checks` | 項目単位 · provider 照合結果 |
| `business_directory_verification_documents` | Storage 参照 · 書類 |

`listings` への cache 列（`verification_status` · `verification_badges` 等）も **設計済み**。

正本: [business-directory-verification-architecture.md](./business-directory-verification-architecture.md)

---

# Relationships

## リレーション概要

```text
listings (1) ── (1) profiles
listings (1) ── (0..1) pending_updates
listings (1) ── (0..n) review_requests
listings (1) ── (0..n) photos | hours | social | tlv | audit_logs
listings (N) ── (1) categories
listings (N) ── (1) plan_features
auth.users (1) ── (0..n) ai_draft_usage_daily
```

## 外部キー · 整合性

| FK | ON DELETE | 意図 |
| --- | --- | --- |
| `listings.owner_user_id` → `auth.users` | CASCADE | ユーザー削除時 listing 削除 |
| `profiles.listing_id` → `listings` | CASCADE | listing 削除で profile 連鎖 |
| `pending_updates.listing_id` → `listings` | CASCADE | listing 削除で pending 破棄 |
| `review_requests.listing_id` → `listings` | CASCADE | — |
| 子表 `listing_id` → `listings` | CASCADE | 一貫した listing スコープ |
| `ai_draft_usage_daily.user_id` → `auth.users` | CASCADE | — |

**CHECK 制約:** `status` · `listing_type` · `request_type` · `subscription_status` 等 — migration 正本。

**slug 一意:** `(owner_user_id, slug)` — Owner 内 URL 一意。

---

# Index Strategy

## 実装済みインデックス（migration 由来）

| 用途 | インデックス | テーブル |
| --- | --- | --- |
| **公開一覧** | `(status, listing_type)` · `(published_at DESC) WHERE published` | listings |
| **Owner ダッシュボード** | `(owner_user_id)` | listings |
| **カテゴリ絞込** | `(category_id)` | listings |
| **地域** | GIN `(service_areas)` | listings |
| **Ops 審査キュー** | `(status, submitted_at) WHERE open` | review_requests |
| **listing 別審査履歴** | `(listing_id, submitted_at DESC)` | review_requests |
| **監査参照** | `(listing_id, created_at DESC)` | audit_logs |
| **pending 運用** | `(updated_at DESC)` | pending_updates |
| **quota 日次** | `(date_jst)` | ai_draft_usage_daily |
| **Stripe** | `(stripe_subscription_id)` · `(subscription_status)` partial | listings |
| **カテゴリマスタ** | `(listing_type, sort_order)` | categories |

## 検索 · Owner · Admin · 公開

| シナリオ | 現状 | 将来 |
| --- | --- | --- |
| **Public キーワード** | view + Edge · アプリ層フィルタ | `search_text` + GIN / tsvector トリガ（**未実装**） |
| **Owner 一覧** | `owner_user_id` index + RLS | 複数 listing（Premium · **未実装**） |
| **Admin 審査** | `review_requests` open index | Verification キュー join（**設計済み**） |
| **公開 detail** | PK · slug（Edge 解決） | — |
| **AI 検索 / おすすめ** | `allow_ai_recommend` フラグのみ | pgvector · 別 Epic（**未実装**） |

## 将来 pgvector（**未実装**）

方針案（data model § 参照）:

- `listings.embedding vector(1536)` または別 `business_directory_search_documents`
- listing + profile テキストから Edge/batch で embedding 生成
- Public 検索 API と TASFUL AI おすすめ（Pro+）は **別クエリ path** — Marketplace 検索と混在禁止

---

# RLS Architecture

## 原則

| 主体 | DB アクセス |
| --- | --- |
| **Public（anon）** | `published` listing / profile / 子表 · view `listings_public` |
| **Owner（authenticated）** | 自身 `owner_user_id` の listing ツリー CRUD |
| **Admin / Ops** | `business_directory_is_ops_admin()` — JWT `role` / `app_metadata.role` |
| **service_role** | Edge のみ · RLS bypass · pending · quota |
| **Direct client → pending / quota 表** | **禁止**（REVOKE / deny policy） |

## テーブル別（実装済み）

| テーブル | Public | Owner | Ops | Edge (service_role) |
| --- | --- | --- | --- | --- |
| マスタ（categories · plan_features） | SELECT | SELECT | ALL（categories） | ALL |
| listings / profiles / 子表 | SELECT published | ALL own | ALL | ALL |
| review_requests | — | SELECT/INSERT own | ALL | ALL |
| audit_logs | — | SELECT own listing | SELECT | INSERT（Edge） |
| pending_updates | — | — | — | ALL（RLS on · policy なし） |
| ai_draft_usage_daily | deny | deny | deny | RPC 経由のみ |

## Edge との役割分担

- **状態遷移**（approve · suspend · content_update apply）は Edge + service_role — Owner JWT では live 直接更新しない設計（content_update 時）
- **RLS** は defense in depth · 漏洩時の published 以外非公開
- Ops 判定: `business_directory_is_ops_admin()` — L7 JWT claims 前提（Auth hook · 環境別設定は [supabase-environments.md](../supabase-environments.md)）

Verification 追加時 RLS 案 → [business-directory-verification-architecture.md](./business-directory-verification-architecture.md) §7

---

# Content Update Flow

## 旧公開維持方式（実装済み）

公開済み listing の編集は **live 行を直接更新しない**。差分は `pending_updates.content_json` に蓄積し、Ops 承認まで public は **旧 published 内容** を返す。

```text
published（live: listings + profiles + 子表）
    │
    │ Owner: update_draft_listing（Edge）
    ▼
pending_updates（content_json にマージ · live 不変）
    │
    │ Owner: submit_listing_for_review（request_type=content_update）
    ▼
review_requested + review_requests.open
    · snapshot_json = pending 全文
    · published_snapshot_json = live 全文（監査比較用）
    │
    │ Public: listings_public / Edge get_public_*
    ▼
【旧公開維持】view 条件:
  status = 'published'
  OR (status = 'review_requested' AND published_at IS NOT NULL)
    │
    │ Ops: approve_listing
    ▼
applyContentSnapshotToLive → live 更新
clearPendingContent
status → published
```

**却下時:** pending clear · live **変更なし** · status → `published`

**初回公開（initial_publish）:** pending 表は使わない · draft/rejected から live 直接更新。

Edge 実装: `supabase/functions/_shared/business-directory.ts`  
設計: [business-directory-self-service-design.md](../business-directory-self-service-design.md)

---

# AI Draft Architecture

## 構成（実装済み）

```text
Owner UI（business-directory-ai-draft.js）
    │ action: generate_listing_draft
    ▼
Edge: generateListingDraft
    │ 1) consumeAiDraftQuota → RPC consume_business_directory_ai_draft_quota
    │ 2) validateGenerateListingDraftInput（prefecture · city 必須 等）
    │ 3) Gemini または mock fallback
    ▼
Response: draft payload（short_description · seo · faq 等）
    │ Owner が edit/new に反映 → update_draft_listing → profiles
    ▼
listings / profiles（通常 CRUD · quota 表とは独立）
```

| 項目 | 内容 |
| --- | --- |
| **Quota** | 全プラン **10 回/日（JST）** · `BD_AI_DRAFT_DAILY_LIMITS` |
| **RPC** | `consume_business_directory_ai_draft_quota(p_user_id, p_date_jst, p_limit)` → jsonb |
| **テーブル** | `business_directory_ai_draft_usage_daily` |
| **Draft 保存** | **profiles/listings** — quota 表に draft 本文は保存しない |

## Builder Lite との関係

| 項目 | Business Directory AI Draft | Builder AI |
| --- | --- | --- |
| エンジン | BD Edge `business-directory` | Builder `surface=builder_ai` |
| DB | `business_directory_*` | Builder 専用 schema |
| 統合 | **なし**（AD-002） | — |
| UI ラベル | Owner new/edit · Phase 2a 固定フィールド | Builder プロジェクト |

Phase 2a の「固定セクション」（SEO · FAQ · recommended uses 列）は **Builder blocks_json ではなく profiles 列** — いわゆる **Lite ページ構成** を DB 列で表現。AI draft はそれら列向け JSON を生成する。

---

# Verification Architecture

**ステータス: 設計済み · migration / Edge action 未実装**

| 概念 | DB 上の位置づけ（将来） |
| --- | --- |
| `verification_level` | `verification_rules` per category |
| Provider adapter | `verification_checks.provider` · 外部 API 結果 |
| 書類 | `verification_documents` + Storage |
| Ops 審査 | 既存 `review_requests` を **拡張**（置換しない） |
| content_update 連携 | pending の license/insurance 変更 → verification_request 再 open |

将来 Edge 例: `run_verification_ai_review` — **BD 専用 adapter** · `ai-model-gateway.js` 契約変更なし（AD-005）。

正本: [business-directory-verification-architecture.md](./business-directory-verification-architecture.md)  
フェーズ: V1 Manual+AI checklist → V2 API 照合 → V4 Renewal

---

# Migration Strategy

## Migration チェーン（リポジトリ正順）

| Version | ファイル | 内容 | ステータス |
| --- | --- | --- | --- |
| `20260711100000` | phase1_schema | 10 表 · view · RLS · 関数 | **実装済み** |
| `20260711100001` | phase1_seed | categories · plan_features | **実装済み** |
| `20260712100000` | phase6_stripe | listings Stripe 列 | **実装済み** |
| `20260715100000` | storage | bucket `business-directory` | **実装済み** |
| `20260715110000` | content_update | pending · published_snapshot · view | **実装済み** · **Production partial apply 済** |
| `20260716100000` | ai_draft_usage | quota 表 · RPC | **実装済み** · **Production apply 済** |
| `20260717120000` | phase2a | profiles SEO/FAQ · view 更新 | **実装済み** · **Production apply 済** |

## 環境別適用状態（固定 · 2026-07-01）

| 環境 | ref | 状態 |
| --- | --- | --- |
| **Production** | `ddojquacsyqesrjhcvmn` | Phase 1–6 · storage · Phase 2a · **`15110000` partial · `16100000` full 適用済** · **DB Production Ready Go** |
| **Staging** | `ahlxuyvhzqdqaojiywmu` | BD チェーン **適用済**（MVP-1 セットアップ · [tasful-supabase-staging-mvp1-setup.md](../../reports/tasful-supabase-staging-mvp1-setup.md)） |

**Production apply 記録:** [business-directory-production-controlled-apply-result.md](../../reports/business-directory-production-controlled-apply-result.md)

## Production controlled apply（完了 · 再 apply 不要）

| Migration | Production 状態 |
| --- | --- |
| `15110000` | **partial apply 済**（[snippet](../../reports/sql/business-directory-15110000-partial-apply.sql) · view block **未実行**） |
| `16100000` | **full apply 済** |
| `17120000` | **適用済**（再実行不要） |
| Edge redeploy | **不要**（DB のみ · 実施なし） |
| Rollback | **不要** |

## Staging 運用

- Greenfield: timestamp 順 **full apply** 可（`15110000` → `16100000` → `17120000`）
- Phase 2a 先行ドリフト時: Production と同様 **partial `15110000`**
- 詳細: [supabase-environments.md](../supabase-environments.md) · [tasful-supabase-staging-project-plan.md](../../reports/tasful-supabase-staging-project-plan.md)

## Edge Functions（DB 関連 · 実装済み）

| Function | DB 操作 |
| --- | --- |
| `business-directory` | listings CRUD · pending · review · quota RPC 呼出 · public read |
| `stripe-webhook` | listings サブスク列更新 |

---

# Future Expansion

| テーマ | ステータス | 方針 |
| --- | --- | --- |
| **page_content / blocks_json** | **未採用** | Phase 2a = 固定列。将来ブロック化する場合は **新 migration** · Verification / Public render と整合 |
| **Vector Search** | **未実装** | pgvector · embedding 列 · AI おすすめ（Pro+）— Marketplace 検索と path 分離 |
| **Provider Adapter** | **設計済み** | Verification `checks` · 法人番号 · 許可 DB — Edge adapter 層 |
| **Renewal** | **設計済み** | `verification_expires_at` · 定期再審査（Phase V4） |
| **Fraud Detection** | **未実装** | audit_logs · verification risk_score · Ops ワークフロー拡張 |
| **Premium** | **未実装** | 複数 listing · 予約 · Connect 決済 — `plan_features` 拡張 |
| **Verification V1+** | **設計済み** | rules · requests · checks · documents テーブル群 |

---

# 関連ファイル

| 種別 | パス |
| --- | --- |
| Phase 1 schema | `supabase/migrations/20260711100000_business_directory_phase1_schema.sql` |
| content_update | `supabase/migrations/20260715110000_business_directory_content_update.sql` |
| partial apply 正本 | `reports/sql/business-directory-15110000-partial-apply.sql` |
| AI quota | `supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql` |
| Phase 2a | `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql` |
| Edge shared | `supabase/functions/_shared/business-directory.ts` |
| Edge AI | `supabase/functions/_shared/business-directory-ai.ts` · `business-directory-ai-quota.ts` |
| Edge router | `supabase/functions/business-directory/index.ts` |

---

# 本 SSOT の位置づけ

| ドキュメント | 役割 |
| --- | --- |
| **本ファイル** | **DB アーキテクチャ SSOT** — 表 · 関係 · RLS · フロー · migration 戦略 |
| [business-directory-data-model-design.md](../business-directory-data-model-design.md) | 列定義 · 状態遷移 · RLS 詳細（設計起草 · migration と reconcile） |
| [business-directory-architecture.md](./business-directory-architecture.md) | 製品境界 · 論理アーキテクチャ |
| [business-directory-verification-architecture.md](./business-directory-verification-architecture.md) | Verification 拡張 SSOT |

**更新ルール:** migration 追加時 — 本ファイルの「環境別適用状態」を更新。**Production controlled apply 完了（2026-07-01）以降、`15110000`/`16100000` の再 apply は不要** — [apply result](../../reports/business-directory-production-controlled-apply-result.md) を正本とする。

---

*本ファイルは設計 · ドキュメントのみ。migration / SQL 実行 / Edge 変更は別タスクで実施する。*
