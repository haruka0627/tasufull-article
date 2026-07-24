# Business Directory — Commercial Launch チェックリスト（2026-07-04 更新案）

**作成日:** 2026-07-04  
**状態:** 計画（更新案 · commit/deploy 禁止）  
**正本:** [commercial-launch-checklist.md](./business-directory-commercial-launch-checklist.md) · [operational-readiness](./business-directory-operational-readiness.md) · [launch-gate-prep](./business-directory-launch-gate-prep.md)

**記号:** ✅ 完了 · ⏸ 未実施/未確認 · ❌ 未達 · 🔄 進行中 · ⚡ Blocker · 📅 公開日実施

---

## 1. Stripe

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| ST-1 | Phase 6 Stripe コード（Checkout / Portal / Webhook） | ✅ | 52/52 |
| ST-2 | Production Edge secrets 名（Test） | ✅ | |
| ST-3 | Test Price ID（Standard / Pro） | ✅ | |
| ST-4 | Webhook endpoint URL 設定 | ✅ | Production `stripe-webhook` |
| ST-5 | Webhook **6 events** Dashboard 購読 | ⏸ | Dashboard 人手目視残 |
| ST-6 | Webhook test delivery 成功 | ✅ | Step 4 4242 → plan=standard |
| ST-7 | R2 Test E2E（4242） | ✅ | Step 4 **48/48** |
| ST-8 | Portal 解約 Runbook | ✅ | |
| ST-9 | Stripe **Live** keys / Price / webhook | ❌ ⚡ | **Blocker** · OB2 · Launch 直前 |
| ST-10 | Live 小額 E2E + 返金手順 | ❌ ⚡ | **Blocker** · OB2 後 |
| ST-11 | Customer Portal Dashboard 有効化確認 | ⏸ | Test 目視 |

---

## 2. Business Directory（MVP-1）

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| BD-1 | MVP-1 実装（Phase 1–7） | ✅ | Complete |
| BD-2 | Production DB controlled apply | ✅ | 2026-07-01 |
| BD-3 | R1 public/detail config | ✅ | |
| BD-4 | R1b public/list config | ✅ | |
| BD-5 | Owner / Admin / Public フロー | ✅ | Step 4 48/48 |
| BD-6 | Post-apply smoke（Stripe 除外） | ✅ | S2 16/0 · S3 15/0 |
| BD-7 | Post-apply Stripe E2E | ✅ | Step 4 48/48 |
| BD-8 | Portal 解約 E2E 実施 | ⏸ | Runbook 整備済 · 未実施 |
| BD-9 | plan_code RLS ガード（M6） | ⏸ | Launch 前推奨 |
| BD-10 | MVP-2（タブ編集 · Pro TLV 等） | ❌ | Launch 不要 |

---

## 3. Production 基盤

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| PR-1 | Production ref `ddojquacsyqesrjhcvmn` | ✅ | 固定 |
| PR-2 | Edge `business-directory` ACTIVE | ✅ | |
| PR-3 | Edge `stripe-webhook` ACTIVE | ✅ | |
| PR-4 | Migration 17120000 適用 | ✅ | controlled apply |
| PR-5 | Cloudflare Pages Production build | ✅ | `tasufull-article.pages.dev` |
| PR-6 | `TASFUL_SUPABASE_*` Production | ✅ | build 注入 |
| PR-7 | **OB5** Migration history repair | ✅ | **2026-07-04 完了** — 4 件 repair · BD 7 件 Remote 整合 |
| PR-8 | **OB4** 監視・アラート | ✅ | **2026-07-04 P0 完了** — smoke 2 本 · oncall runbook · package.json |
| PR-9 | 障害 Runbook 承認 | 🔄 | 草案整備済 · 運営承認待ち |
| PR-10 | **OB1** Cloudflare Access / robots 解除 | ❌ ⚡ | **Blocker** · 調査完了 · 未実施 |

---

## 4. Browser / Smoke

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| BR-1 | 8788 dev 検証（file:// 禁止） | ✅ | |
| BR-2 | Owner dashboard / edit / new | ✅ | |
| BR-3 | Admin reviews / listing | ✅ | |
| BR-4 | Public list / detail / search | ✅ | |
| BR-5 | Checkout 4242（8788） | ✅ | |
| BR-6 | Public planGate Standard rich | ✅ | |
| BR-7 | Viewport 1280 / 768 / 390 | ⏸ | 記録未実施 |
| BR-8 | Console error 0 | ✅ | OB4 browser smoke 8/8 PASS |
| BR-9 | 本番公開 URL smoke（OB1 後） | ❌ ⚡ | **Blocker** · OB1 Access 解除後 |
| BR-10 | **OB4** 統合 smoke `npm run smoke:business-directory` | ✅ | **2026-07-04 完了** — 7/8 PASS · 1 SKIP |
| BR-11 | **OB4** Playwright browser smoke（4 画面） | ✅ | **2026-07-04 完了** — 8/8 PASS · Console Error 0 |

---

## 5. Operations（OB1–OB8）

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| HG-1 | **OB1** 公開 URL / Cloudflare Access 方針 | ❌ ⚡ | **Blocker** · 調査完了 · 運営判断待ち |
| HG-2 | **OB2** Stripe Live 切替判断 | ❌ ⚡ | **Blocker** · OB8 前後に実施 |
| HG-3 | **OB3** Owner オンボーディング | ⏸ | FAQ 草案 · 運営判断待ち |
| HG-4 | **OB4** 監視・アラート | ✅ | **2026-07-04 P0 完了** · smoke + runbook + package.json |
| HG-5 | **OB5** migration repair | ✅ | **2026-07-04 完了** · Production 4 件 repair |
| HG-6 | **OB6** 法務文案 | ❌ ⚡ | **Blocker** · 規約 · 特商法 |
| HG-7 | **OB7** サポート窓口 | ❌ ⚡ | **Blocker** · 未整備 |
| HG-8 | **OB8** Commercial Launch **明示 Go** | ❌ ⚡ | **Blocker** · 全 OB 確認後 |
| HG-9 | R2 運用 Runbook 整備 | ✅ | |
| HG-10 | Launch Gate レビュー日程 | ⏸ | 人間設定 |

---

## 6. OB1 詳細（Cloudflare Access / robots / indexing）— 調査完了

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| OB1-01 | Cloudflare Access 解除（BD Public パス） | ❌ ⚡ | **Blocker** · サイト全体 Access 保護中 |
| OB1-02 | `robots.txt` 修正（`Disallow: /` → BD Public 許可） | ❌ ⚡ | **Blocker** · 全ページ クロール禁止 |
| OB1-03 | `_headers` 修正（`/*` `noindex` → BD Public 除外） | ❌ ⚡ | **Blocker** · HTTP header noindex |
| OB1-04 | build script meta robots 修正（BD Public ページ除外） | ❌ ⚡ | **Blocker** · `stage-cloudflare-pages.mjs` 注入 |
| OB1-05 | 公開 URL 方針決定（案 B: path 除外 or 案 C: Custom Domain） | ❌ ⚡ | **Blocker** · 運営判断 |
| OB1-06 | Custom Domain 設定（`directory.tasful.jp` 等） | ⏸ | 推奨 · Launch 後可 |
| OB1-07 | sitemap.xml 生成 | ⏸ | 推奨 · Launch 後可 |
| OB1-08 | Admin 画面 Access 維持（または `auth-ops-guard.js`） | ⏸ | 推奨 · Launch 後可 |

---

## 7. 公開日に実施する項目

| # | 項目 | 種別 | 備考 |
|---|------|------|------|
| 📅-1 | Cloudflare Access 解除（BD Public パス） | **必須** | Zero Trust Dashboard · OB1-01 |
| 📅-2 | `robots.txt` 更新 · `_headers` 更新 · build script 修正 | **必須** | `deploy/cloudflare/` 3 ファイル · OB1-02/03/04 |
| 📅-3 | `npm run build:pages` + Cloudflare Pages deploy | **必須** | OB1 変更反映 |
| 📅-4 | 本番公開 URL smoke（BR-9） | **必須** | `npm run smoke:business-directory:prod` + `capture-business-directory-ob4-smoke.mjs --prod` |
| 📅-5 | Stripe Live 切替（ST-9/ST-10） | **必須** | Dashboard · OB2 |
| 📅-6 | `npm run smoke:business-directory:prod` 最終確認 | **必須** | 8/8 PASS |
| 📅-7 | OB8 Commercial Launch 明示 Go | **必須** | 運営全承認 |
| 📅-8 | マーケット TOP / 公開ページに BD 入口表示 | 推奨 | 公開告知 |

---

## 8. Blocker 一覧（全 10 件）

| ID | 項目 | 種別 |
|----|------|------|
| ⚡-1 | OB1: Cloudflare Access 解除 | Human Decision + Ops Setting |
| ⚡-2 | OB1: robots.txt / _headers / build script 修正 | Code + Deploy |
| ⚡-3 | OB1: 公開 URL 方針決定 | Human Decision |
| ⚡-4 | OB2: Stripe Live 切替（ST-9/ST-10） | Human Decision + Ops Setting |
| ⚡-5 | OB6: 法務文案（規約 · 特商法） | Human Decision |
| ⚡-6 | OB7: サポート窓口 | Human Decision |
| ⚡-7 | OB8: Commercial Launch 明示 Go | Human Decision |
| ⚡-8 | BR-9: 本番公開 URL smoke | OB1 解除後 |
| ⚡-9 | PR-10: OB1 robots 解除（コード変更） | OB1 方針決定後 |
| ⚡-10 | HG-10: Launch Gate レビュー日程設定 | Human Decision |

---

## 9. 完了済み（2026-07-04 時点）

| ID | 項目 | 完了日 |
|----|------|--------|
| ✅ OB4 P0 | 統合 smoke + browser smoke + oncall runbook + package.json | 2026-07-04 |
| ✅ OB5 | Production migration repair（4 件 · BD 7 件整合） | 2026-07-04 |
| ✅ OB1 | Cloudflare Access / robots / indexing 調査 | 2026-07-04 |
| ✅ BD-1〜7 | MVP-1 実装 · DB apply · Step 4 smoke | 2026-06-27〜07-01 |
| ✅ PR-1〜6 | Production 基盤 | 2026-06-27〜07-01 |

---

## 10. 判定サマリー（更新）

| カテゴリ | Go 可否 | 備考 |
|----------|---------|------|
| **Stripe（Test E2E）** | **Conditional Go** | ST-5 Dashboard 目視残 |
| **Stripe（Live / Launch）** | **No-Go** | ST-9–10 · OB2 · 📅公開日 |
| **Business Directory MV0P-1** | **Go** | 全項目完了 |
| **Production 基盤** | **Go** | OB4/OB5 完了 · PR-1–10 完了/進行中 |
| **OB1 Access/robots** | **No-Go** | 調査完了 · 実装未 · ⚡ Blocker 3 件 |
| **OB3/OB6/OB7 運営** | **No-Go** | Human Decision 待ち |
| **OB8 承認** | **No-Go** | 全 OB 確認後 |
| **Commercial Launch 総合** | **No-Go** | ⚡ Blocker 10 件 · OB1/OB2/OB6/OB7/OB8 未解決 |

---

## 11. 最短次アクション（優先順）

1. **OB1** 公開 URL 方針決定 → Access 解除 + robots 修正（案 B または C）
2. **OB6** 法務文案 作成 · レビュー
3. **OB7** サポート窓口 開設
4. **OB3** Owner オンボーディング文案確定
5. **📅 公開日**: ST-9/10 Stripe Live 切替 → OB4 smoke 本番実行 → BR-9 smoke → OB8 Go

---

*Commercial Launch チェックリスト更新案 — 2026-07-04 作成。OB4 P0 · OB5 · OB1 調査の結果を反映。*