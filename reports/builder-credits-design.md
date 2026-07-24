# Builder Credits — 設計レポート（Future）

**日付:** 2026-06-28  
**種別:** Future Draft · **設計のみ · 未実装**  
**正本:** [docs/AI/BUILDER_CREDITS.md](../docs/AI/BUILDER_CREDITS.md)

---

## サマリー

Builder プラットフォーム全体向け **共通クレジット（Builder Credits）** の将来設計。

- **Builder 専用** Wallet · Ledger
- **AI Membership · TLV · Platform · Coin 非統合**
- **サブスク補助**（Pro / Business 超過消費）· サブスク代替ではない

---

## 利用フロー（Future）

```text
Credits 購入 → Wallet 加算 → 有料機能で消費 → Ledger 保存
```

---

## スキーマ案

**builder_wallets:** `user_id` · `balance` · `locked_balance` · `lifetime_*` · `status`

**builder_wallet_ledger（INSERT ONLY):** `entry_type` · `credits_delta` · `balance_after` · `payment_id` · `reason_code` · `metadata`

**entry_type:** purchase · spend · refund · adjustment · bonus · expiration

---

## 設計原則

Builder 専用 · FIFO 不要 · Wallet 分離 · Ledger 監査 · 二重消費防止 · Transaction 前提 · Coin 非混在

---

## 対象機能（Future 消費例）

Contact Reveal · AI/Vision 追加 · PDF/レポート追加 · Marketplace · Premium Template · Sponsored 等

---

## Backlog

| ID | 内容 |
| --- | --- |
| BC-0 | 設計 ✅ |
| BC-1 | Wallet schema |
| BC-2 | Payment 連携 |
| BC-3 | Credits 購入 |
| BC-4 | Credits 消費 |
| BC-5 | 管理画面 |
| BC-6 | 監査ログ |

---

## 禁止（今回）

実装 · migration · Payment Engine 変更 · Stripe · 各種 Wallet 統合

---

*Design only · 2026-06-28*
