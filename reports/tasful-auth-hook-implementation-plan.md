# TASFUL — Auth Hook / JWT Claim 実装計画

| 項目 | 内容 |
|------|------|
| 版 | v1.0（実装計画のみ） |
| 作成日 | 2026-06-21 |
| ステータス | 未実施 · コード / Supabase / Hook / DB / UI 変更なし |
| 前提 | `tasful-auth-hook-jwt-claim-design.md`, `match-rls-d2-talk-user-id-draft-review.md`, `match-edge-jwt-design.md`, `match-local-edge-smoke-result.md` |
| 判定入力 | `READY_FOR_AUTH_HOOK_IMPLEMENTATION_PLAN` |
| 採用案 | **A: `app_metadata.talk_user_id` + Custom Access Token Hook** |

---

## 0. 目的

`talk_user_id` を Supabase access token JWT に **安全に載せる**ため、Hook 導入 · backfill · 検証 · rollback · RLS/Edge 順序を **実行可能な手順**に落とす。

**不変方針（本計画全体）**

- `user_metadata` は使わない · `auth.uid()` を MATCH/TALK 業務 user_id にしない
- `x-match-user-id` は本番で信用しない
- RLS D2（`20260621140000`）は **JWT claim 実測ゲート通過後**
- **MATCH 新機能追加は凍結継続**（Auth/Hook 横断のみ）

---

## 1. 実装前提

| 項目 | 状態 |
|------|------|
| 設計固定 | `auth-jwt-design-final.md` D-1〜D-15 · 本 repo 設計レビュー一式 |
| MATCH Edge stub | `LOCAL_EDGE_SMOKE_PASS` · JWT stub 整合済み |
| RLS D2 草案 | `match_current_user_id()` = JWT coalesce · **未適用** |
| Custom Access Token Hook | **未デプロイ** |
| `member_identities` テーブル | **未作成**（DDL 草案は P1-A2） |
| Docker（ローカル `supabase functions serve`） | 開発機 **未導入** · Deno smoke router で代替済み |

### 1.1 Supabase プロジェクト ref（現状）

| 区分 | ref / URL | リポジトリ上の扱い |
|------|-----------|-------------------|
| **linked / 実運用 DB** | `ddojquacsyqesrjhcvmn` · `https://ddojquacsyqesrjhcvmn.supabase.co` | `chat-supabase-config.js` · auth-step8〜10 レポート |
| **専用 staging ref** | **未確認 · 未文書化** | P1-A2 は「別 project 推奨」 |

**結論:** 現時点では **staging 専用 ref が repo 上存在しない**。本計画は **staging-first を原則**とし、専用 ref 無しの場合は §5 の最小リスク手順にフォールバックする。

---

## 2. 実装しないこと（本計画フェーズ含む）

| 禁止 | 理由 |
|------|------|
| 本番 `tasful.jp` Pages / DNS 変更 | スコープ外 |
| MATCH UI `edge_stub` デフォルト化 | 凍結 |
| `user_metadata.talk_user_id` | 改ざん可能 |
| RLS enable / policy 本適用 | claim ゲート前 |
| `auth-current-user.js` 本番 fallback 緩和 | 既存方針維持 |
| TALK / Builder / Marketplace Edge 本体改修 | 影響分離 |
| client への service_role | セキュリティ |
| remote MATCH Function deploy（Auth 作業と混同しない） | 別ゲート |

---

## 3. 推奨導入順（全体）

```text
Phase 0  DRY-RUN（Dashboard 変更なし · 本計画の次ステップ）
    ↓
Phase 1  棚卸し · mapping · テストユーザー選定
    ↓
Phase 2  member_identities DDL（任意 · staging のみ）
    ↓
Phase 3  app_metadata backfill（staging · テストユーザー → 段階拡大）
    ↓
Phase 4  Custom Access Token Hook deploy（staging · 限定有効化）
    ↓
Phase 5  JWT 実測 · token refresh · TasuAuthCurrentUser 一致
    ↓
Phase 6  Edge verifyJwt 本実装（MATCH 先行 · staging）
    ↓
Phase 7  Edge smoke 再実行（署名付き JWT）
    ↓
Phase 8  RLS D2 migration 適用（MATCH · staging）
    ↓
Phase 9  横断回帰（TALK RLS 等 · staging）
    ↓
Phase 10 本番 ref（infra 合意 · 監視 · rollback 待機）
```

**MATCH 凍結:** Phase 0–7 は Auth/Hook/Edge 横断 · Phase 8 以降で MATCH RLS のみ再開。

---

## 4. staging-first 手順

### 4.1 理想（専用 staging ref あり）

| 順 | 作業 | 成果物 |
|----|------|--------|
| S1 | 新規 Supabase project（staging ref）作成 | ref 文書化 |
| S2 | staging 用 anon/service_role secrets（CI のみ · repo 不入） | secrets 管理表 |
| S3 | staging に auth テストユーザー 3〜5 作成 | ユーザー一覧 |
| S4 | backfill · Hook · 検証を **staging ref のみ**で完遂 | エビデンスレポート |
| S5 | 本番 ref へは S4 成功後に **同一手順をコピー** | 本番 runbook |

### 4.2 staging ref 作成時の設定

| 項目 | 方針 |
|------|------|
| `chat-supabase-config.js` | **本番ファイルは触らない** · staging 検証は env / ローカル上書きのみ |
| DB データ | TALK/MATCH 最小 seed または anonymized subset |
| Hook | staging Dashboard のみ enable |
| 本番 JWT secret | staging と **共有しない** |

---

## 5. 本番 ref（`ddojquacsyqesrjhcvmn`）で検証する場合の最小リスク手順

**専用 staging が無い場合のフォールバック。** Hook 有効化前に **必ず Phase 0 dry-run** を完了する。

| 順 | 手順 | リスク低減 |
|----|------|------------|
| P0 | **Dry-run** — mapping / Hook 仕様 / rollback 文書 · Dashboard **変更なし** | §12 |
| P1 | **テストユーザー限定** — 本番 Auth ユーザー全体に backfill しない | 影響半径最小 |
| P2 | **metadata のみ先行** — Hook **OFF** のまま Admin API で 1 ユーザー `app_metadata` 更新 | 既存 JWT 埋込確認 |
| P3 | **refresh 実測** — 当該ユーザーのみ `refreshSession` · JWT decode | lag 確認 |
| P4 | **Hook staging 相当** — メンテ時間帯 · 監視 · **即 disable 手順待機** | §12 |
| P5 | **段階拡大** — 10 → 100 → 全量（各段階でゲート §11） | ロールバック可能単位 |
| P6 | **RLS D2 禁止** — Hook + claim ゲート未達の間は MATCH RLS **適用しない** | 全拒否回避 |

| 追加安全策 | 内容 |
|------------|------|
| 変更窗口 | 低トラフィック帯 · 担当 2 名以上 |
| 監視 | Auth error rate · Edge 5xx · login 失敗率 |
| 通信 | `#ops-auth` 等で Hook ON/OFF 宣言 |
| 共有 DB 注意 | TALK RLS 既適用 — **talk 系ポリシーは claim 順位と整合**済みか `verify-talk-rls-staging.mjs` で再確認 |

**product/infra 判断:** 共有 ref で Hook を触るか · 専用 staging を先に作るか → §14 U-5。

---

## 6. Hook 実装案

### 6.1 推奨: ハイブリッド（A0 metadata + A1 Hook）

| 層 | 実装 | 担当 |
|----|------|------|
| 永続 | Admin API / signup Edge で `app_metadata` 設定 | backfill バッチ |
| 発行 | Custom Access Token Hook | 毎 token で claim 保証 |

### 6.2 実装形態比較（U-1 解消）

| 形態 | 概要 | メリット | デメリット | 推奨 |
|------|------|----------|------------|------|
| **H1: Postgres Hook** | `auth` スキーマ SQL function · Supabase 標準 | 低レイテンシ · Edge 依存少 | `member_identities` lookup は SQL 内 | **Phase 1 推奨** |
| **H2: HTTP Hook → Edge Function** | Auth が Edge を呼び claim マージ | DB/外部 lookup 柔軟 | 障害点増 · 冷起動 | member_identities 必須時 |
| **H3: metadata のみ（Hook 無）** | 案 B | 最�simple | refresh lag · ops 同期弱 | **移行期のみ** |

**推奨パス:** **H1（Postgres Hook）** で開始。`member_identities` 導入後に H1 内 JOIN または H2 へ拡張。

### 6.3 Hook 責務（疑似コード · 実装は dry-run 後）

```sql
-- 概念のみ · 本計画では適用しない
-- 入力: event.claims (sub 等)
-- 1) auth.users から app_metadata 読込
-- 2) talk_user_id 欠落 → member_identities lookup (将来)
-- 3) 欠落 → raise / ログ（本番 login 拒否 vs staging warn は dry-run で決定）
-- 4) member_id := talk_user_id, is_ops/role 同期
-- 5) claims を返却（user_metadata は触らない）
```

| 禁止 | 理由 |
|------|------|
| client 入力 claims を信頼 | 改ざん |
| `user_metadata` から talk_user_id 読取 | D-4 |
| `sub` を talk_user_id として返却 | ID 空間不一致 |

### 6.4 Dashboard 設定（実施フェーズ · 今回は記載のみ）

| 設定 | 値 |
|------|-----|
| Authentication → Hooks | Custom Access Token Hook = **Postgres function 名** |
| Enable | staging / テスト窗口のみ |
| Secrets | service_role は Hook 内のみ · repo 不入 |

---

## 7. app_metadata backfill 案

### 7.1 棚卸し（Phase 1 · read-only）

| ソース | 確認内容 |
|--------|----------|
| `auth.users` | 件数 · 既存 `app_metadata` キー |
| TALK `transaction_rooms` |  distinct `buyer_id`, `seller_id` |
| Marketplace `listings` | distinct `user_id` |
| Builder 参加者列 | `applications.user_id` 等 |
| demo | `u_me` 等の出現箇所（本番禁止確認） |

### 7.2 mapping 生成

| 列 | 説明 |
|----|------|
| `auth_user_id` (uuid) | `auth.users.id` |
| `email` | 照合用 |
| `proposed_talk_user_id` | 既存 TALK 行 or 新規 `u_*` |
| `source` | `talk_room` / `listing` / `new_issue` / `manual` |
| `confidence` | high / medium / manual_review |

**ルール**

- 1 auth ユーザー → 1 `talk_user_id`（UNIQUE）
- TALK 既存 text ID を **優先**（新規 UUID マッピングは避ける）
- 曖昧行は **自動 backfill しない**（manual_review）

### 7.3 実行（Phase 3 · staging）

| 順 | 作業 |
|----|------|
| B1 | dry-run CSV レビュー（**書込なし**） |
| B2 | テストユーザー 1 件 Admin API `updateUserById` · metadata merge |
| B3 | JWT decode 確認（Hook OFF でも metadata 埋込） |
| B4 | テストユーザー 3〜5 件 |
| B5 | 段階拡大（§5 P5） |

**Admin API 更新例（概念）**

```json
{
  "app_metadata": {
    "talk_user_id": "u_xxxx",
    "member_id": "u_xxxx",
    "role": "authenticated",
    "platform_role": "member",
    "is_ops": false
  }
}
```

| 注意 |
|------|
| **merge** 既存 `app_metadata` · 上書き誤り防止 |
| service_role **サーバ/CI のみ** |
| backfill スクリプトは repo に **secrets 不含** |

---

## 8. 検証 SQL 案（read-only · staging · dry-run 可）

**JWT 実測は authenticated セッションが必要。** SQL は **claim 関数の unit 相当**と **DB 整合**用。

### 8.1 mapping 整合（backfill 前後）

```sql
-- 草案 · 実行は staging DBA/ops · 本計画では適用しない

-- TALK 側 text ID の母集団
select distinct buyer_id as talk_user_id from public.transaction_rooms where buyer_id is not null
union
select distinct seller_id from public.transaction_rooms where seller_id is not null;

-- Marketplace seller 母集団（例）
select distinct user_id as talk_user_id from public.listings where user_id is not null;
```

### 8.2 RLS helper 相当（migration 適用 **後** · staging）

```sql
-- ログインセッションコンテキストで実行（authenticated role）
select public.match_current_user_id() as match_uid;

-- 期待: app_metadata.talk_user_id と一致 · NULL ならゲート失敗
```

### 8.3 auth.users metadata 監査（service_role · read）

```sql
-- 草案
select
  id,
  email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id
from auth.users
order by created_at desc
limit 50;
```

### 8.4 クライアント側（非 SQL）

| 方法 | 確認 |
|------|------|
| JWT decode（jwt.io 禁止 · ローカル script） | `app_metadata.talk_user_id` 存在 |
| `TasuAuthCurrentUser.getCurrentUser()` | `talkUserId` = JWT |
| TALK ルーム参加 | `buyer_id`/`seller_id` = talkUserId |

---

## 9. token refresh 確認

| ステップ | 操作 | 期待 |
|----------|------|------|
| R1 | backfill 直後 · **旧 token** decode | 旧 claim の可能性あり |
| R2 | `supabase.auth.refreshSession()` | 新 access token |
| R3 | 新 token decode | `app_metadata.talk_user_id` 存在 |
| R4 | Hook ON 後 R2 再実行 | Hook 出力と metadata 一致 |
| R5 | Postgres `auth.jwt()`（SQL クライアント） | coalesce 第一候補が期待 ID |

**ゲート:** R3/R4/R5 が **同一 talk_user_id** · NULL なし。

**運用:** backfill 後リリースノートに **再ログイン推奨**（silent refresh 失敗端末対策）。

---

## 10. Edge smoke 再実行手順

**前提:** Phase 6 `verifyJwt` 本実装後 · staging Functions + **署名付き** Supabase JWT。

| 順 | 作業 |
|----|------|
| E1 | Docker 導入（任意）または staging remote Functions URL |
| E2 | `match-auth.ts`: `decodeJwtPayloadStub` → `verifyJwt` + `extractTalkUserIdFromClaims` |
| E3 | テストユーザー JWT で `node scripts/test-match-local-edge-smoke.mjs` 拡張版（**新 script 案** · dry-run 後） |
| E4 | `Authorization: Bearer <real access_token>` · `x-match-user-id` **送信しない** |
| E5 | admin: JWT `is_ops` / `tasu_admin` · `x-match-admin` **本番 OFF** |
| E6 | 結果を `reports/match-staging-edge-smoke-result-signed-jwt.md` に記録 |

**LOCAL_EDGE_SMOKE_PASS との差:** stub token / 署名なし JWT → **Supabase 発行 JWT** に置換。

---

## 11. RLS D2 migration 適用前ゲート

`20260621140000_match_rls_d2_talk_user_id_draft.sql` は以下 **すべて PASS** まで適用禁止。

| # | ゲート | 確認方法 |
|---|--------|----------|
| G1 | JWT に `talk_user_id` | token decode · `auth.jwt()` |
| G2 | JWT = `TasuAuthCurrentUser.talkUserId` | browser / script |
| G3 | JWT = TALK `buyer_id`/`seller_id` | SQL + session |
| G4 | JWT = `match_profiles.user_id`（seed 後） | SQL |
| G5 | Edge `requireUser` = 同一 ID | signed JWT smoke |
| G6 | Hook ON · refresh 後も維持 | §9 |
| G7 | `match_current_user_id()` NULL ユーザー **0**（対象 cohort） | SQL cohort 監査 |

**順序（MATCH）**

```text
Hook + backfill ゲート (G1–G6)
  → 20260621120000 schema（未適用なら）
  → 20260621130000 RLS draft helpers
  → 20260621140000 D2 talk_user_id
  → （別 migration）RLS ENABLE + policies
  → RLS 統合テスト
```

**Edge requireUser 順序:** G5（Edge verify + claim 抽出）が **RLS D2 より先**。現 stub は LOCAL 済み · verify 本実装が G5 の本体。

---

## 12. rollback

### 12.1 Hook 無効化（最優先 · 1 分以内目標）

| 順 | 操作 |
|----|------|
| 1 | Supabase Dashboard → Authentication → Hooks → **Custom Access Token Hook OFF** |
| 2 | Auth error / login 率を確認 |
| 3 | 影響継続 → §12.3 エスカレーション |

**Hook OFF 後の JWT:** Supabase 標準 claim（`app_metadata` は **Hook 無でも** JWT に含まれる · backfill 済みなら talk_user_id 残る）。Hook 障害と metadata 欠落を混同しない。

### 12.2 backfill rollback

| ケース | 手順 |
|--------|------|
| 単一ユーザー誤 mapping | Admin API で `talk_user_id` 修正 + refresh |
| バッチ誤り | 影響 uuid リストから **正 mapping CSV** で再 upsert |
| 新規誤発行 ID | TALK 行未作成なら metadata 削除可 · **作成済み行がある場合は ID 変更禁止**（データ修正 PR） |

### 12.3 RLS D2 rollback

| 順 | 操作 |
|----|------|
| 1 | RLS ENABLE した migration を revert（別ファイル想定） |
| 2 | `match_current_user_id()` を DROP または旧版に **戻す migration**（事前に rollback SQL 草案を dry-run で用意） |
| 3 | MATCH API client_stub 維持 · UI 影響なし |

### 12.4 Edge verify rollback

`match-auth.ts` を stub 版に revert · Functions redeploy（staging）。

---

## 13. 影響範囲

| 領域 | Hook/backfill 影響 | 本フェーズ作業 |
|------|-------------------|----------------|
| **Auth / JWT** | **直接** | Hook · metadata · refresh |
| **TALK** | JWT = buyer/seller · RLS 既存 | 整合テスト · JS 変更なし |
| **Marketplace** | listings.user_id | 同上 |
| **Builder** | talk_user_id · platform_role | metadata 同期 |
| **MATCH** | RLS D2 · Edge verify | 凍結 · G1 後に RLS |
| **安否** | member_id = talk_user_id | backfill 同値 |
| **Client UI** | 本番 fallback 禁止維持 | **変更なし** |
| **demo / LS** | localhost のみ demo | 本番影響なし |
| **Stripe / GenAI Edge** | service_role 独立 | Hook 対象外 |

---

## 14. demo user / localStorage fallback 整理

| 環境 | JWT claim | localStorage / URL fallback |
|------|-----------|----------------------------|
| **本番 host** | **必須** `app_metadata.talk_user_id` | **禁止**（現行維持） |
| **localhost / talkDev** | 未ログイン時 UI のみ | `u_me` 等 **表示用** · API 正ではない |
| **MATCH stub** | `stub-match-token` | ローカル smoke のみ |
| **staging テストユーザー** | Admin で `talk_user_id` 設定 | テスト専用アカウントに限定 |

**Hook 導入不会改变:** `TasuAuthCurrentUser.isProductionHost()` ロジック · demo fallback コードは **触らない**。

---

## 15. 未決事項

| # | 項目 | 推奨 | dry-run で決めるか |
|---|------|------|-------------------|
| U-5 | 専用 staging ref 作成 | **作成推奨** | infra 判断 · **Hook 有効化前** |
| U-1 | Hook H1 vs H2 | **H1 先行** | dry-run で SQL 草案レビュー |
| U-2 | 本番 `u_me` mapping | **禁止** · 新規 `u_*` | mapping CSV レビュー |
| U-7 | talk_user_id 欠落時 login 拒否 vs warn | staging **warn** · 本番 **拒否** 推奨 | dry-run |
| U-8 | backfill バッチ実装言語 | Node + Admin API（CI secrets） | 実装 PR |
| U-9 | Docker 導入（開発機） | 任意 · signed JWT ローカル serve 用 | 低 |

---

## 16. Phase 0 — DRY-RUN チェックリスト（次ステップ）

**Dashboard / DB 書込 / Hook 作成 すべて禁止。**

- [ ] mapping 棚卸し SQL 草案レビュー（§8 · **実行は ops 判断**）
- [ ] テストユーザー 3 名選定（email リスト · 本番ユーザー全体ではない）
- [ ] Postgres Hook SQL **草案** peer review（ファイル追加は次 PR）
- [ ] rollback / Hook OFF 手順の walkthrough（口頭/tabletop）
- [ ] U-5 staging ref 有無 · infra 回答
- [ ] `verify-talk-rls-staging.mjs` 計画再実行タイミング（backfill 後）
- [ ] 成果物: `reports/tasful-auth-hook-dry-run-result.md`（次フェーズ）

---

## 17. 最終判定

### **READY_FOR_AUTH_HOOK_DRY_RUN**

**理由**

- staging-first · 共有 ref 最小リスク · Hook 形態 · backfill · 検証 SQL · refresh · rollback · RLS/Edge 順序を手順化
- 次ステップ **Phase 0** は Dashboard/DB/Hook **変更なし**で開始可能
- MATCH 凍結 · 不変方針（user_metadata 禁止 · uid 禁止 · RLS ゲート後）を計画全体に反映

**NEEDS_DECISION が必要になるタイミング（dry-run 後 · Hook 有効化前）**

- **U-5:** 専用 staging ref を作らず `ddojquacsyqesrjhcvmn` で Hook を ON にするか（product/infra 承認）
- **U-7:** claim 欠落ユーザーの login 拒否ポリシー（本番）

dry-run 自体は上記未決でも **開始可能**。

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-hook-jwt-claim-design.md` | 採用案 A |
| `reports/match-rls-d2-talk-user-id-draft-review.md` | D2 ゲート |
| `reports/match-edge-jwt-design.md` | Edge / client 方針 |
| `reports/match-local-edge-smoke-result.md` | LOCAL_EDGE_SMOKE_PASS |
| `reports/auth-jwt-design-final.md` | P1-A2 全体 |
| `scripts/test-match-local-edge-smoke.mjs` | Edge smoke ベース |
