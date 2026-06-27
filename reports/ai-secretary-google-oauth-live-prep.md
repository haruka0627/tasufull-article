# AI 秘書 P0 — Google OAuth Live 準備

**作成日:** 2026-06-28  
**Git HEAD（作成時）:** `b024264` — `fix(secretary): allow dev user header in google oauth cors`  
**種別:** live OAuth 準備チェックリスト · GCP 手順 · Secret 登録前確認  
**前提:** Mock Connect / Callback E2E **Go**（`fb78d64`）· CORS fix **Go**（`b024264`）

**スコープ:** AI秘書 Google OAuth / Tools のみ · **Secret / Token 値は本書に記載しない**

---

## 総合判定: **準備ドキュメント完成 — live 実施は人間作業待ち**

| 領域 | 状態 |
| --- | --- |
| Mock P0 | ✅ 完了 |
| Edge deploy | ✅ `secretary-google-oauth` · `secretary-google-tools` |
| Migration / Vault | ✅ 適用済 |
| REDIRECT_URI Secret | ✅ present |
| CLIENT_ID / CLIENT_SECRET | ⏸ **未設定**（意図どおり） |
| live OAuth E2E | ⏸ **未実施** |

---

## 1. Live OAuth に必要な設定値（整理）

### 1.1 Authorized redirect URI

Google Cloud Console の OAuth 2.0 Client に **完全一致** で登録:

```text
https://<project-ref>.supabase.co/functions/v1/secretary-google-oauth?action=callback
```

| 項目 | 内容 |
| --- | --- |
| **Supabase Secret 名** | `SECRETARY_GOOGLE_REDIRECT_URI` |
| **現状** | **present**（mock P0 で設定済） |
| **live 時** | 値はそのまま利用可（mock / live 共通 callback URL） |
| **クエリ `action=callback`** | Edge `secretary-google-oauth` が GET callback を処理 — **省略不可** |

**Staging / 別プロジェクト:** redirect URI は GCP Client ごとに追加登録。Secret は環境ごとに 1 値。

### 1.2 OAuth Client 種別

| 項目 | 推奨 |
| --- | --- |
| **Client type** | **Web application** |
| **Platform OAuth 分離** | Platform ユーザー Google ログイン用 Client とは **別 GCP プロジェクト / 別 Client ID**（`reports/secretary-google-workspace-plan.md` §1.3） |
| **Grant** | Authorization Code + **PKCE (S256)** · `access_type=offline` |
| **初回 connect** | `prompt=consent`（refresh token 取得のため） |

### 1.3 必要 Scopes

#### P0 live 最小（推奨 · 本番初回 smoke 用）

| 用途 | Scope | Google 分類 |
| --- | --- | --- |
| アカウント表示 | `openid` · `email` · `profile` | Non-sensitive |
| Gmail read-only | `https://www.googleapis.com/auth/gmail.readonly` | **Sensitive** |
| Calendar read-only | `https://www.googleapis.com/auth/calendar.readonly` | Sensitive |

#### コード既定（`DEFAULT_GOOGLE_OAUTH_SCOPES` · 現行 Edge）

`supabase/functions/_shared/secretary-google-oauth.ts` は connect 時に **以下すべて** を要求:

| Scope | Phase | 備考 |
| --- | --- | --- |
| `openid` · `email` · `profile` | Base | 接続 UI 表示 |
| `gmail.readonly` | 6-C | ✅ P0 |
| `gmail.compose` | 6-D | write · Human Gate |
| `calendar.readonly` | 6-E | ✅ P0 |
| `calendar.events` | 6-F | write · Human Gate |
| `contacts.readonly` | 6-G | **後段可** |
| `drive.readonly` | 6-H | **後段可** · Restricted |

**方針:**

- **初回 live smoke（P0）:** GCP consent screen に **P0 最小 3 系統** を登録し、Gmail / Calendar read-only smoke のみ実施。
- **現行コードは全 DEFAULT を connect に送る** — write / Contacts / Drive スコープも consent 画面に載せるか、後続タスクで `connect` の `scopes` を段階付与に変更する。
- **Contacts / Drive:** live 前に必須ではない。利用開始時に API 有効化 + scope 追加 + 再 consent。

### 1.4 OAuth consent screen — 必要項目

| 項目 | 内容 |
| --- | --- |
| **User Type** | **External**（個人 Gmail 想定）または Internal（Workspace 限定の場合） |
| **App name** | 例: `TASFUL AI Secretary`（運営向けと分かる名称） |
| **User support email** | 運営連絡先 |
| **Developer contact** | Google 審査連絡先 |
| **App logo** | 任意 · 推奨 |
| **Application home page** | 運営サイト URL |
| **Privacy policy URL** | **Production 公開前必須** |
| **Terms of service URL** | 推奨 |
| **Authorized domains** | 本番 Dashboard ドメイン（例: `tasufull-article.pages.dev`） |
| **Scopes** | 上記 §1.3 を consent screen に追加 · Sensitive / Restricted は **利用目的の説明** を記載 |

### 1.5 テストユーザー設定

| Publishing status | 要件 |
| --- | --- |
| **Testing（未検証）** | **Test users 必須** — 接続する Google アカウントを Console に追加（最大 100） |
| **Testing 制約** | 「Google hasn't verified this app」警告 · refresh token **7 日で失効** の可能性 |
| **In production（検証済）** | 一般ユーザー可 · Sensitive scope は **OAuth verification** · Restricted（`drive.readonly` 等）は **CASA** 追加 |

**P0 live smoke 推奨:** まず **Testing + 運営者 Gmail を test user 登録** で E2E。Production verification は read-only smoke 成功後。

---

## 2. GCP Console — OAuth Client 設定手順

**Secret 値・Client ID 実値は Console / Supabase のみ。リポジトリ・本 report には書かない。**

### Step 0 — 専用 GCP プロジェクト

1. [Google Cloud Console](https://console.cloud.google.com/) → **New Project**
2. 推奨名: `tasful-secretary-workspace`（Platform OAuth と分離）
3. 請求先アカウントを紐付け（API 利用のため）

### Step 1 — API 有効化

**APIs & Services → Library** で有効化:

| API | P0 | 後段 |
| --- | --- | --- |
| **Gmail API** | ✅ 必須 | |
| **Google Calendar API** | ✅ 必須 | |
| People API | | Contacts 利用時 |
| Google Drive API | | Drive 利用時 |

### Step 2 — OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User Type 選択（External 推奨）
3. App information 入力（§1.4）
4. **Scopes → Add or remove scopes** — §1.3 の scope を追加
5. **Test users** — live smoke 用 Google アカウントを追加（Testing 時）
6. Save

### Step 3 — OAuth 2.0 Client ID 作成

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: 例 `tasful-secretary-oauth-web`
4. **Authorized redirect URIs** に §1.1 の URI を **1 行追加**（typo 注意）
5. Create → **Client ID / Client Secret を控える**（Secret は再表示不可 — 即 Supabase Secret へ）

### Step 4 — 動作確認（GCP 側のみ · live 前）

| チェック | 期待 |
| --- | --- |
| Redirect URI 完全一致 | Supabase callback URL と byte 一致 |
| Consent screen scopes | Gmail / Calendar read が listed |
| Test user | smoke 用アカウント registered |
| Client type | Web application |

---

## 3. Supabase Secrets — live 登録前チェックリスト

### 3.1 登録順序（推奨）

| # | Secret | 操作 | 確認 |
| --- | --- | --- | --- |
| 1 | `SECRETARY_GOOGLE_REDIRECT_URI` | **既存のまま**（present 確認） | callback URL パターン一致 |
| 2 | `SECRETARY_GOOGLE_CLIENT_ID` | **新規 set** | presence = present |
| 3 | `SECRETARY_GOOGLE_CLIENT_SECRET` | **新規 set** | presence = present |
| 4 | `SECRETARY_GOOGLE_OAUTH_MOCK` | **unset または `0` / `false`** | mock 強制 OFF |
| 5 | （任意）`SECRETARY_GOOGLE_POST_CONNECT_URL` | 本番 Dashboard URL | callback 後 redirect 先 |

**CLI 例（値は人間が入力 · ログに残さない）:**

```bash
npx supabase secrets set \
  SECRETARY_GOOGLE_CLIENT_ID="<from-gcp-console>" \
  SECRETARY_GOOGLE_CLIENT_SECRET="<from-gcp-console>" \
  --project-ref <project-ref>
# MOCK を外す:
npx supabase secrets unset SECRETARY_GOOGLE_OAUTH_MOCK --project-ref <project-ref>
```

### 3.2 Secret presence 期待値（live 直前）

| Secret | Mock P0（現状） | Live 準備完了後 |
| --- | --- | --- |
| `SECRETARY_GOOGLE_OAUTH_MOCK` | present (`1`) | **absent** または `0` / `false` |
| `SECRETARY_GOOGLE_REDIRECT_URI` | present | **present** |
| `SECRETARY_GOOGLE_CLIENT_ID` | absent | **present** |
| `SECRETARY_GOOGLE_CLIENT_SECRET` | absent | **present** |

### 3.3 Mock → Live 切替方針

**判定ロジック**（`isSecretaryGoogleMockMode()`）:

```text
mock = true  IF  SECRETARY_GOOGLE_OAUTH_MOCK ∈ { "1", "true" }
          OR  CLIENT_ID が空
          OR  CLIENT_SECRET が空
```

| モード | 条件 | connect 挙動 |
| --- | --- | --- |
| **Mock** | MOCK=1 **または** ID/Secret 欠落 | `mock:true` · `mock_callback` 自動 |
| **Live** | ID + Secret + REDIRECT_URI あり **かつ** MOCK 無効 | Google `authUrl` redirect · 実 token exchange |

**切替手順（推奨）:**

1. GCP Client 作成 · redirect URI 登録 · test user 追加
2. Supabase: `CLIENT_ID` · `CLIENT_SECRET` を set
3. **`SECRETARY_GOOGLE_OAUTH_MOCK` を unset**（`1` のままだと live でも mock）
4. Edge **redeploy**（Secret バインド反映 — DeepSeek P0 と同様）
5. `connect` → Google consent → callback → `status.connected:true` · **`mock:false`**
6. tools: Gmail / Calendar **live read** smoke（8788 Dashboard + Edge probe）
7. 問題時: MOCK=1 に戻して rollback smoke

**Token Vault:** mock 接続済み行は live 前に **disconnect** 推奨（mock token と live token の混在回避）。

### 3.4 Edge redeploy（Secret 変更後必須）

```bash
npx supabase functions deploy secretary-google-oauth secretary-google-tools \
  --project-ref <project-ref> --no-verify-jwt --use-api --yes
```

---

## 4. Live E2E 計画（次タスク · 本書では未実施）

| Step | 確認 |
| --- | --- |
| 1 | Secrets presence（§3.2 live 列） |
| 2 | `connect` → HTTP 200 · `mock:false` · `authUrl` が `accounts.google.com` |
| 3 | ブラウザ consent 完了 → callback 302 → Dashboard |
| 4 | `status` → `connected:true` · `mock:false` · email 表示 |
| 5 | `capabilities` → `googleConnected:true` |
| 6 | `gmail` · `labels.list` → live データ（または空） |
| 7 | `calendar_read` · `calendarList.list` → live データ |
| 8 | Dashboard 8788 · 1280 / 390 · JS fatal 0 |
| 9 | disconnect · vault 行削除確認 |

**証跡予定:** `reports/ai-secretary-google-oauth-live-e2e.md`（live 実施時）

---

## 5. リスク · 注意

| 項目 | 内容 |
| --- | --- |
| **未検証アプリ** | Testing 中は test user 以外は接続不可 |
| **Sensitive scopes** | `gmail.readonly` は verification 対象 · 社内 smoke は Testing で可 |
| **DEFAULT scopes 過多** | compose / calendar.events / drive 等も consent に出る — 最小化は後続検討 |
| **refresh token** | 初回 `prompt=consent` 必須 · 再取得は disconnect → reconnect |
| **CORS** | `x-secretary-dev-user-id` 許可済（`b024264`）— Dashboard live connect に必要 |
| **Platform 分離** | Builder / TASFUL AI / Platform OAuth には触れない |

---

## 参照

| ファイル | 内容 |
| --- | --- |
| `reports/ai-secretary-google-oauth-p0-mock-connect.md` | Mock E2E 証跡 |
| `reports/ai-secretary-google-oauth-p0-edge-smoke.md` | Edge deploy 証跡 |
| `reports/secretary-google-phase6b-oauth-token-vault.md` | OAuth / Vault 設計 |
| `reports/secretary-google-workspace-plan.md` | Workspace 全体設計 · scope 分類 |
| `supabase/functions/_shared/secretary-google-oauth.ts` | DEFAULT scopes · mock 判定 |
| `supabase/functions/secretary-google-oauth/index.ts` | connect / callback フロー |
