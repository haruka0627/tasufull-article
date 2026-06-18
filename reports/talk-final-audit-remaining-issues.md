# TALK 最終監査 — 現状残課題一覧

**実施日:** 2026-06-16  
**方針:** 修正なし・監査のみ  
**市場EC:** RELEASE FROZEN（本監査は TALK のみ）

---

## 総合評価

| 項目 | 判定 |
|------|------|
| 自動監査総合 (`review-talk-user-flow.mjs`) | **PASS** |
| P0（リリースブロッカー） | **なし** |
| 補助監査での未確認・要再検証 | **WARNING** 2領域 |

---

## 対象別 PASS / WARNING / FAIL

| 対象 | 判定 | 根拠 |
|------|------|------|
| **通知** | **PASS** | 9種通知 × 390/1280 全件 通知→遷移 OK。reload / 戻り / 既読 すべて PASS |
| **やりとり一覧** | **WARNING** | 総監査は `tab=notify` 中心。一覧パネル（`tab=chat` / `.talk-line-list`）の専用 PASS なし。chat-hub smoke で 12 件 NG |
| **チャット詳細** | **PASS** | `chat-detail.html` DOM 表示 OK。A→B 双方向メッセージ 390/1280 PASS |
| **カレンダー通知** | **WARNING** | 総監査スコープ外。専用テスト（`test-talk-builder-calendar-return.mjs`）は dev サーバー検出失敗で未実施 |
| **完了報告** | **PASS** | 通知→`board-thread#completion`、承認/差し戻し UI 検出 390/1280 PASS |
| **レビュー通知** | **PASS** | 通知→`chat-detail` + `openReview=1` 390/1280 PASS |

---

## 確認項目別

| # | 確認内容 | 判定 | 詳細 |
|---|----------|------|------|
| 1 | 通知→対象画面へ遷移 | **PASS** | メッセージ / やり取り開始 / 購入 / 応募 / 採用 / 完了 / レビュー / Connect / 安否 — 全 PASS |
| 2 | A/B 双方へ通知 | **PASS** | チャット双方向（送信者→受信者受信）390/1280 PASS。権限別表示（掲載者・応募者・採用者）各 59 件 PASS |
| 3 | 未読同期 | **PASS** | クリック既読化・`readAt` 永続化・未読バッジ更新 — PASS |
| 4 | カレンダー通知 | **WARNING** | 本実行では未検証。`builder-project-new-001` は Builder 通知整理で notify 一覧から除外済みの可能性（`test-talk-builder-notify.mjs` REMOVED_IDS） |
| 5 | 完了報告フロー | **PASS** | 通知→完了画面、`data-thread-completion-approve` / `reject` 検出 |
| 6 | レビュー導線 | **PASS** | `platform-verify-job-full-review-001` → `chat-detail` + `demoState=completed&openReview=1` |

---

## P0 — リリースブロッカー

**なし**（`review-talk-user-flow.mjs`: FAIL 0 / WARNING 0）

---

## P1 — 要確認（修正前に再検証推奨）

### やりとり一覧（`tab=chat`）

`test-talk-chat-hub-browser.mjs`（5173 実行）で以下が NG:

- LINE 形式リスト行（avatar / name / preview / unread）
- 検索フィルタ（最終メッセージ）
- カテゴリフィルタ（job）
- 未読スレッドのソート順
- Builder カード → `mvp-threads.html` リンク
- AI ハブ href
- インラインルーム（遷移なしで開く）
- 空メッセージ定数
- モバイルタブ: notify / ai の href
- モバイル full-bleed 幅（main=336px / vw=390）
- モバイルルーム内の相手名表示

> **注:** 本テストは `talkDev=1` なし・デフォルト port 8765 前提。総監査（5500 + talkDev）とは条件が異なる。**環境差か実装差かの切り分けが必要。**

### カレンダー通知

- 専用スクリプトが port 5500/5173 を検出できず未実行
- 公式ルーム / Builder board 通知への移行後、カレンダー導線の監査スクリプト更新が必要な可能性

---

## P2 — リリース後改善（監査で既知）

| 項目 | 内容 |
|------|------|
| 通知 URL 正規化 | `talk-notifications.html` は存在しない。正は `talk-home.html?tab=notify` |
| インライン composer | TALK インラインルームの `saveMessage` 未接続。送信検証は `chat-detail.html` で実施 |
| 本番認証 | JWT / 本番ロールとの統合テスト未実施 |
| Supabase 同期 | 通知・既読のマルチ端末整合は将来対応 |
| モバイルタブバー | notify→chat マッピングの UX 見直し（将来） |

---

## 正常導線（監査 PASS 一覧）

- 通知 9 種 → 遷移先一致（390 / 1280 各 2 回）
- チャット A→B 双方向メッセージ
- 通知クリック → 既読化
- 詳細画面の戻る / `from=notify` 導線
- 完了報告 → 承認・差し戻し画面
- 通知一覧 reload 維持（`tab=notify` / `tab=notifications`）
- 通知クリック → 戻る → 通知一覧復帰
- 通知タブ reload 異常なし
- 権限別通知表示（3 ロール × 2 viewport）

---

## 監査ログ

| スクリプト | 結果 | 出力 |
|-----------|------|------|
| `scripts/review-talk-user-flow.mjs` | **PASS** | `screenshots/talk-user-flow-review/review-report.md` |
| `scripts/test-talk-notify-final-unified.mjs` | **PASS**（Builder/安否/求人/店舗/運営 遷移 OK） | コンソール |
| `scripts/test-talk-chat-hub-browser.mjs` | **12 FAIL** | コンソール（要再検証） |
| `scripts/test-talk-builder-calendar-return.mjs` | **未実施** | dev server 検出失敗 |

---

## P1 切り分け再検証（2026-06-16 完了）

詳細: [`talk-p1-triage-conclusion.md`](talk-p1-triage-conclusion.md)

| P1 | 判定 | 結論 |
|----|------|------|
| やりとり一覧 | WARNING | 12 NG の大半はテスト古い。インラインルームは PASS |
| カレンダー通知 | PASS + WARNING | `builder-project-new-001` 意図的除外。notify→calendar 線なし |

**P1 製品修正: 不要（監査スクリプト更新で足りる）**
