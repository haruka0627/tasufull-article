# Platform AI

**最終更新:** 2026-07-26  
**ステータス:** 入口接続済 · **AIページ生成 = RELEASE READY WITH FOLLOW-UP**  
**直近コミット（ページ生成）:** `57952cd` · 証跡 [platform-ai-page-gen-phase2e-release-verification.md](../../reports/platform-ai-page-gen-phase2e-release-verification.md)

---

## 方針（決定）

| 項目 | 内容 |
| --- | --- |
| **展開方針** | 日本国内向け基本 · 海外前提の設計・実装は行わない — [DECISIONS.md](../DECISIONS.md) **AD-011** |
| **Platform 製品** | Production Ready |
| **Platform 専用 AI エンジン** | **作らない**（AD-003）— 検索/比較は deterministic + Workspace 遷移 |
| **AI ページ生成** | Phase 1 共通エンジン + Platform アダプタ（`surface=platform`）· GenAI 有料 entitlement · **Builder / BD と統合しない** |
| **AI 利用（従来）** | deterministic assist + **TASFUL AI Workspace** 遷移（`source=platform`） |

---

## AIページ生成（2026-07 · Phase 1 → 2-E）

| 項目 | 内容 |
| --- | --- |
| Types | product · skill · job · worker |
| Persist | `listings.form_data.page_doc`（Migration なし） |
| Entitlement | `gen_ai_subscriptions` → `ai_page_gen_paid`（server JWT） |
| CTA | purchase / request / apply / talk_start · booking/join 未接続 |
| Tests | Phase1 **252/252** · Phase2-A **63/63** · Phase2-D Staging E2E **PASS** |
| Release | **RELEASE READY WITH FOLLOW-UP** · Deploy/Push 未実施 |
| Follow-up | 投稿画面の既存下書き生成との文言整理（P3）· Production schema 手動確認 |

主要ファイル: `shared/page-gen/*` · `platform-page-gen-*.js` · `deploy/cloudflare/functions/api/page-gen-*.js`

---

## 実装済み（`5ed9672`）

| 領域 | モジュール |
| --- | --- |
| バッジ · AI おすすめ | `platform-badges.js`, `platform-ai-recommend.js` |
| 検索 assist | `platform-search-assist.js`, `platform-search-hub.js` |
| 比較 assist | `platform-compare-assist.js` |
| お気に入りフォルダ | `platform-favorites-folders.js` + `favorites-list.*` |
| OAuth（コード） | `platform-google-auth.js`, `login.js/html`, `signup.js/html` |
| 補助 | `platform-location-search.js`, `platform-category-kyc.js` |
| 配線 | `listing-renderer.js`, `business-board-renderer.js`, 各 listing HTML |

**遷移例**

- 検索: `ai-workspace.html?mode=cross-matching&q=...&send=1&source=platform`
- 比較: `compare=id1,id2&source=platform`

Platform 専用 LLM ループ（Workspace 代替）は **呼ばない**。ページ生成は共通エンジン + Functions 経由。

---

## テスト

| スクリプト | 結果 |
| --- | --- |
| `scripts/test-platform-finish-phase.mjs` | 37/37 PASS（`5ed9672` 時） |
| `scripts/test-platform-next-phase.mjs` | 37/37 PASS（`5ed9672` 時） |
| `scripts/test-page-gen-engine-phase1.mjs` | **252/252 PASS**（2026-07-26） |
| `scripts/test-platform-page-gen-phase2a.mjs` | **63/63 PASS**（2026-07-26） |
| Staging E2E | `scripts/_tmp-phase2d-staging-e2e.mjs` · **PASS** |

---

## 残タスク

参照: `reports/platform-finish-phase.md` §6, §9 · [TODO.md](../TODO.md) · Phase 2-E follow-up

| 項目 | 状態 |
| --- | --- |
| **AIページ生成 Production Deploy** | 手順確定 · **未 Deploy** |
| **投稿UI：下書き生成 vs AIページ作成** | P3 文言整理候補 |
| **index.html featured カード** | バッジ未組込（一覧カードは OK） |
| **お気に入り DB 同期** | localStorage のみ · Supabase サーバー保存未 |
| **Google OAuth 実機確認** | コード OK · Dashboard 設定 + E2E 未 |
| （任意）検索ハブ listing pool 初回ロード | 未 |

### Google OAuth 本番前チェック（人間作業）

1. Supabase → Google provider 有効化
2. Redirect URLs 登録（staging / production / localhost）
3. Google Cloud OAuth クライアント
4. staging E2E → production E2E

---

## 触っていない

- `ai-model-gateway.js`（AD-005）
- `builder-ai-core.js`（AD-002）
- Business Directory AI ページ
- booking / join CTA

**レポート:** `reports/platform-finish-phase.md`, `reports/platform-next-phase.md`, `reports/platform-ai-page-gen-phase2e-release-verification.md`
