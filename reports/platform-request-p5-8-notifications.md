# Platform Request P5-8 — Notifications Foundation

**Date:** 2026-07-05
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（のみ）
**判定:** **Go**

---

## 通知フロー

```text
Match INSERT (Edge match-sync)
  → owner 通知（pending）
  → candidate 通知（pending）
Status 変更（Edge notify · owner JWT）
  → owner 通知
  → closed 時 candidate 通知
既読（Edge notify · mark_read · service_role PATCH）
  → status=sent · sent_at 設定
```

## Store 概要

| モード | 実装 |
| --- | --- |
| local | `platform-request-notification-store.js` · localStorage |
| supabase | RLS SELECT（recipient のみ） |
| dual | supabase 優先 + local マージ |

## Edge 概要

| エンドポイント | 責務 |
| --- | --- |
| `/api/platform-request-match-sync` | Match INSERT + 通知 fan-out |
| `/api/platform-request-notify` | status_changed · mark_read |

service_role は Edge 内のみ。

---

## 検証結果

| 項目 | 結果 |
| --- | --- |
| Match → 通知生成 | PASS |
| owner 通知取得 | PASS |
| candidate 通知取得 | PASS |
| 既読更新 | PASS |
| status 変更通知 | PASS |
| 漏洩チェック | PASS |
| HTTP Status | 200 / 200 |
| Console Error | **0** |

### Request / Match

| 項目 | 値 |
| --- | --- |
| request_id | e2c75081-687d-44b5-885d-6aee654381c1 |
| match_id | d327c298-a680-4a0b-b873-86d008ddd730 |
| owner notification | 35eae8a5-3ba8-4995-adcf-5959441b4290 |
| candidate notification | c9f363b2-a5f8-4067-a1dd-3323a7b41efd |

### RLS

| 主体 | 結果 |
| --- | --- |
| owner | PASS (1 rows) |
| candidate | PASS (1 rows) |
| unrelated | PASS (0 rows) |
| anon | PASS (0 rows) |

### UI（8788）

| 画面 | 結果 |
| --- | --- |
| 一覧 通知パネル | PASS (35 items · API 35) |
| 詳細 通知パネル | PASS (35 items · API 35) |

### 回帰

| スクリプト | 結果 |
| --- | --- |
| P5-6 | PASS |
| P5-7 | PASS |
| P5-7b | PASS |
| P5-7c | PASS |

---

## 変更ファイル（P5-8）

| ファイル | 変更 |
| --- | --- |
| `platform-request-notification-store.js` | **新規** — local/supabase/dual |
| `deploy/cloudflare/functions/api/platform-request-notify.js` | **新規** |
| `deploy/cloudflare/functions/_shared/platform-request-notifications.mjs` | **新規** |
| `deploy/cloudflare/functions/api/platform-request-match-sync.js` | Match 後に通知 INSERT |
| `platform-request.js` | Adapter + UI |
| `platform-request.html` / `platform-request-detail.html` | 通知パネル |
| `platform-request.css` | 通知スタイル |
| `scripts/test-platform-request-p5-8-notifications.mjs` | **新規** |

---

## Go / No-Go

| 環境 | 判定 |
| --- | --- |
| **Staging P5-8** | **Go** |
| **P5-9 Talk** | **未着手** |
| **Production** | **No-Go** 継続 |
