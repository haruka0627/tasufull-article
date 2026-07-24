# Platform Request P5-9 — Talk Integration

**Date:** 2026-07-05
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（のみ）
**判定:** **Go**

---

## Talk Bridge 概要

| コンポーネント | 責務 |
| --- | --- |
| `platform-request-talk-bridge.js` | Edge 呼び出し · Talk 遷移 · local fallback |
| `/api/platform-request-create-talk` | JWT 検証 · Match 確認 · `transaction_rooms` ensure |

**重複防止:** `service_type=platform_request` + `service_ref_id=match_id`

## 通知 → Detail → Talk

通知の「Talk開始」→ 詳細 (`?match_id=&prq_talk=1`) → Talk開始ボタン → `chat-detail.html`

---

## 検証結果

| 項目 | 結果 |
| --- | --- |
| Match 作成 | PASS |
| Talk Room 作成 | PASS |
| 重複防止（同一 Room） | PASS |
| owner 開始 | PASS |
| candidate 開始 | PASS |
| 漏洩チェック | PASS |
| HTTP create-talk | 200 |
| Console Error | **0** |

### IDs

| 項目 | 値 |
| --- | --- |
| request_id | 1998c92b-821e-4d47-a1c1-ec1658ecf03f |
| match_id | 9c755f7d-5fff-4d27-b7de-f0a2789472e9 |
| room_id | 344bf7d4-7bdb-47c9-b044-19e4525aa221 |

### RLS / 権限

| 主体 | 結果 |
| --- | --- |
| owner | PASS (SELECT room) |
| candidate | — |
| unrelated | PASS (403) |
| anon | PASS (401) |

### UI（8788）

| 画面 | 結果 |
| --- | --- |
| 詳細 Talk開始 | PASS (match=9c755f7d-5fff-4d27-b7de-f0a2789472e9) |
| 通知 → 詳細導線 | PASS |

### 回帰

| スクリプト | 結果 |
| --- | --- |
| P5-6 | PASS |
| P5-7 | PASS |
| P5-7b | PASS |
| P5-7c | PASS |
| P5-8 | PASS |

---

## 変更ファイル（P5-9）

| ファイル | 変更 |
| --- | --- |
| `platform-request-talk-bridge.js` | **新規** |
| `deploy/cloudflare/functions/api/platform-request-create-talk.js` | **新規** |
| `deploy/cloudflare/functions/_shared/platform-request-talk.mjs` | **新規** |
| `platform-request.js` | Talk開始 UI · 通知導線 |
| `platform-request-detail.html` | Talk開始ボタン |
| `platform-request.css` | ハイライト |
| `scripts/test-platform-request-p5-9-talk-bridge.mjs` | **新規** |

---

## Go / No-Go

| 環境 | 判定 |
| --- | --- |
| **Staging P5-9** | **Go** |
| **P5-10 Stripe** | **未着手** |
| **Production** | **No-Go** 継続 |
