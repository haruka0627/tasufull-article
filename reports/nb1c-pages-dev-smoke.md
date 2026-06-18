# NB-1C — Cloudflare Pages 初回デプロイ後 smoke

**実施日:** 2026-06-18 · **Push 先修正:** 2026-06-18  
**種別:** `*.pages.dev` Production デプロイ + smoke  
**スコープ:** **pages.dev のみ** — `tasful.jp` / DNS / Custom Domain **未実施**

**GitHub:** `haruka0627/tasufull-article` · **branch:** `main` · **commit:** `fd23dba`

---

## NB-1C 判定: **FAIL**

| 判定 | **FAIL** |
|------|----------|
| 理由 | **deploy Success** · config **200** · smoke **FAIL**（`/builder/` で `TASU_CHAT_SUPABASE_CONFIG` 未ロード） |
| 根因 | `builder/index.html` に `chat-supabase-config.js`（Supabase config スタック）が未組み込み |
| 次手 | `builder/index.html` に config スタック追加 → push → redeploy → smoke 再実行 → **READY** |

---

# Push 先修正（実施済）

## 1–3. remote 修正

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| origin | `https://github.com/ユーザー名/リポジトリ名.git` | `https://github.com/haruka0627/tasufull-article.git` ✅ |

```powershell
git remote set-url origin https://github.com/haruka0627/tasufull-article.git
```

## 4–5. ブランチ

| 項目 | 値 |
|------|-----|
| ローカル（作業ブランチ） | `cf-pages-deploy`（orphan · 単一コミット） |
| Cloudflare 監視 | `main` |

## 6. push 経緯

| 試行 | 結果 |
|------|------|
| `git push origin HEAD:main`（merge 後） | ❌ **rejected** — `backups/*.zip` · `.tmp.driveupload/*` が GitHub 100MB 制限超過 |
| `git push origin cf-pages-deploy:main --force-with-lease` | ✅ **成功** `126ca98...fd23dba` |

**対処:** 履歴を含まない **orphan ブランチ** `cf-pages-deploy` を作成 · `backups/` を index から除外 · サイト全体を 1 コミットで `main` に反映。

> `main` 上の `deploy/cloudflare/stage-cloudflare-pages.mjs` は GitHub で到達確認済（raw.githubusercontent.com **200**）。

## 7. Cloudflare 自動デプロイ

| 項目 | 状態 |
|------|------|
| GitHub push | ✅ `fd23dba` on `main` |
| Production env | ✅ `TASFUL_SUPABASE_*` 設定済 |
| Deployments | ✅ **`fd23dba` Success**（build + deploy） |
| `pages.dev` 反映 | ✅ **200**（config 含む） |

---

# pages.dev URL

| URL | HTTP（deploy Success 後 · 2026-06-18） |
|-----|----------------------------------------|
| `https://tasufull-article.pages.dev/` | **200** |
| `https://tasufull-article.pages.dev/chat-supabase-config.js` | **200** · Generated at deploy 確認済 |
| `https://tasufull-article.pages.dev/builder/` | **200**（config 未ロード → smoke FAIL） |

---

# Cloudflare Build 設定（確定）

| 項目 | 値 |
|------|-----|
| Framework preset | None |
| Build command | `node deploy/cloudflare/stage-cloudflare-pages.mjs` |
| Build output directory | `deploy/cloudflare/dist` |
| Root directory | 空欄 |
| Production env | `TASFUL_SUPABASE_URL` · `TASFUL_SUPABASE_ANON_KEY` ✅ 設定済 |

### Build Failed 対処（解消済）

| log | 対処 |
|-----|------|
| `TASFUL_SUPABASE_* required` | ✅ Production env 追加 → Retry → Success |
| `Cannot find module` | ✅ 解消済（GitHub に script 存在） |
| その他 | Dashboard Build log 末尾 20 行を本レポートに追記 |

---

# smoke結果

**実施:** 2026-06-18 · deploy Success 後

```text
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
→ FAIL: missing TASU_CHAT_SUPABASE_CONFIG on https://tasufull-article.pages.dev/builder/
```

| # | パス | HTTP | config | CSS | 結果 |
|---|------|------|--------|-----|------|
| — | `/chat-supabase-config.js` | 200 | static audit OK | — | **PASS** |
| 1 | `/` | 200 | ✅ | 4 sheets | **PASS** |
| 2 | `/talk-home.html` | 200 | ✅ | 11 sheets | **PASS** |
| 3 | `/dashboard.html` | 200 | ✅ | 5 sheets | **PASS** |
| 4 | `/shop-store.html` | 200 | ✅ | 7 sheets | **PASS** |
| 5 | `/shop-products.html` | 200 | ✅ | 7 sheets | **PASS** |
| 6 | `/payment-settings.html` | 200 | ✅ | 1 sheet | **PASS** |
| 7 | `/builder/` | 200 | ❌ | — | **FAIL** |
| 8 | `/ai-workspace.html` | — | — | — | **未実施**（#7 で中断） |

### FAIL 原因

| 項目 | 内容 |
|------|------|
| 失敗 URL | `https://tasufull-article.pages.dev/builder/` |
| エラー | `missing TASU_CHAT_SUPABASE_CONFIG` |
| 原因 | `builder/index.html` の `<script>` に `../chat-supabase-config.js` がない（他 builder ページは admin 系のみ config あり） |
| 影響 | fallback スイート（builder LS role block）も未実行 · `/ai-workspace.html` も未検証 |

### 修正方針（NB-1C → READY）

`builder/index.html` の `</body>` 前に、他 Talk/Connect ページと同様の Supabase config スタックを追加:

```html
<script src="../chat-supabase-config.js"></script>
<script src="../auth-current-user.js" defer></script>
<script src="builder-actor-identity.js" defer></script>
```

→ push → Cloudflare redeploy → smoke 再実行。

### 再実行

```powershell
curl.exe -sI https://tasufull-article.pages.dev/chat-supabase-config.js
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
```

---

# console error / config / fallback

| 区分 | pages.dev |
|------|-----------|
| config static audit | **PASS** — `currentUserId` / `me` / `u_me` なし |
| console | **未完了** — smoke が `/builder/` で中断（到達分に致命エラーなし） |
| CSS / JS 404 | **未完了** — 到達 6 ページは CSS OK |
| fallback lockdown | **未実施** — `talkProductionMode` スイート未到達 |

---

# Ops チェックリスト（BLOCKED 解除）

**スコープ:** Cloudflare Variables のみ — **DNS / Custom Domain / tasful.jp は触らない**

## 1. Production Environment Variables 追加

Dashboard → **Workers & Pages** → **tasufull-article** → **Settings** → **Variables and secrets** → **Production**

| Variable | Value | 備考 |
|----------|-------|------|
| `TASFUL_SUPABASE_URL` | `https://ddojquacsyqesrjhcvmn.supabase.co` | Plain text 可 |
| `TASFUL_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → **anon public** | Encrypted 推奨 · **service_role 禁止** |
| `NODE_VERSION` | `20` | 任意推奨 |

保存（Save）。

## 2. Retry deployment

Dashboard → **Deployments** → コミット **`fd23dba`** → **Retry deployment**

## 3. Build 結果確認

**Success 判定:**

```powershell
curl.exe -sI https://tasufull-article.pages.dev/chat-supabase-config.js
# → HTTP/1.1 200
```

```powershell
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
```

| 結果 | NB-1C 判定 |
|------|------------|
| deploy Success + smoke PASS | **READY** |
| deploy Success + smoke FAIL | **FAIL** |
| env 未設定 · deploy 未完 · 351 前 | **BLOCKED** ← **現状** |

**Failed 時:** Build log **末尾 20 行**を取得し本レポートに追記。

## 4. 進捗チェック

- [x] Build Failed 根因特定（env 未設定）
- [x] Production env 設定
- [x] `fd23dba` Retry → **Success**
- [x] `chat-supabase-config.js` **200**
- [x] smoke 実行 → **FAIL**（`/builder/` config 不足）
- [ ] `builder/index.html` 修正 → redeploy → smoke **PASS** → **READY**

---

# 判定マトリクス

| 状態 | 判定 |
|------|------|
| push + deploy Success + smoke PASS | **READY** |
| push OK · deploy 未 Success / 404 | **BLOCKED** |
| deploy Success + smoke FAIL | **FAIL** ← **現状** |

---

# ローカル Git 注意

| 項目 | 値 |
|------|-----|
| 現在ブランチ | `cf-pages-deploy`（orphan） |
| 旧 `master` | ローカルに残存（`fca614e` · merge `aef7465`） |
| stash | `nb1c-merge-wip`（README） |

---

**ステータス:** NB-1C **FAIL** — **deploy Success · config 200 · smoke FAIL（`builder/index.html` に Supabase config スタック未組み込み）**
