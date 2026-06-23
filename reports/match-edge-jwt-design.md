# TASFUL MATCH — Edge JWT / talk_user_id claim 設計レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0（設計レビューのみ） |
| 作成日 | 2026-06-21 |
| ステータス | 未実装・未接続 |
| 前提 | `match-auth-boundary-design.md`, `match-auth-stub-review.md`, `match-rls-d2-talk-user-id-draft-review.md`, `20260621140000_match_rls_d2_talk_user_id_draft.sql` |
| 横断参照 | `auth-jwt-design-final.md`（TASFUL 全体 JWT 固定）, `match-edge-functions-design.md` |
| 本書の範囲 | JWT claim / Edge / client header 設計の整理。**コード / SQL / Supabase 設定 / UI 変更は行わない** |

---

## 0. 目的

RLS D2 修正により `match_current_user_id()` が JWT の `talk_user_id` / `member_id` を読む設計になった。本書は、将来の **Supabase Auth · Custom Access Token Hook · Edge Function · MATCH client** が同一の会員 text ID をどう扱うべきかを固定し、**Edge JWT スタブ実装**の入力とする。

**不変原則**

- MATCH `user_id` = `TasuAuthCurrentUser.talkUserId` = TALK `buyer_id` / `seller_id`（text）
- `auth.uid()::text` 単独は MATCH / Edge / RLS で **正として使わない**
- 最終判定は **Edge + RLS**。client guard は UX のみ

---

## 1. 現状整理

### 1.1 既存 TASFUL Auth

| コンポーネント | 会員 ID の正 | 備考 |
|----------------|-------------|------|
| `auth-current-user.js` → `TasuAuthCurrentUser` | **`talkUserId`** | JWT 解決の正 |
| `chat-supabase-config.js` | demo `currentUserId: "u_me"` | **開発 fallback のみ** |
| `talk-runtime.js` | `getAuthTalkUserIdSync()` | TALK 同期 ID |

**`TasuAuthCurrentUser.getCurrentUserClaims()` の解決順（JWT あり）**

```text
app_metadata.talk_user_id
→ payload.talk_user_id（root）
→ app_metadata.member_id
→ payload.member_id
→ sub（UUID · 本番では talk_user_id 欠落時の last resort）
```

**セッション読み取り**

- `localStorage`: `tasu-supabase-auth`, `sb-{projectRef}-auth-token`
- access token を decode し `app_metadata` を merge

**localStorage / demo fallback**

| 条件 | 挙動 |
|------|------|
| `isProductionHost()`（`tasful.jp` 等） | LS / URL / `u_me` fallback **禁止** |
| demo（localhost, `?talkDev=1`, `talkDevMode` 等） | `?userId=`, `tasu_member_session`, `config.currentUserId` から demo ID |
| JWT に `talk_user_id` あり | `source: "jwt"`, `authenticated: true` |
| JWT 欠落 + demo 可 | `source: "demo_fallback"`, `authenticated: false` |

**本番方針（変更禁止）:** 既存 Auth 本体は MATCH 専用改修しない。MATCH は **読み取り委譲**のみ。

### 1.2 Supabase Auth / JWT（現状）

| 概念 | MATCH での扱い |
|------|----------------|
| `auth.uid()` | Supabase UUID（`sub`）。**MATCH user_id ではない** |
| `auth.jwt()` | RLS 内で JWT payload（jsonb）を読む Supabase 標準 helper |
| `app_metadata` | **canonical 格納先**（`auth-jwt-design-final.md` D-4） |
| `user_metadata` | ユーザー編集可能 → **RLS / Edge 判定に使わない** |
| Custom Access Token Hook | **未デプロイ**（設計上 D-15 で採用予定） |

**現状ギャップ:** access token に `app_metadata.talk_user_id` が入っていないユーザーが存在し得る。その状態で RLS D2 を適用すると `match_current_user_id()` が NULL になり、authenticated policy が全拒否される。

### 1.3 Edge Function stub（現状）

| 項目 | 現状 |
|------|------|
| `supabase/functions/_shared/match-auth.ts` | stub のみ |
| `requireUser` | Bearer 非空 → 固定 `{ userId: "stub-user-id" }` |
| `requireAdmin` | 上記 + `x-match-admin: true` |
| JWT 検証 | **なし** |
| DB / Supabase client | **なし** |

`match-edge-functions-design.md` §0.2 は `auth.uid()?.toString()` を記載しており、**本書および D2 修正で obsolete**。Edge 本実装時に `talk_user_id` claim へ更新する。

### 1.4 MATCH client stub（現状）

| ファイル | 認証 |
|----------|------|
| `match/match-auth.js` | `mode: "auth_stub"`, `getAuthHeaders()` → `Bearer stub-match-token` + **`x-match-user-id`** |
| `match/match-api.js` | `mode: "client_stub"`, fetch なし, `TasfulMatchAuth.getAuthHeaders` を auto-configure |
| `TasuAuthCurrentUser` | 存在すれば **読み取りのみ**で `talkUserId` sync（Auth 本体は未変更） |

---

## 2. 推奨 JWT claim 構成

### 2.1 最適方針（基本案）

| レイヤ | 正 |
|--------|-----|
| **永続 Source of Truth** | `auth.users.app_metadata.talk_user_id`（Admin API / signup hook のみ更新） |
| **Access Token（RLS / PostgREST）** | JWT 内 `app_metadata.talk_user_id`（Supabase が token に含める） |
| **RLS `match_current_user_id()`** | `auth.jwt() -> 'app_metadata' ->> 'talk_user_id'` を **第一候補**（D2 草案済み） |
| **Edge `requireUser`** | 署名検証後、**同一 coalesce  chain** で `userId` 抽出 |
| **Client UX** | `TasfulMatchAuth.getMatchUserId()` ← `TasuAuthCurrentUser.talkUserId` 委譲 |

### 2.2 claim 優先順位（MATCH / RLS / Edge で統一）

```text
1. auth.jwt() -> 'app_metadata' ->> 'talk_user_id'   ← 正（TASFUL canonical）
2. auth.jwt() ->> 'talk_user_id'                       ← Hook が root に mirror した場合
3. auth.jwt() -> 'app_metadata' ->> 'member_id'       ← 移行期のみ（= talk_user_id 同値が前提）
```

**意図的に含めない fallback**

| 候補 | 理由 |
|------|------|
| `user_metadata.*` | ユーザーが Supabase client 経由で改ざん可能（§3 参照） |
| `auth.jwt() ->> 'sub'` | UUID。TALK / MATCH text ID と不一致 |
| `auth.uid()::text` | 同上 |

**TALK 既存 RLS との差分メモ:** `sql/talk-rls-production.sql` の `talk_current_user_id()` は root 優先 + `user_metadata` + `sub` fallback を含む。MATCH D2 草案は **`auth-jwt-design-final.md` D-4 に合わせて厳格化**。将来 TALK RLS も `app_metadata` 中心へ収束させるのが望ましいが、**本書スコープ外**（既存 TALK SQL は変更しない）。

### 2.3 `user_metadata` に入れてはいけない理由

| 理由 | 説明 |
|------|------|
| 改ざん可能 | anon key + ログインセッションで `supabase.auth.updateUser({ data })` 可能 |
| RLS  bypass リスク | 攻撃者が任意 `talk_user_id` を設定し、他人行へのアクセスを試み得る |
| 設計固定 | `auth-jwt-design-final.md` D-4: **`app_metadata` only** · user_metadata は RLS 禁止 |
| 運用 | ops / 会員 ID は Admin API · service_role · Hook のみが書けるべき |

### 2.4 Custom Access Token Hook vs `user.app_metadata` 直接設定

| 方式 | 内容 | メリット | デメリット |
|------|------|----------|------------|
| **A. Admin API で `app_metadata` 設定** | signup / backfill 時に `talk_user_id` を `auth.users` に書く | シンプル · Supabase が token に自動反映 | metadata 更新〜token 反映に refresh タイムラグ |
| **B. Custom Access Token Hook** | 毎回 token 発行時に DB / metadata から claim 注入 | 常に最新 · root mirror 可能 · `member_identities` lookup | Hook デプロイ · 障害時は全 API 影響 |
| **C. A + B（推奨）** | 永続は A、発行時整合は B | TASFUL 全体設計（D-15）と一致 | 実装コスト |

**MATCH 推奨:** **C（A + B）**

- 永続: `auth.users.app_metadata.talk_user_id` + `member_id`（同値）
- Hook: 欠落時は `member_identities` から lookup、root への `talk_user_id` mirror は **任意**（RLS は app_metadata 第一で足りる）
- Hook 不可環境の代替: **A のみ** + staging で token 実測ゲート（本番は Hook 推奨）

---

## 3. RLS との整合

### 3.1 `match_current_user_id()`（D2 草案 · 適用前）

```sql
coalesce(
  auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
  auth.jwt() ->> 'talk_user_id',
  auth.jwt() -> 'app_metadata' ->> 'member_id'
)
```

| 項目 | 方針 |
|------|------|
| policy 比較 | すべて `user_id = match_current_user_id()`（`auth.uid()::text` 禁止） |
| view | `match_profiles_public` は既に helper 呼び出し · 関数差替で自動整合 |
| service_role | RLS bypass · Edge が DB 書込の trust boundary |

### 3.2 Edge ↔ RLS 整合表

| 操作 | Edge が決める user_id | RLS が効く経路 |
|------|----------------------|----------------|
| 本人 profile CRUD（将来 direct PostgREST） | —（JWT のみ） | `match_current_user_id()` |
| swipe / pair / block（Edge + service_role） | JWT `talk_user_id` | service_role bypass · Edge 側検証が必須 |
| 公開 discovery SELECT | — | `match_profiles_public` + JWT 必須 |

**ルール:** Edge が service_role で書く `user_id` / `swiper_user_id` / `user_low_id` 等は、**必ず `requireUser` 由来**。RLS を bypass する分、Edge の JWT 検証が唯一の防壁。

---

## 4. Edge Function `requireUser` 設計（将来本実装）

### 4.1 フロー（推奨）

```text
Authorization: Bearer <access_token>
        │
        ▼
  getBearerToken(req) — 欠落 → 401
        │
        ▼
  supabase.auth.getUser(token)  // anon client + JWT
  または JWT verify（JWKS / project secret）
        │
        ▼
  extractTalkUserId(user.app_metadata, jwt.payload)
  // 優先順 §2.2 と同一
        │
        ▼
  talkUserId 欠落 → 403 CLAIM_MISSING（本番）
        │
        ▼
  return { userId: talkUserId, sub, claims }
```

### 4.2 Bearer JWT と `x-match-user-id` の照合

| 環境 | 方針 |
|------|------|
| **本番** | **`x-match-user-id` を無視**（存在しても照合しない · ログ warn のみ可） |
| **staging 移行期** | JWT claim と header が両方ある場合 **不一致 → 403**（debug 用） |
| **stub フェーズ** | 現状どおり header 送信可 · Edge stub は JWT 未検証 |

**禁止:** `userId = req.headers.get('x-match-user-id')` を本番の正とする実装。

### 4.3 client payload の `user_id` を信用しない

| payload 例 | Edge 扱い |
|------------|-----------|
| `target_user_id`（swipe 対象） | **許可** — 相手 ID は client 指定でよい（本人操作の対象） |
| `swiper_user_id` / `reporter_user_id` / `user_id`（本人） | **無視** — JWT から上書き |
| body に本人 ID あり + JWT と不一致 | **403** または無視して JWT を採用（ログ推奨） |

`auth-jwt-design-final.md` D-14 と同じ: 書込 API は JWT 必須 · body `user_id` は JWT と一致検証（service_role 除く）。

### 4.4 service_role 使用時の安全な user_id 判定

| パターン | 安全な実装 |
|----------|------------|
| user-facing Function | anon key + **ユーザー JWT** で `requireUser` → service_role client は **サーバ内**のみ |
| DB INSERT `match_pairs` | `user_low_id` / `user_high_id` = sort(JWT userId, targetUserId) — target は業務検証済み |
| `match-admin-review` | **別経路:** `requireMatchAdmin`（§10）· service_role 単独を client から呼ばせない |
| Edge が JWT なしで service_role | **禁止**（user-facing 入口） |

**反パターン:** request body の `user_id` をそのまま service_role INSERT に使う。

### 4.5 `requireUser` 戻り値（案）

```typescript
type MatchAuthUser = {
  userId: string;       // talk_user_id — MATCH / TALK 共通
  authUserId: string;   // sub (UUID)
  claims: Record<string, unknown>;
};
```

---

## 5. client header 設計

### 5.1 本番 `getAuthHeaders()`（推奨）

```javascript
async function getAuthHeaders() {
  const token = TasuAuthCurrentUser?.getCurrentUser?.()?.claims
    ? readAccessTokenFromSession()  // 既存 LS キー · Auth 本体は変更しない
    : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
```

| header | 本番 |
|--------|------|
| `Authorization: Bearer <access_token>` | **必須**（Edge / PostgREST） |
| `x-match-user-id` | **送らない**（または送っても Edge が無視） |
| `apikey` | Supabase Functions 慣行どおり anon key（別途） |

### 5.2 `match-api.js`（edge モード将来）

- `configure({ mode: "edge", getAuthHeaders })` — Bearer のみ
- fetch 前に `getAuthHeadersProvider()` 呼び出し
- レスポンスの `match_user_id` は **表示用**（server 返却を優先 · client 推定は UX のみ）
- `mode: "client_stub"` は開発維持 · 本番 host では `edge` 必須（`match-auth-boundary-design.md`）

### 5.3 `TasfulMatchAuth` の責務

| 用途 | 使う | 使わない |
|------|------|----------|
| ボタン無効化 · リダイレクト | `getMatchUserId()`, `canUseSwipe()` 等 | — |
| API 認証の正 | — | client 推定 ID |
| Edge / RLS 最終判定 | — | client guard のみ |

---

## 6. `x-match-user-id` の扱い

| フェーズ | client | Edge |
|----------|--------|------|
| **現 stub** | `match-auth.js` が送信 | 未使用（`requireUser` は stub userId 固定） |
| **JWT stub 次段** | 送信可（テスト用） | JWT 抽出を実装 · header は **照合のみ / 不一致 reject** |
| **staging 本接続** | 非推奨 · 削除方向 | 無視 |
| **本番** | **送信禁止** | **無視 · ログ warn** |

**結論:** `x-match-user-id` は **debug / transition 専用**。本番では **信用しない**。

---

## 7. demo / fallback の扱い

| コンテキスト | MATCH client | Edge / RLS |
|--------------|--------------|------------|
| localhost / demo | `auth_stub` · `stub-user-current` · stub Bearer | Edge stub · RLS 未適用 |
| demo + `TasuAuthCurrentUser` 読取 | 外部 JWT があれば `talkUserId` sync | — |
| 本番 host | `TasuAuthCurrentUser` 委譲 · token 必須 | JWT `talk_user_id` 必須 · fallback 禁止 |
| 未ログイン | `requireLogin()` → CTA | 401 / 公開 0 件 |

**禁止:** 本番 host で `config.currentUserId` / `?userId=` / stub Bearer を MATCH API の正とする。

**MATCH ページ:** 将来 `auth-current-user.js` を script 読込し、`TasfulMatchAuth` が本番モードで委譲（Auth 本体ファイル自体は変更しない）。

---

## 8. token refresh 問題

| イベント | claim 反映 |
|----------|------------|
| 初回 login | access token に `app_metadata` スナップショット |
| `app_metadata` Admin 更新 | **次回 token refresh まで古い claim の可能性** |
| `supabase.auth.refreshSession()` | 新 access token · 更新済み metadata |
| Custom Access Token Hook | **毎回発行時**に DB / metadata 再読込 |

**運用ルール**

1. backfill 後は **forced refresh** または再ログインをリリースノートに記載
2. staging ゲート: metadata 更新 → refresh → `auth.jwt()` 実測
3. Hook 導入後も Admin API が Source of Truth · Hook は整合レイヤ

**MATCH 影響:** `talk_user_id` 付与前に RLS 適用すると全拒否。ゲート順序: **claim 付与 → token 実測 → D2 migration → RLS enable**。

---

## 9. 既存 TALK との整合

| 項目 | 整合方針 |
|------|----------|
| ID 空間 | `match_profiles.user_id` = `transaction_rooms.buyer_id` / `seller_id` = JWT `talk_user_id` |
| `match_pairs` | `user_low_id` / `user_high_id` = 両者の `talk_user_id`（sorted） |
| TALK room 作成 | Edge が `listing_type: 'match'`, participants = pair の talk_user_id |
| 既存 `chat-supabase.js` | **変更しない** · Edge REST で room INSERT |
| RLS 関数 | TALK: `talk_current_user_id()` · MATCH: `match_current_user_id()` — **同一 claim 解決順を維持** |

**検証クエリ（staging ゲート）:** 同一セッションで `TasuAuthCurrentUser.talkUserId` = JWT claim = 参加中 room の `buyer_id`/`seller_id` = `match_profiles.user_id`。

---

## 10. admin 権限設計

### 10.1 現 stub（廃止対象）

- `requireAdmin`: Bearer + **`x-match-admin: true`** — 誰でも偽装可能

### 10.2 本番推奨（`match-admin-review` / `match-moderation-log`）

| 方式 | 内容 |
|------|------|
| **Primary** | JWT `app_metadata.is_ops === true` **または** `role === 'tasu_admin'`（`TasuAuthCurrentUser.isOpsUser()` と同型） |
| **Optional** | `app_metadata.match_admin === true`（MATCH 専用 ops · 将来） |
| **Deprecated** | `x-match-admin` header — **本番 403 / 未参照** |
| **Network** | ops 画面は `isProductionHost` + ops claim · VPN / IP allowlist は infra 層 |

**`requireMatchAdmin`（将来）**

```text
requireUser(req) → talkUserId
→ claims.is_ops || claims.role === 'tasu_admin' || claims.match_admin
→ 否 → 403 forbidden
```

service_role だけで admin Function を公開しない（client から叩けない設計）。

---

## 11. 導入順

| 順 | 作業 | 依存 |
|----|------|------|
| 1 | **本書固定** — claim 構成 · header 方針 | — |
| 2 | **Auth 基盤（TASFUL 横断 · MATCH 外）** — `app_metadata.talk_user_id` backfill + Custom Access Token Hook | `auth-jwt-design-final.md` STEP 2 |
| 3 | **staging token 実測** — JWT decode · `TasuAuthCurrentUser` 一致 | ゲート |
| 4 | **Edge JWT stub** — `requireUser` が mock JWT / 固定 claim を decode · `talk_user_id` 返却 | 本書 |
| 5 | **MATCH client JWT stub** — `getAuthHeaders()` が session Bearer のみ（`x-match-user-id` は dev flag で optional） | 4 と並行可 |
| 6 | **D2 migration 適用** — `20260621140000_match_rls_d2_talk_user_id_draft.sql` | 3 |
| 7 | **RLS enable migration** | 6 + 統合テスト |
| 8 | **Edge 本実装** — Supabase `getUser` + service_role DB | 6–7 |
| 9 | **`match-api` edge モード + fetch** | 8 |
| 10 | **TALK room 本接続** | 8 |

**既存を壊さない:** 1–5 は MATCH / Edge 配下のみ。`auth-current-user.js` 改修は Auth STEP 2 PR に委譲。

---

## 12. 実装前ゲート

### 12.1 Edge JWT stub 着手前（最小）

- [ ] 本書の claim 優先順位 · header 方針に合意
- [ ] `match-auth.ts` stub が `extractTalkUserId()` インターフェースを持つ設計合意

### 12.2 Edge JWT 本実装 / RLS 適用前（必須）

- [ ] Supabase JWT に `app_metadata.talk_user_id` が存在（staging 実測）
- [ ] `TasuAuthCurrentUser.talkUserId` と JWT claim が一致
- [ ] TALK `buyer_id` / `seller_id` と一致
- [ ] `match_profiles.user_id` と一致（seed 後）
- [ ] token refresh 後も claim 維持を確認
- [ ] `x-match-user-id` なしで Edge E2E が通る
- [ ] RLS: 本人 SELECT / 他人拒否 / `match_profiles_public` 期待動作

### 12.3 本番リリース前

- [ ] 本番 host で `auth_stub` / stub Bearer 無効
- [ ] `x-match-admin` 未使用
- [ ] client payload 本人 ID 上書きテスト（改ざん拒否）

---

## 13. リスク

| リスク | 影響 | 緩和 |
|--------|------|------|
| claim 未付与のまま RLS 適用 | 全 MATCH API 403/空 | ゲート順序 · Hook 先行 |
| `x-match-user-id` 本番信頼 | なりすまし | 本番無視 · Edge は JWT のみ |
| service_role + body user_id | 任意ユーザーとして DB 書込 | requireUser 必須 · body 本人 ID 破棄 |
| metadata 更新 lag | 旧 talk_user_id で RLS | refresh 強制 · Hook |
| TALK / MATCH RLS 関数の差 | 将来の claim 解釈 drift | 同一優先順位表を共有（§2.2） |
| demo ID（`u_me`）本番混在 | ID 衝突 | `auth-jwt-design-final` U-2 横断移行 |
| Edge 設計書の `auth.uid()` 記載 | 実装者誤読 | `match-edge-functions-design.md` 更新は実装 PR で |

---

## 14. 未決事項

| # | 項目 | 推奨デフォルト | ブロッカー |
|---|------|----------------|------------|
| EJ-1 | Custom Access Token Hook のデプロイ形態（Dashboard SQL vs Edge Function） | Edge Function（D-15） | JWT stub には **非ブロッキング** |
| EJ-2 | 既存 demo `u_me` ユーザーの `talk_user_id` backfill | mapping seed · 本番は新規発行のみ | RLS 本番前 |
| EJ-3 | `member_id` fallback を MATCH 本番から除外するか | 移行期のみ残す（D2 草案どおり） | 低 |
| EJ-4 | root `talk_user_id` mirror を Hook で必須にするか | **任意**（app_metadata で足りる） | 低 |
| EJ-5 | `match_admin` 専用 claim を分けるか | 初期は `is_ops` / `tasu_admin` 共用 | admin Function 本番前 |
| EJ-6 | staging で `x-match-user-id` 不一致を 403 にする期間 | JWT stub 期間のみ | 低 |

---

## 15. 判定

### **READY_FOR_MATCH_EDGE_JWT_STUB**

**理由**

- JWT claim 構成 · RLS D2 · Edge `requireUser` · client header · TALK 整合を本書で固定
- 推奨基本案（`app_metadata.talk_user_id` 正 · Bearer のみ信頼 · `x-match-user-id` 本番非信頼）を採用
- Edge JWT **スタブ**（decode インターフェース + mock claim）に進めるのに十分
- Hook デプロイ形態（EJ-1）や demo ID 移行（EJ-2）は **未決だが stub フェーズのブロッカーではない**

**次ステップ:** `match-auth.ts` に `extractTalkUserId()` / JWT stub 版 `requireUser` を追加（本 PR スコープ外）→ client `getAuthHeaders()` Bearer 化 stub → staging JWT 実測。

**NEEDS_DECISION となる条件（現時点では該当せず）**

- 本番 MATCH を Hook なし（Admin API のみ）で出すかどうかの product 決定が必要な場合
- `member_id` fallback 完全排除を MATCH 単独で先走りする場合

---

## 参照ファイル

| パス | 用途 |
|------|------|
| `auth-current-user.js` | JWT / demo fallback 現状 |
| `chat-supabase-config.js` | demo `u_me` |
| `match/match-auth.js` | client stub headers |
| `match/match-api.js` | token provider |
| `supabase/functions/_shared/match-auth.ts` | Edge stub guards |
| `supabase/migrations/20260621140000_match_rls_d2_talk_user_id_draft.sql` | RLS helper |
| `reports/auth-jwt-design-final.md` | TASFUL 全体 JWT 固定 |
