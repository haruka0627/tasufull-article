# TASFUL AI Core — Phase 4 完了レポート（Usage Gauge）

**日付:** 2026-07-26  
**スコープ:** Workspace 利用ゲージ（日次消費率 · 残量目安 · 状態 · 更新日）  
**環境:** コード · mock · unit/static · Playwright · **Staging live 未検証** · Production / deploy / push **なし**  
**前提:** SAFE-05/06/07 · Phase 3 Auto Mode · Staging paused はリリース前確認として保留  

---

## 判定

**CONDITIONAL PASS** — live quota / JWT 本番経路は Staging paused のため未検証。計算・UI・回帰は PASS。

---

## 監査結果

| 区分 | 内容 |
| --- | --- |
| 完成済み | `TasuAiWorkspaceUsage` · Edge `ai-workspace-quota` · chat 残り回数テキスト · SAFE-05 Guard |
| 不足 | ％メーター · 状態ラベル · 次回更新 · Billing が localStorage デモ4本棒 · 「今月」コピーが日次実態と不一致 |
| 今回変更 | Gauge 計算 SSOT · quota `usage` 付与 · 簡易/詳細 UI · Billing を日次ライブへ寄せ替え |

**使わない正本:** `ai_usage_events`（ログ）· SAFE-07 価格表 · Billing demo localStorage

---

## 数値の正本

| 項目 | 値 |
| --- | --- |
| データ | `ai_workspace_usage_daily` via `ai-workspace-quota` status/check |
| period | **daily_jst**（Asia/Tokyo 0:00〜翌0:00） |
| used | feature 別 used（本 Phase 表示は text_turn） |
| limit | plan `dailyTextLimit`（暫定） |
| remaining | max(0, limit − used) |
| ratio | used/limit（0除算防止 · limit0→stopped） |
| resetAt | 翌 Tokyo 日 00:00+09:00 |

クライアント localStorage はキャッシュのみ。申告 used は正本にしない。

---

## 状態閾値（一箇所: `GAUGE_THRESHOLDS`）

| status | 条件 | ラベル |
| --- | --- | --- |
| comfortable | 0–49% | 余裕あり |
| normal | 50–74% | 通常 |
| elevated | 75–89% | やや多い |
| low | 90–99% | 残り少ない |
| near_limit | ≥100% かつ実行可扱いの端 | 上限付近 |
| stopped | ≥100% かつ canExecute=false / limit0 | 利用停止中 |
| unavailable | 欠測・取得失敗 | 利用状況を取得できません |

UI のバーは displayPercent を最大 100% にキャップ。内部 usageRatio は超過を保持可。

---

## API 契約（既存 Edge 拡張）

`POST /functions/v1/ai-workspace-quota` `{ action:"status", surface:"ai-workspace", feature:"text_turn" }`

成功時に `usage: { periodUsed, periodLimit, remaining, usageRatio, displayPercent, periodStart, periodEnd, resetAt, status, statusLabel, statusHint, canExecute, periodKind, heavyModelNote, ... }` を付与。

返さない: 単価 · 原価 · prompt/response · service_role · 他ユーザー。

JWT 検証時は body の別 UUID を `user_mismatch` で拒否。エラー本文に SQL を出さない。

---

## UI

- **簡易:** コンポーザ直上 `[data-ai-workspace-usage-status]` ％ + meter + 状態
- **詳細:** 設定 › 請求「本日の利用状況」+ retry
- Manual 高負荷チップ時: 一般注意文のみ（倍率非公開）

---

## 境界

- Auto/Manual: 同一ゲージ正本
- Usage Guard: 超過時は既存 402 · canExecute=false / stopped
- Cost Ledger: 参照しない · 価格変更なし
- anonymous: 端末目安 · authoritative=false

---

## テスト

```bash
node scripts/test-tasful-ai-usage-gauge-phase4.mjs
node scripts/verify-ai-usage-gauge-phase4.mjs
# + SAFE-05/06/07 · Phase3 · billing tab verify
```

---

## 次 Phase

**Phase 5: プラン制御**（実装開始しない）
