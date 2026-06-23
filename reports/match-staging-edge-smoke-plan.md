# TASFUL MATCH — staging Edge smoke plan

| 項目 | 内容 |
|------|------|
| 版 | v1.0（計画のみ） |
| 作成日 | 2026-06-21 |
| ステータス | **未実行** — 本書は手順書。deploy / DB / RLS / Auth 本接続は行わない |
| 前提 | `match-api-fetch-draft-review.md`, `match-edge-jwt-stub-review.md`, `match-edge-function-stubs-review.md` |
| 判定入力 | `READY_FOR_MATCH_STAGING_EDGE_SMOKE_PLAN` |

---

## 0. 目的

`match-api.js` の **`edge_stub`** モードと、`supabase/functions/match-*` **7 件の Edge Function stub** を、staging 相当環境で **安全に疎通確認**する。

**確認の芯（10 項目）**

| # | 確認内容 |
|---|----------|
| 1 | `Authorization: Bearer` 必須 |
| 2 | `stub-match-token` で user-facing Function が通る |
| 3 | JWT 形式 token の `app_metadata.talk_user_id` を Edge stub が読める |
| 4 | `x-match-user-id` は debug 扱い · 本人判定に使わない |
| 5 | client payload の本人 `user_id` を信用しない |
| 6 | `super_like` → `phase_not_enabled` |
| 7 | admin review → admin claim **または** dev `x-match-admin` fallback のみ |
| 8 | DB query 未実行 |
| 9 | fetch / Edge 通信エラーが `match-api.js` で正規化される |
| 10 | CORS / OPTIONS が通る |

**JWT stub の限界（必読）**

- 現行 `match-auth.ts` は **署名検証なし**（`decodeJwtPayloadStub`）。
- staging smoke 用 dummy JWT は **stub フェーズのみ**有効。
- **本番**では Supabase JWKS / `auth.getUser()` による **署名検証必須**（`match-edge-jwt-design.md`）。

---

## 1. 前提条件

### 1.1 コード状態

| 項目 | 要求 |
|------|------|
| Edge JWT stub | `match-auth.ts` — `requireUser` / `requireAdmin` JWT claim 対応済み |
| Client fetch 草案 | `match-api.js` — `edge_stub` + `callEdgeFunction` 済み |
| デフォルト UI | `client_stub`（`match-review.html` は edge 切替しない） |
| ローカルテスト | `node scripts/test-match-edge-jwt-stub.mjs` PASS |
| ローカルテスト | `node scripts/test-match-api-fetch-draft.mjs` PASS |

### 1.2 環境（推奨順）

| 環境 | 用途 | 本番影響 |
|------|------|----------|
| **A. ローカル `supabase functions serve`** | **第一推奨** · 初回 smoke | **なし** |
| B. 専用 staging Supabase プロジェクト | チーム共有 smoke | 本番プロジェクトと **別 ref** 必須 |
| C. Cloudflare Pages dev (`127.0.0.1:8788`) | client `edge_stub` 手動確認 | **なし** |

**本計画の第一実行先:** **A（ローカル serve）**。B は infra 合意後に同一手順を URL 差し替えで実施。

### 1.3 影響分離

| 対象 | smoke 時 |
|------|----------|
| `tasful.jp` 本番 Pages | **触らない** |
| TALK / Builder / Marketplace Edge Functions | **デプロイしない** |
| Supabase DB / RLS | **接続・変更しない**（stub は DB なし） |
| 既存 TASFUL Auth | **本接続しない**（stub token のみ） |

---

## 2. デプロイ対象 Function

| # | Function | Guard | 備考 |
|---|----------|-------|------|
| 1 | `match-record-swipe` | `requireUser` | `super_like` 422 |
| 2 | `match-ensure-talk-room` | `requireUser` | |
| 3 | `match-submit-report` | `requireUser` | |
| 4 | `match-block-user` | `requireUser` | |
| 5 | `match-submit-verification` | `requireUser` | |
| 6 | `match-admin-review` | `requireAdmin` | |
| 7 | `match-moderation-log` | `requireUser` | |

共有: `supabase/functions/_shared/match-auth.ts`, `_shared/cors.ts`

**デプロイ単位:** `match-*` **7 件 + shared のみ**。他 Function は含めない。

---

## 3. deploy 前チェックリスト

実行担当者が deploy **前**に確認（本 PR では deploy しない）。

- [ ] `npx deno check supabase/functions/_shared/match-auth.ts supabase/functions/match-*/index.ts` — PASS
- [ ] `node scripts/test-match-edge-jwt-stub.mjs` — PASS
- [ ] `node scripts/test-match-api-fetch-draft.mjs` — PASS
- [ ] `rg "createClient|\\.from\\(" supabase/functions/match-*` — **0 件**
- [ ] `rg "createClient" match/match-api.js` — **0 件**
- [ ] デプロイ対象が `match-*` のみ（TALK/Builder 混在なし）
- [ ] smoke 実行者が **ローカル serve または staging 専用 ref** を使用することを確認
- [ ] `tasful.jp` 向け Pages / DNS 変更なし

---

## 4. 環境変数チェック

### 4.1 Edge Function（stub フェーズ）

| 変数 | 必須 | 用途 |
|------|------|------|
| （なし） | — | stub は DB / Supabase client 未使用 |

### 4.2 ローカル serve 時（Supabase CLI）

| 変数 / 設定 | 用途 |
|-------------|------|
| `supabase status` の API URL | smoke base URL 組み立て |
| anon key（ローカル） | 将来 verify 用 · **現 stub では curl に不要**（Bearer stub のみ） |

### 4.3 CORS（ブラウザ smoke 時）

| 変数 | 用途 |
|------|------|
| `TASU_CORS_ALLOWED_ORIGINS` | 追加 Origin（カンマ区切り）· 未設定時は localhost / 127.0.0.1 / `*.tasu*` 等は `cors.ts` 既定 |

**client `edge_stub`  from `http://127.0.0.1:8788`:** 既定 DEV_HOSTS で OPTIONS 可。remote staging  origin を使う場合のみ `TASU_CORS_ALLOWED_ORIGINS` を設定。

---

## 5. smoke URL の作り方

### 5.1 ローカル（推奨）

```text
{BASE} = http://127.0.0.1:54321/functions/v1
{FUNCTION_URL} = {BASE}/match-record-swipe   （例）
```

起動（実行フェーズで実施 · **本書作成時は実行しない**）:

```bash
supabase functions serve match-record-swipe match-ensure-talk-room \
  match-submit-report match-block-user match-submit-verification \
  match-admin-review match-moderation-log --no-verify-jwt
```

`--no-verify-jwt` は Supabase ゲートウェイ側 JWT 検証をスキップし、**Function 内 stub**（`decodeJwtPayloadStub`）をテストするため。本番 deploy では **verify 必須**に戻す。

### 5.2 リモート staging（任意）

```text
{BASE} = https://{PROJECT_REF}.supabase.co/functions/v1
```

- `PROJECT_REF` は **本番と別**の staging 専用プロジェクトを推奨。
- 共有 dev プロジェクト（`ddojquacsyqesrjhcvmn`）を使う場合は **MATCH stub のみ** deploy し、既存 TALK 関数に影響がないことを deploy 前に再確認。

### 5.3 match-api.js 用 base URL

```javascript
functionsBaseUrl: "http://127.0.0.1:54321/functions/v1"
// または staging: "https://{PROJECT_REF}.supabase.co/functions/v1"
```

末尾スラッシュなし推奨（`match-api.js` が正規化）。

---

## 6. curl コマンド例

### 6.1 共通変数

```bash
BASE="http://127.0.0.1:54321/functions/v1"
AUTH_STUB="Authorization: Bearer stub-match-token"
JSON="Content-Type: application/json"
```

### 6.2 JWT 形式 dummy token（署名なし · staging stub 専用）

```bash
# Linux / macOS / Git Bash
JWT_HEADER=$(printf '%s' '{"alg":"none","typ":"JWT"}' | openssl base64 -A | tr '+/' '-_' | tr -d '=')
JWT_BODY=$(printf '%s' '{"app_metadata":{"talk_user_id":"stub-user-current","role":"match_admin"}}' | openssl base64 -A | tr '+/' '-_' | tr -d '=')
JWT_DUMMY="${JWT_HEADER}.${JWT_BODY}.stub-signature"
AUTH_JWT="Authorization: Bearer ${JWT_DUMMY}"
```

PowerShell 例:

```powershell
$payload = '{"app_metadata":{"talk_user_id":"stub-user-current","role":"match_admin"}}'
$bytes = [Text.Encoding]::UTF8.GetBytes($payload)
$body = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$hdrBytes = [Text.Encoding]::UTF8.GetBytes('{"alg":"none","typ":"JWT"}')
$header = [Convert]::ToBase64String($hdrBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$JWT_DUMMY = "$header.$body.stub-signature"
```

> **本番注意:** 上記 dummy JWT は **stub の署名検証スキップ前提**。本番 Edge では無効化される。

---

### 6.3 `match-record-swipe`（成功 · stub-match-token）

```bash
curl -sS -X POST "${BASE}/match-record-swipe" \
  -H "${AUTH_STUB}" \
  -H "${JSON}" \
  -d '{"target_user_id":"stub-user-yui","action":"like"}'
```

### 6.4 `match-record-swipe`（super_like 異常系）

```bash
curl -sS -X POST "${BASE}/match-record-swipe" \
  -H "${AUTH_STUB}" \
  -H "${JSON}" \
  -d '{"target_user_id":"stub-user-yui","action":"super_like"}'
```

期待: HTTP **422**, `"code":"phase_not_enabled"`

### 6.5 `match-record-swipe`（JWT dummy · talk_user_id 読取）

```bash
curl -sS -X POST "${BASE}/match-record-swipe" \
  -H "${AUTH_JWT}" \
  -H "${JSON}" \
  -d '{"target_user_id":"stub-user-yui","action":"like"}'
```

### 6.6 未認証（401）

```bash
curl -sS -X POST "${BASE}/match-record-swipe" \
  -H "${JSON}" \
  -d '{"target_user_id":"stub-user-yui","action":"like"}'
```

期待: HTTP **401**, `"code":"unauthorized"`

---

### 6.7 残り 5 user-facing Function（stub-match-token）

**`match-ensure-talk-room`**

```bash
curl -sS -X POST "${BASE}/match-ensure-talk-room" \
  -H "${AUTH_STUB}" -H "${JSON}" \
  -d '{"pair_id":"stub-pair-yui"}'
```

**`match-submit-report`**

```bash
curl -sS -X POST "${BASE}/match-submit-report" \
  -H "${AUTH_STUB}" -H "${JSON}" \
  -d '{"reported_user_id":"stub-user-yui","reason":"harassment","detail":"テスト通報です"}'
```

**`match-block-user`**

```bash
curl -sS -X POST "${BASE}/match-block-user" \
  -H "${AUTH_STUB}" -H "${JSON}" \
  -d '{"blocked_user_id":"stub-user-yui","reason":"test"}'
```

**`match-submit-verification`**

```bash
curl -sS -X POST "${BASE}/match-submit-verification" \
  -H "${AUTH_STUB}" -H "${JSON}" \
  -d '{"verification_type":"phone","metadata":{}}'
```

**`match-moderation-log`**

```bash
curl -sS -X POST "${BASE}/match-moderation-log" \
  -H "${AUTH_STUB}" -H "${JSON}" \
  -d '{"source":"profile","target_user_id":"stub-user-yui","severity":"low","reason":"smoke test"}'
```

---

## 7. match-api.js edge_stub からの疎通確認案

**UI から自動切替しない。** 開発者コンソールまたは専用 smoke スクリプトのみ。

### 7.1 前提

- Cloudflare Pages dev: `http://127.0.0.1:8788/match/match-review.html`（または任意 MATCH ページ）
- ローカル Function serve が **54321** で起動済み

### 7.2 手動コンソール例

```javascript
// 1) edge_stub 有効化（ページリロード後も client_stub がデフォルトのまま）
TasfulMatchAPI.configure({
  mode: "edge_stub",
  functionsBaseUrl: "http://127.0.0.1:54321/functions/v1",
  debugHeaders: false,
  getAuthHeaders: () => ({ Authorization: "Bearer stub-match-token" }),
});

// 2) 疎通
const swipe = await TasfulMatchAPI.recordSwipe({
  target_user_id: "stub-user-yui",
  action: "like",
});
console.log(swipe); // ok: true, mode: "edge_stub", mode from Edge: stub

// 3) super_like — client 側で fetch 前に止まる
const superLike = await TasfulMatchAPI.recordSwipe({
  target_user_id: "stub-user-yui",
  action: "super_like",
});
console.log(superLike.code); // phase_not_enabled · fetch 0 回

// 4) 終了後は必ず戻す
TasfulMatchAPI.configure({ mode: "client_stub", functionsBaseUrl: "" });
```

### 7.3 エラー正規化確認

| 操作 | 期待 |
|------|------|
| `functionsBaseUrl: ""` | `{ ok:false, code:"config_error" }` · fetch なし |
| `getAuthHeaders: () => ({})` | `{ ok:false, code:"auth_required" }` |
| serve 停止中に recordSwipe | `{ ok:false, code:"network_error" }` |
| 意図的に `timeoutMs: 1` + 遅延 mock | `{ ok:false, code:"timeout" }` |

### 7.4 将来: 自動 smoke スクリプト（任意 · 未作成）

`scripts/test-match-staging-edge-smoke.mjs` — serve 起動検知 + curl 相当 fetch · 本計画の **実行フェーズ**で追加可。

---

## 8. 期待レスポンス一覧

| Function | HTTP | 成功 body 要点 |
|----------|------|----------------|
| `match-record-swipe` | 200 | `ok:true`, `mode:"stub"`, `swipe_recorded:true`, `matched:false` |
| `match-ensure-talk-room` | 200 | `room_id:"stub-room-id"`, `redirect_url` 含む |
| `match-submit-report` | 200 | `report_id:"stub-report-id"`, `status:"submitted"` |
| `match-block-user` | 200 | `blocked:true`, `pair_status:"blocked"` |
| `match-submit-verification` | 200 | `verification_id`, `status:"pending"` · metadata **返さない** |
| `match-admin-review` | 200 | `reviewed:true`, `target_type`, `action` |
| `match-moderation-log` | 200 | `log_id:"stub-log-id"`, `queued:true` |

共通失敗形: `{ "ok": false, "code": "...", "message": "..." }`

---

## 9. 異常系テスト

| # | ケース | 手順 | 期待 |
|---|--------|------|------|
| E1 | Bearer なし | Authorization ヘッダ省略 | 401 `unauthorized` |
| E2 | 空 Bearer | `Authorization: Bearer` | 401 |
| E3 | 不正 token | `Bearer not-a-jwt` | 401 `Invalid or unsupported token` |
| E4 | sub のみ JWT | payload `{ "sub": "uuid..." }` | 403 `JWT talk_user_id claim required` |
| E5 | super_like | payload §6.4 | 422 `phase_not_enabled` |
| E6 | 自分スワイプ | `target_user_id: "stub-user-current"` + stub token | 422 `Cannot swipe yourself` |
| E7 | 空 body | `{}` POST | 400 `invalid_json` |
| E8 | GET | `curl -X GET` | 405 `method_not_allowed` |
| E9 | 不正 enum | `reason: "invalid"` on report | 422 `validation_error` |
| E10 | payload 本人 ID 偽装 | body に `swiper_user_id: "other"` を追加して like | **Edge は無視** · stub token の `stub-user-current` で処理 · DB 書込なし |

### x-match-user-id（debug · 本人判定に使わない）

```bash
curl -sS -X POST "${BASE}/match-record-swipe" \
  -H "${AUTH_STUB}" \
  -H "x-match-user-id: fake-attacker-id" \
  -H "${JSON}" \
  -d '{"target_user_id":"stub-user-yui","action":"like"}'
```

期待: **200 成功**（JWT `stub-user-current` が正）— header は **信用しない**。  
自分スワイプは `target_user_id: stub-user-current` で検証（E6）。

---

## 10. admin テスト

### 10.1 JWT claim（match_admin）

```bash
curl -sS -X POST "${BASE}/match-admin-review" \
  -H "${AUTH_JWT}" \
  -H "${JSON}" \
  -d '{"target_type":"report","target_id":"stub-report-id","action":"dismiss","note":"smoke test"}'
```

期待: 200 · `adminMode: claims` は HTTP body に含まれないが内部 `requireAdmin` 通過

### 10.2 dev fallback（x-match-admin）

```bash
curl -sS -X POST "${BASE}/match-admin-review" \
  -H "${AUTH_STUB}" \
  -H "x-match-admin: true" \
  -H "${JSON}" \
  -d '{"target_type":"report","target_id":"stub-report-id","action":"dismiss","note":"smoke test"}'
```

期待: 200 · **本番廃止 TODO**（`match-edge-jwt-stub-review.md` §7）

### 10.3 admin 拒否

```bash
curl -sS -X POST "${BASE}/match-admin-review" \
  -H "${AUTH_STUB}" \
  -H "${JSON}" \
  -d '{"target_type":"report","target_id":"stub-report-id","action":"dismiss","note":"smoke test"}'
```

期待: 403 `forbidden`

---

## 11. CORS / OPTIONS テスト

### 11.1 OPTIONS preflight

```bash
curl -sS -D - -o /dev/null -X OPTIONS "${BASE}/match-record-swipe" \
  -H "Origin: http://127.0.0.1:8788" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type"
```

期待:

- HTTP **204** または **200**
- `Access-Control-Allow-Origin: http://127.0.0.1:8788`（または `*`）
- `Access-Control-Allow-Methods` に POST
- `Access-Control-Allow-Headers` に `authorization`

### 11.2 ブラウザ fetch（edge_stub）

`127.0.0.1:8788` から `127.0.0.1:54321` への cross-origin POST。§7.2 実行時、DevTools Network で OPTIONS → POST の順序を確認。

---

## 12. DB 未接続確認方法

| 方法 | 手順 | 期待 |
|------|------|------|
| 静的 | deploy 前 `rg "createClient|\\.from\\(" supabase/functions/match-*` | 0 件 |
| 実行時ログ | `supabase functions serve` コンソール | postgres / REST エラー **なし** |
| Dashboard | Supabase → Logs → Edge Functions | SQL / PostgREST 呼び出し **なし** |
| レスポンス | 成功 body | 固定 stub ID のみ · DB 由来 UUID なし |
| client | `match-api.js` | `createClient` なし |

stub が DB に触れた場合は **smoke 失敗**として deploy を止める。

---

## 13. ロールバック方針

| 層 | 手順 |
|----|------|
| Edge deploy | staging の `match-*` 7 件のみ undeploy / 前バージョン revert |
| 共有 lib | `match-auth.ts` 変更を revert する場合は **7 件セット**で revert |
| client | デフォルトは `client_stub` のため **ロールバック不要** · 手動 `edge_stub` は `configure({ mode:"client_stub" })` |
| DB / RLS | **変更なし** — ロールバック対象外 |
| 本番 Pages | MATCH HTML/JS は smoke 実行で変更しない前提 |

---

## 14. 実行してよいタイミング

以下 **すべて** を満たした後（**実行フェーズ** · 本書作成時点では未実施）:

1. §3 deploy 前チェックリスト PASS
2. 実行環境が **ローカル serve** または **staging 専用 Supabase ref**
3. `tasful.jp` 本番 Pages に `edge_stub` 設定を入れていない
4. RLS migration **未適用**
5. Auth Custom Access Token Hook **未適用**（stub token で足りる）
6. 担当者が curl 結果を `reports/` に証跡保存する合意

**推奨順序**

```text
ローカル serve + curl 全件 PASS
  → （任意）client コンソール edge_stub PASS
  → （任意）staging ref deploy + 同一 curl 再実行
  → 証跡レポート match-staging-edge-smoke-result.md（将来）
```

---

## 15. 実行禁止事項

| 禁止 | 理由 |
|------|------|
| `tasful.jp` で UI / HTML を `edge_stub` 固定 | 本番ユーザー影響 |
| RLS / SQL migration 適用 | DB 変更 · 本 smoke スコープ外 |
| Supabase Auth Hook 本番有効化 | Auth 本接続 |
| client に service_role / anon 以外の secret | セキュリティ |
| TALK / Builder / Marketplace Function deploy | 影響分離 |
| payload `user_id` を Edge 正とする実装 | 設計違反 |
| dummy JWT を本番 verify 無効のまま放置 | セキュリティ |
| `x-match-admin` を本番 admin 正とする | なりすまし |
| smoke 成功をもって RLS 適用 GO と判断 | claim / Hook ゲート未達 |

---

## 16. 次ステップ

| 順 | 作業 | 成果物 |
|----|------|--------|
| 1 | **smoke 実行**（本計画に従う） | `match-staging-edge-smoke-result.md`（証跡） |
| 2 | TASFUL Auth — JWT `app_metadata.talk_user_id` backfill + Hook 設計 | Auth STEP 2 |
| 3 | Edge `verifyJwt` 本実装 | `match-auth.ts` 本番版 |
| 4 | D2 migration 適用 + RLS enable | 別 migration |
| 5 | `edge_stub` → 本番 `edge` モード（staging のみ） | `match-api.js` |

---

## 17. smoke 実行記録テンプレート（将来用）

| Function | Token | HTTP | code | PASS |
|----------|-------|------|------|------|
| match-record-swipe | stub | | | |
| match-record-swipe | JWT dummy | | | |
| match-admin-review | JWT admin | | | |
| OPTIONS | — | | | |

---

## 判定

### **READY_FOR_STAGING_EDGE_SMOKE_EXECUTION**

**理由**

- 7 Function · token 2 種 · payload · 異常系 · admin · CORS · DB 未接続確認を手順化
- 第一実行先を **ローカル serve** に固定し、本番 / TALK / Builder への影響を排除
- `match-api.js` edge_stub 手動確認手順を UI 切替なしで定義
- dummy JWT は **staging stub 専用** · 本番署名検証必須を明記

**NEEDS_DECISION となる条件（実行前に確認）**

- リモート staging で **本番と同一** `PROJECT_REF` を使う場合 → **別 ref 推奨**の product/infra 決定
- 共有 dev プロジェクトへ deploy するかどうか（ローカル serve のみなら **決定不要**）

---

## 参照

| ファイル | 用途 |
|----------|------|
| `supabase/functions/_shared/match-auth.ts` | JWT stub guards |
| `match/match-api.js` | edge_stub client |
| `reports/match-edge-function-stubs-review.md` | 各 Function I/O |
| `reports/match-edge-jwt-design.md` | 本番 JWT 方針 |
