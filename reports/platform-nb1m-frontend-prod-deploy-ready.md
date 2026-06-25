# Platform NB-1M — FRONTEND PRODUCTION DEPLOY READY

| 項目 | 内容 |
|------|------|
| **実施日** | 2026-06-26 |
| **種別** | Frontend Production 反映準備（**本番 DB 未操作**） |
| **本番 Supabase** | `ddojquacsyqesrjhcvmn`（FE と linked CLI DB 同一） |
| **Production 現行** | commit `1b32aba` · deploy `43e87305` |
| **local HEAD** | `4a4ec02`（Production より 9 commits 先行 · NB-1M FE は **未コミット**） |

---

## 最終判定

### **Ready for Frontend Production Deploy**

- 本番 DB は NB-1M 適用済み · **DB 変更なし**で Frontend のみ反映可能
- デプロイ対象ファイル確定 · 依存漏れなし · `npm run build:pages` **PASS**
- 回帰 **37/37 · 15/15 · Node ALL PASS**
- commit / push → Cloudflare Pages **Production 昇格**後に prod URL pre-smoke 実施

**本番 deploy 前 No-Go（Frontend 反映後も残る）:**

| ID | 項目 |
|----|------|
| G1 | prod URL pre-smoke **BLOCKED**（CF Access OTP 未更新） |
| G2 | `main` への commit / Production deploy **未実施**（本レポート時点） |

---

## 1. 現在の本番状態

| 層 | 状態 |
|----|------|
| **DB** | ✅ `moderation_status` · `platform_moderation_logs` · publish gate triggers · safe view 3-arg **適用済み** |
| **Production FE** | ❌ NB-1M Content Gate / OPS-FLOW-2 モジュール **未反映**（`1b32aba`） |
| **Preview FE** | ⚠️ `4a4ec02` = HEAD commit だが **NB-1M 未コミット分は Preview にも未含有** |
| **Working tree** | ✅ NB-1M 全モジュール + 配線済み HTML/JS **存在** |

参照: [`platform-prod-state-investigation.md`](platform-prod-state-investigation.md)

---

## 2. 棚卸し — 未コミット NB-1M Frontend

### 2.1 新規ファイル（Production / HEAD いずれにも不存在 · `??`）

| ファイル | 役割 |
|---------|------|
| `platform-content-gate.js` | Content Gate コア（scanListing / scanReview / 三層） |
| `platform-content-gate-events.js` | イベント emit · moderation log LS |
| `platform-content-gate-attachments.js` | Attachment Gate |
| `platform-content-gate-ai-bridge.js` | Gate → AI秘書 Inbox bridge |
| `platform-moderation-log.js` | LS + Supabase dual-write log |
| `platform-moderation-queue.js` | PendingReview · applyReviewAction |
| `platform-ops-action-url.js` | action_url · enrichSignal · deep link |
| `platform-ops-inbox-bridge.js` | Daily Inbox push / complete |
| `platform-ops-content-review.js` | `#ops-content-gate` · auto-select · PendingReviewCount |
| `platform-ops-chat-report-bridge.js` | Report → AI-ops Inbox |
| `platform-actor-resolver.js` | actor JWT 解決（dashboard / talk 等） |

### 2.2 変更ファイル（`1b32aba` / HEAD には存在 · working tree に NB-1M 差分）

| ファイル | 差分概要（vs `1b32aba`） |
|---------|------------------------|
| `admin-ai-daily-inbox.js` | +59 — Content Gate collect · category/severity |
| `admin-operations-dashboard.html` | +237 — `#ops-content-gate` · nav · script 配線 |
| `admin-operations-dashboard.js` | +41 — deep link · refresh · content review hook |
| `admin-operations-dashboard.css` | +2743 — 審査 UI / Inbox レイアウト |
| `post.html` | +8 — gate script tags |
| `listings-db.js` | gate 連携 · moderation 列 REST |
| `business-listings-db.js` | 同上 |
| `business-service-reviews-db.js` | review gate hook |
| `chat-service.js` | submitReport → bridge event |
| `support-ticket-service.js` | support scan / block |
| `support-trouble-center.js` | `?filter=report` 等 |
| `support-trouble-center.html` | 軽微配線 |
| `support-intake.html` | gate scripts |
| `chat-detail.html` | attachment gate scripts |
| `shop-market-listing-new.html` | gate scripts |
| `dashboard.html` | platform-actor-resolver |

### 2.3 OPS-FLOW-2 / deep link / PendingReviewCount

| 機能 | 主要モジュール | 配線先 |
|------|--------------|--------|
| action_url / `#ops-content-gate` | `platform-ops-action-url.js` · `platform-ops-content-review.js` | `admin-operations-dashboard.html` |
| Inbox push / Completed | `platform-ops-inbox-bridge.js` · `admin-ai-daily-inbox.js` | OPS dashboard |
| PendingReviewCount | `platform-ops-content-review.js` · `tasu:ops-content-review-completed` | dashboard refresh |
| Report filter | `support-trouble-center.js` | `?filter=report` |
| contact_leak | bridge + inbox | critical → Ack |

---

## 3. Production 未反映ファイル一覧

| 存在 | `1b32aba` Prod | `4a4ec02` Preview/HEAD | Working tree |
|------|---------------|------------------------|--------------|
| platform-*.js（11 本） | ❌ | ❌ | ✅ |
| admin-ops 差分 | 旧版 | 旧版 | ✅ NB-1M 版 |
| post/listings/chat/support 差分 | 旧版 | 旧版 | ✅ NB-1M 版 |

**Preview deploy `6f72468a`（`4a4ec02`）も NB-1M platform-* は未含有** — commit 後に Production 昇格が必要。

---

## 4. デプロイ対象ファイル一覧（Frontend のみ · DB 変更なし）

### 4.1 含める（31 ファイル）

```
platform-content-gate.js
platform-content-gate-events.js
platform-content-gate-attachments.js
platform-content-gate-ai-bridge.js
platform-moderation-log.js
platform-moderation-queue.js
platform-ops-action-url.js
platform-ops-inbox-bridge.js
platform-ops-content-review.js
platform-ops-chat-report-bridge.js
platform-actor-resolver.js
admin-ai-daily-inbox.js
admin-operations-dashboard.html
admin-operations-dashboard.js
admin-operations-dashboard.css
post.html
listings-db.js
business-listings-db.js
business-service-reviews-db.js
chat-service.js
support-ticket-service.js
support-trouble-center.js
support-trouble-center.html
support-intake.html
chat-detail.html
shop-market-listing-new.html
dashboard.html
scripts/lib/platform-content-gate-core.mjs
scripts/lib/platform-content-gate-attachments-core.mjs
scripts/lib/platform-actor-resolver-core.mjs
scripts/smoke-platform-nb1m-content-gate-browser.mjs
scripts/smoke-platform-ops-flow-2-browser.mjs
scripts/test-platform-content-gate.mjs
scripts/test-platform-ops-flow-2.mjs
scripts/test-platform-actor-resolver.mjs
scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs
scripts/smoke-platform-nb1m-prod-post-apply.mjs
```

Cloudflare Pages ビルドは `stage-cloudflare-pages.mjs` がルート JS/HTML を dist にコピー — **`deploy/cloudflare/dist` は commit 不要**（CI/build 時生成）。

### 4.2 除外（本タスク範囲外）

| カテゴリ | 例 | 理由 |
|---------|-----|------|
| DB / SQL | `sql/platform-nb1m-prod/*` · `supabase/migrations/*` | DB 適用済み · 今回 FE のみ |
| DB apply scripts | `apply-platform-nb1m-*` · `verify-platform-nb1m-db-*` | 本番 DB 触らない |
| Builder B3 系 | `builder/mvp-post.html` · `builder-config.js` 等 | NB-1M 非関連 · 別リリース |
| AI秘書 Phase9 | `admin-ai-secretary-phase*.js` | NB-1M cutover 範囲外 |
| dist / wrangler tmp | `deploy/cloudflare/dist/*` · `.wrangler/*` | 生成物 |
| 調査レポート群 | `reports/platform-*.md`（本レポート除く） | 任意 · deploy 非必須 |

---

## 5. 依存関係確認

| ページ | 読み込む NB-1M モジュール | 状態 |
|--------|-------------------------|------|
| `post.html` | events · log · gate · attachments · bridge · queue | ✅ |
| `admin-operations-dashboard.html` | 全 ops + gate モジュール | ✅ |
| `support-intake.html` | events · log · gate · bridge | ✅ |
| `chat-detail.html` | gate + attachments | ✅ |
| `shop-market-listing-new.html` | gate + attachments | ✅ |
| `dashboard.html` | actor-resolver | ✅ |

**判定: ✅ 配線漏れなし · DB 追加依存なし（既存 Supabase REST + LS）**

---

## 6. build 結果

```text
npm run build:pages
→ exit 0
→ dist に platform-content-gate.js 他 11 モジュール確認済
→ TLV 12 files OK · 247 HTML meta robots
```

---

## 7. Smoke / Regression 結果（2026-06-26 実施）

| スイート | 結果 | 出力 |
|---------|------|------|
| Node Content Gate | **ALL PASS** | `test-platform-content-gate.mjs` |
| Node OPS-FLOW-2 | **14/14 PASS** | `test-platform-ops-flow-2.mjs` |
| NB-1M Browser | **37/37 PASS** | `platform-nb1m-smoke-browser.json` |
| OPS Playwright | **15/15 PASS** | `platform-ops-flow-2-browser.json` |

### 確認項目カバレッジ

| 項目 | 検証 |
|------|------|
| Content Gate | ✅ T1–T7 · post.html 01–14 |
| Attachment Gate | ✅ T6 · 08–10 |
| public listing | ✅ shop / listings paths |
| moderation / queue | ✅ 14-queue · ops approve |
| Inbox | ✅ OPS 15/15 |
| Approve / Reject / Completed | ✅ flow-approve/reject/complete |
| contact_leak | ✅ critical → ack |
| Partner / MATCH / LIVE | ✅ unaffected |
| AI秘書 Inbox | ✅ bridge · deep link · PendingReviewCount |

---

## 8. commit 準備

```bash
# NB-1M Frontend のみ staging（本レポート §4.1）
git add platform-*.js admin-ai-daily-inbox.js admin-operations-dashboard.* \
  post.html listings-db.js business-listings-db.js business-service-reviews-db.js \
  chat-service.js support-ticket-service.js support-trouble-center.* support-intake.html \
  chat-detail.html shop-market-listing-new.html dashboard.html \
  scripts/lib/platform-*.mjs scripts/smoke-platform-nb1m-*.mjs \
  scripts/smoke-platform-ops-flow-2-browser.mjs scripts/test-platform-*.mjs \
  reports/platform-nb1m-frontend-prod-deploy-ready.md

git commit -m "feat(platform): NB-1M Content Gate and OPS-FLOW-2 for production FE"
git push origin main
# Cloudflare Pages Production 昇格 → prod URL pre-smoke
```

**注意:** commit / push は人間承認後。本チェックでは **staging 準備まで**（`git add` 実行可 · commit は未実施）。

---

## 9. Deploy 後チェックリスト

| # | 手順 |
|---|------|
| 1 | CF Access storage 更新 |
| 2 | `node scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs` → **PASS** |
| 3 | OPS 手動 1 件（Inbox → `#ops-content-gate` → Approve） |
| 4 | apply 後 smoke（別タスク · DB write 含む）は cutover 計画どおり |

---

## 10. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| 本番 DB write | ✅ |
| migration / backfill / safe view 再適用 | ✅ |
| DB 仕様変更 | ✅ |
| 不要リファクタ | ✅ |

---

*Ready for Frontend Production Deploy — DB は触らず FE を main → Production へ*
