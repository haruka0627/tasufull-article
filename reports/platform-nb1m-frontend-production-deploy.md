# Platform NB-1M — FRONTEND PRODUCTION DEPLOY

| 項目 | 内容 |
|------|------|
| **実施日** | 2026-06-26 |
| **種別** | Production FE deploy（**本番 DB 未操作**） |
| **実施者** | Cursor Agent（NB-1M FRONTEND PRODUCTION DEPLOY タスク） |

---

## 最終判定

| 項目 | 判定 |
|------|------|
| **Production FE Deploy** | **PASS** |
| **Prod URL Pre-Smoke** | **PARTIAL**（13 PASS / 0 FAIL / 1 BLOCKED） |
| **本番 DB 操作** | **なし**（禁止遵守） |

---

## 1. Staged 38 ファイル確認

`git diff --cached --stat` より **38 files, +8980 / -48** — 対象は NB-1M platform モジュール・配線 HTML/JS・smoke/test スクリプト・deploy-ready レポートのみ。

**除外確認（含まれていないこと）:**

| 禁止カテゴリ | 結果 |
|-------------|------|
| SQL / migration | ✅ なし |
| `deploy/cloudflare/dist` | ✅ なし |
| Builder B3 | ✅ なし |
| `admin-ai-secretary-phase*` | ✅ なし |

---

## 2. Git / Push

| ステップ | 結果 |
|---------|------|
| commit（cf-pages-deploy） | `c6df896` — `feat(platform): NB-1M Content Gate and OPS-FLOW-2 for production FE` |
| cherry-pick → `origin/main` | `48cc681`（同一内容 · main ベース `1b32aba` 上） |
| `git push origin main` | ✅ `1b32aba..48cc681` |

**備考:** ローカル作業ブランチは `cf-pages-deploy`。main への反映は worktree `tasufull-article-main-push` 経由で cherry-pick（TLV 等 9 commits は main に含めず NB-1M のみ）。

---

## 3. Cloudflare Pages Production

`npx wrangler pages deployment list --project-name tasufull-article`

### NB-1M Frontend（Primary）

| 項目 | 値 |
|------|-----|
| **Deploy ID** | `e107900c-4a7f-479f-819d-429dbcc5dd1a` |
| **Environment** | Production |
| **Branch** | `main` |
| **Commit** | `48cc681` |
| **Status** | Active（NB-1M 反映確認済み） |
| **Deploy URL** | https://e107900c.tasufull-article.pages.dev |

**モジュール到達確認:**

- `platform-content-gate.js` → HTTP **200**
- `platform-ops-content-review.js` → HTTP **200**

### Routing 修正（別 commit · 最小 FE）

| 項目 | 値 |
|------|-----|
| **問題** | `_redirects` の `/index.html → /market/` が platform TOP を legacy market へ 301 · `/market/*.css` MIME `text/html` |
| **修正** | `deploy/cloudflare/_redirects` — `/index.html` リダイレクト削除 |
| **Commit** | `83d3111` — `fix(pages): stop redirecting /index.html to /market/ (MIME regression)` |
| **Deploy ID** | `562a8b85-1c3c-4bca-9eec-5101e6739f25` |
| **Status** | Production Active |

---

## 4. Prod URL Pre-Smoke（deploy 後 · read-only）

**コマンド:** `node scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs`  
**実施:** 2026-06-25T20:32:54Z（Production `83d3111` 反映後）

| 領域 | 判定 |
|------|------|
| Frontend Routing | **PASS**（`/index.html` → `/` · MIME エラー解消） |
| Auth UI | **PASS** |
| Public listing | **PASS** |
| AI秘書 Inbox | **PASS*** |
| Deep Link | **PASS*** |
| OPS pages | **PASS*** |
| JS critical error | **NONE** |

\* ops/support は **管理者 JWT なし → 403 期待動作**（TASFUL `auth-ops-guard`）。Product FAIL には含めない。

| Verdict | 件数 |
|---------|------|
| PASS | 13 |
| FAIL | 0 |
| BLOCKED | 1（`regression-tlv-live` · CF Access 追加パス） |

**成果物:**

- [`platform-nb1m-prod-url-pre-smoke.md`](platform-nb1m-prod-url-pre-smoke.md)
- [`platform-nb1m-prod-url-pre-smoke.json`](platform-nb1m-prod-url-pre-smoke.json)
- [`platform-nb1m-prod-url-pre-smoke-screenshots/`](platform-nb1m-prod-url-pre-smoke-screenshots/)

---

## 5. 残 Blocker / フォローアップ

| ID | 項目 | 分類 | 対応 |
|----|------|------|------|
| B1 | `regression-tlv-live` BLOCKED | CF Access（LIVE パス） | infra · service token または LIVE 用 Access 更新 |
| B2 | ops Inbox UI 実表示未検証 | 運営 JWT 必要 | 管理者ログイン or ops JWT 付き smoke（`?talkAdmin=1` は **本番 host では無効**） |
| B3 | ops 403 時 console | `admin-ai-secretary-phase2/3.js` MIME（HTML 404） | 403 ページ到達前の script 参照 · 管理者セッション付き再確認で Inbox 本体を検証 |
| B4 | `/market/` 直アクセス | legacy market · 相対パス資産 | `/index.html` 問題は **83d3111 で解消** · `/market/` 単体は既知（platform TOP 経路は PASS） |

**実施していないこと（禁止遵守）:**

- 本番 DB write / migration / backfill / safe view patch
- Product 仕様変更

**未 push（ローカルのみ）:**

- pre-smoke スクリプト改善（ops 403 期待判定 · routing-top セレクタ修正）— レポート生成用 · main 未反映

---

## 6. タイムライン

| 時刻 (JST 概算) | イベント |
|----------------|---------|
| 05:25 | commit `c6df896` / cherry-pick `48cc681` |
| 05:27 | Production `48cc681` Active |
| 05:29 | pre-smoke 1回目 — routing-top FAIL（/market/ MIME） |
| 05:30 | routing fix `83d3111` push |
| 05:32 | Production `83d3111` Active |
| 05:33 | pre-smoke 最終 — **PARTIAL**（13/0/1） |

---

*本番 DB への write / migration / backfill / safe view patch は一切実施していません。*
