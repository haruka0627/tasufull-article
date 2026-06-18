# TALK — リリース確定

**確定日:** 2026-06-16  
**状態:** ✅ リリース可能（**RELEASE FROZEN**）

以降、TALK の新規製品修正は停止。残課題はリリース後改善（P2 / 改善）として扱う。  
市場ECは別途 [`market-ec-release-status.md`](market-ec-release-status.md) で RELEASE FROZEN 済み（本判定では未変更）。

---

## 総合判定

| 項目 | 判定 |
|------|------|
| **リリース可否** | **RELEASE OK** |
| **凍結** | **RELEASE FROZEN**（本ドキュメント時点で確定） |
| P0（リリースブロッカー） | **なし** |
| P1（要製品修正） | **なし**（監査スクリプト更新で解消済み） |
| 自動監査総合 | **PASS** |

---

## 確定根拠

| 項目 | 判定 | 根拠 |
|------|------|------|
| 自動監査総合 | **PASS** | `scripts/review-talk-user-flow.mjs` → `screenshots/talk-user-flow-review/review-report.md`（FAIL 0） |
| P0 | **なし** | 上記総監査・最終監査でブロッカー未検出 |
| P1 製品修正 | **不要** | [`talk-p1-triage-conclusion.md`](talk-p1-triage-conclusion.md) — NG 大半はテスト条件ミス |
| P1 監査スクリプト | **更新済み・PASS** | 下記「凍結済み監査」参照 |
| 通知→対象画面遷移 | **PASS** | 9 種通知 × 390/1280、遷移先一致 |
| A/B 双方通知 | **PASS** | チャット双方向・権限別表示 |
| 未読同期 | **PASS** | クリック既読化・`readAt` 永続化・バッジ更新 |
| 完了報告 | **PASS** | `board-thread#completion`、承認/差し戻し UI |
| レビュー導線 | **PASS** | `chat-detail` + `openReview=1` |
| 旧 ID `builder-project-new-001` | **意図的 DEPRECATED** | `DEPRECATED_IDS` 確認用途のみ。notify 一覧非表示が正 |
| 市場EC | **未変更** | 本フェーズで市場ECコードに手を入れていない |

### P1 再検証（監査更新後）

`scripts/triage-talk-p1-rerun.mjs`（2026-06-16）:

| 領域 | 判定 |
|------|------|
| やりとり一覧 (`tab=chat`) | **PASS** |
| カレンダー通知 | **PASS** + WARNING 1（後述） |

**Verdicts:** PASS 29 / WARNING 1 / FAIL 0  
**ログ:** `screenshots/talk-p1-triage/report.md`

---

## 対象スコープ（凍結）

### コア画面・導線

- `talk-home.html` / `talk-home.js` / `talk-home.css` — TALK ホーム（chat / notify / インラインルーム）
- `talk-home-data.js` — 一覧・ハブ・デモスレッド
- `talk-notifications-store.js` / `talk-notify-actions.js` / `talk-platform-notify.js`
- `talk-builder-notify-master-v1.js` — Builder 通知マスター・`DEPRECATED_IDS`
- `talk-official-rooms.js` — 公式ルーム
- `chat-detail.html` 系 — チャット詳細・レビュー導線
- `tasful-app-mobile.js` — モバイル 4 タブシェル（notify は TALK 内パネル）
- Builder 連携導線 — `partner-assignment.html` / `builder-board-*` / `platform-verify-*` 通知遷移

### 監査スクリプト（凍結・変更時のみ再実行）

| スクリプト | 役割 | 状態 |
|-----------|------|------|
| `scripts/review-talk-user-flow.mjs` | 総合ユーザーフロー | PASS |
| `scripts/test-talk-chat-hub-browser.mjs` | チャットハブ smoke（`talkDev=1`） | PASS |
| `scripts/test-talk-notify-unified.mjs` | 通知統一監査 | PASS |
| `scripts/test-talk-builder-calendar-return.mjs` | board + partner-assignment 戻り導線 | PASS |
| `scripts/test-talk-notify-final-unified.mjs` | 通知最終統一 | PASS |
| `scripts/triage-talk-p1-rerun.mjs` | P1 切り分け再検証 | PASS（WARNING 1） |
| `scripts/capture-talk-notify-unified-390.mjs` | 390px キャプチャ | PASS |
| `scripts/capture-talk-builder-notify.mjs` | Builder 通知キャプチャ | PASS |
| `scripts/test-builder-calendar-roles.mjs` | role 別表示（partner-assignment 基準） | PASS |
| `scripts/test-builder-flow-audit.mjs` | Builder/TALK 導線監査 | PASS |

---

## 現行導線の整理（監査基準）

| 用途 | 現行 ID / URL | 備考 |
|------|----------------|------|
| 運営→パートナー新着案件 | `builder-ops-route-001` → `partner-assignment.html` | notify 一覧 PASS |
| Builder board 応募 | `builder-board-apply-001` → `board-project-detail.html?view=applications` | PASS |
| Builder board 完了 | `builder-board-completion-001` → `board-thread.html#completion` | PASS |
| 求人・安否・スキル | `platform-verify-*` | PASS |
| パートナー受諾判断 | `partner-assignment.html`（`data-partner-assignment-accept`） | 旧 `mvp-calendar` accept UI は不使用 |
| 旧カレンダー通知 | `builder-project-new-001` | **DEPRECATED** — 一覧非表示が正 |

---

## 残 WARNING（リリースブロッカーにしない）

### official_builder ルームにカレンダー案内カードなし

| 項目 | 内容 |
|------|------|
| 監査 | `triage-talk-p1-rerun.mjs` — WARNING |
| 影響 | 公式ルーム内に旧来型カレンダー案内がない |
| リリース判断 | **notify 導線（`builder-ops-route-001` → `partner-assignment`）は PASS** のため現行仕様として許容 |
| 扱い | **リリース後改善（P2）** |

---

## リリース後改善（P2 / 改善 — 修正不要でリリース可）

| 優先 | 項目 | 内容 |
|------|------|------|
| P2 | official_builder カレンダー案内 | 公式ルームへの案件確認カード追加検討（notify 導線は既に PASS） |
| P2 | モバイル full-bleed 幅 | チャットシェル余白（意図的レイアウトの可能性）— UX 判断 |
| P2 | 通知 URL 正規化ドキュメント | 正: `talk-home.html?tab=notify`（`talk-notifications.html` は非使用） |
| P2 | インライン composer | TALK インラインルームの `saveMessage` 未接続。送信検証は `chat-detail.html` で実施済み |
| 改善 | 本番認証 | JWT / 本番ロール統合テスト |
| 改善 | Supabase 同期 | 通知・既読のマルチ端末整合 |
| 改善 | モバイルタブバー UX | notify→chat マッピングの将来見直し |
| 改善 | partner-assignment 辞退クリック | 監査環境では状態永続が不安定。受諾→スレッド遷移は PASS。製品改善は別チケット |

---

## `builder-project-new-001` 参照の扱い

| 分類 | ファイル例 | 扱い |
|------|-----------|------|
| DEPRECATED 確認用 | `test-talk-notify-unified.mjs`, `test-talk-builder-calendar-return.mjs`, `triage-talk-p1-rerun.mjs` | **意図的** — 非表示・除外の回帰検知 |
| 製品マスター | `talk-builder-notify-master-v1.js` `DEPRECATED_IDS` | **意図的** |
| ドキュメント | `talk-p1-triage-conclusion.md` 等 | 参照のみ |
| 旧テスト漏れ | — | **なし**（2026-06-16 監査スクリプト更新で解消） |

---

## 再検証コマンド（参考・変更時のみ）

```bash
# 総合
node scripts/review-talk-user-flow.mjs

# P1 切り分け
node scripts/triage-talk-p1-rerun.mjs

# 個別 smoke
node scripts/test-talk-chat-hub-browser.mjs
node scripts/test-talk-notify-unified.mjs
node scripts/test-talk-builder-calendar-return.mjs
node scripts/test-builder-calendar-roles.mjs
node scripts/test-builder-flow-audit.mjs
```

**前提:** `npm run dev` 等でローカルサーバー起動。port は `findDevServerBaseUrl` が自動検出（5173 等）。TALK 監査は `talkDev=1` を付与。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [`talk-final-audit-remaining-issues.md`](talk-final-audit-remaining-issues.md) | 最終監査時点の課題一覧（本判定で P1 解消・凍結確定） |
| [`talk-p1-triage-conclusion.md`](talk-p1-triage-conclusion.md) | P1 切り分け — 製品修正不要の根拠 |
| [`market-ec-release-status.md`](market-ec-release-status.md) | 市場EC RELEASE FROZEN（別領域） |

---

## 次フェーズ

TALK は本ドキュメント時点で **RELEASE FROZEN**。  
**P0 / P1 は残っていない。** 新規の TALK 製品修正チケットは受け付けない（リリース後改善 P2 のみバックログ）。  
今後の開発・修正対象から **TALK 製品コードを外す。**
