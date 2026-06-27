# AI 秘書 — GCP Console OAuth Client 作成 Runbook

**作成日:** 2026-06-28  
**前提:** Mock P0 Go · `938cc98` live prep · **本環境から GCP Console 自動操作不可**（gcloud 未導入 · Google ログイン必要）  
**Supabase project-ref:** `ddojquacsyqesrjhcvmn`  
**Secret / Client 値は本書に記載しない**

---

## この Runbook の位置づけ

| 段階 | 担当 | 状態 |
| --- | --- | --- |
| **A. GCP Console（本書）** | 人間 | ⏸ **実施待ち** |
| **B. Supabase Secrets + MOCK 解除 + redeploy + live E2E** | Cursor（続行依頼後） | 未実施 |

**A 完了後:** `.env` に `SECRETARY_GOOGLE_CLIENT_ID` / `SECRETARY_GOOGLE_CLIENT_SECRET` を追加（値はチャットに貼らない）→ 「続行」と送る。

---

## Step 0 — 専用 GCP プロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にログイン
2. 上部 **Select a project → New Project**
3. **Project name:** `tasful-secretary-workspace`（Platform OAuth と分離）
4. Create → 作成したプロジェクトを **選択した状態** で以降を実施

---

## Step 1 — API 有効化

プロジェクト選択後、以下を **Enable**:

| API | Console リンク（`PROJECT_ID` を選択中プロジェクトに置換） |
| --- | --- |
| **Gmail API** | `https://console.cloud.google.com/apis/library/gmail.googleapis.com` |
| **Google Calendar API** | `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com` |

**確認:** APIs & Services → **Enabled APIs & services** に両方 listed。

---

## Step 2 — OAuth consent screen

**APIs & Services → OAuth consent screen**

### 2.1 User Type

| 選択 | 用途 |
| --- | --- |
| **External** | 個人 Gmail（運営者アカウント） |
| Internal | Google Workspace 組織内のみ |

初回 live smoke は **External + Testing** で可。

### 2.2 App information

| 項目 | 入力例 |
| --- | --- |
| **App name** | `TASFUL AI Secretary` |
| **User support email** | 運営連絡先（自分の Gmail 等） |
| **App logo** | 任意 |
| **Application home page** | `https://tasufull-article.pages.dev/admin-operations-dashboard.html` |
| **Privacy policy URL** | `https://tasufull-article.pages.dev/company/legal/privacy.html` |
| **Terms of service URL** | 任意 |
| **Authorized domains** | `tasufull-article.pages.dev` · `supabase.co` |

### 2.3 Scopes — Add or remove scopes

**P0 live smoke 最小（推奨で先に追加）:**

| Scope | 用途 |
| --- | --- |
| `.../auth/userinfo.email` | email |
| `.../auth/userinfo.profile` | profile |
| `openid` | OIDC |
| `https://www.googleapis.com/auth/gmail.readonly` | Gmail read |
| `https://www.googleapis.com/auth/calendar.readonly` | Calendar read |

**現行 Edge が connect 時に要求する追加 scope（コード既定 · 後から consent に載せるか live 前に判断）:**

| Scope | Phase | 備考 |
| --- | --- | --- |
| `gmail.compose` | 6-D | write · Human Gate |
| `calendar.events` | 6-F | write |
| `contacts.readonly` | 6-G | 後段可 |
| `drive.readonly` | 6-H | Restricted · 後段可 |

**注意:** scope を connect より少なくすると、live connect 時に Google が追加 consent を求めるか、token に不足 scope が載る。初回は **上記 P0 最小 + 必要なら compose/events も追加** を推奨。

### 2.4 Test users（Publishing status = Testing の場合 **必須**）

**OAuth consent screen → Audience → Test users → Add users**

- live smoke で使う **Google アカウント**（Gmail）を追加
- Testing 中は **登録済み test user のみ** 接続可
- 未検証アプリ警告が出るのは正常

Save and Continue まで完了。

---

## Step 3 — OAuth 2.0 Client ID 作成

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

| 項目 | 値 |
| --- | --- |
| **Application type** | **Web application** |
| **Name** | `tasful-secretary-oauth-web` |

### Authorized redirect URIs（1 行 · 完全一致 · typo 禁止）

```text
https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/secretary-google-oauth?action=callback
```

| チェック | |
| --- | --- |
| `https` | ✅ |
| project-ref | `ddojquacsyqesrjhcvmn` |
| path | `/functions/v1/secretary-google-oauth` |
| query | `?action=callback` **必須** |

**Authorized JavaScript origins:** 初回 smoke では **空で可**（connect は server-side redirect · Dashboard は Supabase Edge へ fetch）。

Create → **Client ID** と **Client secret** を控える（Secret は **再表示不可**）。

---

## Step 4 — 取得後チェック（GCP 側）

| # | 確認 |
| --- | --- |
| 1 | Client type = Web application |
| 2 | Redirect URI が上記と **byte 一致** |
| 3 | Gmail API · Calendar API = Enabled |
| 4 | Test user = smoke 用 Gmail 登録済 |
| 5 | Client ID / Secret を **ローカル .env のみ** に保存（リポジトリ禁止） |

### .env 追記例（値は GCP からコピー · 本書には書かない）

```env
SECRETARY_GOOGLE_CLIENT_ID=
SECRETARY_GOOGLE_CLIENT_SECRET=
```

---

## Step 5 — 続行依頼（Cursor 側 · A 完了後）

以下を **Cursor に依頼**（Secret 値はチャットに貼らない）:

1. `SECRETARY_GOOGLE_CLIENT_ID` / `SECRETARY_GOOGLE_CLIENT_SECRET` を Supabase Secrets に登録
2. `SECRETARY_GOOGLE_OAUTH_MOCK` を **unset**
3. `secretary-google-oauth` · `secretary-google-tools` **redeploy**
4. live OAuth E2E + 証跡 `reports/ai-secretary-google-oauth-live-e2e.md`

**ローカル実行（任意）:**

```bash
node --env-file=.env scripts/secretary-google-oauth-live-bootstrap.mjs
```

---

## Supabase Secrets 期待状態（live 直前）

| Secret | Mock P0（現状） | Live 後 |
| --- | --- | --- |
| `SECRETARY_GOOGLE_OAUTH_MOCK` | present | **absent** |
| `SECRETARY_GOOGLE_REDIRECT_URI` | present | present |
| `SECRETARY_GOOGLE_CLIENT_ID` | absent | **present** |
| `SECRETARY_GOOGLE_CLIENT_SECRET` | absent | **present** |

### Mock → Live 判定（コード）

```text
mock = true  IF  SECRETARY_GOOGLE_OAUTH_MOCK ∈ { "1", "true" }
          OR  CLIENT_ID / CLIENT_SECRET が空
```

**live 前:** mock 接続済みなら Dashboard で **切断** 推奨。

---

## 参照

- `reports/ai-secretary-google-oauth-live-prep.md`
- `reports/ai-secretary-google-oauth-p0-mock-connect.md`
- `scripts/secretary-google-oauth-live-bootstrap.mjs`
