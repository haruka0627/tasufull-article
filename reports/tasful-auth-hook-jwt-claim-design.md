# TASFUL — Auth Hook / JWT Claim 導入設計レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0（設計レビューのみ） |
| 作成日 | 2026-06-21 |
| ステータス | 未実装 · Supabase 設定未変更 |
| 前提 | `match-auth-boundary-design.md`, `match-edge-jwt-design.md`, `match-rls-d2-talk-user-id-draft-review.md`, `match-local-edge-smoke-result.md` |
| 横断参照 | `auth-jwt-design-final.md`（P1-A2 · TASFUL 全体 JWT 固定） |
| 判定入力 | `LOCAL_EDGE_SMOKE_PASS` |
| 本書の範囲 | **talk_user_id claim 発行方法の確定**。Hook / SQL / Supabase Dashboard / UI / 本番反映は行わない |

---

## 0. 目的

MATCH · TALK · Builder · Marketplace が共通利用する **`talk_user_id`（text 会員 ID）** を、Supabase access token JWT に **安全かつ一貫して載せる方法**を決定する。

**背景（確定済み）**

- 業務 `user_id` の正は **`talk_user_id`**。`auth.uid()`（UUID）ではない。
- MATCH RLS 草案 `match_current_user_id()` は `auth.jwt()` から `app_metadata.talk_user_id` 等を読む（D2 修正済み · 未適用）。
- Edge `requireUser` · `TasuAuthCurrentUser.talkUserId` · TALK `buyer_id`/`seller_id` も同一 ID 空間。
- ローカル Edge smoke（`LOCAL_EDGE_SMOKE_PASS`）は **stub token / 署名なし JWT** で handler 整合を確認。**本番 claim 発行は未着手**。

---

## 1. 現状整理

### 1.1 Supabase Auth / JWT 各要素

| 要素 | 現状 | TASFUL での位置づけ |
|------|------|---------------------|
| **`auth.uid()`** | Supabase UUID（= JWT `sub`） | Auth 行 PK · **業務 user_id ではない** |
| **`auth.jwt()`** | Postgres 内 JWT payload（jsonb） | RLS / SQL helper の読取 API |
| **`app_metadata`** | Admin API / service_role のみ更新可 | **claim の永続 Source of Truth（設計固定）** |
| **`user_metadata`** | ユーザー自身が client から更新可能 | **RLS / Edge 権限判定に使わない** |
| **Custom Access Token Hook** | **未デプロイ** | 毎回 token 発行時に claim 注入 · DB lookup 可 |
| **Access Token 内容** | 通常 `app_metadata` が JWT に含まれる | `talk_user_id` 未設定ユーザーが存在し得る |

### 1.2 クライアント（`TasuAuthCurrentUser`）

| 項目 | 内容 |
|------|------|
| 読取 | `localStorage` session → JWT decode → `app_metadata.talk_user_id` 優先 |
| 解決順 | `app_metadata.talk_user_id` → root `talk_user_id` → `member_id` → `sub` |
| 本番 | `tasful.jp` 等で LS / URL / `u_me` fallback **禁止** |
| demo | localhost · `?talkDev=1` · `config.currentUserId: "u_me"` のみ |

### 1.3 ドメイン別 user_id（DB / JS）

| ドメイン | 格納 / 参照 | ID 型 |
|----------|-------------|-------|
| **TALK** | `transaction_rooms.buyer_id`, `seller_id` | text · `talk_user_id` 同値 |
| **Marketplace** | `listings.user_id`, 取引系 | text · seller = `talk_user_id` |
| **Builder** | `applications.user_id`, 参加者判定 | text · = `talk_user_id` |
| **MATCH** | `match_*.user_id`（草案） | text · = `talk_user_id` |
| **安否** | `member_id` claim（= `talk_user_id`） | text |

### 1.4 ギャップ（本番ブロッカー）

| ギャップ | 影響 |
|----------|------|
| JWT に `talk_user_id` 未設定 | RLS `match_current_user_id()` / `talk_current_user_id()` が NULL → 本人 policy 全拒否 |
| Hook 未導入 | signup 直後 · backfill 直後 · `member_identities` 参照が token に反映されない可能性 |
| Edge 本番 verify 未実装 | stub JWT のみ smoke 済み · 署名検証は別フェーズ |

---

## 2. talk_user_id Source of Truth

### 2.1 推奨（3 層）

```text
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — 永続正（DB + Auth 行）                              │
│   auth.users.app_metadata.talk_user_id  （Admin / signup のみ）│
│   将来: member_identities(auth_user_id ↔ talk_user_id)       │
└───────────────────────────┬─────────────────────────────────┘
                            │ 発行時に読込
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2 — Access Token（JWT · 各リクエストの正）               │
│   app_metadata.talk_user_id  （Supabase 標準 + Hook 整合）      │
│   任意 mirror: root talk_user_id（Hook のみ · 必須ではない）    │
└───────────────────────────┬─────────────────────────────────┘
                            │ auth.jwt() / client decode
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3 — 利用側（読取のみ · 書込禁止）                        │
│   RLS: match_current_user_id() / talk_current_user_id()      │
│   Edge: requireUser → talkUserId                               │
│   Client: TasuAuthCurrentUser.talkUserId · TasfulMatchAuth     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 正しく **ない** Source

| 候補 | 理由 |
|------|------|
| `auth.uid()::text` | UUID ≠ TALK/MATCH text 行 |
| `user_metadata.talk_user_id` | ユーザー改ざん可能 |
| client payload / `x-match-user-id` | 信頼不可（Edge/RLS 正としない） |
| localStorage demo ID（本番） | セキュリティ · 既存方針で禁止 |

---

## 3. 比較表（A〜D）

評価: ◎ 最良 · ○ 可 · △ 条件付 · ✗ 不可

| 評価項目 | **A: app_metadata + Hook** | **B: app_metadata のみ** | **C: user_metadata** | **D: auth.uid() を user_id** |
|----------|---------------------------|-------------------------|---------------------|------------------------------|
| **方式概要** | Admin で metadata 永続 + Hook が毎 token 発行時に claim 注入 / DB lookup | signup/backfill で `app.users.app_metadata` 設定 · Supabase 標準 JWT 埋込 | ユーザー可変 metadata に `talk_user_id` | 業務 ID を UUID に統一 |
| **安全性** | ◎ Admin + Hook のみ書込 · 署名 JWT | ○ metadata 改ざん不可 · 発行経路は Auth 標準 | ✗ client 更新可能 · RLS bypass リスク | ○ UUID 改ざん不可 · **ID 空間が業務と不一致** |
| **移行容易性** | ○ backfill + Hook 段階導入 | ◎ 最小 · Hook なしで開始可 | △ 既存 RLS 方針と衝突 | ✗ TALK/MATCH/Builder 全 DB 列変更 |
| **既存 TASFUL 互換** | ◎ `auth-current-user.js` / P1-A2 一致 | ◎ 同一 metadata 前提 | ✗ `auth-jwt-design-final` D-4 違反 | ✗ `TasuAuthCurrentUser` / TALK text ID と矛盾 |
| **RLS 相性** | ◎ `auth.jwt()->app_metadata->>talk_user_id` | ◎ 同左 · claim 欠落時のみ失敗 | ✗ 使用禁止方針 | ✗ `match_current_user_id()` 設計と矛盾 |
| **Edge 相性** | ◎ verify 後 coalesce · DB 再 lookup 可 | ○ JWT のみ · metadata 更新 lag あり | ✗ 信頼不可 | ✗ Edge/DB text 列と不一致 |
| **運用性** | ○ Hook 監視 · 障害時全 API 影響 | ◎ シンプル · refresh lag 要運用 | ✗ 監査困難 | ✗ 運用は楽だが **製品要件不適合** |
| **MATCH 適用** | ◎ D2 RLS ゲート充足 | △ metadata 全員分 backfill 必須 | ✗ | ✗ |
| **総合** | **推奨** | 移行期 / PoC のみ | **不採用** | **不採用** |

---

## 4. 推奨案

### **採用: 案 A（`app_metadata.talk_user_id` + Custom Access Token Hook）**

**段階導入（案 B を移行期サブステップとして包含）**

| フェーズ | 内容 |
|----------|------|
| **A0 — 永続化** | signup / backfill で `auth.users.app_metadata.talk_user_id` + `member_id`（同値）を設定 |
| **A1 — Hook** | Custom Access Token Hook で token 発行時に metadata / `member_identities` を読み JWT に反映 |
| **A2 — 検証** | staging で JWT 実測 · RLS / Edge / `TasuAuthCurrentUser` 一致ゲート |
| **A3 — RLS** | MATCH D2 migration 適用 · 他ドメイン RLS と同順位 claim |

**案 B 単独を本番恒久としない理由**

- metadata 更新から access token 反映まで **refresh lag**
- `member_identities` 導入時に **token 発行時 DB lookup** が欲しい
- ops claim（`is_ops`）同期を Hook 1 箇所に集約できる（`auth-jwt-design-final` D-15）

**案 C · D は不採用**（§3 参照）。

---

## 5. claim 構造

### 5.1 永続（`auth.users.app_metadata` · Admin API のみ）

```json
{
  "talk_user_id": "u_7f3a9c2e",
  "member_id": "u_7f3a9c2e",
  "is_ops": false,
  "role": "authenticated",
  "platform_role": "member",
  "partner_id": null
}
```

| claim | 必須 | 用途 |
|-------|------|------|
| `talk_user_id` | **必須** | TALK · MATCH · Marketplace · Builder 参加者 · Edge/RLS 正 |
| `member_id` | **必須** | 安否 RLS · = `talk_user_id`（D-3） |
| `is_ops` | 任意 | 運営 · MATCH admin 将来は `is_ops` / `tasu_admin` 共用 |
| `role` | 任意 | `tasu_admin` 既存 RLS 互換 |
| `platform_role` | 任意 | Builder 平台種別のみ |
| `partner_id` | 条件 | partner スタッフのみ |

### 5.2 Access Token（JWT · 読取側）

**RLS / Edge 読取 coalesce（TASFUL 統一）**

```sql
coalesce(
  auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
  auth.jwt() ->> 'talk_user_id',
  auth.jwt() -> 'app_metadata' ->> 'member_id'
)
```

| ルール | 内容 |
|--------|------|
| 主経路 | `app_metadata.talk_user_id` |
| root `talk_user_id` | Hook が mirror する場合のみ（**任意**） |
| `sub` / `auth.uid()` | **業務 user_id に使わない** |
| `user_metadata` | **RLS/Edge で参照禁止** |

### 5.3 Custom Access Token Hook（設計 · 未実装）

```text
Auth token 発行要求
    → Hook（Edge Function または Postgres Hook）
        → auth.users.app_metadata 読込
        → （任意）member_identities lookup by sub
        → claims に talk_user_id / member_id / is_ops / role 注入
        → （任意）root talk_user_id mirror
    → 署名済み access token 返却
```

| Hook 入力 | Hook 出力 |
|-----------|-----------|
| `user_id`（UUID sub） | `app_metadata` ブロックを JWT に保証 |
| 既存 claims | 欠落時は DB/metadata から補完 · **クライアント入力は無視** |

---

## 6. token refresh

| イベント | claim 反映 |
|----------|------------|
| login / signup | 新 access token · Hook 実行 |
| `app_metadata` Admin 更新 | **次回 refresh まで旧 claim の可能性** |
| `supabase.auth.refreshSession()` | 新 token · Hook 再実行（案 A） |
| Hook 障害 | token 発行失敗 → **全 authenticated API 影響** |

**運用ルール**

1. backfill 後は **forced refresh** または再ログインを手順に含める
2. staging ゲート: metadata 更新 → refresh → `auth.jwt()` / client decode 一致
3. 案 A では Hook が **毎回発行時**に最新 metadata を反映（B より lag 小）

---

## 7. backfill 方針

### 7.1 対象

| ユーザー種別 | 方針 |
|--------------|------|
| 既存 Auth ユーザー（`auth.users`） | Admin API で `app_metadata.talk_user_id` 設定 |
| TALK 既存行 | `buyer_id` / `seller_id` と **同じ text** を割当（逆引き or mapping） |
| 新規 signup | signup Hook / Edge で **新規 `u_*` 発行** → metadata 設定 |

### 7.2 将来テーブル（P1-A2 設計 · 未実装）

```text
member_identities (
  auth_user_id uuid PK REFERENCES auth.users(id),
  talk_user_id text NOT NULL UNIQUE
)
```

| 用途 |
|------|
| `sub` ↔ `talk_user_id` 1:1 監査 |
| Hook が metadata 欠落時に lookup |
| backfill バッチの idempotent キー |

### 7.3 手順（実装計画フェーズで詳細化）

1. 棚卸し — JWT に `talk_user_id` 無いユーザー数
2. mapping 生成 — TALK / listings / 既知 demo ID との対応表
3. Admin API バッチ — `app_metadata` 更新（service_role · **client 不可**）
4. refresh 強制 — 影響ユーザーへ再ログイン or silent refresh
5. ゲート — `TasuAuthCurrentUser.talkUserId` = JWT = DB 行

**MATCH RLS 適用はゲート 5 通過後**（D2 migration 草案の APPLY GATES）。

---

## 8. demo user 対応

| コンテキスト | 扱い |
|--------------|------|
| **本番 host** | demo fallback **禁止** · JWT `talk_user_id` 必須 |
| **localhost / talkDev** | 現状維持: `config.currentUserId: "u_me"`, `?userId=` 等 · **JWT 未接続時 UI のみ** |
| **MATCH stub** | `stub-user-current` / `stub-match-token` — ローカル smoke のみ |
| **demo ID を Auth に載せる** | demo 用 Supabase ユーザーに `app_metadata.talk_user_id: "u_me"` を設定（**staging のみ**） |
| **`u_me` 本番混在** | **禁止** — 本番は `u_*` 新規発行（P1-A2 U-2 · product 判断） |

demo fallback は **JWT claim 発行の代替にならない**。本番は claim 必須。

---

## 9. 既存サービス影響

| サービス | Hook / claim 導入の影響 | 必要作業 |
|----------|------------------------|----------|
| **TALK** | `buyer_id`/`seller_id` = JWT `talk_user_id` · 変更なし | backfill 整合 · `talk_current_user_id()` 同順位維持 |
| **Marketplace** | `listings.user_id` = `talk_user_id` | 既存 JS は `TasuAuthCurrentUser` 経由 · RLS 既存 |
| **Builder** | 参加者 = `talk_user_id` · 案件ロールは DB のみ | `platform_role` claim · Hook 同期 |
| **MATCH** | `match_current_user_id()` · Edge `requireUser` | **claim ゲート後** RLS 適用 |
| **安否** | `member_id` = `talk_user_id` | 同値 backfill |
| **Edge（全体）** | user-facing は verify + `talk_user_id` 抽出 | MATCH stub → verifyJwt 本実装 |
| **service_role** | RLS bypass · **user_id は Edge 内で JWT 由来** | client に service_role 禁止（現状維持） |

**触らない（本フェーズ）**

- `auth-current-user.js` 本番 fallback ロジックの緩和
- TALK / Builder / Marketplace の **既存 Edge Function** 本体
- MATCH UI · `client_stub` デフォルト

---

## 10. 導入順

| 順 | 作業 | ゲート |
|----|------|--------|
| 1 | **本書確定** — 案 A · claim 構造 | — |
| 2 | **Auth Hook 実装計画** — Hook 種別 · staging ref · ロールバック | `READY_FOR_AUTH_HOOK_IMPLEMENTATION_PLAN` |
| 3 | `member_identities` DDL 草案（任意 · 先行可） | infra |
| 4 | signup / backfill バッチ — `app_metadata.talk_user_id` | staging 実測 |
| 5 | Custom Access Token Hook deploy（**staging のみ**） | JWT 実測 |
| 6 | `TasuAuthCurrentUser` / TALK 一致テスト | talkUserId = JWT = buyer_id |
| 7 | Edge `verifyJwt` 本実装（MATCH 先行可） | LOCAL smoke 相当 · 署名あり |
| 8 | MATCH D2 migration 適用 | RLS 統合テスト |
| 9 | 他ドメイン RLS 本番 enable | 横断回帰 |
| 10 | 本番 Hook + backfill | 本番 ref · 監視 |

**MATCH 機能凍結中:** 手順 2–7 は Auth/Hook 横断 · 手順 8 以降で MATCH RLS を再開。

---

## 11. リスク

| リスク | 内容 | 緩和 |
|--------|------|------|
| claim 未設定のまま RLS 適用 | 全拒否 | ゲート 5–6 必須 |
| Hook SPOF | token 発行不能 | staging 検証 · fallback 手順 · 監視 |
| backfill 誤 mapping | 他人行アクセス | idempotent バッチ · staging ダブルチェック |
| refresh lag | 旧 talk_user_id | forced refresh · Hook（案 A） |
| demo `u_me` 本番混入 | ID 衝突 | 本番新規発行のみ |
| 共有 dev Supabase ref | 他機能への Hook 影響 | staging 専用 ref 推奨 |
| Edge verify 未完了 | なりすまし（staging） | 本番前 verify 必須 |

---

## 12. 未決事項

| # | 項目 | 推奨デフォルト | ブロッカー |
|---|------|----------------|------------|
| U-1 | Hook 実装形態（Postgres vs Edge Function） | Supabase Dashboard 推奨方式を実装計画で調査 | 実装計画 |
| U-2 | 既存 demo `u_me` を本番 mapping に残すか | **本番は新規 `u_*` のみ** · demo は staging | backfill 前 |
| U-3 | `member_identities` 先行必須か | **推奨** · Hook 単独でも A0 可能 | 低 |
| U-4 | root `talk_user_id` mirror 必須か | **任意**（app_metadata で足りる） | 低 |
| U-5 | 共有 dev project `ddojquacsyqesrjhcvmn` vs 専用 staging | **専用 staging 推奨** | infra 合意 |
| U-6 | MATCH admin 専用 claim | 初期は `is_ops` / `tasu_admin` 共用 | 低 |

U-1 · U-5 は **実装計画**で解消。本設計レビューでは **案 A 採用**をブロックしない。

---

## 13. 横断整合チェックリスト

| 確認項目 | 案 A 整合 |
|----------|-----------|
| `match_current_user_id()` | ◎ `app_metadata.talk_user_id` 第一候補 |
| Edge `requireUser` | ◎ 同一 coalesce · verifyJwt |
| `TasuAuthCurrentUser` | ◎ 既存読取順維持 |
| TALK `buyer_id`/`seller_id` | ◎ text 同値 |
| Marketplace / Builder | ◎ `talk_user_id` canonical |
| service_role Edge 書込 | ◎ userId = JWT 由来 · client payload 無視 |
| localStorage fallback 本番 | ◎ 禁止維持 |
| LOCAL_EDGE_SMOKE | ◎ stub 整合済 · 本番 claim は本書次フェーズ |

---

## 判定

### **READY_FOR_AUTH_HOOK_IMPLEMENTATION_PLAN**

**理由**

- `talk_user_id` の Source of Truth（`app_metadata` 永続 + JWT 発行）を確定
- 案 A〜D 比較 · 案 A 推奨 · C/D 不採用
- claim 構造 · refresh · backfill · demo · 横断影響 · MATCH RLS/Edge 整合を整理
- P1-A2 `auth-jwt-design-final.md` と矛盾なし（本書は MATCH ローカル smoke 後の **実装計画入口**）
- 未決（Hook 形態 · staging ref）は **実装計画フェーズ**で十分

**NEEDS_DECISION となる条件（現時点では該当せず）**

- 本番で案 B のみ恒久運用する product 決定
- 共有 dev Supabase を Hook 本番相当で使うことを強制する場合（U-5）

---

## 参照

| ファイル | 用途 |
|----------|------|
| `auth-current-user.js` | Client claim 読取 |
| `supabase/migrations/20260621140000_match_rls_d2_talk_user_id_draft.sql` | RLS helper |
| `supabase/functions/_shared/match-auth.ts` | Edge claim 抽出 |
| `reports/auth-jwt-design-final.md` | TASFUL 全体 JWT 固定 |
| `reports/match-local-edge-smoke-result.md` | LOCAL_EDGE_SMOKE_PASS |
