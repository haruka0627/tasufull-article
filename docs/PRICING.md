# TLV Pricing — 実装仕様 v1

**最終更新:** 2026-06-28  
**種別:** 実装可能仕様  
**AD:** [DECISIONS.md](./DECISIONS.md) **AD-014**  
**関連:** [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md) · [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) · [LIVE_SYSTEM.md](./LIVE_SYSTEM.md)

**通貨:** 内部 **コイン（coin）** · 表示は「コイン」· 決済は JPY

---

## 1. コイン基本設計

### 1.1 換算レート（固定）

| 項目 | 値 |
| --- | --- |
| Web 基準 | **1 コイン = ¥1.00**（税込表示） |
| コイン小数 | **禁止** — 整数のみ |
| 有効期限 | 購入日から **180 日**（未使用分のみ失効） |
| 払戻 | **原則不可**（チャージバック除く） |

### 1.2 Web vs App 価格差

**目的:** Apple/Google IAP 手数料 30% を吸収し **Net Revenue を Web と同等** に揃える

| チャネル | 手数料率（Gross 対） | 価格係数 | 例: 500 コイン |
| --- | --- | --- | --- |
| **Web**（Stripe JPY） | 3.6% | ×1.00 | **¥550** |
| **iOS IAP** | 30% | ×1.4286 | **¥786** |
| **Android IAP** | 30% | ×1.4286 | **¥786** |

**Net 換算（500 コイン購入時）:**

```text
Web Net  = 550 * (1 - 0.036) = ¥530.20
App Net  = 786 * (1 - 0.30)  = ¥550.20  // 意図的に Web Net +2% バッファ
```

**DB:** `coin_packs.channel` ∈ `{web, ios, android}` · `coin_packs.price_jpy` · `coin_packs.coins`

---

## 2. コインパック（販売 SKU）

### 2.1 Web パック（正本）

| SKU ID | コイン | 価格（税込） | ボーナス | 実効単価 |
| --- | --- | --- | --- | --- |
| `web_coin_100` | 100 | ¥110 | 0 | ¥1.10/coin |
| `web_coin_500` | 500 | ¥550 | 0 | ¥1.10/coin |
| `web_coin_1000` | 1,000 | ¥1,100 | +50 | ¥1.05/coin |
| `web_coin_3000` | 3,000 | ¥3,300 | +200 | ¥1.03/coin |
| `web_coin_10000` | 10,000 | ¥11,000 | +1,000 | ¥1.00/coin |

**端数:** ボーナス込みでも **1 coin = 最低 ¥1.00 Net 相当** を FinOps が月次確認

### 2.2 App パック（同コイン数 · 係数 1.4286 丸め）

| SKU ID | コイン | iOS/Android 価格 |
| --- | --- | --- |
| `app_coin_100` | 100 | ¥157 |
| `app_coin_500` | 500 | ¥786 |
| `app_coin_1000` | 1,050 | ¥1,572 |
| `app_coin_3000` | 3,200 | ¥4,714 |
| `app_coin_10000` | 11,000 | ¥15,715 |

**価格端数:** 10 円単位切上（App Store 価格 tier 整合）

---

## 3. 初回無料コイン

| 項目 | 値 |
| --- | --- |
| 付与量 | **100 コイン** |
| 対象 | `users.first_coin_grant_at IS NULL` · 本人確認前でも可 |
| 1 アカウント 1 回 | device fingerprint 重複 → 付与拒否 |
| 使用制限 | 投げ銭 · ギフト · **延長不可**（延長は有償コインのみ） |
| 有効期限 | **30 日** |
| 還元対象 | **非還元** — Platform マーケ費用 |

**API:** `POST /api/tlv/wallet/grant-welcome` → `{ coins: 100, expires_at }`

---

## 4. ライブ — 30 分サバイバル延長

### 4.1 基本フロー

```text
T+0     配信開始（30 分無料 · 720p ラジオモード既定）
T+25:00 延長 UI 表示 · 500 コイン必要を明示
T+30:00 ゲージ未達 → 配信終了
        ゲージ達成 OR ルーム延長コイン ≥ 500 → 次 30 分開始
```

### 4.2 延長料金（確定仕様 v1）

| 項目 | 値 |
| --- | --- |
| 延長単位 | **30 分** |
| 必要コイン（ルーム合計） | **500 コイン** |
| 支払者 | 視聴者 1 名以上の合算 · Creator 自己負担可 |
| 無料コイン | **使用不可** |
| 未達時 | 配信 **強制終了**（Grace 60 秒） |

**収益帰属:** 延長コイン消費の **100% Gross** → Net 按分 → Creator 還元（[CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md)）

### 4.3 延長ゲージ（ルーム単位）

```text
gauge_pct = min(100,
  (unique_viewers_live * 2) +
  (avg_watch_minutes * 1.5) +
  (cheer_count * 0.5) +
  (paid_coins_in_room / 5)
)
```

**延長解放条件（いずれか）:**

- `gauge_pct >= 100` **かつ** `paid_extension_coins >= 500`
- **または** `paid_extension_coins >= 500` **かつ** `unique_viewers_live >= 5`

---

## 5. 投げ銭 · ギフトアイテム

### 5.1 価格 tier（コイン = 円相当）

| Tier | コイン | Web 支払参考 | 用途 |
| --- | --- | --- | --- |
| T1 | 100 | ¥110 | 軽い応援 |
| T2 | 300 | ¥330 | 標準ギフト |
| T3 | 500 | ¥550 | ライブ延長 1 単位相当 |
| T4 | 1,000 | ¥1,100 | 大型ギフト |
| T5 | 3,000 | ¥3,300 | イベント限定 |
| T6 | 10,000 | ¥11,000 | 上限（1 回） |

**1 トランザクション上限:** 10,000 コイン · **1 日/user/creator 上限:** 100,000 コイン

### 5.2 還元

```text
gift_net = gross * (1 - payment_fee_rate)
creator_share = gift_net * effective_payout_rate   // CREATOR_PROGRAM
platform_share = gift_net - creator_share
```

---

## 6. サブスクリプション

### 6.1 Viewer サブスク（TASFUL TLV Premium）

| プラン | Web 月額 | App 月額 | 特典 |
| --- | --- | --- | --- |
| `viewer_free` | ¥0 | ¥0 | 基本視聴 · 広告あり |
| `viewer_plus` | **¥480** | **¥686** | 広告なし · バッジ · スタンプ 5 個/月 |
| `viewer_vip` | **¥980** | **¥1,400** | Plus + VIP バッジ · 限定エフェクト 3 · 推し活ボーナス +10% |

**年額:** 月額 × 10（2 ヶ月分無料）— Web のみ v1

### 6.2 Creator サブスク（Studio Pro）

| プラン | Web 月額 | App 月額 | 特典 |
| --- | --- | --- | --- |
| `creator_free` | ¥0 | ¥0 | 30 分無料ライブ · 基本分析 |
| `creator_pro` | **¥1,980** | **¥2,829** | 1080p · Creator Dashboard · AI レポート 4 回/月 |
| `creator_business` | **¥4,980** | **¥7,114** | Pro + 高画質 · チーム 3 席 · API export |

**Creator サブスク収益:** Platform 100%（Creator 還元対象外 · infra 割引に充当）

### 6.3 チャンネルメンバーシップ（Viewer → Creator）

| Tier | 月額（Web） | Creator 取り分 |
| --- | --- | --- |
| メンバー | ¥300 | Net × **70%**（Bronze 基準） |
| 上位メンバー | ¥800 | Net × **effective_rate** |

App 価格: Web × 1.4286

---

## 7. Web 決済誘導ロジック

### 7.1 表示ルール

| 条件 | UI 動作 |
| --- | --- |
| App 内コイン購入画面 | 先頭に **「Web なら約 30% お得」** バナー |
| 500 コイン比較表示 | Web **¥550** vs App **¥786**（同時表示） |
| 初回購入 | Web 限定 +50 コインボーナス（`web_first_purchase_bonus` · 1 回） |

### 7.2 Deep Link

```
https://tasufull.jp/tlv/wallet?source=app_deeplink&sku=web_coin_500
```

App → Universal Link · 購入完了 Webhook → App wallet sync

### 7.3 Creator 還元連動

```text
WR_month = web_net_jpy / max(total_net_jpy, 1)
```

Web 比率が [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) 90% 条件 **≥ 0.60** · 95% **≥ 0.75** に寄与

---

## 8. Apple / Google 手数料の扱い

| 処理 | ルール |
| --- | --- |
| 会計 Gross | ユーザー支払額（IAP 含む） |
| Net 計算 | `net = gross * (1 - fee_rate)` |
| fee_rate Web | 0.036 |
| fee_rate iOS/Android | 0.30 |
| Creator 還元基準 | **常に Net** |
| App 価格設定 | §1.2 係数で Net parity |
| レポート | `ledger.payment_channel` 必須 |

**禁止:** Gross ベース還元 · App 内で Web 価格の直接表示（ストア規約）

---

## 9. 心理 × PL 両立ルール

| ID | ルール |
| --- | --- |
| UX-01 | 延長 500 コイン = 最安パック 1 個（¥550）— **決断コスト最小** |
| UX-02 | 100/300/500/1000 tier — **4 択以下**（AD-012） |
| UX-03 | 初回 100 コインでギフト体験 → 延長は有償転換 |
| PL-01 | 30 分無料 infra 上限 **¥150/セッション**（Platform 負担 · [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md)） |
| PL-02 | 延長 500 coin 未満のルームは **延長不可** |
| PL-03 | 月次 FinOps で App/Web Net 差 **±3% 以内** を監視 |

---

## 10. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | v1 実装仕様 — コイン · 延長 500 · サブスク · Web/App 差 |
