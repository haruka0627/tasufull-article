# Business Directory — 実装準備レポート（Implementation Readiness）

**日付:** 2026-06-28  
**Priority:** **P3 Business Directory**（Live Platform Core Complete 後の次優先）  
**種別:** 現状確認 · 実装準備のみ（**コード変更 · 本番公開 · 仕様変更なし**）  
**正本参照:** [docs/business-directory-mvp-design.md](../docs/business-directory-mvp-design.md) · [docs/TODO.md](../docs/TODO.md) · [docs/ROADMAP.md](../docs/ROADMAP.md) · [docs/PROJECT_STATUS.md](../docs/PROJECT_STATUS.md)

---

## Executive summary

| 項目 | 判定 |
| --- | --- |
| **MVP コア実装** | **完了済**（Phase 1–7 + Production Step 1–4） |
| **P3 着手（運用・硬さ強化 track）** | **Go** |
| **一般向け本番公開（Commercial Launch）** | **No-Go**（今回スコープ外 · ユーザー指示） |
| **次 Step** | **Step 5 — Operational Readiness**（下記 §8） |

Business Directory は **設計→実装→staging E2E→Production Pages deploy まで完了**している。P3 として進めるべきは **新規 MVP 実装** ではなく、**ドキュメント正本の整合 · 8788 回帰 · 運用準備 · 公開判断ゲート** である。

---

## 1. 現在の実装状態

### 1.1 コード資産（リポジトリ内）

| 領域 | パス | 状態 |
| --- | --- | --- |
| **Owner UI** | `business-directory/`（index · new · edit · plan 等） | 実装済 |
| **Admin UI** | `business-directory/admin/`（reviews · listing） | 実装済 |
| **Public UI** | `business-directory/public/`（list · detail） | 実装済 |
| **Client API** | `business-directory-repository.js` | 実装済 |
| **Edge** | `supabase/functions/business-directory/` · `stripe-webhook` | deploy 済（staging ref） |
| **Shared** | `supabase/functions/_shared/business-directory*.ts` | 実装済 |
| **DB** | `supabase/migrations/20260711*` · `20260712100000_*` | staging linked apply 済 |

### 1.2 実装フェーズ vs 設計（MVP 設計 §11 対照）

| 設計 Phase | 内容 | 実装状態 |
| --- | --- | --- |
| **MVP-1** | Self-Service 初回申請 · 審査 · 公開ページ · 検索 | **完了**（Phase 3–5 + Production E2E） |
| **MVP-2** | 公開後編集 · Pro（TLV · 問い合わせ） | **部分**（`edit.html` あり · タブ UI / Pro 機能未） |
| **MVP-3** | Stripe サブスク · プラン自動反映 | **完了**（Phase 6 · Test mode） |
| **Future** | Premium · Connect · 成果報酬 · 予約 | **未着手** |

### 1.3 Production Rollout 証跡（2026-06-27）

```text
Step 1 Migration  → Step 2 Edge/Secrets → Step 3 Preview E2E → Step 4 Production Go
```

| Step | レポート | 結果 |
| --- | --- | --- |
| 1 | [production-step1-migration.md](./business-directory-production-step1-migration.md) | **23/23 PASS** · staging DB apply |
| 2 | [production-step2-edge.md](./business-directory-production-step2-edge.md) | **15/15 PASS** · Edge + Stripe Test secrets |
| 3 | [production-step3-preview-e2e.md](./business-directory-production-step3-preview-e2e.md) | **15/15 PASS** · mock なし E2E |
| 4 | [production-step4-production.md](./business-directory-production-step4-production.md) | **48/48 PASS · Go** · Production Pages deploy |

**検証済み E2E 導線:**

```text
Owner create_draft → Stripe Checkout (4242) → webhook/sync → submit_for_review
  → Admin approve → Public list/detail (published only)
```

### 1.4 テストスイート一覧（記録値 · 2026-06-27）

| スイート | コマンド | PASS |
| --- | --- | --- |
| Phase 1 DB | `scripts/test-business-directory-phase1-schema.mjs` | 37 |
| Phase 2 API | `scripts/test-business-directory-phase2-api.mjs` | 68 |
| Phase 3 Owner UI | `scripts/test-business-directory-phase3-owner-ui.mjs` | 53 |
| Phase 4 Admin UI | `scripts/test-business-directory-phase4-admin-ui.mjs` | 35 |
| Phase 5 Public UI | `scripts/test-business-directory-phase5-public-ui.mjs` | 27 |
| Phase 6 Stripe | `scripts/test-business-directory-phase6-stripe.mjs` | 52 |
| Phase 7 Preflight | `scripts/test-business-directory-phase7-deploy-preflight.mjs` | 74 |
| Prod Step 1 | `test-business-directory-production-step1-migration.mjs --remote` | 23 |
| Prod Step 2 | `test-business-directory-production-step2-edge.mjs --remote` | 15 |
| Prod Step 3 | `test-business-directory-production-step3-preview-e2e.mjs --e2e` | 15 |
| Prod Step 4 | `test-business-directory-production-step4-production.mjs --all` | 48 |

**合計記録:** 447 テスト PASS（スイート別 · 単一コマンド統合ではない）

### 1.5 設計 vs 実装ギャップ（UI URL）

設計（[ui-flow-design.md](../docs/business-directory-ui-flow-design.md)）の論理パス:

- `/business-directory/listings/:id`（タブ編集）
- `/shop-directory/:slug` · `/service-directory/:slug`

**現行実装:**

- Owner: `index.html` · `new.html` · `edit.html`（フラット HTML）
- Public: `public/list.html` · `public/detail.html`

機能は E2E で担保済み。**URL 構造は設計の簡略版** — 仕様変更なし方針のため、P3 最初は **現行 URL を正** として運用準備を進める。

### 1.6 ドキュメント正本のズレ（要整理 · 実装ではない）

| ドキュメント | 記載 | 実態 |
| --- | --- | --- |
| [docs/README.md](../docs/README.md) | Production Step 2 · Pages prod 未着手 | Step 4 Go 済（** stale **） |
| [docs/ROADMAP.md](../docs/ROADMAP.md) §優先 | P2 実装待ち · P3 待機後 | P2 Core Complete · BD 実装済（** stale **） |
| [docs/PROJECT_STATUS.md](../docs/PROJECT_STATUS.md) | BD 行なし | 製品別サマリー未記載 |
| [mvp-design.md](../docs/business-directory-mvp-design.md) §10 | コード/DB/Stripe 未着手 | Phase 1–7 で ** superseded ** |

---

## 2. 完了済み

### 2.1 設計（AD-013）

- [x] サブスク掲載モデル · MVP 設計 · Self-Service · Data Model · UI Flow
- [x] Marketplace / Platform 成約手数料方針維持（境界明確）

### 2.2 実装（Phase 1–7）

- [x] DB schema + seed + Stripe subscription columns
- [x] Edge `business-directory` API（CRUD · 審査 · public read · checkout）
- [x] Owner / Admin / Public UI
- [x] Stripe Test: checkout · webhook · plan guard · sync
- [x] `npm run build:pages` dist 同期 · 市場 TOP 導線

### 2.3 Production 検証（Step 1–4）

- [x] Staging Supabase migration apply（direct SQL）
- [x] Edge deploy + BD Stripe Test Price secrets
- [x] Pages preview mock なし E2E
- [x] Production Pages deploy + 最終 smoke **48/48 Go**
- [x] Marketplace / Platform 副作用なし確認

### 2.4 Live Platform（P2 · 別 track · 今回 Complete 確定）

- [x] Phase A–F · 278 テスト PASS · TLV 未接続 · Post-MVP は別 track

---

## 3. 未完了

### 3.1 MVP 設計スコープ内（機能）

| 項目 | 設計参照 | 状態 |
| --- | --- | --- |
| 公開後編集タブ UI | ui-flow §3.4 | 部分（`edit.html` のみ） |
| Pro: TLV 動画 embed | mvp-design §2 | 未着手 |
| Pro: TASFUL 内問い合わせ | mvp-design §2 | 未着手（MVP は mailto/外部 HP） |
| Standard+: 口コミ | mvp-design §4 | 未着手 |
| Admin 通報 UI | ui-flow §5 | スキーマ余地 · UI MVP 外 |
| Admin 監査ログ UI | ui-flow | 未着手 |
| Premium プラン | mvp-design §4 | Future |
| 予約 · 見積 · Connect | mvp-design §4 | Future |

### 3.2 運用 · インフラ

| 項目 | 状態 |
| --- | --- |
| **Owner オンボーディング** 手順書 | 未整備（TODO REL-P1-07 次アクション） |
| **監視 / アラート** | 未整備 |
| **Migration history repair** | 未実施（Step 1 NOTE · `migration repair` 要） |
| **Supabase migration 履歴ドリフト** | 既知（Match/Live 等 · BD とは独立 Epic） |
| **Stripe Live mode** | 未切替（Test mode のみ · Step 2 証跡） |
| **8788 現 HEAD 回帰** | 本レポート時点 **未再実行**（Step 4 は 2026-06-27 HEAD） |
| **ドキュメント正本同期** | README / ROADMAP / PROJECT_STATUS / mvp-design §10 |

### 3.3 意図的に着手しない（Post-MVP / 禁止）

- TLV 再開 · Live Platform Post-MVP · ZEGO 本接続 · Chat UI · surface 別接続
- **一般向け Business Directory 本番公開**（今回ユーザー指示で禁止）
- 仕様変更の先行実装

---

## 4. 本番公開 blocker

**注:** Step 4 で Production **Pages deploy** は完了しているが、**一般ユーザー向け Commercial Launch** とは別。以下は **公開判断 Go** の blocker。

| # | Blocker | 詳細 | 深刻度 |
| --- | --- | --- | --- |
| B1 | **Cloudflare Access** | 正本 URL `tasufull-article.pages.dev` は Access 保護 · 未認証はログイン HTML（Step 4 NOTE） | **High** |
| B2 | **Owner オンボーディング未定** | サポートフロー · 審査 SLA · 料金説明 · 問い合わせ窓口 | **High** |
| B3 | **監視未整備** | Edge/Stripe/Webhook 障害検知 · 審査キュー滞留 | **Medium** |
| B4 | **Stripe Live 未準備** | 実課金は Test mode のみ · Live Price / Webhook 要設定 | **High**（課金開始時） |
| B5 | **Migration history 未 repair** | `schema_migrations` 未記録 · 将来 `db push` リスク | **Medium** |
| B6 | **ドキュメント正本不一致** | 運用判断の誤りリスク | **Medium** |
| B7 | **8788 回帰未確認（現 HEAD）** | Live Platform / 他領域変更後の BD 影響未知 | **Medium** |

**Blocker なし（技術 MVP コア）:** Owner 作成 → 審査 → 公開 → Public 表示 · Stripe Test checkout — **Step 3/4 で PASS 済**。

---

## 5. MVP に必要な残タスク

ユーザー指示（本番公開禁止 · 仕様変更禁止）を踏まえた **P3 残タスク**:

### 5.1 必須（公開判断前）

1. **ドキュメント正本同期** — README · ROADMAP · PROJECT_STATUS · mvp-design ヘッダ/§10
2. **8788 全 BD スイート再実行** — 現 working tree / HEAD で Phase 1–7 + Step 4 smoke（local `--smoke` 部分）
3. **Operational Readiness チェックリスト** — 監視 · オンボーディング · Access 方針 · Stripe Live 判断
4. **Migration repair 判断** — 運営確認後 `migration repair` 3 本

### 5.2 MVP-2 機能（仕様承認後 · 別 Step）

- 公開後編集タブ · Pro TLV embed · 問い合わせ導線 · 口コミ — **今回着手しない**

### 5.3 Commercial Launch（明示的に後回し）

- Cloudflare Access 解除 or 公開用ドメイン方針
- Stripe Live + 利用規約 · 特定商取引法表記
- マーケット TOP 本番導線の一般公開

---

## 6. 実装順序（P3 推奨）

```text
Step 5  Operational Readiness     ← 次に着手（本レポート）
  ├ 5a  Docs 正本同期（README / ROADMAP / PROJECT_STATUS / mvp-design）
  ├ 5b  8788 BD 回帰（Phase 1–7 + production smoke subset）
  ├ 5c  監視 · Owner オンボーディング playbook 草案
  ├ 5d  Migration repair 判断
  └ 5e  Launch Gate 判定（Commercial Launch Go/No-Go · 実施は別承認）

Step 6  MVP-2 機能（Future · 仕様凍結後）
  └ Pro TLV · 問い合わせ · 編集タブ UI 等

Step 7  Commercial Launch（Future · 全 blocker 解消後）
  └ Access · Stripe Live · 一般公開
```

**禁止（現フェーズ）:** Step 6/7 の先行 · TLV/Live Platform 接続 · 仕様変更実装

---

## 7. Go / No-Go

| 判断 | 結果 | 根拠 |
| --- | --- | --- |
| **P3 Business Directory 着手（運用 track）** | **Go** | MVP コア実装完了 · テスト証跡あり · 次は整合と運用準備 |
| **新規 MVP-1 実装開始** | **No-Go** | MVP-1 は完了済 |
| **Commercial Launch（一般公開）** | **No-Go** | B1–B4 blocker · ユーザー指示 |
| **仕様変更の先行実装** | **No-Go** | 設計正本優先 |
| **Live Platform Post-MVP** | **No-Go** | 別 track · Complete 確定 |

---

## 8. 次に着手すべき Step

### **Step 5 — Operational Readiness**（推奨 · コード最小）

| # | タスク | 成果物 | 備考 |
| --- | --- | --- | --- |
| 5a | ドキュメント正本同期 | `docs/README.md` · `ROADMAP.md` · `PROJECT_STATUS.md` · `mvp-design.md` §10 更新 | 実装変更なし |
| 5b | 8788 BD 回帰 | `reports/business-directory-step5-regression-8788.md` | `npm run dev` · Phase 1–7 + smoke |
| 5c | 運用 playbook 草案 | `docs/business-directory-operations-playbook.md`（新規 · 承認後） | オンボーディング · 監視項目 |
| 5d | Launch Gate 整理 | `reports/business-directory-launch-gate.md` | B1–B7 解消チェック |
| 5e | Migration repair | Step 1 手順どおり（**運営明示承認後**） | DB 操作 |

**最初の 1 手:** **5a + 5b** — 正本を Step 4 Go に揃え、現 HEAD で 8788 回帰を取ってから Launch Gate 議論。

---

## 参照レポート索引

| レポート | 内容 |
| --- | --- |
| [business-directory-mvp-design.md](./business-directory-mvp-design.md) | MVP 設計報告 |
| [business-directory-phase1-db.md](./business-directory-phase1-db.md) | Phase 1 |
| [business-directory-phase2-api.md](./business-directory-phase2-api.md) | Phase 2 |
| [business-directory-phase3-owner-ui.md](./business-directory-phase3-owner-ui.md) | Phase 3 |
| [business-directory-phase4-admin-ui.md](./business-directory-phase4-admin-ui.md) | Phase 4 |
| [business-directory-phase5-public-ui.md](./business-directory-phase5-public-ui.md) | Phase 5 |
| [business-directory-phase6-stripe.md](./business-directory-phase6-stripe.md) | Phase 6 |
| [business-directory-phase7-deploy-preflight.md](./business-directory-phase7-deploy-preflight.md) | Phase 7 |
| [business-directory-production-step1-migration.md](./business-directory-production-step1-migration.md) | Prod Step 1 |
| [business-directory-production-step2-edge.md](./business-directory-production-step2-edge.md) | Prod Step 2 |
| [business-directory-production-step3-preview-e2e.md](./business-directory-production-step3-preview-e2e.md) | Prod Step 3 |
| [business-directory-production-step4-production.md](./business-directory-production-step4-production.md) | Prod Step 4 |
| [platform-live-platform-summary.md](./platform-live-platform-summary.md) | Live Platform Core Complete |

---

## Live Platform Core 確定（2026-06-28）

Phase A–F **Go** · 278 テスト PASS · TLV / watch-video / live-broadcasts.js / live-comments.js 未接続 · Post-MVP は別 track。

P3 Business Directory へ優先順位移行 **承認済**。
