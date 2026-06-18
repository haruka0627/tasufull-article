# Marketplace RLS Final Lock Review

**作成日:** 2026-06-17  
**種別:** 最終監査のみ（**修正なし / SQL 未適用 / UI 未変更**）  
**前提:** P1 RLS · P2 safe view · P3 owner-only base SELECT 適用済み  
**対象プロジェクト:** `ddojquacsyqesrjhcvmn`

---

## 総合判定: **WARNING**

**本番投入は可能**（行動ベース検証 38/38 PASS、RLS による遮断は機能している）が、**JS 層の防御深度・検証スクリプトの盲点・スコープ外テーブル**に改善推奨事項がある。セキュリティ上の即時ブロッカー（FAIL 相当のデータ漏洩経路）は確認されなかった。

---

## 監査方針

| 項目 | 内容 |
|------|------|
| コード変更 | **なし** |
| SQL 適用 | **なし** |
| UI 変更 | **なし** |
| 問題の扱い | FAIL / WARNING として本レポートに記録のみ |

---

## 確認したファイル一覧

### SQL（静的監査）

| ファイル | 内容 |
|----------|------|
| [`sql/marketplace-rls-production.sql`](../sql/marketplace-rls-production.sql) | P1 ヘルパー · RLS · owner CRUD |
| [`sql/marketplace-public-safe-layer.sql`](../sql/marketplace-public-safe-layer.sql) | P2 safe view 4 本 · anon REVOKE · GRANT |
| [`sql/marketplace-rls-p3-authenticated-owner-only.sql`](../sql/marketplace-rls-p3-authenticated-owner-only.sql) | P3 `*_select_public` DROP · owner-only SELECT |
| [`sql/marketplace-rls-drop-dev-policies.sql`](../sql/marketplace-rls-drop-dev-policies.sql) | dev `using(true)` ポリシー DROP |

### JS（公開 fetch / owner CRUD）

| ファイル | 役割 |
|----------|------|
| [`tasu-supabase-client.js`](../tasu-supabase-client.js) | `TasuMarketplaceRead` · `shouldQueryOwnerBaseTable()` |
| [`listings-db.js`](../listings-db.js) | 一般掲載 fetch / CRUD / payment |
| [`business-listings-db.js`](../business-listings-db.js) | 店舗掲載 fetch / CRUD |
| [`listing-detail-loader.js`](../listing-detail-loader.js) | 掲載詳細 Supabase 取得 |
| [`listing-seller-profile.js`](../listing-seller-profile.js) | 出品者 profile / member |

### 公開 UI ページ（fetch 導線）

| ファイル | 画面 |
|----------|------|
| [`index-home.js`](../index-home.js) | 市場 TOP（一般掲載） |
| [`shop-market-top.js`](../shop-market-top.js) | 店舗市場 TOP |
| [`ai-search.js`](../ai-search.js) | AI 検索 |
| [`shop-market-search.js`](../shop-market-search.js) · [`listing-category-page.js`](../listing-category-page.js) · [`shop-store-page.js`](../shop-store-page.js) | 店舗一覧 / カテゴリ |
| [`listing-detail-loader.js`](../listing-detail-loader.js) · [`detail-shop-store-loader.js`](../detail-shop-store-loader.js) · [`detail-business-service-loader.js`](../detail-business-service-loader.js) | 商品 / 掲載詳細 |
| [`listing-seller-profile.js`](../listing-seller-profile.js) | 出品者 profile |
| [`listing-feed.js`](../listing-feed.js) · [`listing-top-spotlight.js`](../listing-top-spotlight.js) · [`job-top-page.js`](../job-top-page.js) | フィード / スポットライト |

### 検証

| ファイル | 役割 |
|----------|------|
| [`scripts/verify-marketplace-rls.mjs`](../scripts/verify-marketplace-rls.mjs) | P1 + P2 + P3 統合検証 |

---

## 1. 公開 UI fetch 静的監査

### 1.1 結論: **PASS（WARNING 2 件）**

公開一覧・詳細・出品者 profile の主要導線は、いずれも `TasuListingStore.fetchPublishedListings` / `TasuBusinessListings.fetchPublishedBusinessListings` / `fetchListingById` / `fetchBusinessListingById` 経由で **safe view を第一選択**している。ページ JS から base table への直接 `.from("listings")` 等は **検出されなかった**。

### 1.2 ページ別ルーティング

| 画面 | エントリ JS | Supabase 経路 | safe view |
|------|-------------|---------------|-----------|
| 市場 TOP | `index-home.js` | `fetchPublishedListings` → `publicListingsTable()` | ✅ `public_marketplace_listings` |
| 店舗 TOP | `shop-market-top.js` | `fetchPublishedBusinessListings` → `publicBusinessTable()` | ✅ `public_business_listings` |
| AI 検索 | `ai-search.js` | 上記 2 関数 + タイプ別 fetch | ✅ |
| 店舗一覧 | `shop-market-search.js` 等 | `fetchPublishedBusinessListings` | ✅ |
| 商品 / 掲載詳細 | `listing-detail-loader.js` 等 | `fetchListingById` / `fetchBusinessListingById` → safe 優先 | ✅（owner fallback あり） |
| 出品者 profile | `listing-seller-profile.js` | `profilesTable()` / `membersTable()` | ✅ `public_marketplace_profiles` / `public_marketplace_members` |

### 1.3 safe view ルーティング実装（コア）

```297:314:listings-db.js
  async function queryListingRow(sb, primaryKey, select) {
    const sel = select || "*";
    const pubRes = await sb
      .from(publicListingsTable())
      .select(sel)
      .eq("id", primaryKey)
      .maybeSingle();
    if (pubRes.data && !pubRes.error) return pubRes.data;

    if (marketplaceRead()?.shouldQueryOwnerBaseTable?.()) {
      const ownerRes = await sb
        .from(baseListingsTable())
        .select(sel)
        .eq("id", primaryKey)
        .maybeSingle();
      // ...
    }
    return null;
  }
```

```1020:1036:business-listings-db.js
  async function queryBusinessRow(sb, column, value) {
    const pubRes = await sb
      .from(publicBusinessTable())
      .select("*")
      .eq(column, value)
      .maybeSingle();
    if (pubRes.data && !pubRes.error) return pubRes.data;

    if (marketplaceRead()?.shouldQueryOwnerBaseTable?.()) {
      const ownerRes = await sb
        .from(baseBusinessTable())
        .select(BUSINESS_LISTING_FETCH_SELECT)
        .eq(column, value)
        .maybeSingle();
      // ...
    }
    return null;
  }
```

### 1.4 WARNING 一覧

| ID | 深刻度 | 内容 | 該当 | 推奨修正方針（P4） |
|----|--------|------|------|-------------------|
| W-PUB-1 | WARNING | `fetchBusinessListingByDemoId` が **safe view を経由せず** base `business_listings` を直接 SELECT する。公開 fetch チェーン（`fetchBusinessListingById` ステップ 2）に含まれる | [`business-listings-db.js` L898–912](../business-listings-db.js) | demo_id 用に safe view 上の RPC / フィルタ付き view、または `form_data->>demo_id` 用の公開専用 lookup view を追加し JS から base 直叩きを除去 |
| W-PUB-2 | WARNING | 出品者 profile で `users` テーブルを base 直読（P1–P3 スコープ外）。handle 取得のみだが RLS / 列マスクなし | [`listing-seller-profile.js` L503–514](../listing-seller-profile.js) | `public_marketplace_users` 相当の safe view 追加、または profiles view に handle を JOIN して `users` 直読を廃止 |

**注:** W-PUB-1 は anon / authenticated 非 owner では DB 層（REVOKE + RLS）で **0 行 / 403** となり、実害は現状なし。JS 設計原則「公開は safe view のみ」からは逸脱。

---

## 2. owner CRUD 導線監査

### 2.1 結論: **PASS（WARNING 1 件）**

owner 管理・draft 閲覧・payment 取得は base table を意図的に使用しており、RLS `*_select_owner` / `*_insert_owner` / `*_update_owner` と整合。

### 2.2 owner 導線マップ

| 操作 | 関数 | テーブル | 判定 |
|------|------|----------|------|
| 自分の掲載一覧 | `fetchListingsByUser` / `fetchBusinessListingsByUser` | base | ✅ owner RLS |
| 新規 insert | `insertSupabase` / `insertSupabaseListing` | base | ✅ `*_insert_owner` |
| 更新 | `updateSupabaseListing` / publish status update | base | ✅ `*_update_owner` |
| draft / 非公開詳細 | `queryListingRow` / `queryBusinessRow` owner fallback | base | ✅ owner RLS |
| payment_url 等 | `getListingPayment` | base + `isAuthenticatedSync()` | ✅ owner RLS（非 owner は 0 行） |
| profiles upsert | `profile-settings.js` / `member-auth.js` 等 | base `profiles` | ✅ owner CRUD |

### 2.3 `shouldQueryOwnerBaseTable()` 判定

```155:158:tasu-supabase-client.js
  /** P3: 公開閲覧は safe view。base は owner CRUD / draft 取得のみ（RLS owner policy） */
  function shouldQueryOwnerBaseTable() {
    return isMarketplaceAuthenticatedSync();
  }
```

| 観点 | 評価 |
|------|------|
| 不足（owner が読めない） | **なし** — JWT + `marketplace_is_owner` で owner draft / payment は検証 PASS |
| 過剰（非 owner が base を試行） | **WARNING** — ローカル `TasuMemberAuth` が true の **全 authenticated** が public miss 後に base fallback を試行。RLS で拒否されるため漏洩なしだが、不要な base プローブが発生 |

| ID | 深刻度 | 内容 | 推奨修正方針（P4） |
|----|--------|------|-------------------|
| W-OWN-1 | WARNING | 関数名は「owner base」だが条件は「任意 authenticated sync」。Supabase JWT の `talk_user_id` 一致や listing `user_id` 一致は見ていない | `shouldQueryOwnerBaseTable()` を Supabase セッション + owner コンテキスト（例: 管理画面 / 自分の userId 一致）に限定 |

### 2.4 base table 直参照 grep 結果（`.from("listings"|"business_listings"|"profiles"|"members")`）

| ファイル | 行 | 用途 | 公開経路? |
|----------|-----|------|-----------|
| `listings-db.js` | 653, 901 | insert / updatePublishStatus | ❌ owner |
| `business-listings-db.js` | 741, 776, 903, 1220 | insert / update / **fetchByDemoId** / updatePublish | 903 のみ ⚠️ 公開チェーン |
| `profile-settings.js` | 205 | profiles upsert | ❌ owner |
| `member-auth.js` | 400 | profiles select | ❌ owner |
| `member-profile.js` | 234 | profiles upsert | ❌ owner |
| `dashboard-data.js` | 112 | profiles select | ❌ owner dashboard |

---

## 3. SQL policy 監査

### 3.1 結論: **PASS（WARNING 1 件 — 検証インフラ）**

P3 SQL 定義および行動ベース検証は期待どおり。**REST 経由の `pg_policies` イントロスペクションは本環境で 404** のため、ポリシー名の機械確認は verify スクリプト上 no-op になりうる（後述 W-SQL-1）。

### 3.2 期待ポリシー状態（P3 適用後）

| チェック項目 | 期待 | 行動検証 |
|--------------|------|----------|
| `*_select_public` on base 4 tables | **0 件** | ✅ non-owner base published row denied |
| `*_select_owner` only | authenticated + `marketplace_is_owner(user_id)` | ✅ owner draft / payment readable |
| dev `*_dev` / `using(true)` | **0 件** | ✅ verify「no dev policies」（※ pg_policies 未公開時は no-op リスク） |
| anon base SELECT | **REVOKE** | ✅ anon draft denied · base direct denied |
| safe view SELECT | **GRANT** anon, authenticated | ✅ anon / non-owner safe view OK |

### 3.3 base SELECT ポリシー（設計）

| テーブル | ポリシー | ロール | USING |
|----------|----------|--------|-------|
| `listings` | `listings_select_owner` | authenticated | `marketplace_is_owner(user_id)` |
| `business_listings` | `business_listings_select_owner` | authenticated | 同上 |
| `profiles` | `profiles_select_owner` | authenticated | 同上 |
| `members` | `members_select_owner` | authenticated | 同上 |

**`*_select_public`:** P3 SQL で明示 DROP — [`marketplace-rls-p3-authenticated-owner-only.sql` L15–18](../sql/marketplace-rls-p3-authenticated-owner-only.sql)

### 3.4 safe view GRANT / anon REVOKE

[`marketplace-public-safe-layer.sql` L229–243](../sql/marketplace-public-safe-layer.sql) および P3 再 GRANT/REVOKE と一致。

| WARNING ID | 内容 | 推奨 |
|------------|------|------|
| W-SQL-1 | `GET /rest/v1/pg_policies` が **PGRST205（404）**。verify の dev policy / `*_select_public` 件数チェックは、エラー時 `[]` 扱いで **誤 PASS しうる** | verify を行動テスト主体にし、pg_policies は Supabase SQL / CLI または RPC ラッパーで検証するよう強化 |

---

## 4. 権限マトリクス

`publish_status` は `public`（公開）/ `draft` / その他非公開を想定。`private` 列はなく **非 public = draft 等** として扱う。

| Role | Path | published | draft | private（非 public） | payment_url | base direct SELECT | safe view SELECT |
|------|------|-----------|-------|----------------------|-------------|-------------------|------------------|
| **anon** | 公開閲覧（一覧 / 詳細 / profile） | ✅ view のみ | ❌ | ❌ | ❌（view に列なし） | ❌ REVOKE + RLS | ✅ 4 views |
| **anon** | owner CRUD | ❌ | ❌ | ❌ | ❌ | ❌ | — |
| **authenticated 非 owner** | 公開閲覧 | ✅ view のみ | ❌ | ❌ | ❌ | ❌（owner policy のみ · 0 行） | ✅ 4 views |
| **authenticated 非 owner** | 他人 draft / payment | ❌ | ❌ | ❌ | ❌ | ❌ 検証 PASS | ❌ |
| **authenticated owner** | 自分の掲載（全 status） | ✅ base + view | ✅ base | ✅ base | ✅ base | ✅ 自分の行のみ | ✅ 公開分は view でも可 |
| **authenticated owner** | 他人の掲載 | ✅ view のみ（公開分） | ❌ | ❌ | ❌ | ❌ | ✅ 公開分のみ |

---

## 5. 検証コマンドと結果

### 5.1 Marketplace RLS 統合検証

```bash
node scripts/verify-marketplace-rls.mjs
```

| 結果 | 詳細 |
|------|------|
| **PASS** | **38/38** 項目 PASS（2026-06-17 再実行） |
| P1 | anon 公開のみ · owner CRUD · non-owner 拒否 · dev policy なし |
| P2 | safe view 列マスク · anon base 直読拒否 · owner payment_url |
| P3 | non-owner safe view OK · non-owner base 拒否 · owner draft base OK |
| page smoke | anon 公開 listings / business_listings · seller profile / member · UUID 詳細 |

### 5.2 Marketplace 関連 smoke（その他）

| コマンド | 結果 |
|----------|------|
| `node scripts/verify-market-pages-cross.mjs` | **未実行** — Playwright + ローカル dev server 依存の UI スクリーンショット検証。RLS 観点の代替として verify 内 page smoke（REST）を使用 |
| `rg '.from("listings")'` 等 | 上記 §2.4 のとおり **7 ファイル · 11 箇所**。公開 UI 直叩き **0 件**（W-PUB-1 の demo_id 経路除く設計逸脱 1 件） |

### 5.3 手動 pg_policies プローブ（監査時）

```
GET /rest/v1/pg_policies → 404 PGRST205（schema cache に未公開）
```

→ ポリシー状態は **P3 行動テスト + SQL ファイル静的監査**で裏付け。

---

## 6. FAIL 項目

**なし** — 行動ベース検証で anon / authenticated 非 owner による draft・payment_url・base 直読の成功は確認されなかった。

---

## 7. WARNING サマリーと P4 候補

| 優先 | ID | 概要 | ファイル |
|------|-----|------|----------|
| P4-1 | W-PUB-1 | `fetchBusinessListingByDemoId` の base 直読を safe 経由に変更 | `business-listings-db.js` |
| P4-2 | W-OWN-1 | `shouldQueryOwnerBaseTable()` を真の owner コンテキストに限定 | `tasu-supabase-client.js` + fetch helpers |
| P4-3 | W-PUB-2 | 出品者 profile の `users` 直読を safe 化 | `listing-seller-profile.js` + SQL view |
| P4-4 | W-SQL-1 | verify の `pg_policies` REST 依存を修正（no-op 防止） | `scripts/verify-marketplace-rls.mjs` |
| P4-5 | — | `shop_store_products` 等 Marketplace 関連だが P2 未マスクテーブルの列監査 | 別スコープ |
| P4-6 | — | owner CRUD の hardcoded `"listings"` / `"business_listings"` を `BASE.*` ヘルパーに統一（保守性） | `listings-db.js`, `business-listings-db.js` |

---

## 8. 判定根拠まとめ

| 観点 | 判定 |
|------|------|
| 公開 UI が safe view 経由 | ✅ 主要導線 OK · ⚠️ demo_id 1 経路 |
| owner CRUD / draft / payment | ✅ |
| SQL RLS（行動ベース） | ✅ |
| 検証自動化 | ✅ 38/38 · ⚠️ pg_policies introspection |
| 即時本番ブロッカー | **なし** |

**総合: WARNING** — RLS 多層防御は本番投入可能水準。P4 で JS 層の原則統一と検証堅牢化を推奨。

---

*本レポートは Final Lock Review として **実装変更・SQL 適用・UI 変更を一切行わず** 静的監査と既存 verify 再実行のみで作成した。*
