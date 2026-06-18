# TALK P1 切り分け再検証 — 結論

**実施:** 2026-06-16  
**Base:** `http://localhost:5173`（`findDevServerBaseUrl` 自動検出）  
**方針:** 修正なし・切り分けのみ  
**ログ:** `screenshots/talk-p1-triage/report.json`

---

## 総合判定

| P1 項目 | 判定 | 判断 |
|---------|------|------|
| 1. やりとり一覧 (`tab=chat`) | **WARNING** | 実導線は動作。12 NG の大半は **テスト条件ミス** |
| 2. カレンダー通知 | **PASS**（除外正）+ **WARNING**（導線定義） | `builder-project-new-001` 意図的除外。notify→calendar 専用線は現行なし |

**P1 を製品修正対象にする必要: なし（監査スクリプト更新で足りる）**

---

## 1. やりとり一覧

### 実状態（`talk-home.html?tab=chat&talkDev=1`）

一覧先頭5件（スクロール前）:

| ID | 表示名 | preview |
|----|--------|---------|
| official_platform | TASFUL運営 | 新しい案件が追加されました |
| official_anpi | 安否確認センター | 安否確認通知 |
| official_tasful | TASFUL運営 | 運営からのお知らせ |
| talk-hub-ai | TASFUL AI | AI タブ案内 |
| talk-hub-support | TASFULサポート | サポート案内 |

- `talk-mock-friend-001`（田中 一郎）は **一覧クリックでインラインルーム OPEN → PASS**
- `talkDev=0` / `talkDev=1` で **チェック結果は同一**（P1 は talkDev 不足が原因ではない）
- port 8765（旧テスト default）vs 5173 の差も、今回の NG 分類には影響小（テスト期待値が主因）

### 12 NG 分類（`test-talk-chat-hub-browser.mjs`）

| # | チェック | 分類 | 理由 |
|---|----------|------|------|
| 1 | LINE形式リスト行 | **テスト条件ミス** | セレクタ `[data-chat-domain="friend"]` が公式ルームにヒット。期待 preview「打ち合わせ」は `DEMO_SOCIAL_THREADS` と不一致 |
| 2 | 検索（塗装） | **テスト条件ミス** | `MOCK_EXTRA_CHATS` が空（`talk-home-data.js` L291 廃止コメント） |
| 3 | カテゴリ job | **テスト条件ミス** | 同上 |
| 4 | 未読ソート | **テスト条件ミス** | テストは `getMockExtraChats()` のみ。実一覧は公式+ハブで未読ソートは動作 |
| 5 | Builder→mvp-threads | **テスト条件ミス** | 現行 `resolveChatTalkHref` → `chat-detail.html?from=talk`（インライン/外部遷移設計変更） |
| 6 | AI hub `tab=ai` | **テスト条件ミス** | 現行 `_hubHref: ai-workspace.html`（別画面設計） |
| 7 | インラインルーム | **PASS（実装OK）** | テストのみ「さちこ」期待 → 実名「田中 一郎」 |
| 8 | 空メッセージ定数 | **テスト条件ミス** | `CHAT_EMPTY_MESSAGE` 文言変更済み |
| 9 | mobile notify href | **テスト条件ミス** | モバイルタブバーから **通知タブ削除**（4タブ: ホーム/TALK/AI/マイページ） |
| 10 | mobile ai href | **テスト条件ミス** | 現行 `ai-workspace.html`（`talk-home.html` L631） |
| 11 | mobile full-bleed | **要判断（P2）** | main 336px / vw 390 — シェル余白。意図的レイアウトの可能性大 |
| 12 | mobile 相手名 | **PASS（実装OK）** | テストのみ「さちこ」期待 |

### 修正対象（最小）

| 種別 | ファイル | 内容 |
|------|----------|------|
| **監査のみ** | `scripts/test-talk-chat-hub-browser.mjs` | `talkDev=1`・`findDevServerBaseUrl`・期待値更新（mock/文言/タブ数/href） |
| **監査のみ** | `scripts/triage-talk-p1-rerun.mjs` | 本切り分け用（維持可） |
| 製品 | — | **P1 では不要** |

---

## 2. カレンダー通知

### `builder-project-new-001`

| 確認 | 結果 |
|------|------|
| マスター（board）に残存 | **いいえ**（フィルタ後ストアに不出） |
| notify 一覧 DOM | **不出**（正しい） |
| `DEPRECATED_IDS` | `talk-builder-notify-master-v1.js` L284 に明示 |

→ **一覧からの除外は意図どおり（PASS）**

### notify → mvp-calendar 導線

| 確認 | 結果 |
|------|------|
| notify 一覧内 `mvp-calendar.html` href | **0件** |
| `builder-board-*` 通知 | **12件表示 PASS**（応募→`board-project-detail` 等） |
| `official_builder` ルーム内カレンダー案内 | **なし** |

→ カレンダーは **notify 専用通知経由ではなく Builder board / 直接 URL** が現行導線。  
旧 `test-talk-builder-calendar-return.mjs` は **監査条件が obsolete**。

### 専用テスト dev server 失敗

| 原因 | 詳細 |
|------|------|
| port リスト不足 | `PORTS` に 5500/5173 未包含 or HEAD 失敗 |
| 待機 ID obsolete | `builder-project-new-001` を待つが DOM に存在しない |

### 修正対象（最小）

| 種別 | ファイル | 内容 |
|------|----------|------|
| **監査のみ** | `scripts/test-talk-builder-calendar-return.mjs` | `findDevServerBaseUrl` + 新導線（board 通知 or 直接 calendar）へ書き換え、または DEPRECATED として skip |
| **監査のみ** | `scripts/test-talk-notify-unified.mjs` 等 | `builder-project-new-001` ケース削除/置換 |
| 製品 | — | **P1 では不要**（除外は正） |

---

## 判断まとめ

```
やりとり一覧 P1  → 監査条件修正で解消（製品バグではない）
カレンダー P1    → 監査条件修正 + 導線ドキュメント化（製品は意図的変更）
```

### 次フェーズ推奨

1. `test-talk-chat-hub-browser.mjs` を現行 UI に合わせて更新
2. カレンダー監査を `builder-board-*` or `mvp-calendar.html` 直アクセスに再定義
3. full-bleed 幅は P2 として別途 UX 判断（リリースブロッカーにしない）
