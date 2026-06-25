# 月次運営レポート（サンプル）

本書は `output/monthly-operator-report.md` の構成サンプルです。  
実データはスクリプト再生成で更新されます。

```bash
node scripts/generate-tlv-business-simulator.mjs
```

---

## レポート構成

1. **今月の収益** — 総広告収益・種別内訳
2. **今月のコスト** — Cloudflare / AI / Stripe / 固定費
3. **会社に残すべき金額** — 予備費 + 最低利益
4. **還元可能額** — payout_pool・還元合計・還元後利益
5. **推奨ベース還元率** — 内部値 + 公開表現ガイド
6. **上位クリエイターへの高還元提案** — Top / High Performer
7. **70% 適用者の理由** — 特別条件の記録
8. **70% にした場合の会社利益** — 試算比較
9. **AI 運営コメント** — 自動生成サマリー
10. **送金前チェックリスト** — 人手確認項目

---

## 公開表現ガイド

| NG（外部） | OK（外部） |
|-----------|-----------|
| 「還元率 60% です」 | 「成果に応じた段階制の収益還元」 |
| 「Top は 70%」 | 「大きく貢献いただいたクリエイターへ優遇還元」 |
| 固定％の表 | 貢献度・収益・コストに応じて変動する旨 |

内部運営用 JSON/CSV/Excel には具体値を残します。

---

## 送金前チェックリスト（要約）

- [ ] `safety_status` が `SAFE` または `CAUTION`（要レビュー）
- [ ] 還元合計 ≤ `payout_pool`
- [ ] 70% レンジ適用者の承認
- [ ] Stripe Connect ID の有効性（手動）
- [ ] 実送金は別フロー・本ツール外

---

## 最新出力の場所

| ファイル | 用途 |
|---------|------|
| [output/monthly-operator-report.md](output/monthly-operator-report.md) | 運営レポート本体 |
| [output/monthly-payout-decision.json](output/monthly-payout-decision.json) | API/ツール連携 |
| [output/stripe-connect-payouts.csv](output/stripe-connect-payouts.csv) | 送金候補 |

---

## 免責

- サンプル数値は検証用。実運用は会計実績で Inputs を更新すること
- AI コメントは判断補助であり、最終決定は運営者が行う
