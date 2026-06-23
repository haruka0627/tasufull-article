# TASFUL — Auth Hook linked ref L0 READ-ONLY 棚卸し結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21**（UTC クエリ実行 · ローカル作業環境） |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 方法 | `npx supabase db query --linked` · **SELECT のみ** |
| 前提 | `tasful-auth-hook-linked-ref-phased-checklist.md` §L0 |
| 運用コンテキスト | 利用者 0（公開前）· 10 月公開予定 · 現状は開発者のみ · linked ref = 開発兼本番予定 |
| 本セッション | **書込・Dashboard · Hook · migration 適用なし** |

---

## 1. 接続先 ref 確認

| # | 確認項目 | 結果 |
|---|----------|------|
| C1 | CLI linked DB 接続 | **成功**（`supabase db query --linked`） |
| C2 | Client 設定 ref | `chat-supabase-config.js` → `https://ddojquacsyqesrjhcvmn.supabase.co` |
| C3 | anon JWT `ref` claim | `ddojquacsyqesrjhcvmn`（`chat-supabase-config.js` anonKey decode） |
| C4 | 本書実行による SQL 適用 | **なし**（READ-ONLY のみ） |
| C5 | Custom Access Token Hook 関数 | **`pg_proc` 0 件** · DB 上未 CREATE |
| C6 | `tasful.jp` / Pages 変更 | **本セッション未実施** · repo 上 config は従来どおり linked ref |
| C7 | repo `supabase/migrations/202606211*.sql` | **linked DB 未適用**（`match_*` テーブル 0 · `match_current_user_id` 無） |

**結論:** 接続先は **`ddojquacsyqesrjhcvmn` で一致**。Auth Hook migration / MATCH 草案 migration は **未適用**。

---

## 2. 実施した READ-ONLY クエリ一覧

| # | 目的 | 概要 |
|---|------|------|
| Q1 | auth 集計 | `auth.users` 件数 · metadata 有無 |
| Q2 | auth 明細 | 全 7 ユーザー email · app/user metadata 主要列 |
| Q3 | 重複 | `app_metadata.talk_user_id` GROUP BY HAVING count>1 |
| Q4 | Hook 関数 | `pg_proc` `%custom_access_token%` / `%access_token_hook%` |
| Q5 | MATCH テーブル | `information_schema` `match_%` |
| Q6 | 行数 | `transaction_rooms` · `transaction_reads` · `listings` · `business_listings` · `profiles` · `members` |
| Q7 | TALK ID | `transaction_rooms` buyer_id / seller_id  distinct |
| Q8 | UUID vs text | buyer/seller regex 集計 |
| Q9 | Marketplace | `listings.user_id` · `owner_id` · `business_listings.user_id` |
| Q10 | profiles / members | 全行（4 件ずつ · テストデータ） |
| Q11 | Builder | builder_* テーブル一覧 · evaluations 列調査 |
| Q12 | RLS | `pg_policies` 主要テーブル · `relrowsecurity` |
| Q13 | metadata ギャップ | `member_id` あり · `talk_user_id` NULL |
| Q14 | transaction_reads | `user_id` distinct |
| Q15 | u_me 詳細 | `auth.users` 1 行 metadata 構造 |

**再利用:** `sql/auth-hook-l0-inventory-readonly.sql`（一部テーブル不存在時は個別クエリに分割実行）

---

## 3. auth.users 棚卸し結果

### 3.1 集計

| 指標 | 値 |
|------|-----|
| **total_users** | **7** |
| `@tasful.invalid` email | **0** |
| email に `test` / `demo` 含む | **7**（すべて `@tasful-dev.test`） |
| `app_metadata.talk_user_id` あり | **4** |
| `app_metadata.member_id` あり | **7** |
| `user_metadata.talk_user_id` あり | **4** |

### 3.2 ユーザー一覧（READ-ONLY · テスト/dev ドメイン）

| email | auth uuid | app `talk_user_id` | app `member_id` | app `role` | user_meta `talk_user_id` | 備考 |
|-------|-----------|-------------------|-----------------|------------|--------------------------|------|
| talk-rls-worker@tasful-dev.test | `0f106b57-…` | `u_worker` | `u_worker` | — | `u_worker` | TALK RLS テスト |
| talk-rls-admin@tasful-dev.test | `9d9bd0bb-…` | `u_admin` | `u_admin` | `tasu_admin` | `u_admin` | admin テスト |
| talk-rls-b@tasful-dev.test | `15bb209a-…` | `u_store` | `u_store` | — | `u_store` | |
| talk-rls-a@tasful-dev.test | `a4a111ca-…` | **`u_me`** | `u_me` | — | **`u_me`** | demo ID · client config と一致 |
| anpi-rls-admin@tasful-dev.test | `b77481c9-…` | **NULL** | `anpi_rls_admin` | `tasu_admin` | NULL | **talk 欠落** |
| anpi-rls-b@tasful-dev.test | `c8476454-…` | **NULL** | `anpi_rls_member_b` | — | NULL | **talk 欠落** |
| anpi-rls-a@tasful-dev.test | `72d07af0-…` | **NULL** | `anpi_rls_member_a` | — | NULL | **talk 欠落** |

**所見**

- 公開前・開発者のみ利用との方針に対し、Auth 上は **RLS/ANPI 検証用 7 アカウント**が残存（本番一般ユーザーではない）。
- **`@tasful.invalid` Auth Hook 用アカウントは未作成** → L2 で T1–T5 新規作成方針どおり。
- **`app_metadata.talk_user_id` 重複:** Q3 → **0 件**（ゲート PASS）。

---

## 4. app_metadata / user_metadata 状態

| 項目 | 状態 |
|------|------|
| **正（将来）:** claim 源 = `app_metadata` のみ | 4 ユーザーは app に `talk_user_id` 済 |
| **D-4 逸脱:** `user_metadata.talk_user_id` | **4 ユーザー**に **重複設定**（talk-rls 4 件） |
| **member_id のみ:** `talk_user_id` NULL | **3 ユーザー**（anpi-rls 3 件 · `member_id` は text 別 ID） |
| **`is_ops` in app_metadata** | **全員 NULL**（admin は `role=tasu_admin` のみ 2 件） |
| **provider** | 全員 email · `app_metadata.providers` |

**JWT への影響（Hook OFF 現状）**

- Supabase は **`app_metadata` を access token JWT に埋込**するため、4 ユーザーは **refresh 後 JWT に `talk_user_id` が載る可能性あり**（Hook 無しでも）。
- 3 anpi ユーザーは **`talk_user_id` 欠落** → U-7 P1 WARN 対象になりうる（L6 以降）。

**L3 方針との整合**

- T1 は **新規 `@tasful.invalid`** · 既存 7 件は **allowlist 外**（触らない）で問題なし。
- 将来 cohort 拡大（L7）前に: anpi 3 件の **`talk_user_id` = `member_id` 同期**または **検証専用のまま除外**を product 判断。

---

## 5. 既存 TASFUL ID 棚卸し結果

### 5.1 テーブル行数

| テーブル | 行数 | RLS |
|----------|------|-----|
| transaction_rooms | 11 | **ENABLED** |
| transaction_reads | 12 | （rooms 経由） |
| listings | 27 | **ENABLED** |
| business_listings | 5 | （policies あり） |
| profiles | 4 | **ENABLED** |
| members | 4 | **ENABLED** |
| match_* | **0 テーブル** | 未導入 |

### 5.2 TALK — text ID 運用

| ソース | distinct text ID | 件数 |
|--------|------------------|------|
| buyer_id | **`u_me`** | 11 rooms |
| seller_id | **`u_hiro`** | 11 rooms |
| transaction_reads.user_id | `u_me`, `u_hiro` | — |

| UUID 形式 buyer/seller | text 形式 |
|--------------------------|-----------|
| 0 | **11 / 11** |

**結論:** TALK 業務 ID は **UUID ではなく text**（`u_me` · `u_hiro` 等）。

### 5.3 Marketplace

| ソース | distinct ID | 備考 |
|--------|-------------|------|
| listings.user_id | **`u_me`** × 27 | 全 listing が同一テスト seller |
| listings.owner_id | **空** × 27 | owner_id 未使用 |
| business_listings.user_id | `u_me` × 4 · `00000000-0000-4000-b000-000000000001` × 1 | text + 固定 UUID 混在 |

### 5.4 profiles / members

| user_id（text） | 用途 |
|-----------------|------|
| `u_me`, `u_sachi`, `u_hiro`, `u_store` | テスト用プロフィール / メンバー |

### 5.5 Builder

| テーブル | 備考 |
|----------|------|
| builder_partner_evaluations | 存在 · user 列名は L0 未詳細（空列調査） |
| builder_partner_status_events | 存在 |
| builder_partner_visibility | 存在 |

**結論:** Builder 関連テーブルは **存在** · Auth Hook allowlist 用の `applications.user_id` 相当は **未棚卸し（L7 前に再確認）**。

### 5.6 Auth UUID ↔ text ID マッピング（現状）

| auth email | app talk_user_id | TALK/Marketplace 行 |
|------------|------------------|---------------------|
| talk-rls-a | `u_me` | rooms buyer · listings · profiles |
| talk-rls-b | `u_store` | profiles `u_store` |
| talk-rls-admin | `u_admin` | — |
| talk-rls-worker | `u_worker` | — |
| anpi-* | NULL | member_id は anpi_rls_* |

---

## 6. demo / fallback ID 確認

| ID / パターン | 出現箇所 |
|---------------|----------|
| **`u_me`** | auth `talk-rls-a` · TALK buyer · listings ×27 · profiles · members · `chat-supabase-config.js` `currentUserId` |
| **`u_hiro`** | TALK seller · profiles · members |
| **`u_store`**, **`u_sachi`**, **`u_admin`**, **`u_worker`** | auth / profiles / members テスト |
| **`stub-user-current`** | **DB 上なし**（Edge stub のみ · repo） |
| **`@tasful.invalid`** | **auth 上なし** |

**方針整合**

- 公開前開発環境として **demo text ID 中心のテストデータ**が DB に残存。
- Auth Hook T1–T5 は **`u_auth_test_*` / 新規 `@tasful.invalid`** で **既存 `u_me` と分離**（phased checklist §2）。
- 本番 host fallback **`u_me` 禁止**方針は維持 · localhost UI のみ。

---

## 7. Hook / JWT 前提確認

| # | 項目 | 結果 |
|---|------|------|
| H1 | `custom_access_token_hook` DB 関数 | **不存在** |
| H2 | Dashboard Hook 有効化 | **DB 上は未 CREATE のため Postgres Hook は未設定相当** · Dashboard 実状態は **L1 スクショで記録推奨** |
| H3 | repo Auth Hook migration | **未適用** |
| H4 | JWT に `talk_user_id` 未投入前提 | **部分的中** — 4/7 ユーザーは **既に app_metadata 済** · refresh で JWT 載る想定 |
| H5 | app_metadata に claim 元を置けるか | **可** — 7/7 に `app_metadata` オブジェクトあり · merge 運用可能 |
| H6 | MATCH `202606211*.sql` | **未適用** |
| H7 | TALK RLS | **ENABLED** · participant policies 存在 |

**結論:** Hook **未有効 · 未 CREATE**。L5/L6 前に **Hook migration + Dashboard OFF/ON 手順**どおり。現状でも **metadata 先行**（L3）は技術的に可能。

---

## 8. L1 backup 対象（次フェーズ · 本 L0 では backup 未実施）

### 8.1 必須（§4.1 相当）

| 優先 | 対象 | 理由 |
|------|------|------|
| P0 | **Supabase Dashboard backup / PITR 有無** | L6 Hook SPOF 前 |
| P1 | **`auth.users` 全 7 行** — `id, email, raw_app_meta_data, raw_user_meta_data, updated_at` | backfill rollback |
| P2 | **mapping CSV**（L0 結果 + allowlist T1–T5 計画） | 監査 |
| P3 | **Dashboard スクショ** — Auth Hooks · URL · Email providers | 設定 baseline |
| P4 | **rollback SQL 草案** — Hook DROP · metadata revert | ops |
| P5 | **Edge Functions リビジョン一覧** | L8 前 |

### 8.2 推奨（テストデータ · 小規模）

| 対象 | 行数 | 理由 |
|------|------|------|
| transaction_rooms | 11 | TALK ID 整合 |
| transaction_reads | 12 | 付随 |
| listings | 27 | Marketplace seller |
| business_listings | 5 | |
| profiles | 4 | text user_id |
| members | 4 | |
| pg_policies（public 主要） | export | RLS revert 参照 |

### 8.3 不要 / 禁止

| 対象 | 理由 |
|------|------|
| チャット本文 bulk | 最小原則 · L0 未収集 |
| KYC 画像 / storage | match 未導入 · 本 DB 最小 |
| service_role / JWT secret 平文 | secrets 管理表のみ |

### 8.4 migration 状態 baseline

| 項目 | L0 状態 |
|------|---------|
| `supabase_migrations.schema_migrations` | **テーブル不存在**（CLI migration 履歴テーブル未使用） |
| repo `supabase/migrations/202606211*.sql` | **3 ファイル · 未適用** |
| 適用履歴 | **手動 SQL（`sql/` 配下）で構築済み** · L1 で `sql/` 適用済み一覧と突合推奨 |

---

## 9. リスク

| リスク | 深刻度 | L0 所見 |
|--------|--------|---------|
| linked ref 単一 Auth SPOF | 高 | Hook ON は全ユーザー token 経路 · L6 窗口 + rollback 必須 |
| TALK RLS 既適用 | 中 | claim 順位 · `verify-talk-rls-staging.mjs` を L6 前再実行 |
| `user_metadata.talk_user_id` 残存 | 中 | D-4 違反 · Hook は app のみ参照設計 · **将来 user_meta 削除検討** |
| anpi 3 件 `talk_user_id` NULL | 中 | L6 U-7 WARN ログ対象 · L7 前に同期 or 除外 |
| demo `u_me` が auth+DB 中心 | 中 | T1 新規 ID と **混同禁止** |
| 既存 4 件が metadata 済 | 低 | L3 T1 新規作成なら **allowlist 分離**で影響限定 |
| MATCH 未導入 | 低 | L10/L11 は Auth ゲート後 |
| migration 履歴テーブル無 | 低 | L1 で適用 SQL 一覧を手動エクスポート |

---

## 10. 次ステップ

| 順 | フェーズ | 作業 |
|----|----------|------|
| **1** | **L1** | §8 backup baseline 実行 · Dashboard Hooks スクショ |
| 2 | **L2** | T1–T5 **`@tasful.invalid` 新規作成** · UUID を repo 外管理表へ |
| 3 | **L3** | **T1 のみ** Admin API backfill（allowlist 外の既存 7 件は **不変**） |
| 4 | **L4** | JWT refresh 実測 |
| 5 | — | anpi 3 件 / user_metadata 重複 — **L6 前** product 判断（除外 or `talk_user_id:=member_id`） |

**L0 ゲート（phased checklist）**

| 項目 | 結果 |
|------|------|
| mapping ベースライン | **本レポート §3–§5** |
| `talk_user_id` 重複 | **0 · PASS** |
| allowlist 方針 | **T1 新規 `@tasful.invalid` · 既存ユーザー非使用 · PASS** |
| Hook / migration 未適用 | **PASS** |

---

## 11. 判定

### **READY_FOR_LINKED_REF_L1_BACKUP**

**理由**

- linked ref `ddojquacsyqesrjhcvmn` への READ-ONLY 接続 · 棚卸し **完了**
- auth / TALK / Marketplace / profiles / members / Hook 前提を **実測**
- 重複 `talk_user_id` **なし** · MATCH/Hook 草案 migration **未適用**
- L1 backup 対象を **具体化**（§8）
- 書込 · Dashboard · Hook · RLS 変更 **なし**

### **L0_NEEDS_DECISION（L1 を阻害しない · L2/L6 前に推奨）**

| ID | 論点 | 推奨 |
|----|------|------|
| D-L0-1 | anpi 3 ユーザーの `talk_user_id` | L7 まで **allowlist 外・触らない** · または `talk_user_id := member_id` |
| D-L0-2 | 既存 4 件の `user_metadata.talk_user_id` | Hook 設計どおり **参照しない** · 余裕があれば user_meta から削除 |
| D-L0-3 | Supabase Pro PITR | L1 B1 で Dashboard 確認 |

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-hook-linked-ref-phased-checklist.md` | L0–L12 |
| `sql/auth-hook-l0-inventory-readonly.sql` | 再利用 READ クエリ |
| `chat-supabase-config.js` | client ref 確認 |
