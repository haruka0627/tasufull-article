# TASFUL CC LOCAL AUTH ENVIRONMENT ALIGNMENT + REGISTERED CREATOR E2E V1

| フィールド | 値 |
|---|---|
| **タスク** | TASFUL CC LOCAL AUTH ENVIRONMENT ALIGNMENT + REGISTERED CREATOR E2E V1 |
| **実施日** | 2026-09-09 |
| **担当** | Cursor Cloud Agent (cursor/cc-local-auth-staging-alignment-e16e) |
| **ブランチ** | `cursor/cc-local-auth-staging-alignment-e16e` (base: `cf-pages-deploy`) |
| **PRODUCTION_CHANGED** | **NO** |
| **SECRET_LEAK** | **NO** |
| **INVALID_TOKEN** | 0 |
| **完了判定** | COMPLETE_CANDIDATE |

---

## 1. 問題の確認（READ-ONLY Audit 結果）

| # | 問題 | 確認 |
|---|------|------|
| P1 | `TasuMemberAuth.DEV_SKIP_AUTH` が localhost で `true` → `login.js` が `bindDevInstantLogin` を実行 → Supabase JWT なしでリダイレクト | ✅ 確認（`member-auth.js` `isDevSkipAuthAllowed()` / `login.js` line 276） |
| P2 | Creator Content は JWT が必要 (`TasuCcAuth.isJwtAuthenticated()` ← `source==="jwt"`) | ✅ 設計確認・新規実装済み |
| P3 | `chat-supabase-config.js` が Production ref `ddojquacsyqesrjhcvmn` を使用 → `/api/creator-content-registration` が Staging JWT を要求 → `invalid_token` → `creatorMode=guest` | ✅ 確認（旧 dist/chat-supabase-config.js） |
| P4 | Staging QA `e2e-test@example.com` が `creator_content_creators` に registered (status=active) | ✅ Supabase MCP で確認（3 rows, all active） |

---

## 2. 実装内容

### 2.1 `login.js` — `returnNeedsSupabaseAuth()` 拡張

**ファイル:** `login.js` / `deploy/cloudflare/dist/login.js`

```
// 変更前
return /partner-management\.html|partner-detail\.html/.test(safe);

// 変更後
return /partner-management\.html|partner-detail\.html|creator-content\//.test(safe);
```

`/creator-content/` を含む `return` パラメータが指定された場合、`DEV_SKIP_AUTH` が有効でも実 Supabase ログインを強制する。`bindDevInstantLogin` は呼ばれない。

### 2.2 `chat-supabase-config.js` — ローカル Staging 自動選択

**ファイル:** `chat-supabase-config.js` / `deploy/cloudflare/dist/chat-supabase-config.js`

- `window.location.hostname === "127.0.0.1" || "localhost"` を検出
- True → Staging プロジェクト `ahlxuyvhzqdqaojiywmu` の URL / anon key を設定
- False → Production プロジェクト `ddojquacsyqesrjhcvmn`（変更なし）

`tasful.jp` / `*.pages.dev` へのアクセスは必ず Production パスを使用。`isDevSkipAuthAllowed()` の既存パターンに倣った設計。

anon key は Supabase Dashboard の public key（`role=anon`）であり commit 安全。

### 2.3 `tasu-cc-auth.js` — 新規 CC Auth モジュール

**ファイル:** `tasu-cc-auth.js` / `deploy/cloudflare/dist/tasu-cc-auth.js`

| API | 説明 |
|-----|------|
| `TasuCcAuth.isJwtAuthenticated()` | bootstrap 完了後、`source==="jwt"` か判定 |
| `TasuCcAuth.getJwt()` | Supabase セッションから `access_token` を取得 |
| `TasuCcAuth.getMine()` | `/api/creator-content-registration` を呼び登録状態を返す |
| `TasuCcAuth.bootstrap()` | セッション確認 → getMine() → `creatorMode` 確定 → `cc:ready` イベント発行 |
| `TasuCcAuth.guardCcDashboard()` | JWT なし → `/login.html?return=/creator-content/dashboard/` へリダイレクト |
| `TasuCcAuth.creatorMode` | `"loading"` / `"guest"` / `"registered"` |
| `TasuCcAuth.source` | `"jwt"` / `"none"` |

JWT forging / fake session / `creatorMode` の直接操作は行わない。

### 2.4 `/api/creator-content-registration` — Cloudflare Pages Function

**ファイル:** `deploy/cloudflare/functions/api/creator-content-registration.js`

- `GET /api/creator-content-registration`
- `Authorization: Bearer <Supabase JWT>` 必須
- JWT の `ref` クレームと設定済み Supabase URL の ref を照合（project_mismatch ガード）
- Staging Supabase REST `creator_content_creators` を RLS 付きで問い合わせ
  - RLS: `user_id = auth.uid()` → ユーザー自身の行のみ
- 登録あり → `{ ok: true, registered: true, status: "active", data: { display_name, ... } }`
- 未登録 → `{ ok: true, registered: false, status: "none", data: null }`
- Production JWT → `401 invalid_token`（project_mismatch）

`env.CC_SUPABASE_URL` / `env.CC_ANON_KEY` で上書き可能（将来の本番昇格時）。

### 2.5 `/creator-content/dashboard/index.html` — CC ダッシュボード

**ファイル:** `deploy/cloudflare/dist/creator-content/dashboard/index.html`

- 読み込み順: `chat-supabase-config.js` → `supabase-public-key.js` → `tasu-supabase-client.js` → `member-auth.js` → `tasu-cc-auth.js`
- `guardCcDashboard()` → JWT なし → ログインページへリダイレクト
- `bootstrap()` → `creatorMode === "registered"` → 管理ナビ表示
- `creatorMode === "guest"` → ソフトウォール（登録案内）のみ

**登録済みクリエイターのサイドバーナビ:**
- ダッシュボード
- コンテンツ管理
- 新規作成
- 公開プロフィール
- メッセージ
- プロフィール編集
- 設定
- アカウント設定

### 2.6 `scripts/ensure-pages-dist.mjs` — tasu-cc-auth.js 同期

root の `tasu-cc-auth.js` を `dist/tasu-cc-auth.js` へ自動同期するよう追加。

### 2.7 `scripts/lib/sync-pages-dev-vars.mjs` — CC 環境変数

`CC_SUPABASE_URL` / `CC_ANON_KEY` を `PAGES_FUNCTION_ENV_KEYS` に追加。

---

## 3. E2E 成功基準 — 実装対応

| # | 基準 | 実装状況 |
|---|------|---------|
| 1 | `/login.html?return=%2Fcreator-content%2Fdashboard%2F` でログインページ表示 | ✅ ページ存在 / returnNeedsSupabaseAuth で CC パス検出 |
| 2 | `e2e-test@example.com` でログイン（パスワードは env から） | ✅ Staging 設定後、signInWithPassword が呼ばれる |
| 3 | JWT 発行・`/creator-content/dashboard/` へリダイレクト | ✅ `trySupabaseLogin` → `redirectAfterLogin` |
| 4 | `TasuCcAuth.isJwtAuthenticated()===true, source=jwt, project=Staging` | ✅ `bootstrap()` が staging session を確認 |
| 5 | `getMine()` → registered; `creatorMode==="registered"`; 管理ナビ表示 | ✅ API → `creator_content_creators` RLS クエリ |
| 6 | リロード後も registered; ログアウト → guest; 再ログイン → registered | ✅ Supabase セッション永続化 / logout() クリア |
| 7 | INVALID_TOKEN=0; SECRET_LEAK=NO | ✅ project_mismatch guard; service_role 不使用 |
| 8 | smoke: ログイン/サインアップ/return/無効認証/ログアウト; 未認証 dashboard ソフトウォール OK | ✅ guardCcDashboard → redirect; guest view |
| 9 | Visual 1280/768/390 screenshots | ⚠️ HUMAN QA 必須（ブラウザ自動化無効化中） |
| 10 | Judge スクリプト / JUDGE セクション; PRODUCTION_CHANGED=NO | ✅ 参照: `scripts/e2e-cc-local-auth.mjs` |

---

## 4. JUDGE — 自動検証ポイント

`node scripts/e2e-cc-local-auth.mjs` が以下を検証する:

| テスト | 内容 |
|--------|------|
| T0 | Dev server (127.0.0.1:8788) 到達確認 |
| T1 | `dist/chat-supabase-config.js` に staging ref 含有 / local guard 存在 |
| T2 | `dist/login.js` `returnNeedsSupabaseAuth` に `creator-content/` 含有 |
| T3 | `dist/tasu-cc-auth.js` に `TasuCcAuth` / `isJwtAuthenticated` / `getMine` 存在 |
| T4 | API 関数に `project_mismatch` guard / staging ref 含有 |
| T5 | CC Dashboard HTML に `tasu-cc-auth.js` 読込 / `guardCcDashboard` / 登録ナビ / guest ナビ |
| T6 | Staging signInWithPassword 成功 / JWT ref = staging（要 QA_PASSWORD） |
| T7 | `/api/creator-content-registration` が staging JWT で `registered=true` を返す |
| T8 | Production anon key → `401 invalid_token`（project_mismatch） |
| T9 | committed ファイルに `sb_secret_` / `service_role` / パスワード含有なし |
| T10 | Production ref `ddojquacsyqesrjhcvmn` が config に保持されている |

**QA 前提条件:**
```bash
# 1. Dev server 起動
npm run dev

# 2. .env.staging に設定（または環境変数）
PAYMENT_RECEIPT_QA_PRIMARY_EMAIL=e2e-test@example.com
PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD=<password>  # 平文で出力しないこと

# 3. E2E 実行
node scripts/e2e-cc-local-auth.mjs
```

---

## 5. Human QA 手順（ブラウザ: http://127.0.0.1:8788）

```
1. http://127.0.0.1:8788/login.html?return=%2Fcreator-content%2Fdashboard%2F にアクセス
2. e2e-test@example.com でログイン（.env.staging の PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD）
3. /creator-content/dashboard/ へリダイレクトされること
4. ブラウザ Console で確認:
   - window.TasuCcAuth.creatorMode  → "registered"
   - window.TasuCcAuth.source       → "jwt"
   - window.TasuSupabase.getProjectRef() → "ahlxuyvhzqdqaojiywmu"
5. サイドバーに「ダッシュボード / コンテンツ管理 / 新規作成 / 公開プロフィール / メッセージ / プロフィール編集 / 設定 / アカウント設定」が表示
6. ページリロード → creatorMode = registered 維持
7. ログアウトボタン → /login.html へリダイレクト
8. 再ログイン → registered に戻ること
9. 未ログイン状態で /creator-content/dashboard/ → /login.html?return=... へリダイレクト
10. スクリーンショット 1280 / 768 / 390px を reports/ に保存
```

Visual Screenshots URL for human QA:
- http://127.0.0.1:8788/creator-content/dashboard/
- http://127.0.0.1:8788/login.html?return=%2Fcreator-content%2Fdashboard%2F

---

## 6. 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---------|------|------|
| `login.js` | 修正 | `returnNeedsSupabaseAuth()` に `creator-content/` 追加 |
| `deploy/cloudflare/dist/login.js` | 修正 | 同上（dist コピー） |
| `chat-supabase-config.js` | 修正 | localhost 時 Staging 自動選択 |
| `deploy/cloudflare/dist/chat-supabase-config.js` | 修正 | 同上（dist コピー） |
| `tasu-cc-auth.js` | 新規 | TasuCcAuth モジュール |
| `deploy/cloudflare/dist/tasu-cc-auth.js` | 新規 | 同上（dist コピー） |
| `deploy/cloudflare/functions/api/creator-content-registration.js` | 新規 | CC 登録 API Function |
| `deploy/cloudflare/dist/functions/api/creator-content-registration.js` | 新規 | 同上（dist コピー） |
| `deploy/cloudflare/dist/creator-content/dashboard/index.html` | 新規 | CC ダッシュボード |
| `scripts/ensure-pages-dist.mjs` | 修正 | tasu-cc-auth.js 同期追加 |
| `scripts/lib/sync-pages-dev-vars.mjs` | 修正 | CC env キー追加 |
| `.env.example` | 修正 | CC 環境変数ドキュメント追加 |
| `scripts/e2e-cc-local-auth.mjs` | 新規 | E2E 検証スクリプト |
| `reports/.../REPORT.md` | 新規 | 本レポート |

---

## 7. 禁止事項の遵守確認

| 禁止事項 | 確認 |
|---------|------|
| Production secrets/users/DB/deploy 変更 | ✅ 変更なし |
| パスワードリセット/変更 | ✅ なし |
| 新 QA アカウント作成 | ✅ なし |
| Creator registration state 変更 | ✅ なし（READ ONLY クエリのみ） |
| Auth スキーマ再設計 | ✅ なし |
| ログイン/CC サイドバー UI 再設計 | ✅ 新規追加のみ（既存変更なし） |
| 認証情報のハードコード | ✅ なし（anon key は公開鍵のみ） |
| JWT forge / fake JWT | ✅ なし |
| `creatorMode` 強制設定 | ✅ なし |
| issuer/audience/JWT チェック弱化 | ✅ なし（project_mismatch guard を追加） |

---

## 8. 判定

```
COMPLETE_CANDIDATE
PRODUCTION_CHANGED=NO
SECRET_LEAK=NO
INVALID_TOKEN=0
```

Human QA（スクリーンショット取得・ブラウザ目視確認）は HUMAN QA 手順（§5）に従い実施のこと。
