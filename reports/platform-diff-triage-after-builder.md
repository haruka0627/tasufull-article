# Platform 未コミット差分棚卸し（Builder 完了後）

**作成日:** 2026-06-26  
**HEAD:** `563dcdb` — `build(builder): update Pages dist assets`  
**方針:** 調査・分類のみ。stage / commit / 実装変更なし。

---

## 1. git status 概要

| 区分 | 件数（概算） | 内容 |
|------|-------------|------|
| 追跡済み `M` | **80** | `git diff --stat`: +5149 / −628 行 |
| 未追跡 `??` | **~230** | ほぼ `deploy/cloudflare/dist/**` の build 出力 |
| Builder | **完了** | `builder/**` ソース差分なし · `deploy/cloudflare/dist/builder/**` は `563dcdb` でコミット済み |

### ドメイン別（working tree 全体・除外対象）

| ドメイン | 代表パス | 扱い |
|----------|----------|------|
| **Platform（本棚卸し対象）** | `post.js`, `shop-market-product-data.js`, `platform-*`, `listing-*`, `shop-*`, `worker-*` | 下記 A–F |
| **Talk** | `talk-home.html`, `talk-runtime.js`, `deploy/.../talk-*` | **今回対象外** |
| **ANPI** | `anpi-*`, `deploy/.../anpi-*` | **今回対象外** |
| **TLV** | `deploy/cloudflare/dist/live/**` | **今回対象外** |
| **AI 秘書 / Gateway** | `ai-ops-case-store.js`, `admin-ai-*`, `ai-model-gateway.js` | **今回対象外** |
| **TASFUL AI** | `reports/tasful-ai-*`, `deploy/.../docs/AI/*` | **今回対象外** |
| **Builder reports** | `reports/builder-release-status.md` 等 | **今回対象外** |
| **Builder scripts** | `scripts/test-builder-ai-live-*` | **今回対象外** |

---

## 2. Platform 候補ファイル一覧（分類）

### A. Platform source（リポジトリルート・コミット候補）

| 状態 | ファイル | 判断理由 |
|------|----------|----------|
| **M** | `post.js` | 掲載成功モーダル文言を `moderation_status` / `publish_status` / `autoPublic` に応じて分岐（Content Gate 連携 UX） |
| **M** | `shop-market-product-data.js` | `TasuPlatformContentGate.applyShopPublishGate` · `TasuPlatformModerationQueue.trackLocalListing` · 公開済み seller 商品のフィルタ |

**補足:** `platform-content-gate.js`, `listings-db.js`, `listing-detail-loader.js` 等の **ソースは既に追跡済みで working tree はクリーン**。未コミットは上記 2 ファイルのみ。

### B. Platform dist（`deploy/cloudflare/dist` · build 反映）

#### B-1. 変更済み `M`（6 + 関連 4）

| ファイル | ソース対応 | 備考 |
|----------|------------|------|
| `deploy/cloudflare/dist/post.js` | `post.js` | ソースと同内容 (+14 行) |
| `deploy/cloudflare/dist/post.html` | `post.html`（クリーン） | 軽微配線 (+8 行) |
| `deploy/cloudflare/dist/shop-market-product-data.js` | `shop-market-product-data.js` | ソースと同内容 (+21 行) |
| `deploy/cloudflare/dist/shop-market-listing-new.html` | 既存ソース | 軽微 (+5 行) |
| `deploy/cloudflare/dist/business-listings-db.js` | `business-listings-db.js`（クリーン） | listings DB (+79 行) — **要 dist のみかソース未反映か確認** |
| `deploy/cloudflare/dist/business-service-reviews-db.js` | 既存ソース | レビュー DB (+8 行) |

**Platform 隣接 dist `M`（パターン未ヒットだが Platform 会員 UI）:**

| ファイル | 備考 |
|----------|------|
| `deploy/cloudflare/dist/chat-detail.html` | チャット詳細 (+5) |
| `deploy/cloudflare/dist/chat-service.js` | チャットサービス (+136) |
| `deploy/cloudflare/dist/dashboard.html` | 会員ダッシュボード (+2) |

#### B-2. 未追跡 `??`（dist に初回コピー · ソースは既に git 追跡済み）

**platform-* コア（14）**

- `platform-actor-resolver.js`
- `platform-content-gate.js`
- `platform-content-gate-ai-bridge.js`
- `platform-content-gate-attachments.js`
- `platform-content-gate-events.js`
- `platform-moderation-log.js`
- `platform-moderation-queue.js`
- `platform-ops-action-url.js`
- `platform-ops-chat-report-bridge.js`
- `platform-ops-content-review.js`
- `platform-ops-inbox-bridge.js`
- `platform-chat-cancel-flow.js`
- `platform-chat-fee-pay.html` / `platform-chat-fee-pay.js`
- `platform-chat-bench-buyer-wait.html`

**listing / 掲載（6）**

- `listings-db.js`, `listing-detail-loader.js`, `listing-images.js`, `listing-options.js`
- `listing-management.html`, `my-listings.css`

**shop / marketplace（22）**

- `shop-market-checkout.js`, `shop-market-complete.js`, `shop-market-notify.js`
- `shop-store-*`（cart, checkout, complete, demo, page, products-db, …）
- `shop-vendors.html`, `shop-vendors-brand.css`, `skill-paid-options.css`
- `post-shop-product-upload.js`, `product-list-card.css`, `post.css`

**worker 掲載（5）**

- `worker-card.js` / `worker-card.css`
- `worker-data.js`, `worker-listing-fields.js`, `worker-requests-store.js`

**会員・決済・設定（8）**

- `job-applications-store.js`, `job-review-urls.md`
- `sales-fees.js`, `service-deal-fee-payment.js`, `stripe-shop-config.js`
- `notification-settings.html`, `payment-settings.html`
- `tasful-notification-settings.html` / `.js` / `-store.js`

**docs mirror（1）**

- `deploy/cloudflare/dist/docs/platform-coupon-system-backlog.md`

**dist Platform 候補合計:** 精査フィルタで **66 件**（`talk-` / `live/` / `anpi` / `builder` 除外）

### C. Platform test / scripts

| 状態 | ファイル | 判断理由 |
|------|----------|----------|
| **??** | `scripts/verify-platform-ui3-batch1.mjs` | UI-3 batch1 · dist ページ smoke |
| **??** | `scripts/verify-platform-ui3-batch2-b1.mjs` | UI-3 batch2 |
| **??** | `scripts/verify-platform-ui3-precommit.mjs` | pre-commit 最終チェック（390/768/1280） |

**既存追跡 scripts（今回 `M` なし）:** `test-platform-content-gate.mjs`, `test-platform-all-browser.mjs`, `smoke-platform-nb1m-*` 等はクリーン。

### D. Platform reports / docs

| 状態 | ファイル | 判断理由 |
|------|----------|----------|
| **M** | `reports/platform-nb1m-frontend-prod-deploy-ready.md` | Platform 本番 FE デプロイ readiness（+14 行程度） |

### E. Platform ではないがパターンにヒット（除外）

| ファイル | 除外理由 |
|----------|----------|
| `deploy/cloudflare/dist/_patch_worker_detail.py` | Cloudflare Worker パッチ · Platform 製品外 |
| `deploy/cloudflare/dist/_worker_shared_sections.html` | Worker HTML 断片 |
| `deploy/cloudflare/dist/talk-platform-notify*.js` | **Talk** 通知 |
| `deploy/cloudflare/dist/talk-worker-review-mode.js` | **Talk** worker レビュー |
| `deploy/cloudflare/dist/talk-category-normalize.js` | **Talk** カテゴリ |
| `deploy/cloudflare/dist/talk-ai-search-bridge.js` 等 | **Talk / TASFUL AI** 橋渡し |
| `deploy/cloudflare/dist/talk-service-worker.js` | **Talk** SW |
| `reports/tasful-ai-production-*.md` | **TASFUL AI**（`preflight` で誤マッチ） |

### F. 判断不能・要人手確認

| ファイル | 懸念 |
|----------|------|
| `deploy/cloudflare/dist/business-listings-db.js` | ソース `business-listings-db.js` はクリーンなのに dist のみ +79 行 — **ソース未同期 or 別ブランチ混入の可能性** |
| `deploy/cloudflare/dist/chat-service.js` | Platform チャットか Talk 境界 — 差分大（+136）· 単独レビュー推奨 |
| `deploy/cloudflare/dist/supabase-ops-*.js` | Ops 読み書きアダプタ · Platform 本流かインフラか要確認 |
| `deploy/cloudflare/dist/stripe-connect-*.js` | 決済基盤 · TLV/Platform 横断 |

---

## 3. Platform と判断した理由（要約）

1. **命名:** `platform-*`, `listing-*`, `shop-market-*`, `shop-store-*`, `worker-listing-*` は Platform 掲示板・マーケット・ワーカー領域の既存モジュール群と一致。
2. **差分内容:** `post.js` / `shop-market-product-data.js` は Content Gate · Moderation Queue · 掲載ステータス UX — `c6df896`（NB-1M Content Gate）系列の延長。
3. **docs:** `docs/AI/PLATFORM_AI.md` — Platform 専用 AI エンジンは作らない · Production Ready 凍結。
4. **dist `??`:** ソースは既にコミット済み · dist に未反映だったモジュールが `npm run build:pages` で初めてコピーされた状態。

---

## 4. Platform 以外として除外した主要ファイル

- **ANPI:** `anpi-*.html`, `anpi-rls.js` + dist 鏡像
- **Talk:** `talk-home.html`, `talk-runtime.js`, `deploy/.../talk-*`（大量 `??`）
- **TLV:** `deploy/cloudflare/dist/live/**`（~40 `M`, 1 `D`）
- **AI 秘書:** `admin-ai-*`, `admin-operations-dashboard.*`, `ai-ops-case-store.js`
- **Gateway:** `ai-model-gateway.js`（TASFUL AI · AD-005 凍結契約）
- **Builder reports/scripts:** `reports/builder-*`, `scripts/test-builder-ai-live-*`
- **汎用 site chrome:** `style.css`, `top.js`, `iwasho-site-chrome.css` 等（Platform 単独コミットに含めない）

---

## 5. dist に残る Platform 差分（Builder dist コミット後）

- **Builder:** `deploy/cloudflare/dist/builder/**` → **コミット済み（`563dcdb`）· working tree クリーン**
- **Platform dist:** 上記 B 節 **~66 ファイル** が未 stage
- **非 Platform dist:** TLV `live/**`, Talk 大量 `??`, ANPI, secretary, site-wide CSS/JS など **多数残存**

---

## 6. いまコミット可能か

| 単位 | 判定 | 理由 |
|------|------|------|
| **A のみ（source 2 件）** | **条件付き Go** | 差分は一貫した Platform Content Gate 連携 · ただし **検証未実施** |
| **B dist のみ** | **No-Go（単独）** | ソース 2 件未コミットのまま dist だけ先に出すと **source/dist 不整合** · `business-listings-db.js` 異常要確認 |
| **C scripts 3 件** | **条件付き Go** | 新規 verify スクリプト · source/dist コミット後または同 PR で |
| **D report 1 件** | **任意** | ドキュメントのみ · 実装コミットと分離可 |
| **一括 Platform commit** | **No-Go** | Talk/TLV/ANPI dist が同じ build 出力に混在 · `git add -A` 禁止 |

---

## 7. 追加検証が必要なテスト

`BUILDER_BASE_URL` クリア後 · `http://127.0.0.1:5173` または dist 直読み（スクリプト定義に従う）:

```bash
# Content Gate / NB-1M 系
node scripts/test-platform-content-gate.mjs
node scripts/smoke-platform-nb1m-content-gate-browser.mjs

# 新規 UI-3 verify（未追跡 · 追加後）
node scripts/verify-platform-ui3-precommit.mjs
node scripts/verify-platform-ui3-batch1.mjs
node scripts/verify-platform-ui3-batch2-b1.mjs

# 回帰
node scripts/test-platform-all-browser.mjs
node scripts/test-platform-actor-resolver.mjs
node scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs
```

**post.js / shop 変更に直結する確認:**

- 掲載フォーム → `pending_review` 時の成功モーダル文言
- ショップ seller 商品が `approved` + `public` のみ一覧表示
- `TasuPlatformContentGate.applyShopPublishGate` 拒否時のエラー表示

---

## 8. 推奨コミット単位（選別 stage · 一括禁止）

### Commit 1 — Platform source（最優先）

```text
feat(platform): gate shop publish and listing success messaging
```

- `post.js`
- `shop-market-product-data.js`

### Commit 2 — Platform dist（source コミット → 再 build 後が理想）

```text
build(platform): sync Pages dist for marketplace and content gate
```

- `deploy/cloudflare/dist/post.js`, `post.html`, `post.css`, `post-shop-product-upload.js`
- `deploy/cloudflare/dist/shop-market-product-data.js`, `shop-market-listing-new.html`, `shop-market-*.js`
- `deploy/cloudflare/dist/platform-*.js`, `platform-*.html`
- `deploy/cloudflare/dist/listing-*`, `listings-db.js`, `my-listings.css`
- `deploy/cloudflare/dist/shop-store-*`, `shop-vendors.*`
- `deploy/cloudflare/dist/worker-card.*`, `worker-data.js`, `worker-listing-fields.js`, `worker-requests-store.js`
- `deploy/cloudflare/dist/business-listings-db.js`, `business-service-reviews-db.js`（**差分レビュー後**）
- `job-applications-store.js`, `sales-fees.js`, `service-deal-fee-payment.js`, `stripe-shop-config.js` 等

**含めない:** `chat-service.js`, `supabase-ops-*` は別コミット or 要確認後。

### Commit 3 — Platform verify scripts（任意 · 同 PR 可）

```text
test(platform): add UI3 precommit verification scripts
```

- `scripts/verify-platform-ui3-batch1.mjs`
- `scripts/verify-platform-ui3-batch2-b1.mjs`
- `scripts/verify-platform-ui3-precommit.mjs`

### Commit 4 — Platform docs（任意）

```text
docs(platform): update NB-1M frontend deploy readiness
```

- `reports/platform-nb1m-frontend-prod-deploy-ready.md`

---

## 9. 最終判定

### Go / No-Go

| 項目 | 判定 |
|------|------|
| **即時一括コミット** | **No-Go** |
| **Platform source 2 件のみ（検証後）** | **条件付き Go** |
| **Platform dist 同期** | **No-Go（source 先行 + 要レビュー後）** |
| **今回の棚卸しレポート** | **Go** |

### Platform としてコミット可能なファイル一覧（検証後）

**Source（確定）**

- `post.js`
- `shop-market-product-data.js`

**Scripts（新規 · 確定）**

- `scripts/verify-platform-ui3-batch1.mjs`
- `scripts/verify-platform-ui3-batch2-b1.mjs`
- `scripts/verify-platform-ui3-precommit.mjs`

**Dist（source コミット + 再 build または現状 dist を精査 stage 後）**

- 本レポート **B 節** の 66 件（`chat-service.js` / `supabase-ops-*` は保留）

**Docs（任意）**

- `reports/platform-nb1m-frontend-prod-deploy-ready.md`

### コミット前に必要な検証コマンド

1. `node scripts/test-platform-content-gate.mjs`
2. `node scripts/smoke-platform-nb1m-content-gate-browser.mjs`
3. `node scripts/verify-platform-ui3-precommit.mjs`（追加後）
4. `node scripts/test-platform-all-browser.mjs`
5. 手動: 掲載フォーム · ショップ出品 · pending_review モーダル

### 注意点

1. **`git add -A` 禁止** — Platform dist はパス指定の選別 stage のみ。
2. **Builder は触らない** — `563dcdb` 済み · `builder/**` クリーン。
3. **Talk / ANPI / TLV dist** は同じ `npm run build:pages` で更新されているが **別コミット系列**。
4. **`business-listings-db.js`** — ソース無変更で dist のみ変更 · コミット前に diff 内容を確認すること。
5. **push / deploy 未実施** — 本棚卸し時点ではローカルのみ。
6. **再 build 推奨フロー:** Commit 1 → `npm run build:pages` → Platform dist だけ stage → Commit 2。

---

## 10. 残タスク（Platform スコープ）

1. 上記検証コマンド実行 · 失敗があれば source 2 件の意図確認
2. `business-listings-db.js` dist-only 差分の原因調査
3. Platform source コミット（Commit 1）
4. 再 build → Platform dist 選別コミット（Commit 2）
5. Talk / ANPI / TLV dist — **別タスクで棚卸し**
6. `chat-service.js` / `supabase-ops-*` dist 差分の帰属判断
