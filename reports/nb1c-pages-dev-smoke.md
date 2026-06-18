# NB-1C — Cloudflare Pages 初回デプロイ後 smoke

**実施日:** 2026-06-18  
**種別:** `*.pages.dev` Production デプロイ + smoke  
**スコープ:** **pages.dev のみ** — `tasful.jp` / DNS / Custom Domain **未実施**

**GitHub:** `haruka0627/tasufull-article` · **branch:** `main` · **commit:** `a09e389`（fix: `fd23dba` → `a09e389`）

---

## NB-1C 判定: **FAIL**

| 判定 | **FAIL** |
|------|----------|
| 理由 | deploy **Success** · 8 URL **PASS** · smoke **SUMMARY FAIL**（fallback スイート） |
| `/builder/` | ✅ **解消** — `TASU_CHAT_SUPABASE_CONFIG` ロード確認済 |
| 残 blocker | `talk-home.html` に `auth-current-user.js` 未読込 → `TasuAuthCurrentUser` 未定義で fallback タイムアウト |

---

# Deploy 状態

| 項目 | 状態 |
|------|------|
| Production env | ✅ `TASFUL_SUPABASE_URL` · `TASFUL_SUPABASE_ANON_KEY` |
| Build / Deploy | ✅ Success（`a09e389`） |
| `chat-supabase-config.js` | ✅ **200** · Generated at deploy |
| `https://tasufull-article.pages.dev/builder/` | ✅ **200** · config スタック読込済 |

---

# 修正コミット `a09e389`

**message:** `fix builder pages supabase config`

| ファイル | 変更 |
|----------|------|
| `builder/index.html` | Supabase + auth stack 追加 |
| `auth-current-user.js` | **新規 push**（orphan `fd23dba` に未含有だったため同 No |
| `builder/builder-actor-identity.js` | **新規 push**（同上） |

### `builder/index.html` 追加 script（読込順）

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../chat-supabase-config.js"></script>
<script src="../tasu-supabase-client.js"></script>
<script src="../talk-runtime.js"></script>
<!-- 既存 talk-category-normalize 等 -->
<script src="../auth-current-user.js"></script>
<script src="builder-actor-identity.js"></script>
<script src="builder-general-flow.js"></script>
```

---

# ローカル検証（修正後）

```powershell
npm run build:pages          # PASS
npm run verify:pages-stage   # FAIL — talk-home.html missing auth-current-user.js（既存ギャップ）
node scripts/smoke-cloudflare-pages.mjs --base http://127.0.0.1:8788
```

| 段階 | 結果 |
|------|------|
| build:pages | **PASS** |
| verify:pages-stage | **FAIL** — `talk-home.html` に `auth-current-user.js` なし |
| ローカル smoke · 8 URL | **PASS**（`/builder/` 含む） |
| ローカル smoke · fallback | **FAIL** — `TasuAuthCurrentUser` タイムアウト |

---

# smoke 結果（pages.dev · `a09e389` deploy 後）

```text
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
```

| # | パス | HTTP | config | CSS | 結果 |
|---|------|------|--------|-----|------|
| — | `chat-supabase-config.js` static audit | 200 | OK | — | **PASS** |
| 1 | `/` | 200 | ✅ | 4 | **PASS** |
| 2 | `/talk-home.html` | 200 | ✅ | 11 | **PASS** |
| 3 | `/dashboard.html` | 200 | ✅ | 5 | **PASS** |
| 4 | `/shop-store.html` | 200 | ✅ | 7 | **PASS** |
| 5 | `/shop-products.html` | 200 | ✅ | 7 | **PASS** |
| 6 | `/payment-settings.html` | 200 | ✅ | 1 | **PASS** |
| 7 | `/builder/` | 200 | ✅ | 2 | **PASS** ← **前回 FAIL 解消** |
| 8 | `/ai-workspace.html` | 200 | ✅ | 6 | **PASS** |

### SUMMARY

```text
[smoke-pages] SUMMARY: FAIL — page.waitForFunction: Timeout 30000ms exceeded.
```

| チェック | 結果 |
|----------|------|
| HTTP 200（8 URL） | **PASS** |
| CSS 読込 | **PASS** |
| config ロード | **PASS** |
| config static audit（currentUserId / me / u_me なし） | **PASS** |
| console error（到達分） | 致命エラーなし |
| fallback lockdown（talkProductionMode シミュレーション） | **FAIL** |
| demo user / LS fallback 拒否 | **未完了**（fallback 未到達） |

### FAIL 原因（fallback スイート）

| 項目 | 内容 |
|------|------|
| 失敗箇所 | smoke 後半 · `talk-home.html` で `window.TasuAuthCurrentUser` 待ち |
| 原因 | `talk-home.html` に `<script src="auth-current-user.js">` がない（`fd23dba` / `a09e389` 共通） |
| 影響 | `connect-state.js` · `market-identity.js` 等の fallback 検証も未実行 |
| スコープ外 | 今回は `/builder/` のみ修正。talk-home auth stack は **別 NB** |

---

# 判定マトリクス

| 状態 | 判定 |
|------|------|
| deploy Success + smoke SUMMARY PASS | **READY** |
| deploy Success + smoke SUMMARY FAIL | **FAIL** ← **現状** |
| env 未設定 / deploy 未完 | **BLOCKED** |

---

# 次手（NB-1C → READY）

1. `talk-home.html`（および smoke fallback が参照する `payment-settings.html` 等）に auth stack 追加  
   - 最低: `auth-current-user.js`  
   - fallback 完走には `connect-state.js` · `market-identity.js` も要確認
2. push → Cloudflare redeploy
3. `node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev` → **PASS** → **READY**

**触らない:** `tasful.jp` / DNS / Custom Domain / Supabase Site URL

---

# Git / push

| 項目 | 値 |
|------|-----|
| 作業ブランチ | `cf-pages-deploy` |
| push | ✅ `git push origin HEAD:main` → `fd23dba..a09e389` |
| remote | `https://github.com/haruka0627/tasufull-article.git` |

---

**ステータス:** NB-1C **FAIL** — **`/builder/` 修正・deploy 反映済 · 8 URL PASS · fallback スイートは talk-home auth 未読込で FAIL**
