# TLV Admin System — 実装仕様 v1

**最終更新:** 2026-06-28  
**種別:** 実装可能仕様  
**AD:** [DECISIONS.md](./DECISIONS.md) **AD-014** · **AD-004**（AI は TASFUL AI 入口）  
**関連:** [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) · [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md) · [EVENT_SYSTEM.md](./EVENT_SYSTEM.md)

**アクセス:** Cloudflare Access + Ops role JWT · 監査ログ必須

---

## 1. ダッシュボード構造

```text
/admin/tlv/
├── executive/          # Executive Dashboard
├── finops/             # FinOps Console
├── creators/           # Creator CRM
├── trust/              # Trust & Safety
├── infra/              # CDN · 配信監視
├── payments/           # 決済管理
├── payouts/            # Creator 還元管理
├── events/             # Event 管理
├── ads/                # 広告管理
└── ai-insights/        # AI 監視（TASFUL AI 埋込 · AD-004）
```

---

## 2. KPI 定義 · 計算式

**集計 TZ:** `Asia/Tokyo` · **刷新:** Executive 5 分 · FinOps 1 時間

### 2.1 ユーザー KPI

| KPI | 式 | ソース |
| --- | --- | --- |
| **DAU** | `count(distinct user_id) WHERE activity_date = today` | `user_activity_daily` |
| **MAU** | `count(distinct user_id) WHERE activity_date in month` | 同上 |
| **課金率** | `paying_users / DAU` | `ledger` / DAU |
| **ARPU** | `Net_month / MAU` | `platform_pl_monthly` |
| **ARPPU** | `Net_month / paying_users` | `ledger` |
| **LTV** | `Σ Net_user_12m / cohort_users` | cohort テーブル |
| **CAC** | `marketing_spend / new_paying_users` | 手入力 + ledger |

### 2.2 Creator · Viewer

| KPI | 式 |
| --- | --- |
| **Creator Retention** | `creators_active_m / creators_active_m-1` |
| **Viewer Retention** | `viewers_active_m / viewers_active_m-1` |
| **Web 決済比率** | `web_net / total_net` |
| **Profit 率** | `platform_profit / net_jpy` |
| **Creator Pool** | `pool_fund_jpy`（[CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §5） |
| **Platform Profit** | `platform_pl_monthly.platform_profit` |

### 2.3 アラート閾値

| KPI | WARN | CRIT |
| --- | --- | --- |
| Profit 率 | < 12% | < 8% |
| Web 決済比率 | < 55% | < 45% |
| 課金率 | < 2% | < 1% |
| Creator Retention | < 85% | < 75% |
| Chargeback 率 | > 0.5% | > 1% |

---

## 3. Executive Dashboard

**URL:** `/admin/tlv/executive`

| ウィジェット | 内容 | 更新 |
| --- | --- | --- |
| 今日の Net / Profit | リアルタイム概算 | 5 min |
| DAU / 同時配信 | ライブ数 · CCU 合計 | 1 min |
| Top 10 Creator Net | 匿名化オプション | 1 h |
| イベント進行 | 開催中 KPI | 15 min |
| アラート一覧 | CRIT のみ | realtime |

**権限:** `role: tlv_executive`

---

## 4. FinOps Console

**URL:** `/admin/tlv/finops`

### 4.1 機能

| 機能 | 説明 |
| --- | --- |
| PL 月次確定 | `platform_pl_monthly` ロック |
| infra 単価更新 | `infra_unit_costs` CRUD |
| Profit First シミュレータ | 還元率変更 → PPR 投影 |
| セグメント PL | Live / VOD / Short タブ |
| 同接シミュレータ | [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md) §5 入力 UI |

### 4.2 Profit First 自動アクション

```typescript
if (monthly_profit_rate < 0.08) {
  disablePayoutTier95NewGrants();
  reduceCreatorPoolContribution(0.10 → 0.05);
  notifyFinOps('CRIT_PROFIT_RATE');
}
```

**権限:** `role: tlv_finops`

---

## 5. Creator CRM

**URL:** `/admin/tlv/creators/{creator_id}`

| タブ | データ |
| --- | --- |
| 概要 | Score · Rank · 還元率 · 90/95 条件チェックリスト |
| 収益 | Net · Payout · Pool bonus |
| ライブ履歴 | セッション PL 一覧 |
| Trust | TS 内訳 · strikes |
| 操作 | 還元停止 · 手動降格 · メモ |

**還元停止 API:**

```
POST /admin/api/tlv/creators/{id}/payout-hold
Body: { reason, until_at, operator_id }
```

---

## 6. Trust & Safety

**URL:** `/admin/tlv/trust`

### 6.1 BOT 検知

| シグナル | 重み | アクション |
| --- | --- | --- |
| 同一 IP > 50 session/日 | 0.4 | view 除外 |
| User-Agent クラスタ | 0.3 | CAPTCHA |
| 視聴 0 秒 · cheer のみ | 0.5 | スコア除外 |
| `bot_score >= 0.7` | — | 自動 BAN 24h |

```text
bot_score = clamp(Σ signal_weight, 0, 1)
```

### 6.2 自己投げ銭検知

| ルール | 条件 |
| --- | --- |
| SG-01 | `payer.kyc_id == creator.kyc_id` |
| SG-02 | 同一 device_id · 異なる account |
| SG-03 | 新規 account → 単一 Creator へ 7 日で ≥ ¥50,000 |
| SG-04 | 還元直前の concentrated gift（1h 内 80%） |

**確定時:** 還元停止 30 日 · **TS −100**（正本 [TLV_PRD.md](./TLV_PRD.md) §7.1） · [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md)

### 6.3 マネロン対策

| 段階 | 処理 |
| --- | --- |
| 1 疑義 | 出金保留 · 追加 KYC |
| 2 CONFIRMED | 還元永久停止 · 当局報告フロー |
| 3 | アカウント閉鎖 |

**閾値:** 30 日 Net ≥ ¥1,000,000 かつ KYC 未完了 → 自動段階 1

### 6.4 Trust Score（Viewer · 0〜100）

```text
TrustScore = 100 - bot_score*50 - chargeback_count*20 - report_valid*5
```

Creator TS（200 満点）とは **別スコア**

### 6.5 Creator TS 回復（Ops · TLV_PRD §5.5.3 正本）

**URL:** `/admin/tlv/trust` → **TS Recovery** タブ

| 操作 | 前提 | 記録 |
| --- | --- | --- |
| **誤判定解除** | 当該 SG/Collusion/CB case が `cleared` | `TS_FALSE_POSITIVE_REVERSAL` · 全額復元 |
| **レビュー PASS** | TS&lt;50 / TS=0 復帰チェックリスト ALL | `TS_OPS_REVIEW_PASS` · +10〜15 |
| **KYC 完了加点** | マネロン段階 1 解除 · major sanction なし | `TS_KYC_COMPLETED` · +10 · 1 回限り |

**自動（日次 03:30 JST）:** `TS_CLEAN_PERIOD_RECOVERY` — 30 日無 penalty → +5（90 日 max +15）

**還元再開（TS&lt;50）:** レビュー PASS で `payout_hold` 解除 **可** — TS 点数回復とは **別操作**（還元再開のみで Override は TS≥80 まで不可）。

**禁止:** 暦月 +30 超の手動加点（誤判定解除を除く）· DMCA / マネロン CONFIRMED への回復操作

### 6.6 共謀（Collusion · TLV_PRD §7.5 正本）

**URL:** `/admin/tlv/trust` → **Collusion Queue**

| 段階 | Ops アクション | システム |
| --- | --- | --- |
| **Triage** | CL-01〜05 ヒット確認 · 関連 Creator / payer 一覧 | `suspicious_collusion_flag=true` |
| **Hold** | 疑義 strong → payout 保留 | `creators.payout_hold=true` |
| **Confirmed** | 証拠確定 · Net 除外範囲指定 | `collusion_confirmed` · PPC 除外 · TS−50〜100 |
| **Cleared** | 誤検知 | flag 解除 · 必要なら TS 誤判定解除 |
| **Repeat / Severe** | 還元 90〜180 日停止 · アカウント審査 | `collusion_repeat` · Override 無効 |

**自己投げとの振り分け:** SG-01〜04 該当 → §6.2。**異 account 循環** → 本節。

**エスカレーション:** CL-04 / CL-05 + Net ≥ ¥500k → FinOps + マネロン §6.3 段階 1 連動

---

## 7. インフラ監視

**URL:** `/admin/tlv/infra`

| メトリク | ソース | WARN |
| --- | --- | --- |
| CDN egress GB/日 | Cloudflare Analytics | > 予算 120% |
| 同時配信数 | Stream API | > 800 |
| エンコードキュー | Worker metrics | > 60s lag |
| Storage 増加率 | R2/GCS | > 20%/週 |
| API エラー率 | Edge logs | > 1% |

**自動:** CCU > 8000 → 新規 1080p 禁止 · 480p 推奨

---

## 8. AI 監視システム（TASFUL AI 入口 · AD-004）

**URL:** `/admin/tlv/ai-insights` → iframe `ai-workspace.html?source=tlv_admin`

| 機能 | 入力 | 出力 |
| --- | --- | --- |
| 異常検知サマリー | 日次 KPI JSON | テキストアラート（自動送信 **禁止** · 人間確認） |
| リテンション分析 | cohort CSV | 提案レポート |
| 利益分析 | PL 月次 | 還元率シナリオ 3 案 |

**禁止:** 自動還元変更 · 自動 BAN · 自動返信

---

## 9. 決済 · 還元管理

### 9.1 決済管理 `/admin/tlv/payments`

- Stripe / IAP イベントログ
- チャージバックワークフロー
- Web/App Net 差分レポート

### 9.2 還元管理 `/admin/tlv/payouts`

**月次フロー:**

```text
D+1  03:00  creator-score-daily 確定
D+5  06:00  creator-payout-monthly 実行
D+5  10:00  FinOps レビュー（hold リスト）
D+7  12:00  振込バッチ（KYC PASS のみ）
```

**hold 条件:** `payout_hold = true` · `TS < 80` · `chargeback_pending` · `suspicious_collusion_flag` · wallet `frozen`

### 9.3 Clawback · Chargeback 運用（FinOps · TLV_PRD §7.6 正本）

**URL:** `/admin/tlv/payments` · `/admin/tlv/payouts`

| ケース | 手順 | 記録 |
| --- | --- | --- |
| **dispute.created** | 自動 lock · creator hold | `payment_reversals(dispute_open)` |
| **dispute.lost / refund** | RPC clawback · revenue adjustment | `applied` · TS−20 |
| **payout 前・未出金相殺** | 次回 payout 計算から **自動控除**（adjustment 行） | `payout_log` メモ |
| **将来売上相殺** | 回収完了まで **payout_hold** · 月次 batch で控除額累積 | **Wallet マイナス禁止** |
| **payout 済み** | Stripe Connect **manual recovery** · 回収不能時 account review | `manual_finops` · `admin_audit_log` |
| **shortfall / frozen** | viewer wallet frozen · Creator hold 継続 | `coins_shortfall` · 利用者通知（TODO-LEGAL-CB-01） |

**日次 triage:** CRIT dispute · shortfall · manual_finops 未完了一覧（09:00 JST）

**禁止:** `coin_balance` 負値操作 · silent 残高改ざん · Connect 自動 clawback v1 必須化

---

## 10. Event · 広告管理

| モジュール | 機能 |
| --- | --- |
| `/admin/tlv/events` | カレンダー CRUD · KPI ダッシュボード · 予算 cap |
| `/admin/tlv/ads` | 広告枠 · 収益按分 · Creator ad_share 設定 |

---

## 11. オペレーション cadence

### 11.1 日次（毎日 09:00 JST）

- [ ] DAU / Net / Profit 速報確認
- [ ] Trust アラート triage（CRIT 30 分以内 · **collusion queue 含む**）
- [ ] CDN 前日コスト
- [ ] ライブ赤字セッション一覧（`platform_profit < 0`）

### 11.2 週次（月曜 10:00 JST）

- [ ] ARPU / ARPPU / 課金率トレンド
- [ ] Creator Retention cohort
- [ ] Web 決済比率 · App 価格差レビュー
- [ ] イベント ROI 中間評価
- [ ] infra 単価 drift チェック

### 11.3 月次（翌月 5 営業日まで）

- [ ] `platform_pl_monthly` 確定 · ロック
- [ ] Creator Pool 分配承認
- [ ] 還元率 90/95 資格監査
- [ ] FinOps 利益率モデル（FM_10〜25）比較
- [ ] Trust & Safety 月次レポート
- [ ] infra 単価正式更新

---

## 12. 監査ログ

```sql
CREATE TABLE admin_audit_log (
  id           bigserial PRIMARY KEY,
  operator_id  uuid NOT NULL,
  action       text NOT NULL,
  resource     text NOT NULL,
  payload_json jsonb,
  created_at   timestamptz DEFAULT now()
);
```

**必須記録:** payout-hold · rank override · infra 単価変更 · PL ロック

---

## 13. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | v1.1 — §5.5.3 TS 回復 Ops · §6.6 Collusion · §9.3 Clawback 運用（Design Audit 追補） |
| 2026-06-28 | v1 — Dashboard · KPI · T&S · Ops cadence |
