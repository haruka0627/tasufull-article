# product / shop 支払い方式別フロー — 最終サマリー

**生成元:** 既存レポートのみ（`reports/product-shop-payment-final-verify/*.json` / `*-ng-bulk-copy.txt`）  
**再実行:** なし（Playwright / スクショ / 画像比較なし）  
**Base:** `http://localhost:5173`  
**判定基準:** `final.ngCount` / `final.ngCodes` を business NG とする（`scripts/verify-product-shop-payment-final-review.mjs` の `IGNORE_NG` 除外後）

---

## 総合判定

| 項目 | 結果 |
|---|---|
| 対象 CASE 数 | 6 / 6 |
| business 合否 | **全 CASE OK** |
| business NG 合計 | **0** |
| 全 CASE `completed` | **true** |
| 検証方式 | DOM / textContent / localStorage / notify iframe / postMessage / NG bulk テキスト |

**結論:** product / shop × prepaid / bank_transfer / cash_on_delivery の **6 CASE はいずれも business OK（通過扱い）** です。

---

## 6 CASE 結果一覧

| # | CASE | checkpoints | exit (`ok`) | businessNg (`final.ngCount`) | `completed` | reviewA | reviewB | レポート JSON |
|---|---|---:|---|---:|---|---|---|---|
| 1 | product-prepaid | 3 | ✅ true | 0 | ✅ true | ✅ true | ✅ true | `product-prepaid.json` |
| 2 | product-bank_transfer | 6 | ✅ true | 0 | ✅ true | ✅ true | ✅ true | `product-bank_transfer.json` |
| 3 | product-cash_on_delivery | 4 | ✅ true | 0 | ✅ true | ✅ true | ✅ true | `product-cash_on_delivery.json` |
| 4 | shop-prepaid | 3 | ✅ true | 0 | ✅ true | ✅ true | ✅ true | `shop-prepaid.json` |
| 5 | shop-bank_transfer | 6 | ✅ true | 0 | ✅ true | ✅ true | ✅ true | `shop-bank_transfer.json` |
| 6 | shop-cash_on_delivery | 4 | ✅ true | 0 | ✅ true | ✅ true | ✅ true | `shop-cash_on_delivery.json` |

### checkpoint 内訳（フロー定義）

| 支払い方式 | checkpoint 数 | ステップ ID |
|---|---:|---|
| prepaid | 3 | `01-start` → `02-after-ship` → `03-after-receive` |
| bank_transfer | 6 | `01-start` → `02-after-shipping-ready` → `03-after-bank-report` → `04-after-payment-confirm` → `05-after-ship` → `06-after-receive` |
| cash_on_delivery | 4 | `01-start` → `02-after-ship` → `03-after-cod-report` → `04-after-cod-confirm` |

### 各 CASE の final thread 状態（抜粋）

| CASE | threadId（例） | paymentMethod | 完了時フラグ |
|---|---|---|---|
| product-prepaid | `chat-1781032801890-5qovag` | prepaid | shipped + received + completed |
| product-bank_transfer | `chat-1781033466544-qd9i9c` | bank_transfer | shippingReady + bank + payment + shipped + received + completed |
| product-cash_on_delivery | `chat-1781033219541-nh21a4` | cash_on_delivery | shipped + codReported + codConfirmed + completed |
| shop-prepaid | `chat-1781033358904-2zav1b` | prepaid | shipped + received + completed |
| shop-bank_transfer | `chat-1781033526002-3i5zin` | bank_transfer | 同上（bank 系フラグすべて true） |
| shop-cash_on_delivery | `chat-1781034804806-finavq` | cash_on_delivery | shipped + codReported + codConfirmed + completed |

全 CASE で `errors: []`（verify スクリプト exit 0 相当）。

---

## business NG と診断系 NG の分離

### business NG（フロー合否に使用）

| CASE | `final.ngCount` | `final.ngCodes` | `final.diagnosticNgCount` |
|---|---:|---|---:|
| 全 6 CASE | **0** | `[]` | **0** |

→ **product/shop フロー本体の合否判定に使う business NG はゼロ。**

### 診断系 NG（ng-bulk-copy 記録のみ・business 判定外）

ベンチ診断パネルの NG 一覧（`*-ng-bulk-copy.txt`）に残る項目。verify スクリプトの `IGNORE_NG` により **business 判定から除外** されるものを含みます。

| ngType / cause | 分類 | 備考 |
|---|---|---|
| `chat_diag_ok_but_composer_missing_dom` | **診断系（記録のみ）** | `IGNORE_NG` 対象。diag OK だが composer DOM 未検出 |
| `product_shipping_postmessage_missing` | **診断系（記録のみ）** | `IGNORE_NG` 対象。store/DOM はあるが bench postMessage ログ未記録 |
| `product_receive_ui_blocked_by_frozen_iframe` | **診断系（記録のみ）** | `IGNORE_NG` 対象。frozen iframe 中の受取 UI 検出 |
| `notification_missing` / `notification_store_not_written` | **診断系（記録のみ）** | shop-cash_on_delivery の ng-bulk のみ。business `ngCount` には未反映 |

### CASE 別 ng-bulk NG 件数

| CASE | ng-bulk `NG count` | 診断系 ngType（ng-bulk より） |
|---|---:|---|
| product-prepaid | 3 | composer_missing_dom, receive_ui_frozen, shipping_postmessage_missing |
| product-bank_transfer | 3 | 同上 |
| product-cash_on_delivery | 2 | composer_missing_dom, shipping_postmessage_missing |
| shop-prepaid | 3 | composer_missing_dom, receive_ui_frozen, shipping_postmessage_missing |
| shop-bank_transfer | 3 | 同上 |
| shop-cash_on_delivery | 3 | composer_missing_dom, **notification_store_not_written**, shipping_postmessage_missing |

**注意:** `chat_diag_ok_but_composer_missing_dom` は全 CASE で ng-bulk に記録されますが、**product/shop 支払いフロー本体の合否には含めません**（診断系残 NG として記録のみ）。

---

## 変更ファイル一覧（本検証・修正スコープ）

検証インフラ（スクショ禁止・直列・finally close）:

| ファイル | 概要 |
|---|---|
| `scripts/verify-product-shop-payment-final-review.mjs` | メイン検証。CASE 単体、`IGNORE_NG`、boot reset 待ち、business/diagnostic 分離 |
| `scripts/capture-product-shop-payment-final-review.mjs` | スクショ no-op、直列化 |
| `scripts/test-product-shop-payment-flows.mjs` | `withPlaywrightSession`、スクショ削除 |
| `scripts/lib/playwright-browser.mjs` | 共有ブラウザ起動・finally close |

フロー本体（shop-cash_on_delivery 最終修正含む）:

| ファイル | 概要 |
|---|---|
| `chat-thread-store.js` | product/shop 購入 thread の `resolveThreadAccess` 復元、`createThreadFromContact` partner ID 正規化 |
| `platform-chat-purchase-payment-flow.js` | `confirmCodCollection` の store 永続化チェック |

ベンチ安定化・メモリ（検証補助）:

| ファイル | 概要 |
|---|---|
| `chat-dual-window-demo.html` | ログ上限、reconcile、idle hygiene |
| `chat-detail.js` | init trace 上限 |
| `platform-chat-bench-flow-diag.js` | 診断スナップショット軽量化、NG bulk 上限 |

---

## 参照ファイル

| 種別 | パス |
|---|---|
| CASE レポート | `reports/product-shop-payment-final-verify/{CASE}.json` |
| NG bulk テキスト | `reports/product-shop-payment-final-verify/{CASE}-ng-bulk-copy.txt` |
| 直近 CASE サマリー | `reports/product-shop-payment-final-verify/summary.json`（最終実行: shop-cash_on_delivery） |
| 人可読 index | `reports/product-shop-payment-final-verify/index.md` |

---

## 運用メモ（再検証時）

```powershell
$env:CASE='shop-cash_on_delivery'; node scripts/verify-product-shop-payment-final-review.mjs
```

- 1 CASE ずつ実行（連続ループ禁止）
- スクショ・並列・長時間 wait 禁止
- browser / context / page は `finally` で close

---

*Generated from existing reports only. No Playwright re-run.*
