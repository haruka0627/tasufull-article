# TASFUL MATCH — 認証境界設計レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0（設計レビューのみ） |
| 作成日 | 2026-06-21 |
| ステータス | 未実装・未接続 |
| 前提 | `match-db-api-design-review.md` ほか MATCH 設計・スタブ一式 |
| 本書の範囲 | 認証境界の整理。**コード / SQL / Supabase 接続 / UI 変更は行わない** |

---

## 0. 目的

`stub-user-current` を将来の Supabase Auth / 既存 TASFUL Auth に置き換える前に、**「誰が MATCH の user_id か」**と **client / Edge / RLS の責務**を固定する。既存 TALK・Builder・Marketplace の認証を壊さないことを最優先とする。

---

## 1. 現状整理

### 1.1 既存 TASFUL Auth 構成

| コンポーネント | 役割 | 会員 ID の正 |
|----------------|------|-------------|
| `chat-supabase-config.js` | `TASU_CHAT_SUPABASE_CONFIG`（url, anonKey, **demo `currentUserId: "u_me"`**） | 開発 fallback のみ |
| `auth-current-user.js` | `window.TasuAuthCurrentUser` — JWT 解決・本番 fallback 禁止 | **`talkUserId`**（JWT `app_metadata.talk_user_id` → `member_id` → `sub`） |
| `talk-runtime.js` | `getAuthTalkUserIdSync()` — TALK 同期 ID 解決 | 同上（`talk_user_id` 優先） |
| `chat-user-identity.js` | 開発時 `?userId=` 上書き（**本番無効**） | `TasuTalkRuntime` / config fallback |

**本番方針（既存・変更禁止）**

- `TasuAuthCurrentUser.isProductionHost()` では LS / URL / `u_me` fallback **禁止**
- JWT `app_metadata.talk_user_id`（または `member_id`）が TALK の `buyer_id` / `seller_id` と同じ **text ID 空間**（例: `u_me`, `u_hiro`）
- Supabase session は `localStorage` の `tasu-supabase-auth` / `sb-{ref}-auth-token` から読む

**TALK / Dashboard / Marketplace での user_id**

| 領域 | 取得方法 | 格納先例 |
|------|----------|----------|
| TALK チャット | `TasuTalkRuntime.getAuthTalkUserIdSync()` / `TasuAuthCurrentUser.getCurrentUser().talkUserId` | `transaction_rooms.buyer_id`, `seller_id`（**text**） |
| Builder | `auth-current-user.js` 読み込み（`builder/*.html`） | プロジェクト・見積の owner 系 |
| Marketplace | 主に TALK / 会員セッション経由 | 取引チャットと同じ会員 ID |
| Dashboard | `dashboard-mobile-home.js` 等 | リンクのみ（MATCH 未接続） |

### 1.2 MATCH 側の現在構成

| レイヤ | ファイル | 認証の扱い |
|--------|----------|------------|
| データスタブ | `match/match-data-stub.js` | `currentUser.user_id = "stub-user-current"`（**Auth 未接続**） |
| 描画 | `match/match-data-render.js` | スタブの `getCurrentUser()` を表示のみ |
| API client | `match/match-api.js` | `mode: "client_stub"` — **token 未使用・fetch なし** |
| UI wiring | `match/match-wiring.js` | `TasfulMatchAPI` 呼び出し。user_id は **表示データ**から取得 |
| Edge stub | `supabase/functions/_shared/match-auth.ts` | `requireUser`: Bearer 非空のみ mock → `stub-user-id` |

**スキーマ / RLS 草案（未適用）**

- 全 `match_*` テーブルの `user_id` は **text**（TALK と同じ方針）
- `match_current_user_id()` = `nullif(auth.uid()::text, '')`（`20260621130000_match_rls_draft.sql`）
- Edge 設計書は `auth.uid()?.toString()` を userId と記載

### 1.3 `stub-user-current` の使用箇所

| 場所 | 用途 |
|------|------|
| `match-data-stub.js` | `currentUser.user_id`、全 `pairs[].user_low_id`、`verifications[].user_id` |
| `match-data-render.js` | 本人確認画面のサブタイトル |
| `match-review.html` | 開発表示「Current user: stub-user-current」 |
| `match-wiring.js` / `match-api.js` | **直接参照なし**（表示中プロフィール / pair_id 経由） |

将来は **`TasfulMatchAuth.getMatchUserId()`** 1 箇所に集約し、データ層はその ID を参照する。

---

## 2. 認証 ID の対応方針（最重要）

### 2.1 問題: `auth.uid()` と `talk_user_id` のズレ

| ソース | 典型値 | 利用箇所 |
|--------|--------|----------|
| `auth.uid()::text` | Supabase UUID | RLS 草案 `match_current_user_id()` |
| `talk_user_id` / `TasuAuthCurrentUser.talkUserId` | `u_me`, `u_hiro` 等 | TALK `transaction_rooms`、既存 JS 全体 |

**このまま RLS を適用すると、`match_profiles.user_id = 'u_me'` の行に `auth.uid()::text` では一致せず、本人ポリシーが機能しない。**

### 2.2 推奨: MATCH の正は `talk_user_id`（TASFUL 会員 text ID）

| 項目 | 推奨 |
|------|------|
| **MATCH `user_id` 列** | `TasuAuthCurrentUser.getCurrentUser().talkUserId` と **同一文字列** |
| **RLS `match_current_user_id()`** | **適用前に修正** — JWT custom claim から `talk_user_id` を返す SQL 関数に変更 |
| **Edge Function** | JWT 検証後、**claims の `talk_user_id`** を userId とする |
| **開発スタブ** | `stub-user-current` → ローカルでは `u_me` マップを **TasfulMatchAuth スタブ内**に閉じる |

**非推奨**: MATCH だけ UUID に統一し TALK 接続時にマッピングテーブルを挟む（`transaction_rooms` 改修範囲が広い）。

### 2.3 `auth.uid()::text` 方針との整合

| レイヤ | 方針 |
|--------|------|
| PostgreSQL RLS | `match_current_user_id()` = **会員 text ID**（JWT claim 由来） |
| Edge | 同上を JWT 検証後に抽出 |
| Client | `TasfulMatchAuth.getMatchUserId()` が唯一の入口 |

---

## 3. 認証境界の推奨構成

```
┌─────────────────────────────────────────────────────────────┐
│ 既存（変更しない）                                            │
│  TasuAuthCurrentUser / TasuTalkRuntime / chat-supabase-config │
└───────────────────────────┬─────────────────────────────────┘
                            │ talkUserId, access_token
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  window.TasfulMatchAuth  （新規・MATCH 専用境界）              │
│  - getMatchUserId() / getAccessToken() / isAuthenticated()   │
│  - getMatchProfileState() / canSwipe() / canLike()           │
└───────────────┬─────────────────────────┬───────────────────┘
                ▼                         ▼
┌───────────────────────┐   ┌─────────────────────────────────┐
│ TasfulMatchData*      │   │ TasfulMatchAPI + tokenProvider   │
└───────────────────────┘   └───────────────┬─────────────────┘
                                            │ Bearer JWT
                                            ▼
                            ┌─────────────────────────────────┐
                            │ Edge match-* / RLS                 │
                            └─────────────────────────────────┘
```

---

## 4. `window.TasfulMatchAuth` 案

### 4.1 配置

| 項目 | 案 |
|------|-----|
| ファイル | `match/match-auth.js`（**新規・MATCH 配下のみ**） |
| 依存 | `../auth-current-user.js` をオプション読み込み |
| グローバル | `window.TasfulMatchAuth` |

### 4.2 公開 API

| メソッド | 役割 |
|----------|------|
| `getMatchUserId()` | MATCH / TALK 共通 text ID。未認証は `null` |
| `getAccessToken()` | Supabase JWT。未認証は `null` |
| `isAuthenticated()` | JWT 有効 + talkUserId 有り |
| `getMatchProfileState()` | `none` \| `draft` \| `active` \| `suspended` |
| `getVerificationState()` | `unverified` \| `pending` \| `verified` |
| `getSanctionState()` | `none` \| `restricted` \| `banned` |
| `canBrowsePublic()` / `canSwipe()` / `canLike()` / `canOpenTalk()` | UX guard |
| `requireAuth({ redirect })` | 未認証時ログイン誘導 |

### 4.3 スタブフェーズ

| メソッド | スタブ |
|----------|--------|
| `getMatchUserId()` | `TasfulMatchDataStub.getCurrentUser().user_id` または `"stub-user-current"` |
| `getAccessToken()` | `null`（client_stub 維持） |
| 本番 host | **`TasuAuthCurrentUser` に委譲**（fallback 禁止を継承） |

---

## 5. `match-api.js` への token provider 差し込み案

```javascript
TasfulMatchAPI.configure({
  mode: "edge", // "client_stub" | "edge"
  baseUrl: "/functions/v1",
  getAuthHeaders: async () => {
    const token = window.TasfulMatchAuth?.getAccessToken?.();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  },
});
```

**本番**: anon key のみで user-facing Function を叩かない。token 無しは `AUTH_REQUIRED` で wiring が toast + リダイレクト。

---

## 6. 状態分岐表

| 状態 | UI（MATCH） | Client guard | Edge / RLS |
|------|-------------|--------------|------------|
| **未ログイン** | TOP / ログイン CTA | `requireAuth` | 401 / 公開ビュー 0 件 |
| **ログイン済・プロフィール未作成** | `match-profile-create.html` | `canSwipe` = false | 403 `PROFILE_REQUIRED` |
| **プロフィール draft** | 作成ウィザード | 探索不可 | 本人 CRUD のみ |
| **active・本人確認未完了** | スワイプ閲覧可、いいね制限推奨 | `canLike` = false 可 | Edge verified ゲート |
| **verification pending** | 審査中表示 | いいね不可推奨 | status 自己昇格不可 |
| **active + verified** | 通常利用 | 全 guard true | 通常フロー |
| **BAN / sanction** | 安心・お問い合わせ | 全操作 false | 403 `MATCH_USER_BANNED` |
| **ブロック関係** | 相手非表示 | 対象操作不可 | 403 / 候補除外 |
| **pair 非参加者** | — | `ensureTalkRoom` 不可 | 403 |

### 6.1 本人確認未完了でも使える範囲（推奨）

| 機能 | Phase 1 推奨 |
|------|--------------|
| プロフィール作成・編集 | ○ |
| 本人確認申請 | ○ |
| スワイプ skip（閲覧） | ○（**ログイン必須**） |
| いいね / マッチ成立 | △ **verified 必須を推奨** |
| 通報・ブロック | ○（active profile） |

### 6.2 プロフィール公開条件

`match_profiles_public` 草案: `profile_status = active`、BAN なし、認証済み、ブロックなし、写真 approved、自分以外。

---

## 7. Edge `requireUser` と client guard の責務分離

| 責務 | Client | Edge |
|------|--------|------|
| JWT 付与 | `getAccessToken` | `auth.getUser(jwt)` |
| user_id | `getMatchUserId()`（UX） | **claims `talk_user_id`（正）** |
| BAN / block / 上限 | ボタン無効化 | **403 最終判定** |
| マッチ / TALK room | 演出・redirect 表示 | `match_pairs` / `transaction_rooms` mutation |

**Client 禁止**: service_role、`match_pairs` 直 INSERT、`verification_status` 自己昇格。

---

## 8. RLS 整合性

| 項目 | 適用前の修正 |
|------|--------------|
| `match_current_user_id()` | `auth.uid()::text` 単独 → **JWT `talk_user_id` claim** |
| policy | `user_id = match_current_user_id()` で TALK と同じ text 空間 |

---

## 9. TALK 接続時の user_id 整合性

| 項目 | 方針 |
|------|------|
| `match_pairs` | `user_low_id` / `user_high_id` = `talk_user_id` |
| `transaction_rooms` | `buyer_id` / `seller_id` = 同上、`listing_type = 'match'` |
| 既存 `chat-supabase.js` | **変更しない** |

---

## 10. 導入順（既存を壊さない）

1. `TasfulMatchAuth` スタブ（`match/match-auth.js`）
2. data stub の currentUser を Auth 境界経由に
3. `match-api.configure` スタブ
4. Edge JWT 本実装（`match-auth.ts`）
5. `match_current_user_id()` 修正 + RLS 適用
6. data stub → Edge fetch
7. TALK room 本番接続

---

## 11. 触ってはいけない既存箇所

- `auth-current-user.js` 本番 fallback ロジック
- `chat-supabase-config.js` / `talk-runtime.js` 本番判定
- `chat-user-identity.js` 本番 URL 上書き無効化
- 既存 `reports` / `blocked_users`
- Builder / TALK / Marketplace の Edge Functions
- `match/` 以外への script 強制注入

---

## 12. リスク

| リスク | 緩和 |
|--------|------|
| `auth.uid()` ≠ `talk_user_id` | RLS 適用前に `match_current_user_id()` 修正 |
| MATCH 独自ログイン | `TasuAuthCurrentUser` 委譲のみ |
| client_stub 本番残存 | 本番 host で `mode: edge` 必須 |
| RLS 先行有効化 | schema + policy 同時適用 |

---

## 13. 未決事項

| # | 項目 | 推奨デフォルト |
|---|------|----------------|
| D1 | いいねに本人確認必須か | **必須** |
| D2 | `match_current_user_id()` の claim 名 | `talk_user_id` |
| D3 | custom access token hook 要否 | Auth チーム調査 |
| D4 | 未ログイン時の閲覧範囲 | ランディングのみ |
| D5 | `stub-user-current` → `talkUserId` 切替 | Auth スタブで吸収 |
| D6 | `match_admin` ロール定義 | `app_metadata.role` |
| D7 | Marketplace 会員と MATCH 1:1 強制タイミング | 初回スワイプ前 |

D1・D2 未決でも **Auth スタブ実装は可能**（フラグで切替）。

---

## 14. 判定

### **READY_FOR_MATCH_AUTH_STUB**

- 既存 TASFUL Auth と MATCH text `user_id` の対応方針を固定
- `TasfulMatchAuth` 境界と `match-api` token provider 口を定義
- 状態分岐・責務分離・TALK 整合・導入順を提示
- RLS 適用前の `match_current_user_id()` 修正を明示（Auth スタブのブロッカーにはしない）

**次ステップ**: `match/match-auth.js` スタブ → data stub 接続 → `match-api.configure` スタブ → 回帰テスト。
