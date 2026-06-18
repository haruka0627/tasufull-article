# NB-3 STEP 5: 市場 buyer/seller JWT 化レポート

**作成日:** 2026-06-18  
**前提:** [`auth-jwt-design-final.md`](auth-jwt-design-final.md) · STEP 2 `TasuAuthCurrentUser` · STEP 4 `TasuConnectState`  
**種別:** 市場 buyer/seller 本人判定の基盤化のみ（Stripe Live / checkout 本格 / shop_orders / Connect onboarding 本番 / Builder JWT / RLS / DB スキーマ変更 **未実施**）

---

# 実装内容

## 新規 `market-identity.js`（`window.TasuMarketIdentity`）

市場専用 identity helper。STEP 2 の JWT current user と STEP 4 の Connect state を組み合わせ、buyer/seller 判定の正規入口にする。

| API | 役割 |
|-----|------|
| `getMarketIdentity()` | `{ buyerId, sellerShopId, sellerUserId, ownedShopIds, isBuyerAuthenticated, isSellerRegistered, source, connectReady, connectSource }` |
| `getMarketIdentitySource()` | 取得元ラベル |
| `getCurrentBuyerId()` | 購入者 `talk_user_id` |
| `getCurrentSellerId()` | 販売者 user id（shop 主） |
| `getCurrentSellerShopId()` | 販売者 shop/listing id |
| `isCurrentBuyer(userId)` | 指定 user と current buyer 一致 |
| `isCurrentSeller(shopIdOrOwnerId)` | shop / owner / seller user 一致 |
| `isListingOwnedByCurrentUser(listing)` | DB 行と JWT buyer 照合 |
| `requireBuyer(options)` | 未ログイン時 `BUYER_REQUIRED`（本番は redirect 可） |
| `requireSeller(options)` | 非 seller 時 `SELLER_REQUIRED` |
| `resolveSellerUserIdForShop(shopId)` | 同期 seller 解決（本番は cache のみ） |
| `resolveSellerUserIdForShopAsync(shopId)` | 非同期 DB 解決 |
| `refreshMarketIdentityFromDb()` | `listings` / `business_listings` から owned shops 取得 |
| `invalidateMarketIdentityCache()` | キャッシュ破棄 |
| `listingOwnerId(row)` | owner 列の正規化（`user_id` / `seller_user_id` / `owner_id` / `partner_id` / `form_data.*`） |
| `isProductionHost()` / `canUseLsFallback()` | auth helper 委譲 |

### 推奨 script 読込順

```
talk-runtime.js → auth-current-user.js → connect-state.js → market-identity.js
```

## 既存接続

| ファイル | 変更 |
|----------|------|
| `shop-market-notify.js` | `resolveBuyerUserId` / `resolveSellerUserId` → helper 委譲 · 本番 LS / `u_me` 無効 |
| `shop-market-product-data.js` | `getDefaultSellerShopId()` → helper 優先 · 本番 DB 未所有時は `""` |
| `shop-market-checkout.js` | 注文 draft に `buyerId` 付与 · notify 前 `refreshMarketIdentityFromDb` + seller prefetch |
| `shop-market-mypage.js` | init 時 `refreshMarketIdentityFromDb()` |
| 市場 checkout/cart/complete/mypage/order-history/seller-orders HTML | auth stack script 追加 |

---

# 追加/変更ファイル

| ファイル | 種別 |
|----------|------|
| **`market-identity.js`** | 新規 — ブラウザ helper |
| **`scripts/lib/market-identity-core.mjs`** | 新規 — Node 単体テスト（owner 照合 / prod LS block） |
| **`scripts/test-market-identity.mjs`** | 新規 — STEP 5 検証 |
| `shop-market-notify.js` | 変更 |
| `shop-market-product-data.js` | 変更 |
| `shop-market-checkout.js` | 変更 |
| `shop-market-mypage.js` | 変更 |
| `shop-market-cart.html` | script 4 行追加 |
| `shop-market-checkout.html` | script 4 行追加 |
| `shop-market-complete.html` | script 4 行追加 |
| `shop-market-mypage.html` | script 4 行追加 |
| `shop-market-order-history.html` | script 4 行追加 |
| `shop-market-seller-orders.html` | script 4 行追加 |

---

# market identity 返却仕様

```javascript
{
  buyerId: string,              // JWT talk_user_id（本番）/ demo fallback
  sellerShopId: string,         // 主 shop listing id
  sellerUserId: string,         // shop 所有者 talk_user_id
  ownedShopIds: string[],       // DB 上の所有 shop 一覧
  isBuyerAuthenticated: boolean,
  isSellerRegistered: boolean,
  source: string,               // 下表参照
  connectReady: boolean,        // TasuConnectState.isConnectReady()
  connectSource: string         // TasuConnectState.getConnectStateSource()
}
```

| source | 意味 | 本番 |
|--------|------|------|
| `jwt_db_owner` | JWT + DB 所有 shop あり | ✅ 正 |
| `jwt` | JWT のみ · 所有 shop なし | ✅ buyer のみ |
| `unauthenticated` | 未ログイン | ✅ buyer/seller 空 |
| `demo_url` | `?userId=` | ❌ 本番無視 |
| `demo_localStorage` | `tasu_market_seller_profile` | ❌ 本番無視 |
| `jwt_demo` | JWT + demo host | ❌ 本番のみ |
| `demo_fallback` | demo デフォルト（`u_me` 等） | ❌ 本番無視 |
| `none` | 初期キャッシュ | 一時的 |

### DB owner 解決（`listingOwnerId`）

優先順: `user_id` → `seller_user_id` → `owner_id` → `partner_id` → `form_data.user_id` → `form_data.seller_user_id` → `form_data.owner_id`

`fetchOwnedShopsFromDb`: `listings` / `business_listings` を `user_id = talkUserId` で検索。  
`fetchShopOwnerUserIdFromDb`: shop id で行取得 → owner 照合。

---

# buyer判定方針

| 環境 | 取得順 |
|------|--------|
| **本番 host** | `TasuAuthCurrentUser.getCurrentUser().talkUserId` のみ |
| **デモ host** | ① JWT → ② `?userId=` → ③ `TasuChatUserIdentity` → ④ `tasu_member_session` → ⑤ config → ⑥ `u_me` |

### 未ログイン時

- **checkout / cart / complete:** 既存どおりデモ導線を維持（ゲスト checkout 可 · 住所デモ固定）。本番 host では `buyerId` は空のまま draft 保存 · notify は送信しない。
- **mypage / order-history:** 既存 UI 維持。`requireBuyer()` は将来 STEP で login 誘導に接続可能（今回は mypage init の DB refresh のみ）。
- **本番:** LS / URL / `u_me` による buyer 昇格 **禁止**。

---

# seller判定方針

| 環境 | 取得順 |
|------|--------|
| **本番 host** | ① `refreshMarketIdentityFromDb` で owned shops → ② `resolveSellerUserIdForShopAsync` で shop 行 owner → JWT buyer と照合 |
| **デモ host** | ① `tasu_market_seller_profile` LS → ② `DEMO_SELLER_BY_SHOP` マップ → ③ buyer フォールバック |

### 本番 seller 条件

- `listings.user_id` または `business_listings.user_id` が current JWT と一致する shop のみ seller。
- LS の `shopId` / `sellerUserId` だけでは seller にならない。
- `isCurrentSeller(shopId)` は `ownedShopIds` / `sellerShopId` / `sellerUserId` / DB cache と照合。

### Connect 連携

- identity 返却に `connectReady` / `connectSource` を含む（表示・将来ガード用）。
- 今回 seller 判定自体は Connect ready 必須にしていない（既存 Featured:モ互換 · STEP 6+ で `requireConnectReady` 接続可能）。

---

# 本番で禁止した fallback

| 禁止対象 | 本番挙動 |
|----------|----------|
| `localStorage.userId` / config `currentUserId` | buyer 判定に不使用 → 空 |
| `localStorage` seller profile (`tasu_market_seller_profile`) | seller shop 昇格不可 |
| `localStorage` sellerId / vendorId / buyerId | 不使用 |
| URL `?userId=` / `?role=` / `?seller=` | 不使用 |
| preview seller / demo seed 固定 id | 不使用 |
| `u_me` 定数（notify 含む） | 不使用 |
| URL order owner 推定 | 不使用 |

判定は `TasuAuthCurrentUser.isProductionHost()` / `canUseLocalStorageFallback()` に委譲。

---

# demo互換条件

以下を維持（`verify-market-notify-live-flow.mjs` で確認済み）:

| 導線 | 条件 |
|------|------|
| TOP → 店舗 → 商品 → カート → 注文確認 → 完了 | `?talkDev=1&userId=u_me` · localhost |
| 店舗販売通知（購入 → seller TALK） | notify helper 経由 · demo seller map |
| seller 側注文確認デモ | `shop-market-seller-orders.html` |
| Featured 表示 | 変更なし · seed `featured` フラグ |

デモ fallback 許可 host: `localhost` · `127.0.0.1` · `?talkDev=1` · bench/preview 系（auth helper 定義に準拠）。

---

# checkoutへの影響

| 項目 | 今回 | 備考 |
|------|------|------|
| `buyerId` 取得元 | ✅ `TasuMarketIdentity.getCurrentBuyerId()` | `saveLastOrder` に付与 |
| `sellerId` 取得元 | ✅ notify 前 `resolveSellerUserIdForShopAsync` | DB cache 温め |
| order draft 所有者 | ✅ `buyerId` フィールド追加 | LS `tasu_market_last_order` |
| 通知先 seller | ✅ `shop-market-notify.js` → helper | 本番 cache/DB のみ |
| Stripe / shop_orders 本番 | ❌ 未実装 | STEP 後続 |
| 本番 checkout ログイン必須 | ❌ 未変更 | ゲスト UI 維持 · buyerId 空 |

---

# Featuredへの影響

| 箇所 | 状態 |
|------|------|
| `shop-market-top.js` / `shop-market-search.js` featured ソート | **未接続** — seed `featured` フラグのまま |
| `shop-store-demo.js` `getFeatured()` | **未接続** — デモ seed |
| Connect バッジ（`connectVerified`） | **未変更** — product data seed / DB 列 |
| seller 本人ガード on Featured 申込 | **STEP 後続** — `stripe-featured-config.js` / checkout 系 |

今回の identity helper は Featured ページ HTML には未読込。Featured seller 判定の JWT 化は STEP 6 以降。

---

# 未対応箇所（STEP 後続）

| 対象 | 理由 |
|------|------|
| `shop-store.html` / `detail-shop-store.html` / `shop-vendors.html` / `shop-products.html` / `detail-shop-product.html` | 閲覧導線 · script 未追加（`getDefaultSellerShopId` は helper 不在時 LS fallback） |
| `shop-market-seller.html` / `shop-market-listing-new.html` / seller-products | seller 管理 · `requireSeller()` 未適用 |
| `shop-market-seller-orders.js` seller ガード | デモ注文確認互換のため未ロック |
| Featured 申込 / Stripe checkout | 本番 checkout 禁止スコープ外 |
| `shop_orders` 本番 CRUD | 禁止 |
| Builder actor JWT 化 | STEP 6 |
| RLS / DB スキーマ | 禁止 |

---

# 検証結果

## 自動テスト

| コマンド | 結果 |
|----------|------|
| `node scripts/test-market-identity.mjs` | **ALL PASS** — demo buyer/seller · demo LS seller · prod LS blocked · checkout page |
| `node scripts/test-auth-current-user.mjs` | **ALL PASS** |
| `node scripts/test-connect-state.mjs` | **ALL PASS** |
| `node scripts/test-auth-ops-guard.mjs` | **ALL PASS** |
| `node scripts/verify-market-notify-live-flow.mjs` | **overallPass: true** — 購入〜レビュー通知 8/8 |

## チェックリスト

| # | 項目 | 結果 |
|---|------|------|
| 1 | localhost demo buyer 判定 | ✅ `u_me` |
| 2 | localhost demo seller 判定 | ✅ LS profile + DEMO_SELLER_BY_SHOP |
| 3 | `?talkDev=1` fallback | ✅ |
| 4 | production host 想定 LS seller 無効 | ✅ |
| 5 | production host 想定 LS buyer 無効 | ✅ |
| 6 | 未ログイン時の扱い | ✅ prod 空 · demo `u_me` |
| 7 | listings owner 照合 | ✅ `listingOwnerId` / `isListingOwnedByCurrentUser` |
| 8 | business_listings owner 照合 | ✅ 同一 helper（両 table クエリ） |
| 9 | Connect state helper 連携 | ✅ identity に `connectReady` 含有 |
| 10 | 既存市場導線 | ✅ notify live flow PASS |

---

# STEP5判定

## **PASS**

| PASS 条件 | 状態 |
|-----------|------|
| 本番 host で LS buyer/seller 昇格が無効 | ✅ |
| buyer/seller 判定が helper 経由になる | ✅（checkout · notify · mypage · getDefaultSellerShopId） |
| current user / DB 所有者照合方針が入っている | ✅ |
| 既存市場デモ導線が維持されている | ✅ |
| STEP 6 Builder actor JWT 化へ進める | ✅ |

### 警告（WARNING ではなく PASS 内メモ）

- 閲覧系 HTML（`shop-store.html` 等）には auth stack 未読込 — 本番 seller 管理ページでは STEP 6 で script 追加 + `requireSeller` 推奨。
- Featured / seller 管理の全面 JWT 化は意図的に後続へ defer。

---

**次ステップ:** NB-3 STEP 6 — Builder actor JWT 化（市場 seller 管理ページへの `requireSeller` / auth stack 展開を含む）
