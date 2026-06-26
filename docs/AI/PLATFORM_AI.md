# Platform AI

**最終更新:** 2026-06-26  
**ステータス:** 入口接続済 · 仕上げタスク残  
**直近コミット:** `5ed9672`

---

## 方針（決定）

| 項目 | 内容 |
| --- | --- |
| **展開方針** | 日本国内向け基本 · 海外前提の設計・実装は行わない — [DECISIONS.md](../DECISIONS.md) **AD-011** |
| **Platform 製品** | Production Ready |
| **Platform 専用 AI** | **作らない** |
| **AI 利用** | deterministic assist + **TASFUL AI Workspace** 遷移（`source=platform`） |

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

Platform 専用 LLM ループは **呼ばない**。

---

## テスト

| スクリプト | 結果（`5ed9672` 時） |
| --- | --- |
| `scripts/test-platform-finish-phase.mjs` | 37/37 PASS |
| `scripts/test-platform-next-phase.mjs` | 37/37 PASS |

---

## 残タスク

参照: `reports/platform-finish-phase.md` §6, §9 · [TODO.md](../TODO.md)

| 項目 | 状態 |
| --- | --- |
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

- `ai-model-gateway.js`
- `builder-ai-core.js`
- `admin-ai-secretary-*`
- Platform 専用 AI エンジン

**レポート:** `reports/platform-finish-phase.md`, `reports/platform-next-phase.md`
