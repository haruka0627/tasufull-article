# 市場EC — リリース確定

**確定日:** 2026-06-16  
**状態:** ✅ リリース可能（RELEASE FROZEN）

以降、市場ECの新規修正は停止。残課題はリリース後改善（P1/P2）として扱う。

---

## 確定内容

| 項目 | 判定 | 根拠 |
|------|------|------|
| P0（リリースブロッカー） | **なし** | `screenshots/market-final-re-audit/report.md` |
| 検索 SP CTA 44px+ | **PASS** | `screenshots/market-search-sp-cta/` |
| 注文完了 CTA source別導線 | **PASS** | market / store 両導線・390/1280 全項目 PASS |
| 注文確認 | **PASS** | 最終再監査 1280px PASS / 390px 購入導線問題なし |
| 商品詳細 | **PASS** | 最終再監査 SP 390px PASS / 購入導線 44px |
| 横スクロール | **全ページなし** | 5ページ × 390/1280 全 PASS |

---

## 対象ページ（凍結スコープ）

- `shop-store.html` — 市場TOP
- `shop-search.html` — 検索
- `detail-shop-product.html` — 商品詳細
- `shop-market-checkout.html` — 注文確認
- `shop-market-complete.html` — 注文完了

関連 CSS/JS・監査スクリプトも本凍結の対象とする。

---

## リリース後改善（P1/P2 — 修正不要でリリース可）

- 市場TOP PC: カード全体リンク形式の CTA 検出（WARNING）
- 商品詳細 PC: CTA 42px（SP は 44px PASS）
- 注文確認 SP: 固定バー CTA の監査検出（実導線は問題なし）
- 注文完了 PC: コンテンツ幅 760px
- フッター統一・戻り導線・ヘッダー細部

---

## 凍結済みサブシステム

| 領域 | 凍結マーカー | 検証 |
|------|-------------|------|
| 注文完了 CTA | `shop-market-complete.js` `PASS凍結` | `verify-market-complete-cta-final.mjs` |
| 検索 SP CTA | `shop-market-search.css` 44px | `verify-market-search-sp-cta.mjs` |

---

## 再検証コマンド（参考・変更時のみ）

```bash
node scripts/review-market-final-ux-audit.mjs
node scripts/verify-market-search-sp-cta.mjs
node scripts/verify-market-complete-cta-final.mjs
```

---

## 次フェーズ

市場EC は本ドキュメント時点で **RELEASE FROZEN**。  
新規の市場EC修正チケットは受け付けない。次フェーズの作業へ移行する。
