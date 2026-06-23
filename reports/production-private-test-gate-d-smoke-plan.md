# Gate-D — Access 内ブラウザ smoke 手順書

| 項目 | 内容 |
|------|------|
| 作成日 | **2026-06-23** |
| 種別 | 非公開本番テスト · ブラウザ smoke |
| 対象ホスト | `https://tasufull-article.pages.dev` |
| 実施者 | `rubi.hiro0613@gmail.com`（OTP ログイン） |

---

## 1. 目的

Cloudflare Access **OTP ログイン後**の Production `pages.dev` で、代表画面が実ブラウザ上で正常動作することを確認する。Supabase API / Edge / Storage / TALK / MATCH の疎通を **実画面ベース**で検証する（API 単体 verify の補完）。

---

## 2. 前提

| # | 条件 |
|---|------|
| P-01 | **Gate-B Go** — Access 有効 · 許可メールのみ |
| P-02 | **Gate-C Go with note** — noindex / robots / X-Robots デプロイ済 |
| P-03 | **Supabase connectivity Go** — `ddojquacsyqesrjhcvmn` |
| P-04 | Production デプロイ済（Gate-C deploy `44f9c066` 以降） |
| P-05 | **変更禁止** — UI / DB / Stripe / 認証ロジック / Access 設定 |

---

## 3. 対象 URL

### 3.1 必須（今回）

| # | URL | モジュール |
|---|-----|------------|
| U-01 | `/index.html` | TOP |
| U-02 | `/talk-home.html` | TALK |
| U-03 | `/match/match-top.html` | MATCH |
| U-04 | `/match/match-list.html` | MATCH |
| U-05 | `/match/match-talk-bridge.html` | MATCH · TALK 導線 |
| U-06 | `/builder/index.html` | Builder |
| U-07 | `/shop-store.html` | Shop / 市場 |

### 3.2 推奨追加（LIVE 代表）

| # | URL | モジュール |
|---|-----|------------|
| U-08 | `/live/index.html` | LIVE |
| U-09 | `/live/shorts.html` | LIVE ショート |
| U-10 | `/live/profile.html?userId=u_me` | LIVE プロフィール |

### 3.3 存在しないパス（使用しない）

| パス | 代替 |
|------|------|
| `/match/` | `/match/match-top.html` |
| `/marketplace/` | `/shop-store.html` |
| `/builder/`（末尾スラッシュのみ） | `/builder/index.html` |

---

## 4. 実施手順

### 4.1 OTP ログイン（人手 · 必須）

1. シークレット / 通常ウィンドウで `https://tasufull-article.pages.dev/` を開く
2. Cloudflare Access → **One-time PIN** → `rubi.hiro0613@gmail.com`
3. OTP 入力 → サイト表示を確認
4. **同一ブラウザセッション**で以降の URL を開く（Cookie 維持）

### 4.2 自動 smoke（任意 · Service Token）

Access **Service Token** がある場合（Zero Trust → Access → Service Auth）:

```bash
# .env に追加（作成は Dashboard · 本手順書では Access 設定変更しない）
# CF_ACCESS_CLIENT_ID=...
# CF_ACCESS_CLIENT_SECRET=...

node --env-file=.env scripts/smoke-gate-d-production.mjs
```

### 4.3 保存セッション再利用（任意）

OTP 後に Playwright storage を保存:

```bash
npx playwright codegen --save-storage=reports/gate-d-auth-storage.json https://tasufull-article.pages.dev/talk-home.html
```

```bash
node scripts/smoke-gate-d-production.mjs --storage-state reports/gate-d-auth-storage.json
```

### 4.4 手動 DevTools チェック（各 URL）

1. **Network** タブを開いた状態で URL を開く
2. **Console** タブで error を確認
3. 下記 §5 の項目を記録

**Viewport 推奨:** 1280（代表）· 必要に応じ 390

---

## 5. 確認項目

### 5.1 画面

| ID | 確認 | PASS |
|----|------|------|
| V-01 | document が **200**（Access ログイン画面でない） | 本体 HTML が表示 |
| V-02 | **blank page なし** | 白画面・無限ローディングなし |
| V-03 | **404 / 500 なし** | Network で document 4xx/5xx なし |
| V-04 | **重大な表示崩れなし** | ナビ・主要コンテンツが視認可能 |
| V-05 | **主要 CTA クリック可能** | ボタン・リンクが dead でない |

### 5.2 Console

| ID | 確認 | PASS |
|----|------|------|
| C-01 | **重大 error なし** | `Failed to fetch` · uncaught · 404 script 連鎖なし |
| C-02 | Supabase 接続 error なし | `Invalid API key` · CORS · `Failed to load resource`（supabase.co）なし |
| C-03 | 401/403 の分類 | 下記 §5.5 |

**許容（想定内）:**

- 未ログイン JWT 前提の TALK/MATCH で「ログインしてください」系 UI
- feature flag OFF 時のゲート表示（現状フラグ未実装なら該当なし）
- 空データ状態の info ログ

### 5.3 Network

| ID | リソース | 期待 |
|----|----------|------|
| N-01 | **document** | **200** |
| N-02 | **chat-supabase-config.js** | **200** · `ddojquacsyqesrjhcvmn.supabase.co` |
| N-03 | **Supabase REST** | `*.supabase.co/rest/v1/*` → **200** または空配列 **200** |
| N-04 | **Supabase Auth** | `*.supabase.co/auth/v1/*` → セッションに応じ **200** / 401（想定内なら PASS） |
| N-05 | **Edge Functions** | LIVE 画面: `functions/v1/live-*` → **200**（呼び出しがある場合） |
| N-06 | **Storage** | `*.supabase.co/storage/v1/*` → **200**（アセット読込時） |
| N-07 | **静的アセット** | 主要 CSS/JS **200** |

### 5.4 モジュール別

| モジュール | 追加確認 |
|------------|----------|
| **TALK** | スレッド一覧 or 空状態 · `TasuTalkRoomEnsure` ロード |
| **MATCH** | list / talk-bridge CTA「メッセージする」· `smoke-match-talk-room` と整合 |
| **Builder** | builder トップ表示 · config 読込 |
| **Shop** | 店舗 TOP 表示 · ヘッダ/nav |
| **LIVE**（任意） | index/shorts 表示 · console 0 |

### 5.5 401 / 403 分類

| 区分 | 例 | 判定 |
|------|-----|------|
| **想定内** | 未ログインで protected REST · RLS で 0 行 | PASS（UI が説明を表示） |
| **想定外** | anon で他人データ取得 · config 読込 401 · 全面 API 403 | **FAIL** |

---

## 6. PASS / FAIL 基準

### URL 単位

| 判定 | 条件 |
|------|------|
| **PASS** | V-01〜05 · C-01〜02 · N-01〜02 満たす · 想定外 401/403 なし |
| **FAIL** | blank · 500 · Supabase 接続不能 · 想定外 RLS エラー · 重大 console error |
| **SKIP** | 機能フラグで意図的ブロック（記録必須） |
| **BLOCKED** | Access 未ログイン（302）— Gate-D 対象外 |

### Gate-D 総合

| 判定 | 条件 |
|------|------|
| **Go** | 必須 URL（§3.1）**すべて PASS** |
| **HOLD** | 1 つでも FAIL / BLOCKED / 未確認 |

---

## 7. 記録フォーマット

ファイル: `reports/production-private-test-run-YYYYMMDD.md`

```markdown
### {URL}

- 表示:
- Console:
- Network document:
- chat-supabase-config.js:
- Supabase API:
- Edge:
- Storage:
- 備考:
- 判定:
```

---

## 8. 既知の注意点

| # | 内容 |
|---|------|
| N-01 | **未認証 curl は 302** — Gate-B 確認済 · Gate-D は **OTP 後のみ** |
| N-02 | **robots.txt** 未認証 302 — Gate-C note で許容 |
| N-03 | 自動スクリプトは **Service Token または storage-state** がないと Access で BLOCKED |
| N-04 | `talkDev=1` · LS fallback は **本番 host で無効**（`auth-current-user.js`） |
| N-05 | staging Supabase — テストデータは staging 側 |
| N-06 | Edge live 呼び出しは LIVE 画面でのみ発生 — MATCH/TALK では N/A 可 |
| N-07 | Playwright headless は Access Cookie を持たない — 人手 OTP または Service Token 必須 |

---

## 9. 自動実行

```bash
node --env-file=.env scripts/smoke-gate-d-production.mjs
node scripts/smoke-gate-d-production.mjs --storage-state reports/gate-d-auth-storage.json
```

---

## 10. 参照

| 文書 | 用途 |
|------|------|
| [`production-private-test-access-plan.md`](production-private-test-access-plan.md) §6.2 | 親 smoke リスト |
| [`production-private-test-supabase-connectivity.md`](production-private-test-supabase-connectivity.md) | API 疎通 GO |
| [`gate-c-search-blocking-report.md`](gate-c-search-blocking-report.md) | Gate-C |
| `scripts/smoke-match-talk-room.mjs` | MATCH UI 期待値 |

---

**署名:** Gate-D smoke 手順書 — 2026-06-23
