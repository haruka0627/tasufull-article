# P1-S1〜S4 Marketplace RLS 修正レビュー

**作成日:** 2026-06-17  
**種別:** 調査のみ（**SQL 未適用** · アプリ/UI 変更なし）  
**対象 DB:** `ddojquacsyqesrjhcvmn`（`chat-supabase-config.js` と一致）  
**対象テーブル:** `profiles` · `members` · `listings` · `business_listings`  
**目的:** dev policy による anon 全開放を解消するための修正方針を確定する

**参照:**

- [`supabase/setup_marketplace_listings.sql`](../supabase/setup_marketplace_listings.sql)
- [`supabase/members_profiles_rls_dev.sql`](../supabase/members_profiles_rls_dev.sql)
- [`reports/supabase-rls-final-audit.md`](supabase-rls-final-audit.md)
- [`reports/supabase-jwt-auth-final-check.md`](supabase-jwt-auth-final-check.md)
- [`reports/prelaunch-p1-backlog-review.md`](prelaunch-p1-backlog-review.md)

---

## 1. エグゼクティブサマリー

| 項目 | 判定 |
|------|------|
| **現状** | 4 テーブルとも **dev policy のみ**（`using (true)`）。本番 prod policy **未作成・未適用** |
| **anon 読取** | ❌ **全行読取可能**（実測） |
| **anon 書込** | ❌ listings / business_listings は **CRUD 全許可**（静的定義 + 過去監査） |
| **DROP のみで目的達成** | ⚠️ **anon 読取は止まるが、正当な公開読取も止まる** |
| **新 prod policy** | ✅ **必須**（公開一覧・詳細・出品者プロフィール表示を維持するため） |
| **推定工数** | **2〜3 人日**（SQL 設計 + 適用 + 検証脚本） |

**結論:** dev policy DROP は必須だが **単独では不十分**。TALK と同様に **`talk_current_user_id()` ベースの prod policy を先に作成・適用してから dev DROP** する。アプリ JS 変更は原則不要（FROZEN 非抵触）だが、**mock `u_me` + anon 直 POST** の開発導線は prod RLS 適用後に **Supabase Auth JWT（`talk_user_id` / `member_id` クレーム）必須**になる。

---

## 2. 現在の policy 一覧（リンク DB 実状態）

> 出典: [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) の `pg_policies` クエリ（2026-06-17）+ 本日 read-only REST プローブ

| テーブル | RLS | ポリシー数 | ポリシー名 |
|----------|-----|------------|------------|
| `listings` | ✅ | **4** | `listings_select_dev` · `listings_insert_dev` · `listings_update_dev` · `listings_delete_dev` |
| `business_listings` | ✅ | **4** | `business_listings_select_dev` · `business_listings_insert_dev` · `business_listings_update_dev` · `business_listings_delete_dev` |
| `profiles` | ✅ | **1** | `profiles_select_dev` |
| `members` | ✅ | **1** | `members_select_dev` |

**prod / staging 系ポリシー:** **0 件**（4 テーブルすべて）

**関連:** `users` テーブルは RLS 未有効（[`user_member_profile.sql`](../supabase/user_member_profile.sql)）。`listing-seller-profile.js` が `users` も SELECT するが、本 P1 スコープ外。

---

## 3. dev policy 一覧（定義詳細）

### 3.1 `listings` / `business_listings`

出典: [`supabase/setup_marketplace_listings.sql`](../supabase/setup_marketplace_listings.sql) §5

| ポリシー | 操作 | ロール | 条件 |
|----------|------|--------|------|
| `*_select_dev` | SELECT | **anon, authenticated** | `using (true)` |
| `*_insert_dev` | INSERT | **anon, authenticated** | `with check (true)` |
| `*_update_dev` | UPDATE | **anon, authenticated** | `using (true) with check (true)` |
| `*_delete_dev` | DELETE | **anon, authenticated** | `using (true)` |

コメント上も「開発用: anon / authenticated で読み書き可」「本番では user_id ベースのポリシーに差し替え」と明記。

### 3.2 `profiles` / `members`

出典: [`supabase/members_profiles_rls_dev.sql`](../supabase/members_profiles_rls_dev.sql)

| ポリシー | 操作 | ロール | 条件 |
|----------|------|--------|------|
| `profiles_select_dev` | SELECT | **全ロール**（`TO` 句なし） | `using (true)` |
| `members_select_dev` | SELECT | **全ロール** | `using (true)` |

INSERT / UPDATE / DELETE ポリシーなし → **deny**（ただし [`profile-settings.js`](../profile-settings.js) の upsert は dev 環境では別経路・将来 prod では write policy 要）

**再適用事故リスク:** 同一 dev CREATE が [`supabase/seed_u_me_rank_test.sql`](../supabase/seed_u_me_rank_test.sql) にも存在（P1-S12）。

---

## 4. prod policy 一覧

| テーブル | リポジトリ内 prod SQL | リンク DB 適用 |
|----------|----------------------|----------------|
| `listings` | **なし** | **なし** |
| `business_listings` | **なし** | **なし** |
| `profiles` | **なし** | **なし** |
| `members` | **なし** | **なし** |

TALK / 安否 / ops には [`sql/talk-rls-production.sql`](../sql/talk-rls-production.sql) 等の prod 定義があるが、**Marketplace 用 prod RLS ファイルは未作成**。

---

## 5. anon 読取可否

### 5.1 ライブ REST プローブ（2026-06-17 · read-only）

anon key = `chat-supabase-config.js` の公開 anon JWT

| テーブル | HTTP | 取得行数 | Content-Range（総件数） |
|----------|------|----------|-------------------------|
| `profiles` | 200 | 4 | **4** |
| `members` | 200 | 4 | **4** |
| `listings` | 200 | 10（limit） | **27** |
| `business_listings` | 200 | 5 | **5** |

### 5.2 読取可能データの機密度

| テーブル | anon が読める主な列 | リスク |
|----------|---------------------|--------|
| `listings` | `payment_url` · `bank_transfer_info` · `form_data`（JSONB）· **draft 行含む全行** | **High** |
| `business_listings` | 同上 + `phone` · `license_info` · `hp_url` | **High** |
| `profiles` | `display_name` · `avatar_url` · `last_seen_at` · `availability_status` · `work_hours` | **Medium**（行動・在席情報） |
| `members` | `rank` · `badge_image_url` · `is_premium` · `identity_verified` · `deals_count` · `followers_count` | **Medium** |

`fetchPublishedListings` はアプリ側で `publish_status = 'public'` を試すが、**RLS が `true` のため draft / scheduled も REST 直叩きで全取得可能**。

### 5.3 anon 書込（静的定義 · 過去監査）

| 操作 | listings | business_listings | profiles | members |
|------|----------|-------------------|----------|---------|
| SELECT | ✅ 全行 | ✅ 全行 | ✅ 全行 | ✅ 全行 |
| INSERT | ✅ | ✅ | ❌ | ❌ |
| UPDATE | ✅ | ✅ | ❌ | ❌ |
| DELETE | ✅ | ✅ | ❌ | ❌ |

※ listings / business_listings の anon INSERT/UPDATE/DELETE は dev policy 定義上 **許可**。任意 `user_id` へのなりすまし POST が理論上可能（本番データ改ざんリスク）。

---

## 6. authenticated 読取可否

dev policy は **authenticated にも同一条件**（listings / business_listings は CRUD 同等、profiles / members は SELECT 同等）。

| 観点 | 現状 | prod 適用後（想定） |
|------|------|---------------------|
| 他人の draft 読取 | ✅ 可能（dev） | ❌ 不可（owner + public のみ） |
| 公開 listing 読取 | ✅ | ✅（prod SELECT policy 要） |
| 自分の listing 一覧 | ✅ | ✅（`user_id = talk_current_user_id()`） |
| profiles / members | ✅ 全ユーザー | ✅ 公開プロフィール用途の SELECT（設計次第） |

**JWT 整合:** Marketplace の `user_id` は text（`u_sachi` 等）。オーナー判定には既存の [`talk_current_user_id()`](../sql/talk-rls-production.sql)（`talk_user_id` → `member_id` → `sub` フォールバック）の再利用が自然。mock `currentUserId: "u_me"` は **anon ロールのままでは prod RLS を満たせない**。

---

## 7. 検索一覧ページへの影響

### 7.1 データ取得経路

| ページ / 脚本 | 取得 API | `localFallback` | dev DROP のみ | dev DROP + prod 適用 |
|---------------|----------|-----------------|---------------|----------------------|
| [`ai-search.js`](../ai-search.js) | `fetchPublishedListings` / `fetchPublishedBusinessListings` | **true** | デモ + localStorage のみ | **Supabase 公開行 + デモ** |
| [`shop-market-search.js`](../shop-market-search.js) | `fetchPublishedBusinessListings` | **true** | 店舗デモ主体 | 公開 shop_store 行 + デモ |
| [`index-home.js`](../index-home.js) | `fetchPublishedListings`（`public_only: true`） | **true** | ホーム掲載 = デモ | 公開 listing + デモ |
| [`listing-category-page.js`](../listing-category-page.js) | 同上 | **false** | **Supabase 行ゼロ**（カテゴリ一覧が空） | 公開行のみ表示 |
| [`listing-feed.js`](../listing-feed.js) | `fetchPublishedListings` | デフォルト（client あり → false） | リモート空 | 公開行 |

### 7.2 判定

- **DROP のみ:** カテゴリ一覧（`localFallback: false`）は **即座に Supabase データ欠落**。AI 検索・店舗検索は **デモ混在で部分表示**（FROZEN デモは維持）。
- **DROP + prod（公開 SELECT）:** 現行 UX **維持可能**。draft は一覧に出ない（アプリの `public_only` と RLS が二重で効く）。

---

## 8. 店舗一覧への影響

| ページ | 脚本 | 取得 | DROP のみ | DROP + prod |
|--------|------|------|-----------|-------------|
| 店舗マーケット TOP | [`shop-market-top.js`](../shop-market-top.js) | `fetchPublishedBusinessListings` + デモ merge | デモのみ | 公開 business_listings + デモ |
| 店舗検索 | [`shop-market-search.js`](../shop-market-search.js) | 同上 | デモ主体 | 公開行 + デモ |
| 店舗ページ | [`shop-store-page.js`](../shop-store-page.js) | `localFallback: true` | デモ + local | 公開行 + デモ |
| 業者ボード | [`business-board-page.js`](../business-board-page.js) | business + board demo | デモ主体 | 公開行 + デモ |

**付随:** [`ai-search.js`](../ai-search.js) は `shop_store_products` も参照（別テーブル · 本 P1 スコープ外）。店舗 UUID が Supabase から取れない場合、商品ペアリングも弱くなる。

---

## 9. 商品詳細への影響

### 9.1 一般 listing（skill / product / job / worker）

[`listing-detail-loader.js`](../listing-detail-loader.js) → [`listings-db.js`](../listings-db.js) `fetchListingById`

```
Supabase UUID → REST SELECT
  ↓ 失敗
localStorage → DEMO_LISTING_BY_ID → TasuListingDemoCatalog
```

| シナリオ | DROP のみ | DROP + prod |
|----------|-----------|-------------|
| UUID · `publish_status = public` | デモ/local に無ければ **404 相当** | ✅ 表示 |
| UUID · draft | 現状 ✅ 表示（漏えい） | ❌ 非公開（意図通り） |
| デモ ID（`demo-*`） | デモ fallback ✅ | デモ fallback ✅ |

### 9.2 法人・店舗詳細

`fetchBusinessListingById` — listings と同型の fallback チェーン。

### 9.3 出品者プロフィール（詳細内）

[`listing-seller-profile.js`](../listing-seller-profile.js):

- `profiles` · `members` · `users` を anon SELECT
- 失敗時 → `DEMO_PROFILES` / `genericFallbackProfile()`

| シナリオ | DROP のみ | DROP + prod |
|----------|-----------|-------------|
| 既知デモ seller（`u_sachi` 等） | デモプロフィール ✅ | DB + デモ ✅ |
| 本番 UUID seller（DB のみ） | **fallback「出品者」** | prod SELECT で ✅ |
| 公開 listing 件数 | count クエリ失敗 → `—` | prod で ✅ |

---

## 10. 公開プロフィールへの影響

| 経路 | 依存 | DROP のみ | DROP + prod |
|------|------|-----------|-------------|
| 詳細ページ出品者カード | `listing-seller-profile.js` | デモ ID のみ完全 | 全公開 seller |
| TALK プロフィールモーダル | [`talk-profile.js`](../talk-profile.js) | 同上 | 同上 |
| `profile-public.html` リンク | talk-profile / chat-detail | **HTML 未同梱**（リンクのみ） | 将来ページ実装時に profiles/members SELECT 要 |
| 会員プロフィール保存 | [`profile-settings.js`](../profile-settings.js) `profiles.upsert` | **書込 deny のまま**（現状も write policy 無し） | **`profiles_update_owner` prod policy 要** |

**注意:** profiles / members は **行単位の公開フラグが無い**。prod 設計案:

1. **案 A（最小）:** anon/authenticated に SELECT 全許可（現状と同等だが draft listing ほど危険ではない）
2. **案 B（厳格）:** 公開 listing を持つ `user_id` のみ JOIN 許可（複雑 · 性能注意）
3. **案 C:** 公開用 VIEW + GRANT（列限定）

FROZEN 下の現実解は **案 A + listings 側で draft 秘匿**（payment 列は将来 VIEW 分 opcional）。

---

## 11. 推奨 prod policy 設計（未適用 · レビュー案）

**新規ファイル案:** `sql/marketplace-rls-production.sql`  
**DROP ファイル案:** `sql/marketplace-rls-drop-dev-policies.sql`

### 11.1 共通ヘルパー

既存 [`talk_current_user_id()`](../sql/talk-rls-production.sql) を再利用（新規関数不要）。

### 11.2 `listings` / `business_listings`

| ポリシー | 操作 | ロール | 条件（案） |
|----------|------|--------|------------|
| `*_select_public` | SELECT | anon, authenticated | `publish_status = 'public'` |
| `*_select_owner` | SELECT | authenticated | `user_id = talk_current_user_id()` |
| `*_insert_owner` | INSERT | authenticated | `user_id = talk_current_user_id()` |
| `*_update_owner` | UPDATE | authenticated | owner 一致 |
| `*_delete_owner` | DELETE | authenticated | owner 一致 |

- anon: **公開行の READ のみ**
- draft / scheduled: **owner のみ**（JWT 必須）
- admin 例外は TALK 同様 `talk_is_admin()` 追加可

### 11.3 `profiles`

| ポリシー | 操作 | ロール | 条件（案） |
|----------|------|--------|------------|
| `profiles_select_public` | SELECT | anon, authenticated | `true`（案 A） |
| `profiles_insert_owner` | INSERT | authenticated | `user_id = talk_current_user_id()` |
| `profiles_update_owner` | UPDATE | authenticated | owner 一致 |

### 11.4 `members`

| ポリシー | 操作 | ロール | 条件（案） |
|----------|------|--------|------------|
| `members_select_public` | SELECT | anon, authenticated | `true`（案 A） |
| `members_upsert_owner` | INSERT/UPDATE | authenticated | owner 一致 |

### 11.5 適用順（推奨）

```text
1. sql/marketplace-rls-production.sql     ← prod CREATE
2. sql/marketplace-rls-drop-dev-policies.sql  ← dev DROP
3. anon / authenticated REST プローブ
4. scripts/verify-marketplace-rls.mjs   ← 新規検証（未作成）
5. 既存 E2E: verify-market-pages-cross.mjs 等
```

---

## 12. 最終回答

### 12.1 DROP だけで済むか？

**❌ いいえ（目的の半分のみ）。**

| 効果 | DROP のみ |
|------|-----------|
| anon 全行 READ 停止 | ✅ |
| anon CRUD 停止（listings） | ✅ |
| 公開マーケットプレイス表示 | ❌ **Supabase データ全欠落** |
| 会員の my-listings / 投稿 | ❌ **authenticated も deny**（prod 無し） |

### 12.2 新 policy が必要か？

**✅ 必須。**

最低限:

- listings / business_listings: **公開 SELECT + オーナー CRUD**
- profiles: **公開 SELECT + オーナー upsert**
- members: **公開 SELECT**（+ 将来 owner write）

リポジトリには **prod 定義がゼロ**のため、新規 SQL ファイル作成が P1-S1〜S4 の本体作業。

### 12.3 本番公開への影響

| 観点 | dev DROP + prod 適用後 |
|------|------------------------|
| **セキュリティ** | anon から draft / payment_url 直読取 **解消** ✅ |
| **FROZEN デモ** | デモ ID ページ **影響なし**（local/demo fallback） ✅ |
| **Supabase 実データ掲載** | 公開 listing / shop **表示維持** ✅ |
| **開発 mock（`u_me` + anon）** | Supabase への insert/update **不可** ⚠️ → Auth JWT 要 |
| **profile-settings 保存** | prod write policy 無しだと **profiles upsert 失敗** ⚠️ |
| **カテゴリ一覧** | prod 公開 SELECT があれば **回復** |
| **本番 EC 判断** | P1-S1〜S4 完了までは [`prelaunch-p1-backlog-review.md`](prelaunch-p1-backlog-review.md) 同様 **Marketplace DB 本番非推奨** |

**既存本番 DB への露出:** 現状すでに anon key が Git 公開のため、**27 listings / 全 profiles が外部から読取可能**（`payment_url` 等含む）。修正は **漏えい停止**であり、正規 UX を壊さないよう prod SELECT を **同時適用**すること。

### 12.4 推定工数

| 作業 | 工数 |
|------|------|
| prod policy SQL 新規作成（4 テーブル） | **0.5〜1 人日** |
| dev DROP SQL + 適用手順書 | **0.25 人日** |
| 検証脚本 `verify-marketplace-rls.mjs` | **0.5 人日** |
| REST プローブ + 主要ページ目視（検索 / 店舗 / 詳細 / プロフィール） | **0.5 人日** |
| staging 適用 · ロールバック手順 · P1-S12（dev 再適用防止） | **0.25〜0.5 人日** |
| **合計（P1-S1〜S4 バンドル）** | **2〜3 人日** |

（[`prelaunch-p1-backlog-review.md`](prelaunch-p1-backlog-review.md) §7 の Marketplace RLS バンドル見積と一致）

---

## 13. 検証コマンド（適用後 · 未実施）

```bash
# 新規（作成推奨）
node scripts/verify-marketplace-rls.mjs

# 既存 regression
node scripts/verify-market-pages-cross.mjs
node scripts/verify-market-search-sp-cta.mjs
```

**anon プローブ期待値（prod 適用後）:**

| テーブル | anon SELECT | anon INSERT listings |
|----------|-------------|----------------------|
| `listings` | `publish_status=public` のみ | **401 / 0 行** |
| `business_listings` | 同上 | **401 / 0 行** |
| `profiles` | 公開 profile 行 | deny（write） |
| `members` | 公開 member 行 | deny（write） |

---

## 14. P1 チケット対応表

| ID | テーブル | 本レビュー結論 |
|----|----------|----------------|
| **P1-S1** | `listings` | dev 4 本 DROP + prod 5 本 CREATE |
| **P1-S2** | `business_listings` | 同上 |
| **P1-S3** | `profiles` | dev 1 本 DROP + prod SELECT/WRITE |
| **P1-S4** | `members` | dev 1 本 DROP + prod SELECT（+ WRITE 任意） |

---

**検証実施:** 2026-06-17 — 静的レビュー + anon read-only REST プローブ  
**未実施（本タスク範囲）:** SQL 適用 · authenticated JWT プローブ · `pg_policies` 再クエリ（監査レポート値を引用）
