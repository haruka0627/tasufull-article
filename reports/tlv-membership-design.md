# TLV 月額メンバーシップ — 追加設計レポート

**日付:** 2026-06-28  
**版:** 追加設計 v0.1（**未実装**）  
**正本:** [TLV_PRD.md](../docs/TLV_PRD.md) §11 · [TLV_PAYMENT_ENGINE.md](../docs/TLV_PAYMENT_ENGINE.md) §14 · [TLV_DB_SCHEMA.md](../docs/TLV_DB_SCHEMA.md) §11

**ステータス:** **設計のみ** — migration · Edge Functions · DDL 実装は **未着手**

---

## 1. 採用理由

YouTube 型の **月額メンバーシップ（Membership Subscription）** を TLV に導入する方針を採用する。

| 目的 | 説明 |
| --- | --- |
| ストック収益 | 投げ銭（フロー）に加え、月次の予測可能な収益 |
| 固定ファン化 | Creator と Viewer の継続関係 |
| Creator 収益安定 | 配信外でも基礎収入の足し |
| Platform 予測性 | 月次 MRR · FinOps 計画 |
| Profit First 補強 | `SubPlatformRevenue`（PRD §3.1）の具体化 |

**UX:** 視聴者には「推し支援」として投げ銭と **連動して見せる**（同一 Creator ページ · ダッシュボード）。

**会計:** Coin Purchase / Tip / Gauge / Extension / Score **とは完全分離**。Wallet coin を消費しない。

---

## 2. 採用しないもの（初期 MVP）

| 禁止・延期 | 理由 |
| --- | --- |
| サブスクで Wallet coin を直接消費 | coin 残高正本は `viewer_wallets` · tip 専用 |
| サブスクだけで Legend / 95% 還元 | 30 分サバイバル · Tip · PPC 主軸を維持 |
| 自動ゲージ回復 · 自動延長 | 30 分サバイバル UX を壊す |
| サブスク人数による常時バフ | P2W · ゲージ不正 |
| 30 分サバイバル無効化特典 | L1 ゲーム性の根幹 |
| `stream_events` への JPY 正本 | 既存ルール維持 |
| クリエイター自由価格 | IAP / Stripe 管理複雑化 — Platform 固定 Tier |

---

## 3. 収益源との関係

```text
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│  Coin Purchase  │  │      Tip        │  │ Membership Subscription │
│  (Phase 2 済)   │  │  (Phase 2 済)   │  │   (追加設計 · 未実装)    │
├─────────────────┤  ├─────────────────┤  ├─────────────────────────┤
│ payments        │  │ tips            │  │ subscription_invoices   │
│ viewer_wallets  │  │ revenue_ledger  │  │ user_subscriptions      │
│ coin_lots       │  │ gauge_state     │  │ revenue_ledger          │
│ wallet_ledger   │  │ stream_events   │  │   (subscription_revenue)│
└─────────────────┘  └─────────────────┘  │ membership_events       │
        │                    │              └─────────────────────────┘
        └──────── coin / tip レーン ────────┘
                              │
                    会計・DB・Ledger 完全分離
```

---

## 4. Payment Engine 接続方針

**別レーン** — 既存 Phase 2（`tlv-create-coin-purchase` · `tlv-payment-webhook` · `tlv-create-tip`）は **変更しない**。

| 将来 Edge（候補） | 責務 |
| --- | --- |
| `tlv-create-membership-checkout` | Stripe Checkout / Billing · Subscription 作成 |
| `tlv-membership-webhook` | subscription / invoice / refund / dispute |

**決済型:** PaymentIntent（coin）ではなく **Subscription + Invoice**。

**売上認識:** `invoice.paid` → `subscription_invoices` → `revenue_ledger.event_kind = subscription_revenue`（tip 行と別 entry）。

**coin grant 特典（将来）:** 購入ではなく **`wallet_ledger` grant エントリ** — `entry_type` は ops/subscription_grant 等 · FIFO lot とは別経路。

詳細: [TLV_PAYMENT_ENGINE.md](../docs/TLV_PAYMENT_ENGINE.md) §14

---

## 5. DB 候補（DDL 未実装）

| テーブル | 正本責務 |
| --- | --- |
| `membership_tiers` | Creator ごとのプラン定義 · Platform 固定価格 Tier |
| `user_subscriptions` | 購読状態正本 · Webhook 更新 |
| `subscription_invoices` | 請求 / 売上 / refund 正本 |
| `membership_events` | UX / audit（**JPY 正本ではない**） |

**既存テーブルとの境界:**

| テーブル | 責務 |
| --- | --- |
| `viewer_wallets` | coin 残高のみ — サブスク課金なし |
| `wallet_ledger` | coin 監査 — grant 時のみサブスク連動 |
| `revenue_ledger` | JPY PL — tip 行と subscription 行を entry_kind で分離 |
| `stream_events` | 配信 UX のみ — メンバーシップ JPY なし |

詳細: [TLV_DB_SCHEMA.md](../docs/TLV_DB_SCHEMA.md) §11

---

## 6. Score / Creator Program 反映方針

**既存 Score / Rank / 90% / 95% 制度は変更しない。**

新指標候補: **Subscription Profit Contribution（SPC）**

| ソース | PPC 反映（候補） |
| --- | --- |
| Tip 由来 PPC | **100%**（現行維持） |
| Subscription 由来 SPC | **30〜50%**（PL 検証後に確定 · TODO-MEM-01） |

**Legend / 95% 条件:** サブスクだけでは突破不可 · 既存 T95-5（月間 PPC ≥ ¥500,000）等は **維持**（TODO-MEM-02）。

**PPC / WR / TS / Score / 定員 100 / PPR 順** の構造は変更しない。

詳細: [CREATOR_PROGRAM.md](../docs/CREATOR_PROGRAM.md) §2.7

---

## 7. 価格 · Tier（Platform 固定）

| tier_code（候補） | 価格（JPY/月） |
| --- | --- |
| `tier_300` | ¥300 |
| `tier_500` | ¥500 |
| `tier_1000` | ¥1,000 |
| `tier_3000` | ¥3,000 |

- Creator は **Tier 選択** + 名称 · 説明 · 特典（`benefits` jsonb）を編集
- **価格そのものは固定**（TODO-MEM-08 で最終確定）
- Web / App 価格は分離可能（TODO-MEM-06）

---

## 8. 特典設計

### 8.1 初期 MVP

- メンバーバッジ
- 限定スタンプ
- 限定チャット
- 限定称号
- 限定プロフィール装飾
- 限定コミュニティ投稿閲覧

### 8.2 初期 MVP 除外

- 自動ゲージ回復 · 自動延長
- サブスク人数バフ
- 30 分サバイバル無効化

### 8.3 将来検討

- イベント限定ゲージ支援
- 週 1 回限定支援
- メンバー限定ギフト
- 毎月 coin grant（**wallet_ledger 必須** · TODO-MEM-07）

---

## 9. App / Web 決済

| チャネル | 優先度 | 備考 |
| --- | --- | --- |
| **Web Stripe Billing** | **MVP 優先** | Checkout / Customer Portal |
| Apple IAP | 将来 | receipt validation · server notification |
| Google Play Billing | 将来 | 状態同期遅延に備え server-side 正本 |

- App 内から Web 安価誘導 **禁止**
- Web / App 価格差は設計上許容 · 係数は TODO-MEM-06

---

## 10. 状態機械（`user_subscriptions.status`）

```text
incomplete → active | trialing
active → past_due | canceled (cancel_at_period_end)
past_due → grace_period | unpaid | active (retry success)
grace_period → active | canceled
trialing → active | canceled
canceled / unpaid → （権利終了）
```

- `cancel_at_period_end=true` → `current_period_end` まで権利維持
- `payment_failed` → 即剥奪せず **Grace Period 3〜7 日**（TODO-MEM-03）

---

## 11. Profit First との整合

- サブスク Net は **Creator 還元 · Platform gross** を `revenue_ledger` で tip と **別 entry** 記録
- refund / chargeback は **マイナス仕訳**（TODO-MEM-05）
- PF-02 / PF-06 · Override 90/95% 条件は **既存 PRD のまま**
- サブスク収益は Platform 予測性向上に寄与するが、**Tip 主軸の 30 分サバイバルは不変**

---

## 12. 30 分サバイバルを壊さない制約

1. 延長は引き続き **500 coin + §3.4 grant ガード**（Tip レーン）
2. メンバーシップは **gauge_state / tlv.create_tip に触れない**
3. ES 延長参加率等の Score 式は **Tip ベースを維持**
4. サブスク特典は **非 P2W · 非ゲージ操作** から開始

---

## 13. TODO 一覧

| ID | 内容 | 状態 |
| --- | --- | --- |
| **CAND-MEM-01** | Membership Subscription 追加設計 | **設計追加済** |
| TODO-MEM-01 | SPC の Score 反映係数（30〜50% 候補） | 未決 |
| TODO-MEM-02 | Legend / 95% へのサブスク利益反映範囲 · PL 検証 | 未決 |
| TODO-MEM-03 | Grace Period 日数（3〜7 日候補） | 未決 |
| TODO-MEM-04 | Stripe Billing webhook event 確定 | 未決 |
| TODO-MEM-05 | refund / chargeback / clawback 設計 | 未決 |
| TODO-MEM-06 | Web / App 価格差設計 | 未決 |
| TODO-MEM-07 | monthly coin grant 要否 | 未決 |
| TODO-MEM-08 | 固定 Tier 価格の最終候補 | 未決 |
| TODO-MEM-09 | membership_events と stream_events の境界 | 未決 |
| TODO-MEM-10 | RLS 設計 | 未決 |

---

## 14. 実装ステータス

| 項目 | 状態 |
| --- | --- |
| PRD / ENGINE / DB / CREATOR_PROGRAM / TODO 追記 | 本レポート同期 |
| `db/tlv_schema.sql` | **変更なし** |
| migration | **なし** |
| Edge Functions | **なし** |
| Payment Engine Phase 2 | **変更なし** |

**次フェーズ（未着手）:** TODO-MEM-* 決定 → DDL 草案 → Stripe Billing MVP（Web のみ）
