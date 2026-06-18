# NB-3 STEP 2: Auth helper / getCurrentUser 実装レポート

**作成日:** 2026-06-18  
**前提:** [`auth-jwt-design-final.md`](auth-jwt-design-final.md)（P1-A2 READY）  
**種別:** Auth helper 追加 + 最小接続 + 検証（Builder / Connect / 市場 checkout / RLS / DB / Stripe / UI 本体 **未変更**）

---

# 実装内容

TASFUL 全体で使う共通認証レイヤー `TasuAuthCurrentUser` を追加した。

| 関数 | 役割 |
|------|------|
| `getCurrentUser()` | JWT 優先 → demo 時のみ LS/URL/config fallback |
| `requireCurrentUser()` | 未ログイン時 `AUTH_REQUIRED` エラー（任意で login リダイレクト） |
| `getCurrentUserClaims()` | `app_metadata` から claim 正規化 |
| `isOpsUser()` | **`is_ops === true` OR `role === 'tasu_admin'`**（JWT のみ） |
| `isOpsPreviewActive()` | demo 時のみ URL/LS preview 昇格（STEP 3 まで UI 互換） |
| `isDemoMode()` | localhost / 127.0.0.1 / file:// / `?talkDev=1` / bench / preview |
| `isProductionHost()` | `tasful.jp` / `www.tasful.jp` / `talkProductionMode=true` |
| `canUseLocalStorageFallback()` | 本番 host では **常に false** |

**最小接続（既存フロー維持）:**

1. `talk-runtime.js` — 本番 host で `tasu_member_session` を current user として信用しない
2. `chat-user-identity.js` — helper 経由で userId 解決 · 本番 host で `u_me` fallback **禁止**
3. `talk-home.html` / `dashboard.html` / `payment-settings.html` / `talk-calendar.html` — `<script src="auth-current-user.js">` 追加（**表示変更なし**）

---

# 追加/変更ファイル

| ファイル | 種別 |
|----------|------|
| **`auth-current-user.js`** | **新規** — ブラウザ共通 helper（`window.TasuAuthCurrentUser`） |
| **`scripts/lib/auth-current-user-core.mjs`** | **新規** — Node 単体テスト用コア判定 |
| **`scripts/test-auth-current-user.mjs`** | **新規** — STEP 2 検証スクリプト |
| `talk-runtime.js` | 変更 — 本番 LS member_session fallback 禁止 |
| `chat-user-identity.js` | 変更 — helper 連携 + 本番 `u_me` 禁止 |
| `talk-home.html` | 変更 — script 1 行追加 |
| `dashboard.html` | 変更 — script 1 行追加 |
| `payment-settings.html` | 変更 — script 1 行追加 |
| `talk-calendar.html` | 変更 — script 1 行追加 |

**触っていない:** Builder 本体 · Connect 本体 · 市場 checkout · RLS SQL · DB · Stripe · CSS/HTML レイアウト

---

# getCurrentUser の返却仕様

```javascript
{
  authenticated: boolean,   // JWT または demo fallback で talkUserId がある
  sub: string,              // auth.users.id
  talkUserId: string,       // 業務 ID（canonical）
  memberId: string,         // 安否用（= talkUserId 想定）
  email: string,
  role: string,             // 例: authenticated | tasu_admin
  platformRole: string,     // member | partner | vendor
  partnerId: string | null,
  ownerId: string | null,
  isOps: boolean,           // JWT claim 由来
  source: "jwt" | "demo_fallback" | "none",
  claims: {                 // getCurrentUserClaims() と同内容
    sub, talk_user_id, member_id, email, role,
    platform_role, partner_id, owner_id, is_ops
  }
}
```

**解決優先順:**

1. Supabase JWT `app_metadata.talk_user_id`（→ `member_id` → `sub`）
2. demo かつ `canUseLocalStorageFallback()` — `?userId=` → `tasu_member_session` → config `u_me`
3. それ以外 — `talkUserId: ""` · `source: "none"`

---

# production host で禁止した fallback

| 禁止対象 | 本番 host 挙動 |
|----------|----------------|
| `localStorage` userId（`tasu_member_session` 等） | `getCurrentUser()` / `getAuthTalkUserIdSync()` 無視 |
| `localStorage` role | 未参照（ops は JWT のみ） |
| config `u_me` / `currentUserId` | `getEffectiveUserId()` → `""` |
| `?userId=` URL 上書き | 警告ログ · 無視 |
| `?talkAdmin=1` | `isOpsUser()` false · `isOpsPreviewActive()` false |
| `tasu_talk_admin_preview` LS | ops 昇格不可 |
| builder MVP role LS | **未接続**（STEP 6 まで現状維持） |

**production host 判定:**

- `hostname === "tasful.jp"` または `"www.tasful.jp"`
- または `TASU_CHAT_SUPABASE_CONFIG.talkProductionMode === true`

---

# demo/bench/preview 互換条件

| 条件 | `canUseLocalStorageFallback()` |
|------|-------------------------------|
| `localhost` / `127.0.0.1` | ✅ |
| `file://` | ✅ |
| `?talkDev=1` | ✅ |
| `config.talkDevMode === true` | ✅ |
| `?benchEmbed=1` / `?demo=1` / `?preview=1` | ✅ |
| `sessionStorage.tasu_ops_bench_mode === "1"` | ✅ |
| `tasful.jp` | ❌ |

**preview:** demo コンテキスト内のみ `isOpsPreviewActive()` が URL/LS admin を許可（**権限源ではない** · STEP 3 で guard 接続予定）

---

# 既存画面への影響

| 領域 | 影響 |
|------|------|
| **localhost / ?talkDev=1** | **変更なし** — `u_me` · URL userId · デモ seed 動作維持 |
| **talk-home / dashboard** | helper 読込のみ · 表示・操作同一 |
| **chat-detail（helper 未読込ページ）** | `chat-user-identity` 内 fallback で localhost 互換 · 本番 host 名のみ `u_me` 禁止 |
| **Builder / Connect / 市場** | **未接続** — 既存 LS ロジックそのまま |
| **ops 画面** | JWT ops 判定 helper 追加 · **ガード未接続**（STEP 3） |

---

# 検証結果

### 実行コマンド

```bash
node scripts/test-auth-current-user.mjs
node scripts/test-chat-detail-header-align-390.mjs
```

### `test-auth-current-user.mjs`

| ケース | 結果 |
|--------|------|
| core: localhost demo | ✅ PASS |
| core: localhost `?talkDev=1` | ✅ PASS |
| core: production host LS fallback 拒否 | ✅ PASS |
| browser: localhost demo `u_me` | ✅ PASS |
| browser: production mode LS 拒否 | ✅ PASS |
| browser: JWT ops 判定 | ✅ PASS |
| browser: production で talkAdmin 無効 | ✅ PASS |
| browser: `chat-user-identity` demo 互換 | ✅ PASS |
| browser: production で `u_me` 禁止 | ✅ PASS |
| talk-home smoke | ✅ PASS |

### `test-chat-detail-header-align-390.mjs`

| ケース | 結果 |
|--------|------|
| 390px 通常 / AI Sheet / PC ヘッダー | ✅ **All passed** |

### 未実行

| コマンド | 理由 |
|----------|------|
| `npm run verify` | 市場 shop-store キャプチャ · STEP 2 スコープ外 |
| 全 E2E regression | 時間コスト大 · chat-detail + auth helper で代表確認済 |

---

# STEP 2 判定

## **PASS**

| PASS 条件 | 状態 |
|-----------|------|
| 共通 Auth helper 追加 | ✅ `auth-current-user.js` |
| 本番 host で LS fallback 禁止 | ✅ |
| localhost/demo 互換維持 | ✅ 検証済 |
| 既存 UI/デモを壊していない | ✅ chat-detail E2E PASS |
| STEP 3 ops/admin guard に進める | ✅ `isOpsUser()` / `isProductionHost()` 準備完了 |

**次ステップ:** NB-3 STEP 3 — admin-* / ops 画面への JWT guard 接続（`isOpsUser()` 使用 · `?talkAdmin=1` 本番無効化の画面側 enforce）

---

**参照:** [`auth-jwt-design-final.md`](auth-jwt-design-final.md) · [`auth-jwt-migration-audit.md`](auth-jwt-migration-audit.md)
