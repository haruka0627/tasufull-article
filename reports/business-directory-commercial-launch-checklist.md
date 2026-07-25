# Business Directory — Commercial Launch 前チェックリスト

**最終更新:** 2026-07-04  
**Commercial Launch 判定:** **Conditional**（DB Production Ready Go · UI CONDITIONAL GO · Stripe E2E / OB 残）  
**正本:** [launch gate prep](./business-directory-launch-gate-prep.md) · [operational readiness](./business-directory-operational-readiness.md) · [R2 readiness](./business-directory-production-stripe-e2e-readiness.md) · [OB4 monitoring](./business-directory-ob4-monitoring.md)

**記号:** ✅ 完了 · ⏸ 未実施/未確認 · ❌ 未達 · 🔄 進行中

---

## 1. Stripe

| # | 項目 | 状態 | 正本 / 備考 |
| --- | --- | --- | --- |
| ST-1 | Phase 6 Stripe コード（Checkout / Portal / Webhook） | ✅ | [phase6-stripe.md](./business-directory-phase6-stripe.md) · 52/52 |
| ST-2 | Production Edge secrets 名（Test） | ✅ | [step2-edge.md](./business-directory-production-step2-edge.md) |
| ST-3 | Test Price ID（Standard / Pro） | ✅ | `price_1TmyY0…` · `price_1TmyY2…` |
| ST-4 | Webhook endpoint URL 設定 | ✅ | Production `stripe-webhook` |
| ST-5 | Webhook **6 events** Dashboard 購読 | ⏸ | H2 — `.env` に Stripe key なし · **Dashboard 人手目視残** |
| ST-6 | Webhook test delivery 成功 | ✅ | Step 4 4242 → plan=standard（間接確認） |
| ST-7 | R2 Test E2E（4242） | ✅ | Step 4 **48/48** + R2 rich planGate（2026-07-01 実行フェーズ） |
| ST-8 | Portal 解約 Runbook | ✅ | [portal-cancel-runbook.md](./business-directory-r2-portal-cancel-runbook.md) |
| ST-9 | Stripe **Live** keys / Price / webhook | ❌ | OB2 · Launch 直前 |
| ST-10 | Live 小額 E2E + 返金手順 | ❌ | OB2 後 |
| ST-11 | Customer Portal Dashboard 有効化確認 | ⏸ | L3 · Test 目視 |

---

## 2. Business Directory

| # | 項目 | 状態 | 正本 / 備考 |
| --- | --- | --- | --- |
| BD-1 | MVP-1 実装（Phase 1–7） | ✅ | MVP-1 Complete |
| BD-2 | Production DB controlled apply | ✅ | [apply result](./business-directory-production-controlled-apply-result.md) |
| BD-3 | R1 public/detail config | ✅ | [detail config fix](./business-directory-public-detail-config-fix.md) |
| BD-4 | R1b public/list config | ✅ | [list config fix](./business-directory-public-list-config-fix.md) |
| BD-5 | Owner / Admin / Public フロー | ✅ | Step 4 48/48（2026-06-27） |
| BD-6 | Post-apply smoke（Stripe 除外） | ✅ | S2 16/0 · S3 15/0 |
| BD-7 | Post-apply Stripe E2E | ✅ | Step 4 48/48 · Phase 2a 1 fail（API-only） |
| BD-8 | Portal 解約 E2E 実施 | ⏸ | Runbook 整備済 · **未実施** |
| BD-9 | plan_code RLS ガード（M6） | ⏸ | Launch 前推奨 · 別 Epic |
| BD-10 | MVP-2（タブ編集 · Pro TLV 等） | ❌ | Launch 不要 · No-Go 維持 |

---

## 3. Production

| # | 項目 | 状態 | 正本 / 備考 |
| --- | --- | --- | --- |
| PR-1 | Production ref `ddojquacsyqesrjhcvmn` | ✅ | 固定 |
| PR-2 | Edge `business-directory` ACTIVE | ✅ | Step 2 · apply 後 redeploy 不要 |
| PR-3 | Edge `stripe-webhook` ACTIVE | ✅ | 同上 |
| PR-4 | Migration 17120000 適用 | ✅ | controlled apply |
| PR-5 | Cloudflare Pages Production build | ✅ | `tasufull-article.pages.dev` |
| PR-6 | `TASFUL_SUPABASE_*` Production | ✅ | build 注入 |
| PR-7 | Migration history repair（OB5） | ⏸ | staging 推奨 · 未実施 |
| PR-8 | 監視・アラート（OB4） | 🔄 | **Runbook Ready** · 運用設定未 — [ob4-monitoring](./business-directory-ob4-monitoring.md) |
| PR-9 | 障害 Runbook 承認 | 🔄 | [operational readiness §10](./business-directory-operational-readiness.md) |

---

## 4. Browser

| # | 項目 | 状態 | 正本 / 備考 |
| --- | --- | --- | --- |
| BR-1 | 8788 dev 検証（file:// 禁止） | ✅ | [_global.mdc](../.cursor/rules/_global.mdc) |
| BR-2 | Owner dashboard / edit / new | ✅ | Step 4 + R1/R1b |
| BR-3 | Admin reviews / listing | ✅ | Step 4 |
| BR-4 | Public list / detail / search | ✅ | R1/R1b config 修正済 |
| BR-5 | Checkout 4242（8788） | ✅ | Step 4 Playwright 4242（2026-07-01） |
| BR-6 | Public planGate Standard rich | ✅ | R2B listing browser faq/full/uses（2026-07-01 実行フェーズ） |
| BR-7 | Viewport 1280 / 768 / 390 | ✅ | UI Launch Gate 2026-07-04 · [commercial-ui-launch-gate](./business-directory-commercial-ui-launch-gate.md) |
| BR-8 | Console error 0 | ✅ | Step 4 browser smoke · UI Launch Gate |
| BR-9 | **本番公開 URL** smoke（OB1 後） | ❌ | Access 方針未決 |

---

## 5. Human Go / No-Go

| # | 項目 | 状態 | 正本 / 備考 |
| --- | --- | --- | --- |
| HG-1 | **OB1** 公開 URL / Cloudflare Access 方針 | ❌ | [launch gate §OB1](./business-directory-launch-gate-prep.md) |
| HG-2 | **OB2** Stripe Live 切替判断 | ❌ | OB8 前後の順序要確認 |
| HG-3 | **OB3** Owner オンボーディング | ⏸ | FAQ 草案 |
| HG-4 | **OB4** 監視・アラート | 🔄 | Runbook 整備済 · **ツール/通知/オンコールは人間** — [ob4-monitoring](./business-directory-ob4-monitoring.md) |
| HG-5 | **OB5** migration repair | ⏸ | 承認後 |
| HG-6 | **OB6** 法務文案 | ❌ | 規約 · 特商法 |
| HG-7 | **OB7** サポート窓口 | ❌ | 未整備 |
| HG-8 | **OB8** Commercial Launch **明示 Go** | ❌ | 全 OB 確認後 |
| HG-9 | R2 運用 Runbook 整備 | ✅ | 本更新 · E2E + Portal |
| HG-10 | Launch Gate レビュー日程 | ⏸ | 人間設定 |

---

## 6. 判定サマリー

| カテゴリ | Go 可否 | 備考 |
| --- | --- | --- |
| **Stripe（Test E2E）** | **Conditional Go** | ST-5 Dashboard 目視残 · ST-7 Step 4 Go |
| **Stripe（Live / Launch）** | **No-Go** | ST-9–10 · OB2 |
| **Business Directory** | **Conditional** | BD-8 Portal 解約未実施 |
| **Production 基盤** | **Go** | PR-1–6 |
| **Browser（8788）** | **Go** | UI Launch Gate · BR-7/8 |
| **Human Go/No-Go** | **No-Go** | OB1–OB8（OB4 は Runbook 済 · 設定未） |
| **Commercial Launch 総合** | **Conditional** | Test E2E Go · Launch OB 残 |

---

## 7. 最短次アクション（2026-07-04）

1. **OB4 人間作業** — 監視ツール · 通知テスト · オンコール（[ob4-monitoring §7](./business-directory-ob4-monitoring.md)）
2. **ST-5** — Stripe Dashboard（Test）**6 events 目視**（読取のみ）
3. **BD-8** — [portal-cancel-runbook](./business-directory-r2-portal-cancel-runbook.md) 解約 E2E（Test）
4. **本番 API E2E** — safe-smoke preflight 済 · `--execute` は service role + 人間承認後
5. **OB1–OB3 · OB6–OB8** — Commercial Launch Human Gate（Stripe Live は OB8 後）

---

## 8. 関連 Runbook

| ファイル | 用途 |
| --- | --- |
| [r2-production-test-stripe-e2e-runbook.md](./business-directory-r2-production-test-stripe-e2e-runbook.md) | Test E2E 実施 |
| [r2-portal-cancel-runbook.md](./business-directory-r2-portal-cancel-runbook.md) | Portal 解約 |
| [production-stripe-e2e-readiness.md](./business-directory-production-stripe-e2e-readiness.md) | 監査 · ブロッカー |
| [launch-gate-prep.md](./business-directory-launch-gate-prep.md) | OB1–OB8 |

---

*Commercial Launch 前チェックリスト — R2 運用準備 2026-07-01 更新。*
