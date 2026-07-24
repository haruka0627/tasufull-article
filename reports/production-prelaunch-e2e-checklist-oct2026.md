# TASFUL 全サービス — 10月 Production 前 E2E チェックリスト

**作成:** 2026-07-05  
**実施時期:** **2026年10月リリース直前**（月次整理では実行しない）  
**環境:** ローカル `http://127.0.0.1:8788` · Staging Supabase · Stripe **Test** のみ  
**禁止:** Production Supabase 手動 SQL · Stripe Live · Cloudflare Production deploy（本チェックリスト完了＋Go 承認後のみ）

**関連:** [Builder 10月チェックリスト](./builder-general-jobs-october-release-checklist.md) · [商用前棚卸し](../docs/commercial-prep-inventory-2026-07.md)

---

## 0. 共通前提（全領域）

```bash
npm install
npm run build:pages
npm run dev
# netstat -ano | findstr 8788 → LISTEN
# wrangler Ready on http://127.0.0.1:8788
```

| # | 項目 | 確認 |
| --- | --- | --- |
| 0-1 | 開発サーバー 8788 のみ（`file://` · 5173 禁止） | [ ] |
| 0-2 | `npm run verify:pages-stage` | [ ] |
| 0-3 | `npm run smoke:pages` | [ ] |
| 0-4 | 対象 URL **HTTP 200** · Console Error **0**（既知 KI は記録） | [ ] |
| 0-5 | Viewport **1280 / 768 / 390** 代表画面スクリーンショット | [ ] |
| 0-6 | `docs/PROJECT_STATUS.md` · `docs/TODO.md` と HEAD 一致 | [ ] |
| 0-7 | `deploy/cloudflare/dist` がソースと同期（REL-P0-04） | [ ] |

---

## 1. Platform

| # | フロー / 画面 | コマンド / URL | 確認 |
| --- | --- | --- | --- |
| 1-1 | トップ・マーケット | `http://127.0.0.1:8788/index-top.html` | [ ] |
| 1-2 | 掲載作成 | `post.html` | [ ] |
| 1-3 | 求人 → 550円 → Talk 双方向 | `node scripts/capture-platform-job-talk-ui-review.mjs` | [ ] |
| 1-4 | Talk 手動 Review | `node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow --viewport=1280` | [ ] |
| 1-5 | 料金 FAQ | `/help/pricing/` · 掲載無料・550円・オプション予定 | [ ] |
| 1-6 | 利用規約 第7条 | `/company/legal/terms.html` | [ ] |
| 1-7 | オプション UI（準備中） | `/platform-options.html` · 決済ボタン disabled | [ ] |
| 1-8 | 会員ダッシュボード | `dashboard.html` | [ ] |
| 1-9 | Platform 回帰 | `node scripts/test-platform-finish-phase.mjs` · `test-platform-next-phase.mjs` | [ ] |

---

## 2. TASFUL Talk / Connect

| # | フロー / 画面 | コマンド / URL | 確認 |
| --- | --- | --- | --- |
| 2-1 | Talk Home | `talk-home.html` | [ ] |
| 2-2 | チャット一覧・詳細 | `talk-home.html?tab=chat` · `chat-detail.html` | [ ] |
| 2-3 | Platform Request 導線 | `platform-request.html` · create · detail | [ ] |
| 2-4 | 550円決済（Test） | `platform-chat-fee-pay.html` · Staging SKU | [ ] |
| 2-5 | Connect 会員バナー（該当時） | dashboard Connect banner | [ ] |
| 2-6 | 通知・未読（既知保留は記録） | `talk-home.html?tab=notify` | [ ] |

---

## 3. Builder

| # | フロー / 画面 | コマンド / URL | 確認 |
| --- | --- | --- | --- |
| 3-1 | Builder トップ | `/builder/builder-top.html` | [ ] |
| 3-2 | 一般案件（Staging） | Launch Smoke · RL-02 | [ ] |
| 3-3 | ワーカー / 業者検索 → Talk | `reports/ui-review/builder-*` 再現 | [ ] |
| 3-4 | Calendar Hub Primary | `node scripts/test-builder-calendar-cal-main-19-hub-primary-close.mjs` | [ ] |
| 3-5 | 条件検索 P0/P1 | `node scripts/test-builder-conditional-search-p0.mjs` | [ ] |
| 3-6 | Builder AI（FROZEN 回帰のみ） | `node scripts/test-builder-ai-tools-adaptation.mjs` | [ ] |
| 3-7 | **10月のみ** Production SQL + deploy | [builder-general-jobs-october-release-checklist.md](./builder-general-jobs-october-release-checklist.md) | [ ] |

---

## 4. Business Directory

| # | フロー / 画面 | コマンド / URL | 確認 |
| --- | --- | --- | --- |
| 4-1 | 公開一覧 | `business-directory/public/list.html` | [ ] |
| 4-2 | オーナー新規掲載 | `business-directory/new.html` | [ ] |
| 4-3 | オーナー管理 | `business-directory/index.html` | [ ] |
| 4-4 | Staging DB RLS（読取） | 手動 QA · MCP Staging read_only のみ | [ ] |
| 4-5 | Stripe Test サブスク（商用前） | Test mode Checkout のみ · **Live 禁止** | [ ] |
| 4-6 | Commercial Launch Go/No-Go | [business-directory-operational-readiness.md](../reports/business-directory-operational-readiness.md) L14 法務 | [ ] |

---

## 5. TLV Live

| # | フロー / 画面 | コマンド / URL | 確認 |
| --- | --- | --- | --- |
| 5-1 | 主要導線 smoke | `npm run verify:tlv-finish-main-flow-smoke` | [ ] |
| 5-2 | watch URL 正規化 | `watch.html?broadcast_id=` | [ ] |
| 5-3 | creator-dashboard non-fatal | RLS 42501 fallback UI | [ ] |
| 5-4 | Platform Live Phase 5 | `npm run verify:platform-live-zego-integration-phase5-p5-4-smoke` | [ ] |
| 5-5 | Payment Engine（Staging） | Edge webhook Test · idempotency | [ ] |
| 5-6 | Live UI 本番接続 | [tlv-payment-live-ui-connection-audit.md](../reports/tlv-payment-live-ui-connection-audit.md) — **Go 前ブロッカー** | [ ] |

---

## 6. TASFUL AI / AI 秘書（回帰のみ · 本体変更禁止）

| # | フロー / 画面 | コマンド / URL | 確認 |
| --- | --- | --- | --- |
| 6-1 | AI Workspace | `ai-workspace.html` | [ ] |
| 6-2 | Gateway 回帰 | `node scripts/test-tasful-ai-final-phase.mjs` | [ ] |
| 6-3 | Media monitoring | `node scripts/verify-tasful-ai-monitoring.mjs`（KI-014 flake 記録） | [ ] |
| 6-4 | AI 秘書（FROZEN） | `admin-operations-dashboard.html` · DeepSeek Function | [ ] |

---

## 7. 法務・公開文案

| # | 項目 | 確認 |
| --- | --- | --- |
| 7-1 | 利用規約（Platform 料金モデル） | [ ] |
| 7-2 | 特商法表記 | [ ] |
| 7-3 | プライバシーポリシー | [ ] |
| 7-4 | TLV clawback 条文（TODO-LEGAL-CB-01） | [ ] 未了なら No-Go 記録 |
| 7-5 | BD 専用法務（商用時） | [ ] |

---

## 8. Production Go / No-Go 集約（10月ウィンドウ）

| 領域 | 10月時点の判定欄 | ブロッカー記録 |
| --- | --- | --- |
| Platform | [ ] Go / [ ] No-Go | |
| Talk | [ ] Go / [ ] No-Go | |
| Builder 一般案件 | [ ] Go / [ ] No-Go | |
| Business Directory 商用 | [ ] Go / [ ] No-Go | |
| TLV Live 本番接続 | [ ] Go / [ ] No-Go | |
| TASFUL AI | [ ] Go / [ ] No-Go | |

**承認:** Product · DevOps · DB 管理者 · 法務（該当時）のサインオフ後のみ Phase B（Production SQL）・Phase C（CF deploy）へ進む。

---

## 9. 記録テンプレート（実施日）

```text
実施日: YYYY-MM-DD
実施者:
Git HEAD:
8788 HTTP: Platform __ / Talk __ / Builder __ / BD __ / TLV __ / AI __
Console Error: 0 / 既知 KI: __
Viewport: 1280 / 768 / 390 PASS
Regression: （実行コマンドと PASS/FAIL）
Production Go: __ / No-Go: __
残課題:
```

---

*本チェックリストは月次整理では実行しない。10月 Production 直前の証跡用とする。*
