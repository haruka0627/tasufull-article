# NB-1C — Cloudflare Pages 初回デプロイ後 smoke

**実施日:** 2026-06-18  
**種別:** `*.pages.dev` Production デプロイ + smoke  
**スコープ:** **pages.dev のみ** — `tasful.jp` / DNS / Custom Domain **未実施**

**GitHub:** `haruka0627/tasufull-article` · **branch:** `main` · **commit:** `39b05cf`

---

## NB-1C 判定: **READY**

| 判定 | **READY** |
|------|-----------|
| deploy | ✅ Success |
| 8 URL | ✅ PASS |
| fallback lockdown | ✅ PASS |
| smoke SUMMARY | ✅ **PASS** |

---

# Deploy 状態

| 項目 | 状態 |
|------|------|
| Production env | ✅ `TASFUL_SUPABASE_*` |
| `chat-supabase-config.js` | ✅ **200** |
| `https://tasufull-article.pages.dev/` | ✅ **200** |

---

# 修正履歴

## `a09e389` — builder config

`builder/index.html` に Supabase + auth stack 追加 · `/builder/` の `TASU_CHAT_SUPABASE_CONFIG` 不足を解消。

## `39b05cf` — auth helper 読込漏れ（fallback 対応）

| ファイル | 変更 |
|----------|------|
| `talk-home.html` | `talk-runtime.js` 直後に `auth-current-user.js` |
| `payment-settings.html` | `auth-current-user.js` · `connect-state.js` |
| `shop-market-cart.html` | `talk-runtime.js` → `auth-current-user.js` → `connect-state.js` → `market-identity.js` |
| `connect-state.js` | **新規 push**（orphan 分支に未含有） |
| `market-identity.js` | **新規 push**（同上） |

### fallback 検証対象と auth 読込

| ページ | smoke 要件 | 対応 |
|--------|------------|------|
| `talk-home.html` | `TasuAuthCurrentUser` | ✅ `auth-current-user.js` |
| `/builder/` | `TasuBuilderActorIdentity` | ✅ 前コミット済 |
| `payment-settings.html` | `TasuConnectState` | ✅ `connect-state.js` |
| `shop-market-cart.html` | `TasuMarketIdentity` | ✅ `market-identity.js` |

**未変更（8 URL のみ · fallback 対象外）:** `dashboard.html` · `shop-store.html` · `shop-products.html` · `ai-workspace.html` · `/`

---

# ローカル検証（`39b05cf`）

```powershell
npm run build:pages          # PASS
npm run verify:pages-stage   # PASS（talk-home auth stack 含む）
node scripts/smoke-cloudflare-pages.mjs --base http://127.0.0.1:8788  # PASS
```

---

# smoke 結果（pages.dev · 最終）

```text
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
→ SUMMARY: PASS
```

| # | パス | HTTP | config | auth helper | 結果 |
|---|------|------|--------|-------------|------|
| — | config static audit | 200 | OK | — | **PASS** |
| 1 | `/` | 200 | ✅ | — | **PASS** |
| 2 | `/talk-home.html` | 200 | ✅ | auth=true | **PASS** |
| 3 | `/dashboard.html` | 200 | ✅ | — | **PASS** |
| 4 | `/shop-store.html` | 200 | ✅ | — | **PASS** |
| 5 | `/shop-products.html` | 200 | ✅ | — | **PASS** |
| 6 | `/payment-settings.html` | 200 | ✅ | auth=true | **PASS** |
| 7 | `/builder/` | 200 | ✅ | auth=true | **PASS** |
| 8 | `/ai-workspace.html` | 200 | ✅ | — | **PASS** |

### fallback lockdown（talkProductionMode シミュレーション）

| チェック | 結果 |
|----------|------|
| `uMeBlocked` | **PASS** |
| `urlRoleBlocked` | **PASS** |
| `talkAdminBlocked` | **PASS** |
| `lsRoleBlocked` | **PASS** |
| `connectLsBlocked` | **PASS** |
| `buyerSellerLsBlocked` | **PASS** |
| config に currentUserId / me / u_me なし | **PASS** |
| console 致命エラー | **PASS**（Supabase 未ログイン 400 は smoke で除外 · 401 と同様） |

---

# 判定マトリクス

| 状態 | 判定 |
|------|------|
| deploy Success + smoke SUMMARY PASS | **READY** ← **現状** |
| deploy Success + smoke SUMMARY FAIL | **FAIL** |
| env 未設定 / deploy 未完 | **BLOCKED** |

---

# 次フェーズ（NB-1C スコープ外）

- `tasful.jp` DNS / Custom Domain
- Supabase Auth Site URL
- `auth-production-smoke-runbook.md` Phase A（本番 apex）

---

**ステータス:** NB-1C **READY** — **pages.dev deploy Success · 8 URL + fallback lockdown smoke PASS**
