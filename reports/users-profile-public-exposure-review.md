# Users / Profile Public Exposure Review

**作成日:** 2026-06-17  
**種別:** 監査のみ（**修正なし / SQL 変更なし / UI 変更なし**）  
**前提:** Marketplace RLS P1–P3 適用済み · Final Lock Review 済み  
**対象プロジェクト:** `ddojquacsyqesrjhcvmn`

---

## 総合判定: **WARNING**

**即時の個人情報漏洩（email / phone / address / last_seen_at / payment）は確認されなかった。**  
ただし、公開画面から **`users` base table 直読**、**`review_scores` の RLS 未整備**、**デモ UI の疑似ログイン表示**、**デバッグログ** など、防御深度・運用上の改善余地がある。

**FAIL 項目: 0 件**（現行 DB 状態で不要な PII が REST 経由で取得できる経路は未確認）

---

## 監査方針

| 項目 | 内容 |
|------|------|
| コード変更 | **なし** |
| SQL 適用 | **なし** |
| UI 変更 | **なし** |
| Marketplace RLS | **変更しない** |

---

## 確認したファイル一覧

### スキーマ / SQL

| ファイル | 内容 |
|----------|------|
| [`supabase/user_member_profile.sql`](../supabase/user_member_profile.sql) | `users` / `profiles` / `members` 定義 |
| [`sql/marketplace-public-safe-layer.sql`](../sql/marketplace-public-safe-layer.sql) | `public_marketplace_profiles` / `public_marketplace_members` |
| [`sql/marketplace-rls-production.sql`](../sql/marketplace-rls-production.sql) | profiles / members RLS ヘルパー |
| [`supabase/reviews.sql`](../supabase/reviews.sql) | `review_scores`（RLS コメントアウト） |
| [`supabase/members_profiles_rls_dev.sql`](../supabase/members_profiles_rls_dev.sql) | 旧 dev `using(true)`（P1 DROP 対象） |

### JS / 公開 UI

| ファイル | 役割 |
|----------|------|
| [`listing-seller-profile.js`](../listing-seller-profile.js) | 出品者プロフィール取得・描画（**中核**） |
| [`detail-trust-score.js`](../detail-trust-score.js) | `review_scores` 取得・評価表示 |
| [`listing-detail-loader.js`](../listing-detail-loader.js) | 詳細ページ出品者カード |
| [`listing-renderer.js`](../listing-renderer.js) | 一覧カード出品者メタ |
| [`index-home.js`](../index-home.js) | TOP 出品者アバター / ランク |
| [`member-auth.js`](../member-auth.js) | 本人 profiles 同期 |
| [`profile-settings.js`](../profile-settings.js) | 本人プロフィール編集 |
| [`dashboard-data.js`](../dashboard-data.js) | ダッシュボード本人 profile |
| [`member-profile.js`](../member-profile.js) | アバター upload / profiles upsert |
| [`talk-profile.js`](../talk-profile.js) | Talk 相手プロフィールモーダル |
| [`shop-market-profile.html`](../shop-market-profile.html) | 市場マイプロフィール（静的プレースホルダ） |

### 存在しない / 名称整理

| 名称 | 監査結果 |
|------|----------|
| `profile-loader.js` | **リポジトリ内に存在しない** |
| `marketplace_profiles` | **独立 view / テーブルなし**。実体は `public_marketplace_profiles`（P2 safe view） |
| `connect_status` | **コードベース・スキーマに未定義** |

---

## 1. 公開プロフィール監査

### 1.1 データ取得アーキテクチャ（公開出品者）

公開画面の出品者情報は **`TasuListingSellerProfile.fetchSellerProfile` → `fetchUserTables`** が中心。

| ソース | テーブル / view | 取得列 | 公開画面 |
|--------|----------------|--------|----------|
| users（**base 直読**） | `users` | `id`, `handle` | 詳細 / TOP / 一覧カード |
| profiles | `public_marketplace_profiles` | `user_id`, `display_name`, `avatar_url`, `availability_status`, `work_hours` | 同上 |
| members | `public_marketplace_members` | `rank`, `badge_image_url`, `is_premium`, `identity_verified`, `deals_count`, `followers_count` | 同上 |
| 評価 | `review_scores` | `average_rating`, `total_reviews`, `skipped_reviews` | 詳細（`detail-trust-score.js`） |
| 掲載数 | `public_marketplace_listings` | count のみ | 出品者カード |

**店舗プロフィール（business context）:** `public_business_listings` 経由で `company_name`, `phone`, `business_hours`, `service_area` 等が別系統で公開される（ユーザー `profiles` とは別。掲載者連絡先として意図的）。

### 1.2 画面別 — 取得・表示項目

| 画面 | エントリ | 主な表示項目 |
|------|----------|--------------|
| 出品者プロフィール（詳細内 `[data-listing-seller]`） | `listing-seller-profile.js` `render()` | display_name, handle, avatar, rank, deals, followers, availability, work_hours, 最終ログイン（ラベル）, 評価 |
| 店舗 / 掲載詳細 | `listing-detail-loader.js` + seller profile | 上記 + 商品 hero 出品者カード |
| 市場 TOP | `index-home.js` | avatar, rank（`fetchSellerProfile`） |
| 一覧カード | `listing-renderer.js` | display_name, handle, rank, rating UI |
| AI 検索 / カテゴリ | 掲載データ主体（出品者は間接） | company_name / title 等（listings 側） |
| 市場マイプロフィール | `shop-market-profile.html` | **静的**「山田 太郎」「demo@tasful.local」（API 非連動） |
| Talk 相手 profile | `talk-profile.js` | display_name, avatar, category, location, rating（Talk 系） |

### 1.3 抽出項目別判定

| 項目 | 判定 | 根拠 |
|------|------|------|
| **user_id** | **公開可** | URL / `data-author-user-id` / `@handle` フォールバックに利用。公開出品者の識別子として意図的 |
| **email** | **公開非推奨**（現状未露出） | `users` / `profiles` スキーマに列なし。`shop-market-profile.html` に静的 `demo@tasful.local` のみ（API 経路ではない） |
| **phone** | **公開非推奨**（profiles 経路では未露出） | ユーザー profiles にはなし。店舗 `business_listings.phone` は掲載連絡先として別系統で公開可 |
| **address** | **公開非推奨**（profiles 経路では未露出） | profiles / users になし。店舗 `form_data.address` 等は掲載データ |
| **last_seen_at** | **公開非推奨**（API ではマスク済） | `public_marketplace_profiles` から **除外**（P2）。UI は `formatRelativeLastSeen(last_seen_at)` だが live 取得では空 → `—`。**デモ fallback 時のみ**「2時間前」等を表示 |
| **connect_status** | **該当なし** | 未定義 |
| **avatar** | **公開可** | `avatar_url` · safe view 経由 |
| **display_name** | **公開可** | safe view 経由 |
| **company_name** | **公開可**（店舗文脈） | `business_listings` / 掲載 `form_data` 由来。`profiles` 列ではない |
| **review_count** | **公開可** | `review_scores.total_reviews` · anon 可（後述 WARNING） |
| **rating** | **公開可** | `review_scores.average_rating` · anon 可 |
| **created_at** | **要検討** | `users.created_at` は JS が SELECT するが **現行 DB では 0 行**（未表示）。将来 GRANT 変更時に露出リスク |
| **updated_at** | **要検討** | safe view に `updated_at` 含むが **UI 未表示**。JSON には載る |

### 1.4 付帯表示（profiles 派生）

| 項目 | 判定 | 備考 |
|------|------|------|
| availability_status | **公開可** | オンライン / オフライン表示 |
| work_hours | **公開可** | 対応時間 |
| identity_verified / is_premium / rank | **公開可** | 信頼バッジ用途 |
| deals_count / followers_count | **公開可** | 実績表示 |

---

## 2. users テーブル利用監査

### 2.1 grep 結果

```
.from("users") / from('users')  →  listing-seller-profile.js のみ（1 箇所）
```

| パターン | ヒット |
|----------|--------|
| `from('users')` | 0 |
| `from("users")` | **1** — [`listing-seller-profile.js` L507–510](../listing-seller-profile.js) |
| `users select` / `users single` | 上記 `fetchUserRow` のみ |

**profiles base 直読（owner / 本人導線）:**

| ファイル | 用途 | 公開画面? |
|----------|------|-----------|
| `member-auth.js` L400 | 本人 `display_name, avatar_url` | ❌ 認証同期 |
| `profile-settings.js` L205 | 本人 upsert | ❌ 設定画面 |
| `dashboard-data.js` L112 | 本人 fetch | ❌ ダッシュボード |
| `member-profile.js` L234 | 本人 upsert | ❌ 会員 |

### 2.2 公開画面から users 直読 — **WARNING**

```503:515:listing-seller-profile.js
  async function fetchUserRow(sb, sellerUserId) {
    const { data, error } = await sb
      .from("users")
      .select("id, handle")
      .eq("id", queryUserId);
    return { row: data?.[0] || null, error };
  }
```

| 観点 | 評価 |
|------|------|
| 公開画面から base `users` 直読 | **あり** — safe layer bypass |
| `public_marketplace_profiles` で代替可能か | handle は **users 専用列**。現状 safe view 未包含 |
| 現行 DB での実害 | anon / authenticated とも `users` SELECT → **0 行**（live probe）。handle は `@userId` フォールバック |
| Marketplace RLS スコープ | **`users` は P1–P3 未カバー**（`profiles` / `members` のみ） |

### 2.3 safe profile layer bypass 一覧

| ID | 深刻度 | 経路 | 内容 |
|----|--------|------|------|
| W-USR-1 | WARNING | `fetchUserRow` | 公開 fetch が `users` base 直読 |
| W-USR-2 | WARNING | `fetchUserTables` | 正規化後も `profile.userRow` / `profile.profileRow` / `profile.memberRow` をイベント `detail.profile` に同梱 |
| W-USR-3 | WARNING | `console.log` L616–624 | 生の user / profile / member をブラウザ console へ出力 |

---

## 3. 公開情報の最小化

### 3.1 公開 JSON / REST 応答チェック（live probe 2026-06-17）

| データ | anon 取得 | 結果 |
|--------|-----------|------|
| `profiles` base + `last_seen_at` | ❌ | 401 permission denied（P2 REVOKE） |
| `public_marketplace_profiles` | ✅ | `display_name`, `availability_status` 等。**`last_seen_at` なし** |
| `members` base | ❌ | 401 permission denied |
| `public_marketplace_members` | ✅ | rank, deals 等のみ |
| `users` | △ | 200 だが **0 行**（handle 未取得） |
| `review_scores` | ✅ | `average_rating`, `total_reviews` |

### 3.2 禁止項目の含有確認

| 禁止カテゴリ | profiles / users 公開経路 | 判定 |
|--------------|---------------------------|------|
| email | なし（静的 HTML のみ） | ✅ API 経路 OK |
| phone | profiles になし | ✅（店舗 listings は別） |
| address | profiles になし | ✅ |
| payment 情報 | profiles / users になし | ✅ |
| login 系（last_seen 等） | safe view 除外 · live API 空 | ✅（デモ UI のみ要注意） |
| internal role | なし | ✅ |
| last_seen_at | safe view 除外 | ✅ |

### 3.3 WARNING — 関連テーブル

| ID | 内容 |
|----|------|
| W-MIN-1 | `review_scores` に **RLS 未設定**（[`reviews.sql`](../supabase/reviews.sql) コメントアウト）。anon が全行 SELECT 可能。含まれるのは集計値のみで PII ではないが、スコープ外テーブル |
| W-MIN-2 | `public_marketplace_profiles` が `availability_status` / `work_hours` / `updated_at` を返す — 行動・活動ヒントとして **要検討**（意図的公開なら OK） |
| W-MIN-3 | デモ `DEMO_PROFILES` の `lastLoginLabel`（「2時間前」等）が Supabase 未命中時に **UI 表示** — 実データではないがログイン履歴に見える |

---

## 4. 権限マトリクス

**凡例:** ✅ 取得可 · ❌ 取得不可 · △ 条件付き（公開出品者のみ） · — 列なし

### 4.1 `users` テーブル（`id`, `handle`, `created_at` のみ）

| Role | display_name | avatar | company_name | review_count | rating | email | phone | address | last_seen_at |
|------|--------------|--------|--------------|--------------|--------|-------|-------|---------|--------------|
| **anon** | — | — | — | — | — | — | — | — | — |
| **authenticated** | — | — | — | — | — | — | — | — | — |
| **owner** | — | — | — | — | — | — | — | — | — |
| **admin** | — | — | — | — | — | — | — | — | — |

※ `users` には上記の大半の列が存在しない。現行 live probe では **全ロールで SELECT 0 行**（Marketplace RLS パッケージ外 · GRANT/RLS 状態要確認）。

### 4.2 `profiles` / `public_marketplace_profiles`

| Role | Path | display_name | avatar | company_name | review_count | rating | email | phone | address | last_seen_at |
|------|------|--------------|--------|--------------|--------------|--------|-------|-------|---------|--------------|
| **anon** | safe view（公開出品者） | ✅ △ | ✅ △ | — | — | — | — | — | — | ❌ |
| **anon** | base `profiles` | ❌ REVOKE | ❌ | — | — | — | — | — | — | ❌ |
| **authenticated 非 owner** | safe view | ✅ △ | ✅ △ | — | — | — | — | — | — | ❌ |
| **authenticated 非 owner** | base | ❌ RLS | ❌ | — | — | — | — | — | — | ❌ |
| **owner** | base（本人） | ✅ | ✅ | — | — | — | — | — | — | ✅ |
| **owner** | safe view（本人が公開出品者） | ✅ | ✅ | — | — | — | — | — | — | ❌ |
| **admin** | base | ✅（`marketplace_is_owner` 経由で本人行。他者は P3 で base 不可） | 同上 | — | — | — | — | — | — | 本人のみ ✅ |

△ = `marketplace_profile_is_public(user_id)` — 公開掲載を1件以上持つ出品者のみ

### 4.3 `review_scores`（Marketplace RLS スコープ外）

| Role | rating | review_count |
|------|--------|--------------|
| **anon** | ✅ | ✅ |
| **authenticated** | ✅ | ✅ |
| **owner** | ✅（自分） | ✅ |
| **admin** | ✅ | ✅ |

### 4.4 `company_name` 補足

`company_name` は **`business_listings` / 掲載 form_data** 由来。公開掲載経由で anon 可（Marketplace safe view）。ユーザー profiles とは別データ。

---

## 5. 検証コマンドと結果

### 5.1 静的 grep

```text
.from("users")     → listing-seller-profile.js ×1
.from("profiles")  → member-auth, profile-settings, dashboard-data, member-profile（いずれも本人導線）
public_marketplace_profiles → listing-seller-profile.js, tasu-supabase-client.js
```

### 5.2 Live REST probe（anon / owner）

```bash
# 実行: node ワンライナー（loadTalkSupabaseConfig + REST）
```

| クエリ | ロール | HTTP | 結果 |
|--------|--------|------|------|
| `profiles?select=last_seen_at` | anon | 401 | permission denied ✅ |
| `public_marketplace_profiles?limit=3` | anon | 200 | 公開出品者のみ · last_seen なし ✅ |
| `members?select=rank` | anon | 401 | permission denied ✅ |
| `public_marketplace_members?limit=3` | anon | 200 | 公開出品者のみ ✅ |
| `users?select=id,handle&id=eq.u_me` | anon | 200 | **0 行** △ |
| `users?select=id,handle&id=eq.u_me` | owner JWT | 200 | **0 行** △ |
| `profiles?select=last_seen_at&user_id=eq.u_me` | owner JWT | 200 | last_seen_at **取得可**（本人 · 期待どおり） |
| `review_scores?limit=3` | anon | 200 | average_rating, total_reviews **取得可** △ |

### 5.3 Marketplace RLS verify（参考）

直前の Final Lock Review にて `node scripts/verify-marketplace-rls.mjs` **38/38 PASS** — profiles / members の anon base 拒否・safe view 可読は確認済み。

---

## 6. FAIL 項目

**なし**

現行 DB + 公開 UI 経路で、email / phone / address / payment / last_seen_at / internal role が anon に返る事象は確認されなかった。

---

## 7. WARNING サマリーと推奨修正（実装は別タスク）

| 優先 | ID | ファイル / 関数 | データ項目 | 推奨修正 |
|------|-----|-----------------|------------|----------|
| 1 | W-USR-1 | `listing-seller-profile.js` `fetchUserRow` | handle | `public_marketplace_users` 等 safe view に `handle` を含め、base `users` 直読を廃止 |
| 2 | W-USR-4 | SQL（新規 · Marketplace スコープ外） | users GRANT/RLS | `users` を Marketplace RLS パッケージに組み込み、anon/authenticated 向け明示 REVOKE + 公開 handle view |
| 3 | W-MIN-1 | `supabase/reviews.sql` / `detail-trust-score.js` | review_scores | RLS + 公開 read policy（集計のみ）または `public_review_scores` view |
| 4 | W-USR-2 | `listing-seller-profile.js` `fetchUserTables` | raw rows | イベント payload から `userRow` / `profileRow` / `memberRow` を除去し正規化済みのみ渡す |
| 5 | W-USR-3 | `listing-seller-profile.js` | console 出力 | 本番 console.log 削除または debug フラグ化 |
| 6 | W-MIN-3 | `listing-seller-profile.js` DEMO_PROFILES | lastLoginLabel | 公開画面で疑似「最終ログイン」を出さない、または demo 明示 |
| 7 | — | `shop-market-profile.html` | demo email | 静的プレースホルダ email 削除または「サンプル」明示 |

---

## 8. 判定根拠まとめ

| 観点 | 判定 |
|------|------|
| email / phone / address / payment の公開 API 露出 | ✅ なし |
| last_seen_at の公開 API 露出 | ✅ safe view で除外 |
| 公開 UI の safe view 利用（profiles / members） | ✅ |
| users base 直読（公開画面） | ⚠️ 設計上の bypass（現状 0 行） |
| review_scores anon 可読 | ⚠️ 集計のみ · RLS なし |
| デモ / 静的 UI の疑似 PII | ⚠️ 軽微 |

**総合: WARNING** — 本番運用上、重大な PII 漏洩経路はないが、`users` / `review_scores` の防御深度と公開 UI のデモ表示を P4 以降で整備することを推奨。

---

*本レポートは Users / Profile Public Exposure Review として **実装変更・SQL 適用・UI 変更を一切行わず** 静的監査と REST probe のみで作成した。*
