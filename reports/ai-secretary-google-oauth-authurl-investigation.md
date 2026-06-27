# AI 秘書 Google OAuth — authUrl `response_type` 欠落調査

**実施日:** 2026-06-28  
**種別:** 調査のみ（**修正なし**）  
**症状:** 通常 Chrome で Google consent 到達時  
`Required parameter is missing: response_type`（400 · invalid_request）

**Secret / Token / UUID 値は記載しない**

---

## 結論

| 項目 | 判定 |
| --- | --- |
| **Edge connect API の authUrl 生成** | ✅ **正常**（`response_type=code` 含む全必須パラメータあり） |
| **open-external スクリプトの authUrl 加工** | ❌ **加工なし** · ただし **Windows 起動経路で URL が切り詰められる可能性大** |
| **Google 400 の直接原因（推定）** | ブラウザに渡った URL が **最初の `&` 以降欠落** → `client_id` のみ到達 → `response_type` 欠落 |

**OAuth 設定（client_id / redirect_uri / scope 定義）自体の不備ではない。**  
**live connect API が返す authUrl は仕様どおり。**

---

## 1. authUrl 生成箇所

| レイヤ | ファイル | 関数 / 処理 |
| --- | --- | --- |
| Edge handler | `supabase/functions/secretary-google-oauth/index.ts` | `handleConnect()` → `buildGoogleAuthUrl(...)` |
| 共有モジュール | `supabase/functions/_shared/secretary-google-oauth.ts` | `buildGoogleAuthUrl()` |

```110:131:supabase/functions/_shared/secretary-google-oauth.ts
export function buildGoogleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: string;
  prompt?: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scopes || DEFAULT_GOOGLE_OAUTH_SCOPES,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: input.prompt || "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}
```

`handleConnect` は live 時 `mock:false` · `configured:true` と共にこの URL を JSON `authUrl` で返す。

---

## 2. live connect API authUrl パラメータ監査

**方法:** `action=connect` を service 経由で POST · 返却 `authUrl` を `URLSearchParams` で解析（**値は stdout に出さない**）

| パラメータ | API 返却 authUrl に存在 |
| --- | --- |
| `response_type` | ✅（値: `code`） |
| `client_id` | ✅ |
| `redirect_uri` | ✅（callback action 含む） |
| `scope` | ✅ |
| `state` | ✅ |
| `access_type` | ✅（`offline`） |
| `prompt` | ✅（`consent`） |
| `code_challenge` | ✅ |
| `code_challenge_method` | ✅（`S256`） |

- **ホスト:** `accounts.google.com`
- **パス:** `/o/oauth2/v2/auth`
- **クエリキー数:** 10

→ **Edge 側生成は Google OAuth 2.0 Authorization Code + PKCE として完全。**

---

## 3. open-external スクリプトの authUrl 取り扱い

**ファイル:** `scripts/secretary-google-oauth-live-open-external.mjs`

| 処理 | 有無 |
| --- | --- |
| connect API から `d.authUrl` 取得 | そのまま |
| decode / encode / 再構築 | **なし** |
| クエリパラメータの追加・削除 | **なし** |
| Playwright で Google 遷移 | probe 時のみ（通常フローは `openInDefaultBrowser`） |

```57:67:scripts/secretary-google-oauth-live-open-external.mjs
async function openInDefaultBrowser(url) {
  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url], { cwd: ROOT, windowsHide: true });
    return;
  }
  // ...
}
```

**問題点（推定）:** Windows で `cmd /c start "" <authUrl>` に **クエリ付き URL（内部に `&` 多数）** を渡すと、`cmd.exe` が **`&` をコマンド区切り** として解釈し、**最初の `&` 以降が落ちる** 典型パターンと一致。

### 切り詰めシミュレーション

authUrl を **最初の `&` で打ち切った場合:**

| 項目 | 結果 |
| --- | --- |
| 残るクエリキー | **1 のみ**（`client_id`） |
| `response_type` | **欠落** |
| Google エラー | **`Required parameter is missing: response_type`** と一致 |

→ **API が返す URL は正しいが、Chrome に届く URL が壊れている** 説明と整合。

### 補足

- Dashboard bootstrap URL（`?secretary_auth_uid=`）はパラメータ 1 個のため **`&` 切り詰めの影響を受けにくい**
- Google consent URL は **`client_id=...&redirect_uri=...&response_type=code&...`** 形式のため **影響大**
- ブラウザ内 `location.assign(authUrl)`（connect UI）では **切り詰め起きない** · external スクリプト経路のみ

---

## 4. 影響範囲

| 経路 | authUrl 完全性 |
| --- | --- |
| Edge `buildGoogleAuthUrl` | ✅ |
| connect UI `location.assign` | ✅（推定） |
| `secretary-google-oauth-live-open-external.mjs` → Windows `start` | ~~❌ **欠落リスク**~~ → ✅ **PowerShell Start-Process（§7）** |

---

## 5. 修正方針（参考）

~~ユーザー指示により **今回は未修正**。参考:~~

**→ §7 で実施済み（PowerShell `Start-Process`）**

---

## 6. OAuth 設定変更の要否

| 項目 | 変更要否 |
| --- | --- |
| GCP Redirect URI | **不要**（API authUrl に callback 含む） |
| GCP Test users | **不要**（本件は consent 前の 400） |
| Supabase Secrets | **不要** |
| Edge `buildGoogleAuthUrl` | **不要**（生成は正常） |

---

## 参照

- `reports/ai-secretary-google-oauth-live-e2e.md`

---

## 7. 修正実施（2026-06-28）

### 変更内容

**ファイル:** `scripts/secretary-google-oauth-live-open-external.mjs`

| 項目 | Before | After |
| --- | --- | --- |
| Windows 起動 | `cmd /c start "" <url>` | `powershell.exe -Command Start-Process -FilePath <url>` |
| URL 保護 | `&` が cmd 解釈され切り詰め | `JSON.stringify(url)` で PowerShell に安全渡し |
| macOS / Linux | `open` / `xdg-open` | **変更なし** |
| Playwright Google 遷移 | probe あり | **削除**（fetch ベース probe に置換） |

```javascript
await execFileAsync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Start-Process -FilePath ${JSON.stringify(url)}`,
  ],
  { cwd: ROOT, windowsHide: true }
);
```

Edge · OAuth 設定 · authUrl 生成ロジックは **未変更**。

### 検証（修正後）

**コマンド:** `node --env-file=.env scripts/secretary-google-oauth-live-open-external.mjs`

| チェック | 結果 |
| --- | --- |
| connect API | **200** · mock:false · configured:true |
| authUrl `response_type` 存在 | ✅ |
| authUrl `redirect_uri` 存在 | ✅ |
| authUrl `scope` 存在 | ✅ |
| authUrl `state` 存在 | ✅ |
| authUrl `code_challenge` 存在 | ✅ |
| authUrl クエリキー数 | **10** |
| Google `missing response_type` エラー（fetch probe） | **false** |
| Google `invalid_request` 400 ページ（fetch probe） | **false** |
| `google_url_probe_pass` | **true** |
| 通常 Chrome 起動 | ✅（Dashboard + Google consent URL） |
| Playwright consent 操作 | **未使用** |
| Token Vault | **0 rows**（consent **未完了**） |

→ **URL 切り詰め問題は修正済み。**  
→ **Live E2E 全体 PASS 扱いは consent + post-consent 検証後。**

### 人間確認停止点

通常 Chrome の **Google consent タブ**でアカウント選択・権限許可を完了してください。  
完了後:

```powershell
node --env-file=.env scripts/verify-secretary-google-oauth-live-post-consent.mjs
```

---

## 8. Post-consent 結果（2026-06-28 · consent 完了後）

| 領域 | 判定 |
| --- | --- |
| OAuth · Vault · Dashboard | ✅ **PASS** |
| Gmail labels.list / Calendar calendarList.list | ❌ **502** |

**502 原因:** OAuth 自体は成功 · Token Vault 保存済み。Gmail / Calendar **Google Cloud API が GCP プロジェクトで未有効化**（OAuth client プロジェクト側の設定）。

**次アクション:** GCP Console → API とサービス → **Gmail API** · **Google Calendar API** を有効化 → post-consent スクリプト再実行。

### 再検証（API 有効化後 · 2026-06-28）

| Probe | 判定 |
| --- | --- |
| Gmail labels.list | ✅ **PASS** |
| Gmail profile | ✅ **PASS** |
| Calendar calendarList.list | ✅ **PASS** |
| overall | ✅ **PASS** |

**Full Live E2E:** ✅ **Go**
