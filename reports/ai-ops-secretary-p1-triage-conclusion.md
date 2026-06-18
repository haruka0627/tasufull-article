# AI運営秘書 P1 切り分け — 結論

**実施日:** 2026-06-17  
**再監査完了:** 2026-06-17  
**方針:** P1-1 のみ製品修正。P1-2 / P1-3 は監査スクリプト更新（市場EC / TALK / Builder RELEASE FROZEN 維持）

---

## 完了条件

| ID | 対象 | 切り分け結果 | 分類 | 再監査 |
|----|------|-------------|------|--------|
| **P1-1** | Support 深リンク | 実バグ | 製品修正 | **PASS** |
| **P1-2** | OPS WATCH Phase2 E2E | 監査条件ミス | 監査スクリプト更新 | **PASS** |
| **P1-3a** | 新規問い合わせ接続 | 監査条件ミス | 監査スクリプト更新 | **PASS** |
| **P1-3b** | reopened 接続 | 監査条件ミス | 監査スクリプト更新 | **PASS** |
| **P1-3c** | TALK チャット/ブロック | 現行スコープ外 | **P2送り** | P1 除外 |
| **P1-3d** | Builder 案件イベント | 監査条件ミス | 監査スクリプト更新 | **PASS** |

**P1 残存: 0 件**

---

## 総合判定（RELEASE FROZEN 候補）

| 項目 | 判定 |
|------|------|
| P0 | **なし** |
| P1 | **0 件** |
| P2 | バックログ（TALK chat/block 他） |
| **RELEASE FROZEN** | **確定** — [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) |

---

## P1-1 — Support 深リンク

### 質問別回答

| # | 質問 | 回答 |
|---|------|------|
| 1 | 実バグか | **はい** |
| 2 | 監査スクリプト条件ミスか | いいえ（`test-admin-operations-dashboard` は href 存在のみ検証。遷移先動作は未検証） |
| 3 | 本番接続前提でローカル再現不可か | いいえ。`file://` / 静的サーバーで再現可能 |
| 4 | 製品コード修正が必要か | **はい** |
| 5 | 監査スクリプト更新で解消するか | いいえ |

### 根拠

- `support-trouble-center.js` は `URLSearchParams` で **`ticket` のみ**読取（L301-303）。`filter` 未対応。
- 内部フィルタは `connect` / `risk` 等（L116-138）。**`report` フィルタは存在しない**。
- 司令塔がリンクする URL:
  - `support-trouble-center.html?filter=report` — `admin-operations-dashboard.html` L35, L261, L719, L845
  - `support-trouble-center.html?filter=connect` — L40, L260, L41
- 秘書ハブ（`talk-ops-room.js`）の通報セクションは **`admin-ai-operations-center.html`** を指しており、こちらは正しい（L32）。

### 期待修正（参考・本タスク未実施）

- `?filter=report` → 内部 `risk` フィルタを初期適用
- `?filter=connect` → 内部 `connect` フィルタを初期適用
- または司令塔リンクをハブと同じ遷移先に揃える

### 分類: ~~製品修正必要~~ **PASS**（`support-trouble-center.js` 修正済み）

---

## P1-2 — OPS WATCH Phase2 E2E

### 質問別回答

| # | 質問 | 回答 |
|---|------|------|
| 1 | 実バグか | **いいえ** |
| 2 | 監査スクリプト条件ミスか | **はい** |
| 3 | 本番接続前提でローカル再現不可か | 部分的。`BASE_URL`（port 8765）必須だが、Phase1 は同一前提で PASS |
| 4 | 製品コード修正が必要か | いいえ |
| 5 | 監査スクリプト更新で解消するか | **はい** |

### 根拠

- 失敗箇所: `test-ops-watch-phase2-browser.mjs` L196 — `[data-ops-watch-run='all']` を **visible** 待ちでタイムアウト。
- ボタンは `talk-ops-room.js` の `<details data-talk-ops-watch-tools>` 内（L15-27）。**折りたたみ閉じ状態では Playwright 上 non-visible**。
- 検証（2026-06-17）:
  - `details.open = false` → `isVisible('[data-ops-watch-run=all]')` = **false**
  - `details.open = true` → **true**
- Phase9 パネル（`test-admin-ai-ops-watch-browser.mjs`）は **PASS**。本番運用の主導線は司令塔 `#ops-ai-watch`。

### 期待監査修正（参考・本タスク未実施）

```javascript
await page.locator("[data-talk-ops-watch-tools]").evaluate((el) => { el.open = true; });
await page.waitForSelector("[data-ops-watch-run='all']", { state: "visible", timeout: 10000 });
```

### 分類: **監査スクリプト更新で解消** / 判定: **WARNING**

---

## P1-3 — 本番接続ギャップ

### P1-3a — 新規問い合わせ

| # | 質問 | 回答 |
|---|------|------|
| 1 | 実バグか | いいえ（接続は成立） |
| 2 | 監査スクリプト条件ミスか | **はい** |
| 3 | 本番接続前提でローカル再現不可か | いいえ |
| 4 | 製品コード修正が必要か | いいえ |
| 5 | 監査スクリプト更新で解消するか | **はい** |

**根拠:**

- `review-admin-ai-production-connectivity.mjs` L73-78 は `submitInquiry` の戻り値を `ticket` として直接参照。
- 実際の戻り値は **`{ ticket, classification }`**（`support-ticket-service.js`）。
- そのため `ticket?.id` が常に undefined → 「submitInquiry failed」と誤判定。
- 切り分け実行結果（2026-06-17）:
  - チケットは `status: ai_replied` で作成される
  - Daily Inbox には `source: support` ではなく **`response_plan` + `automation`** で反映（3件）
  - `collectFromSupport` は `open` / `needs_review` / `in_progress` のみ対象のため `ai_replied` は除外（設計通り）

**分類: 監査スクリプト更新で解消** / 判定: **WARNING**

---

### P1-3b — reopened

| # | 質問 | 回答 |
|---|------|------|
| 1 | 実バグか | いいえ |
| 2 | 監査スクリプト条件ミスか | **はい** |
| 3 | 本番接続前提でローカル再現不可か | いいえ |
| 4 | 製品コード修正が必要か | いいえ |
| 5 | 監査スクリプト更新で解消するか | **はい** |

**根拠:**

- 本番接続レビュー L136 は **`Store.createTicket`** を呼ぶが、`support-ticket-store.js` に **`createTicket` は存在しない**（`saveTicket` のみ）。
- 正しい検証は `test-admin-ai-connectivity-p2.mjs` L166-216:
  - `saveTicket` + `recordOutcome(resolved)` + `syncSupportReopened()` → **PASS**
  - `support_reopened` ライフサイクルイベント + Inbox 反映を確認済み

**分類: 監査スクリプト更新で解消** / 判定: **WARNING**

---

### P1-3c — TALK チャット / ブロック

| # | 質問 | 回答 |
|---|------|------|
| 1 | 実バグか | **未配線**（現行仕様） |
| 2 | 監査スクリプト条件ミスか | 部分的（L181-189 は **動的テストなしで `connected: false` 固定**） |
| 3 | 本番接続前提でローカル再現不可か | いいえ。意図的に未実装 |
| 4 | 製品コード修正が必要か | 将来は必要。現行デモ凍結では不要 |
| 5 | 監査スクリプト更新で解消するか | 仕様として P2 に降格可能（「未配線・スコープ外」と明記） |

**根拠:**

- `admin-ai-daily-inbox.js` `collectFromTalk` は **未読の重要通知**のみ収集（L376-398）。`chat_started` / `user_block` コレクタなし。
- 通報は Support / AI-ops 経由で **接続済み**（本番接続レビュー L191-196）。
- TALK 未読重要・安否は `TasuTalkNotifications.add` + refresh で Inbox/Ops Watch に反映（P0 テスト PASS）。

**分類: P2送り** / 判定: **WARNING**（リリースブロッカーにしない）

---

### P1-3d — Builder 案件イベント（応募/採用/完了/差し戻し）

| # | 質問 | 回答 |
|---|------|------|
| 1 | 実バグか | いいえ |
| 2 | 監査スクリプト条件ミスか | **はい** |
| 3 | 本番接続前提でローカル再現不可か | いいえ |
| 4 | 製品コード修正が必要か | いいえ（Builder 製品コードは触らない） |
| 5 | 監査スクリプト更新で解消するか | **はい** |

**根拠:**

- 本番接続レビュー L281-287 は **`connected: false` をハードコード**。`listEvaluations未実装` は **誤り**。
- `TasuBuilderPartnerEval.listEvaluations` は `builder-partner-evaluation-store.js` L437 に実装済み。
- 収集元: admin partners / MVP notifications / **TALK builder 通知**（L510-568）。
- `test-admin-ai-connectivity-p0.mjs` は localStorage シード + `tasu:builder-partner-eval-changed` で **Inbox/OpsWatch/KPI/Plans/Automation 反映 PASS**。
- 切り分け実行: `hasListEval: true`, `evalCount: 0`（未シード時は空＝正常）

**分類: 監査スクリプト更新で解消** / 判定: **WARNING**

---

## P1 分類サマリー

| 分類 | 件数 | ID |
|------|------|-----|
| **製品修正必要** | 1 | P1-1 |
| **監査スクリプト更新で解消** | 4 | P1-2, P1-3a, P1-3b, P1-3d |
| **本番接続時対応** | 0 | —（P1-3c は P2送りに統合） |
| **P2送り** | 1 | P1-3c |

---

## 再監査後の P0/P1 残存

- **P0:** なし
- **P1:** **0 件**
- **P2:** TALK chat/block、市場/安否 confirmed、UX ボリューム他

詳細は [`ai-ops-secretary-final-audit-remaining-issues.md`](ai-ops-secretary-final-audit-remaining-issues.md)（再監査後更新）を参照。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [`ai-ops-secretary-final-audit-remaining-issues.md`](ai-ops-secretary-final-audit-remaining-issues.md) | 最終監査残課題（本切り分けで更新） |
| [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | AI運営秘書 RELEASE FROZEN（本判定） |
| [`market-ec-release-status.md`](market-ec-release-status.md) | 市場EC RELEASE FROZEN |
| [`talk-release-status.md`](talk-release-status.md) | TALK RELEASE FROZEN |
| [`builder-release-status.md`](builder-release-status.md) | Builder RELEASE FROZEN |
