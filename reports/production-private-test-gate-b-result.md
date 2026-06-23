# Gate-B 実施結果 — Cloudflare Access 有効化

| 項目 | 内容 |
|------|------|
| 実施日 | **2026-06-23** |
| 実施者 | Cursor Agent（Cloudflare API 試行 · curl プローブ） |
| 親チェックリスト | [`production-private-test-preflight.md`](production-private-test-preflight.md) §5 |
| 計画書 | [`production-private-test-access-plan.md`](production-private-test-access-plan.md) |
| 制約遵守 | アプリコード変更なし · Supabase 未変更 · robots/_headers/feature flags 未変更 · デプロイなし |

---

## 総合判定

| 判定 | 結果 |
|------|------|
| **Gate-B** | **No-Go** |

**理由:** リポジトリ `.env` の `CLOUDFLARE_API_TOKEN` は **Cloudflare Pages API には有効**だが、**Zero Trust / Access API が 403（Authentication error 10000）** のため、Access Application / Policy を API 経由で作成できなかった。`tasufull-article.pages.dev` は引き続き **HTTP 200・Access なし**で一般公開状態。

---

## 1. 実施内容

### 1.1 認証確認

| 項目 | 結果 |
|------|------|
| `npx wrangler whoami` | **OK** — `rubi.hiro0613@gmail.com` |
| Cloudflare Account ID | `002d3d2e2ea8fc31da54a2c79a2dad12` |
| トークンソース | リポジトリ `.env` の `CLOUDFLARE_API_TOKEN`（wrangler が自動読込） |
| `GET /user/tokens/verify` | **active** |
| `GET /accounts/.../pages/projects` | **success**（`tasufull-article` 確認） |

### 1.2 Access API 試行（ブロック）

| API | 結果 |
|-----|------|
| `GET /accounts/002d3d2e2ea8fc31da54a2c79a2dad12/access/identity_providers` | **403** — `10000: Authentication error` |
| `GET /accounts/.../access/organizations` | **403** — 同上 |

→ **Zero Trust / Access 編集権限のない API トークン**のため、Dashboard 相当の Application / Policy 作成に到達できず。

### 1.3 作成予定だった Access 設定（未作成）

| 項目 | 計画値 | 状態 |
|------|--------|------|
| Application A 名 | `TASFUL Production Private (tasful.jp)` | **未作成** |
| Application A ドメイン | `tasful.jp`（Self-hosted · 全パス） | **未作成** |
| Application B 名 | `TASFUL Production Private (pages.dev)` | **未作成** |
| Application B ドメイン | `tasufull-article.pages.dev` | **未作成** |
| Policy 名 | `Allow rubi only` | **未作成** |
| Policy Action | **Allow** | — |
| Policy Include | Emails: `rubi.hiro0613@gmail.com` **のみ** | — |
| 認証方式 | **One-time PIN** | — |
| Session Duration | `24 hours`（計画書 §1.3） | — |

**Application ID:** なし（未作成）

---

## 2. 動作確認（curl · 未認証）

| ID | URL | 期待 | 実測 | 判定 |
|----|-----|------|------|------|
| A-BHV-02 | `https://tasufull-article.pages.dev/` | Access ログイン画面 / 302·403 | **HTTP 200 OK** · `cf-access` ヘッダなし | **FAIL** |
| A-BHV-05 | `curl -sI https://tasful.jp/` | 302·403 | **接続失敗**（exit 6 · DNS 未解決） | **N/A** |
| A-BHV-06 | `curl -sI https://tasufull-article.pages.dev/` | 302·403 | **HTTP 200 OK** | **FAIL** |

### 2.1 ブラウザ検証（人手 · 未実施）

Access 未設定のため以下は **未検証**:

| ID | 手順 | 状態 |
|----|------|------|
| A-BHV-01 | 未ログイン `tasful.jp` → Access 画面 | **SKIP**（DNS 未到達 + Access 未設定） |
| A-BHV-03 | 許可外メール OTP → 拒否 | **SKIP** |
| A-BHV-04 | `rubi.hiro0613@gmail.com` OTP → 成功 | **SKIP** |
| A-BHV-07 | www → apex 後も Access | **SKIP** |

### 2.2 スクリーンショット

| 項目 | 保存先 |
|------|--------|
| Access Application 設定画面 | **未取得**（Application 未作成） |
| Access ログイン画面 | **未取得** |
| OTP 成功画面 | **未取得** |

保存先（計画）: `reports/screenshots/gate-b-access/` — **ディレクトリ未作成**

---

## 3. Gate-B 判定表

| ID | 条件 | 状態 |
|----|------|------|
| GB-01 | One-time PIN IdP 有効 | **未実施** |
| GB-02 | Application `tasful.jp` 作成 | **未実施** |
| GB-03 | Application `tasufull-article.pages.dev` 作成 | **未実施** |
| GB-04 | Allow Policy — `rubi.hiro0613@gmail.com` のみ | **未実施** |
| GB-05 | 未認証 curl → 302/403 | **FAIL**（pages.dev 200） |
| GB-06 | 許可メール OTP ログイン | **未検証** |
| GB-07 | 許可外メール拒否 | **未検証** |

**Gate-B 判定: No-Go**

---

## 4. 残課題一覧

| 優先度 | 課題 | 対応案 |
|--------|------|--------|
| **P0** | API トークンに Zero Trust 権限なし | [API Tokens](https://dash.cloudflare.com/profile/api-tokens) で **Account → Zero Trust → Edit**（または Access Applications Edit）を付与したトークンを `.env` に設定 |
| **P0** | Zero Trust 未有効化の可能性 | Dashboard → **Zero Trust** を開き、アカウントで Zero Trust が有効か確認 |
| **P0** | Access Application 2 本未作成 | Dashboard 手動 or 権限付きトークンで API 再実行（下記 §5） |
| **P1** | `tasful.jp` DNS 未到達 | カスタムドメイン DNS 設定後に Access 検証（[`nb1d-custom-domain-auth-precheck.md`](nb1d-custom-domain-auth-precheck.md)） |
| **P1** | ブラウザ OTP 検証未実施 | Access 有効化後に A-BHV-03〜04 を人手で実施 · スクリーンショット保存 |
| **P2** | `www.tasful.jp` Access | apex と www の両方に Application、または Redirect 後 apex 保護 |

---

## 5. 再実施手順（運営者 · Dashboard 推奨）

Gate-B を **No-Go → Go** にする最短手順:

### 5.1 API トークン（自動化する場合）

1. [Create API Token](https://dash.cloudflare.com/profile/api-tokens) → Custom token
2. Permissions: **Account** · **Zero Trust** · **Edit**（+ 既存 Pages Edit を維持）
3. Account Resources: `Rubi.hiro0613@gmail.com's Account`
4. `.env` の `CLOUDFLARE_API_TOKEN` を更新

### 5.2 Dashboard 手動（計画書 §1 準拠）

1. **Zero Trust** → **Settings** → **Authentication** → **One-time PIN** を ON
2. **Access** → **Applications** → **Add application** → **Self-hosted**
3. **Application 1:** `TASFUL Production Private (tasful.jp)` · Domain `tasful.jp` · Path 空
4. **Application 2:** `TASFUL Production Private (pages.dev)` · Domain `tasufull-article.pages.dev`
5. 各 Application に Policy:
   - Name: `Allow rubi only`
   - Action: **Allow**
   - Include: **Emails** → `rubi.hiro0613@gmail.com`
6. シークレットウィンドウで A-BHV-01〜06 を再検証
7. スクリーンショットを `reports/screenshots/gate-b-access/` に保存
8. 本レポート §1〜§3 を更新し **Gate-B: Go** に変更

---

## 6. 次工程

| 順序 | ゲート | 内容 | 前提 |
|------|--------|------|------|
| **再実施** | **Gate-B** | Access 有効化 · 動作確認 | Zero Trust 権限付きトークン or Dashboard 手動 |
| 次 | **Gate-C** | robots.txt · `X-Robots-Tag` · feature flags 小 PR | **Gate-B Go 後** |
| その後 | **Gate-D** | 非公開本番テスト | Gate-C デプロイ後 |

---

## 7. 参照

| 文書 | 用途 |
|------|------|
| [`production-private-test-gate-a-result.md`](production-private-test-gate-a-result.md) | Gate-A Go（リポジトリ露出なし） |
| [`production-private-test-access-plan.md`](production-private-test-access-plan.md) | Access 詳細手順 |
| [Cloudflare Access for Pages](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) | 公式 |

---

**署名:** Gate-B 実施記録 — Access **未設定** · No-Go · コード/デプロイ/Supabase 変更なし
