# AI秘書 — Google read-only UI 統合 Step 2 最小設計

**実施日:** 2026-06-28  
**前提 commit:** `6fe600f` — Step 1 `feat(secretary): integrate google readonly ui gating`  
**種別:** 設計のみ（**実装・commit なし**）  
**参照:** `reports/ai-secretary-google-readonly-ui-integration-plan.md` · Step 1 完了報告

**Secret / Token / UUID / Token Vault 実データは記載しない**

---

## 1. Step 2 目的

Step 1 で確立した **接続 gating · write hide · 最小サマリ** の上に、read-only 体験を完成させる。

| # | 目的 | 現状（Step 1 後） |
| --- | --- | --- |
| S2-1 | **Gmail labels UI** | Client `listLabels()` あり · UI なし |
| S2-2 | **Calendar list UI** | Client `listCalendars()` あり · UI なし（`primary` 固定） |
| S2-3 | **Live cards assert 拡張** | post-consent は API + 接続ラベルのみ · cards 未 assert |

---

## 2. スコープ

### In

- AI秘書 Dashboard · Gmail / Calendar read-only UI
- `scripts/verify-secretary-google-oauth-live-post-consent.mjs` 拡張
- mock 統合テスト拡張（`test-secretary-google-readonly-ui-integration.mjs`）
- dist 同期（AD-009）

### Out

- Edge function 変更（`secretary-google-tools` · shared gmail/calendar）
- Gmail/Calendar write UI 再有効化
- `users.getProfile` 追加
- Builder / TASFUL AI / Platform / TLV / DeepSeek
- Workspace Orchestrator / Assistant / Contacts / Drive タブ

---

## 3. 既存資産（流用）

| 資産 | Step 2 での使い方 |
| --- | --- |
| `GmailClient.listLabels()` | labels チップ描画 · 件数サマリ |
| Edge `labels.list` | 変更不要 · live/mock 両対応済 |
| Edge `messages.list` + `labelIds` | ラベル chip クリック時フィルタ |
| `CalendarClient.listCalendars()` | カレンダー選択 UI |
| Edge `calendarList.list` | 変更不要 |
| Edge `events.list` + `calendarId` | 選択カレンダーで予定取得 |
| `ReadonlyCoordinator.refreshPanels()` | labels/calendars も refresh 対象に拡張 |
| post-consent verify | `runDashboard()` に UI assert 追加 |

---

## 4. 設計詳細

### 4.1 Gmail labels UI

**配置:** Gmail パネル · preset chips の直下

```html
<div class="ops-secretary-gmail__toolbar ops-secretary-gmail__labels"
     data-ops-secretary-gmail-labels
     role="toolbar"
     aria-label="Gmail ラベル"></div>
```

**動作**

1. `connected && !gated` のときのみ `listLabels()` を 1 回 fetch（`refreshPanels` 内）
2. 返却 `labels[]` を name 昇順 · 最大 **12 件** 表示（`INBOX` / `UNREAD` 等を優先ソート可）
3. chip クリック → `messages.list({ labelIds: [id], maxResults: 10 })`
4. 先頭 chip「すべて」→ 現在 preset（未読）に戻す
5. エラー時: labels 行に `ラベル取得エラー` · cards は既存 preset のまま

**Client 注意:** `listLabels()` は `listMessages` と異なり raw `postGmail` を返す。UI は `result.data?.labels ?? result.labels` を正規化して読む（Step 2 で client 1 行 normalize 可）。

**サマリ拡張（coordinator）**

- Gmail 行: `ready · labels N`（N = 表示可能ラベル数 · 名称は出さない）

---

### 4.2 Calendar list UI

**配置:** Calendar パネル · preset chips の上

```html
<div class="ops-secretary-calendar__list-host"
     data-ops-secretary-calendar-list
     aria-label="カレンダー一覧"></div>
```

**UI 形式:** `<select>` 1 つ（モバイル 390 でも崩れにくい · chip 乱立を避ける）

**動作**

1. `connected` 時 `listCalendars({ maxResults: 20 })`
2. `primary` を default selected
3. `change` → 選択 `calendarId` を uiState に保持 · 現在 preset を維持して `listEvents({ calendarId, preset })`
4. `refreshDefault` / preset クリック時も選択中 `calendarId` を引き継ぐ
5. 0 件: `利用可能なカレンダーがありません`（gated ではない）

**サマリ拡張**

- Calendar 行: `ready · calendars N`

---

### 4.3 Live cards assert 拡張

**対象:** `scripts/verify-secretary-google-oauth-live-post-consent.mjs` の `runDashboard()`

**前提:** Token Vault 1 row · Live OAuth 済 · **再 consent 不要** · bootstrap `?secretary_auth_uid=…`（現行踏襲）

**追加 assert（1280 / 390）**

| # | チェック | PASS 条件 |
| --- | --- | --- |
| L1 | サマリ モード | `data-mode="LIVE"` · `dataset.mock="0"` |
| L2 | Gmail gated でない | cards 内に「接続後にメール」文言 **なし** |
| L3 | Gmail content | `.ops-secretary-gmail__card` ≥ 1 **または** `該当メールはありません` |
| L4 | Gmail labels host | `[data-ops-secretary-gmail-labels]` 子要素 ≥ 1（「すべて」chip 含む） |
| L5 | Calendar tab | タブ click → panel visible |
| L6 | Calendar content | `.ops-secretary-calendar__card` ≥ 1 **または** `予定はありません` |
| L7 | Calendar list | `[data-ops-secretary-calendar-list] select option` ≥ 1 |
| L8 | write 不可視 | Step 1 と同基準（可視 write ボタン 0） |
| L9 | JS fatal | 0 |
| L10 | Secret | DOM テキストに token/uuid パターンなし |

**API 側（任意 · 既存強化）**

- `events.list` probe を post-consent に 1 行追加（HTTP 200 · ok:true のみ記録 · 件数は可変）

**JSON レポート:** pass/fail と件数のみ · email 全文 · UUID · token 値は **書かない**

---

## 5. 変更対象ファイル（予定）

| ファイル | 変更 |
| --- | --- |
| `admin-ai-secretary-google-gmail-ui.js` | `loadLabels` · render chips · label filter |
| `admin-ai-secretary-google-calendar-ui.js` | `loadCalendars` · select · calendarId state |
| `admin-ai-secretary-google-readonly-coordinator.js` | summary に labels/calendars 件数 |
| `admin-operations-dashboard.html` | labels host · calendar list host |
| `admin-operations-dashboard.css` | labels chips · select 行 |
| `scripts/verify-secretary-google-oauth-live-post-consent.mjs` | `runDashboard` assert 拡張 |
| `scripts/test-secretary-google-readonly-ui-integration.mjs` | mock labels/calendar list assert |
| `deploy/cloudflare/dist/*` | 上記ミラー |
| `docs/AI/SECRETARY_AI.md` | 実装後追記（任意） |

**新規ファイル:** なし（Step 2 は既存モジュール拡張のみ）

---

## 6. テスト方針

| 層 | 内容 |
| --- | --- |
| 回帰 | 6-B · 6-C · 6-E · Step 1 統合 — **全 PASS 維持** |
| mock 統合 | connected mock で labels chips · calendar select · 選択後 events reload |
| Live | post-consent 拡張（`.env` · Vault 1 row · 8788 · **再 consent 不要**） |
| Manual | 8788 · Live 接続済みで labels クリック · calendar 切替 · 1280/390 |

---

## 7. Go / No-Go（Step 2）

| 条件 | Go |
| --- | --- |
| Edge 不変更 | 必須 |
| Step 1 gating / write hide 退行なし | 必須 |
| labels / calendar list が connected 時のみ API 呼び出し | 必須 |
| Live post-consent 拡張 PASS（空 inbox/空 calendar も許容） | 必須 |
| Secret 非露出 | 必須 |
| 1280 / 768 / 390 · JS fatal 0 | 必須 |

---

## 8. リスク

| リスク | 緩和 |
| --- | --- |
| Live inbox/calendar が空 | empty 文言を PASS 条件に含める |
| labels 数が多い | 最大 12 + 「すべて」固定 |
| `listLabels` 返却 shape 揺れ | client normalize 1 箇所 |
| calendar select が 390 で幅不足 | 全幅 select · 既存 gmail search と同スタイル |
| post-consent が dev 8788 必須 | `findDevServerBaseUrl` 現行維持 |

---

## 9. 推奨実装順（最小単位）

**1 PR = Step 2 全体**（依存が薄いため分割不要）

1. HTML/CSS hooks
2. Gmail labels UI + coordinator 件数
3. Calendar list UI + calendarId 引き継ぎ
4. mock 統合テスト拡張
5. post-consent live assert 拡張
6. `npm run build:pages` · 回帰一括

**見積:** UI ~120 行 · verify ~60 行 · test ~40 行（Edge 0）

---

## 10. 判定

**Step 2 設計完了 · 実装 Go（承認後）**

実装開始の指示があれば上記順で着手する。
