# AI秘書 — Gmail / Calendar read-only UI 統合 設計案

**実施日:** 2026-06-28  
**種別:** 調査・設計のみ（**実装・commit なし**）  
**前提 commit:** `2f38067` — Google OAuth Live Full E2E PASS  
**参照:** `reports/ai-secretary-google-oauth-live-e2e.md` · `docs/AI/SECRETARY_AI.md`

**Secret / Token / UUID / .env / Token Vault 実データは記載しない**

---

## 1. 現状

### 1.1 総合

| レイヤ | Gmail read-only | Calendar read-only | Live 接続後 UI |
| --- | --- | --- | --- |
| **Edge / tools** | ✅ 実装済 | ✅ 実装済 | API PASS（post-consent） |
| **Client** | ✅ 実装済 | ✅ 実装済 | Edge プロキシ経由 |
| **Dashboard UI** | △ 部分統合 | △ 部分統合 | 接続ラベルのみ live 確認済 |
| **Live UI 検証** | ❌ 未実施 | ❌ 未実施 | 8788 で cards 内容未 assert |

OAuth Live E2E（`verify-secretary-google-oauth-live-post-consent.mjs`）は **API + 接続ラベル** まで PASS。  
Gmail / Calendar の **read-only データが Dashboard カードに live 表示されること** は、現時点で自動検証されていない。

### 1.2 Gmail read-only 棚卸し

| 区分 | ファイル / 場所 | 状態 | 備考 |
| --- | --- | --- | --- |
| **UI** | `admin-ai-secretary-google-gmail-ui.js` | ✅ mount 済 | preset 4種 · 検索 q · メールカード |
| | `admin-operations-dashboard.html` | ✅ DOM あり | `data-ops-secretary-gmail-panel` |
| | `admin-operations-dashboard.css` | ✅ スタイルあり | `.ops-secretary-gmail__*` |
| **Client** | `admin-ai-secretary-google-gmail-client.js` | ✅ | `listMessages` · `getMessage` · `getThread` · **`listLabels`** |
| **Edge** | `supabase/functions/secretary-google-tools/index.ts` | ✅ | `action=gmail` → read only（write は 403） |
| | `supabase/functions/_shared/secretary-google-gmail.ts` | ✅ | `messages.list/get` · `threads.get` · `labels.list` |
| **Tools 定義** | `TOOL_STATUS.gmail.readMethods` | ✅ | 4 method 列挙 |
| **Tests** | `scripts/test-secretary-google-gmail-phase6c.mjs` | ✅ | unit + mock fetch + browser mount smoke |
| | `scripts/verify-secretary-google-oauth-live-post-consent.mjs` | ✅ | `labels.list` live API |
| **Docs** | `docs/AI/SECRETARY_AI.md` §6-C | ✅ | read-only 仕様 |
| | `reports/secretary-google-phase6c-gmail-readonly.md` | ✅ | Phase 6-C 完了報告 |

**Gmail UI の read 機能（動作する）**

- mount 時に未読 preset で `messages.list` 自動実行
- preset chips: 未読 / 重要 / 添付 / 受信トレイ
- Gmail 検索 `q`
- カード: 件名 · From · 日時 · snippet · バッジ · 添付 metadata
- status 行に件数 + `· mock` 表示（live 時は mock なし）

**Gmail UI の read 以外（本フェーズスコープ外だが DOM に存在）**

- Phase 6-D write workflow: 返信案 · 下書き · 送信 · Human Gate（`proposeReply` → DeepSeek）
- カード内「返信案を作る」ボタンが常時表示

**Gmail profile**

- **`users.getProfile` API は未実装**（`GMAIL_READ_METHODS` に含まれない）
- Live E2E の「profile」= OAuth `status` の `googleAccountEmail`（接続 UI ラベル）
- メッセージ総数 · スレッド総数等の Gmail profile 統計は **UI / Edge とも未対応**

**Gmail labels**

- Edge + Client（`listLabels()`）は **実装済**
- Dashboard UI に **ラベル一覧表示なし**（API 呼び出し UI なし）

### 1.3 Calendar read-only 棚卸し

| 区分 | ファイル / 場所 | 状態 | 備考 |
| --- | --- | --- | --- |
| **UI** | `admin-ai-secretary-google-calendar-ui.js` | ✅ mount 済 | preset · 検索 · カード · 詳細 |
| | `admin-operations-dashboard.html` | ✅ DOM あり | 見出し「Calendar（閲覧のみ）」 |
| **Client** | `admin-ai-secretary-google-calendar-client.js` | ✅ | **`listCalendars`** · `listEvents` · `getEvent` |
| **Edge** | `secretary-google-tools` | ✅ | `action=calendar_read` |
| | `secretary-google-calendar.ts` | ✅ | `calendarList.list` · `events.list` · `events.get` |
| **Tests** | `scripts/test-secretary-google-calendar-phase6e.mjs` | ✅ | unit + mock + browser tab smoke |
| | post-consent verify | ✅ | `calendarList.list` live API |
| **Docs** | `docs/AI/SECRETARY_AI.md` §6-E | ✅ | read-only 仕様 |
| | `reports/secretary-google-phase6e-calendar-readonly.md` | ✅ | Phase 6-E 完了報告 |

**Calendar UI の read 機能（動作する）**

- mount 時に「今日の予定」preset で `events.list` 自動実行
- preset: 今日 / 明日 / 今週 / 今後7日
- キーワード検索（`events.list` + `q`）
- 予定カード + クリック詳細（`events.get`）
- Mail / Calendar / Contacts / Drive タブ切替

**Calendar UI の read 以外（本フェーズスコープ外だが DOM に存在）**

- Phase 6-F write: 予定作成フォーム · 詳細から変更/削除 · Human Gate
- 見出しは「閲覧のみ」だが **作成 UI が同居**（仕様不整合）

**Calendar list**

- Edge + Client（`listCalendars()`）は **実装済**
- Dashboard UI に **カレンダー一覧パネルなし**（primary 固定で events のみ）

**直近予定一覧**

- `events.list` + preset「今日」= 実質 **直近予定** として機能
- 専用「直近 N 件」UI ラベルはない（preset で代替可能）

### 1.4 Dashboard 統合（mount 経路）

```
admin-operations-dashboard.html
  → admin-ai-secretary-phase2.js :: render()
       TasuSecretaryGoogleConnectUI.mount()
       TasuSecretaryGoogleGmailUI.mount()
       TasuSecretaryGoogleCalendarUI.mount()
       (+ Contacts / Drive / Orchestrator — 本フェーズ対象外)
```

**接続 UI**（`admin-ai-secretary-google-connect-ui.js`）

- `fetchStatus()` → ラベル「Google接続済み / 未接続」+ mock 表示
- connect / disconnect ボタン
- OAuth 成功後 `?google_oauth=success` を URL から除去
- **接続状態変化時に Gmail/Calendar UI を refresh しない**

**接続 gating なし**

- Gmail / Calendar UI は **未接続でも mount 直後に API 呼び出し**
- 失敗時 status 行に `Gmail エラー: …` / `Calendar エラー: …`（汎用メッセージのみ）
- Workspace パネル全体の disabled / プレースホルダ表示なし

**mock / live 表示**

| 場所 | mock 表示 | live 表示 |
| --- | --- | --- |
| Connect ラベル | `Google接続済み（mock）` | `Google接続済み (email)` |
| Gmail status | `… · mock`（data.mock 時） | 件数のみ |
| Calendar status | 同上 | 件数のみ |
| 統合サマリ | ❌ なし | ❌ なし |

**エラー表示**

- 各パネル status テキスト 1 行（最大 80 文字 truncate）
- 構造化エラー（401 / 502 / scope 不足 / 未接続）の区別 UI なし
- リトライボタンなし

### 1.5 Live E2E とのギャップ

post-consent 検証（`2f38067` 時点 PASS）:

| 項目 | API | Dashboard UI |
| --- | --- | --- |
| 接続状態 | ✅ | ✅ ラベル |
| Gmail labels.list | ✅ | ❌ 未表示 |
| Gmail profile（status email） | ✅ | △ 接続ラベルのみ |
| Gmail messages.list | ✅ | ❌ live cards 未 assert |
| Calendar calendarList.list | ✅ | ❌ 未表示 |
| Calendar events.list | （API 直接未 probe） | ❌ live cards 未 assert |

---

## 2. 既存資産（流用可否）

| 資産 | 流用 | 変更要否 |
| --- | --- | --- |
| `secretary-google-tools` Gmail/Calendar read actions | ✅ そのまま | 不要（Edge 変更なし推奨） |
| `TasuSecretaryGoogleOAuthClient` | ✅ | `fetchStatus` 結果を UI coordinator へ渡す hook のみ |
| `TasuSecretaryGoogleGmailClient.listLabels` | ✅ | UI から呼ぶだけ |
| `TasuSecretaryGoogleCalendarClient.listCalendars` | ✅ | UI から呼ぶだけ |
| `TasuSecretaryGoogleGmailUI.loadQuery` | ✅ | 接続 gating + labels chip 追加 |
| `TasuSecretaryGoogleCalendarUI.loadPreset` | ✅ | 接続 gating + calendar list 追加 |
| `admin-operations-dashboard.css` Gmail カード系 | ✅ | サマリパネル用クラス追加程度 |
| `test-secretary-google-gmail-phase6c.mjs` | ✅ 回帰 | live UI assert 拡張 |
| `test-secretary-google-calendar-phase6e.mjs` | ✅ 回帰 | live UI assert 拡張 |
| `verify-secretary-google-oauth-live-post-consent.mjs` | ✅ 拡張 | Dashboard で cards / labels 表示 assert |

**流用しない（本フェーズ触らない）**

- Gmail write client/UI（6-D）· Calendar write client/UI（6-F）— **DOM から hide するのみ**（削除しない）
- Workspace Orchestrator / Assistant（7-A）— write 含む · スコープ外
- Contacts / Drive タブ — スコープ外（既存のまま）
- DeepSeek Adapter — 変更禁止 · write 経路を UI から到達不能にする

---

## 3. 不足

### 3.1 機能ギャップ

| # | 不足 | 重要度 |
| --- | --- | --- |
| G1 | **接続 gating** — 未接続時に read API を叩かない / 案内表示 | 高 |
| G2 | **接続後 refresh** — OAuth 成功 · disconnect 後に Gmail/Calendar 再読込 | 高 |
| G3 | **Read-only 統合サマリ** — 接続 · email · mock/live · labels 件数 · calendar 件数 · 次回予定 1 件 | 高 |
| G4 | **Gmail labels UI** — `listLabels()` 結果の chips / 一覧 | 中 |
| G5 | **Calendar list UI** — `listCalendars()` 結果 + calendarId 選択 | 中 |
| G6 | **Write UI の非表示** — Gmail 返信案 / Calendar 作成・変更・削除（read-only フェーズ） | 高（安全） |
| G7 | **構造化エラー UI** — unauthorized / not_connected / api_error / mock 明示 | 中 |
| G8 | **Live UI 自動検証** — 8788 で live cards 表示 assert | 高 |
| G9 | Gmail `users.getProfile` 統計 | 低（OAuth email で足りるなら Edge 追加不要） |

### 3.2 仕様不整合

- Calendar 見出し「閲覧のみ」と作成フォーム / 変更・削除ボタンの共存
- Gmail status に `· Human Gate` が read 表示にも付く（6-D 由来）
- Connect UI と Workspace パネル間に **イベント連携なし**（`refreshUi` 単体）

---

## 4. 実装案

### 4.1 方針

1. **Edge / Token Vault / OAuth は変更しない**（Live PASS 資産を温存）
2. **read-only 専用 coordinator** を薄く追加し、Connect UI · Gmail UI · Calendar UI を接続状態で同期
3. **Write UI は DOM 上 `hidden` + JS ガード**（6-D/6-F コードは残す · 次フェーズで再有効化可）
4. **DeepSeek 呼び出し経路**（`proposeReply` · `parseEventIntent`）は UI から到達不能にする（Adapter 本体は不変更）
5. Builder / TASFUL AI / Platform / TLV / `ai-model-gateway.js` — **非接触**

### 4.2 推奨アーキテクチャ

```
[data-ops-secretary-google-connect]  ConnectUI.refreshUi()
        │ status event: tasu:secretary-google-connection-changed
        ▼
admin-ai-secretary-google-readonly-coordinator.js  （新規 · 薄い）
        ├─ refreshSummary()  → [data-ops-secretary-google-readonly-summary]
        ├─ gateWorkspacePanels(connected, mock)
        └─ triggerReadRefresh() → GmailUI / CalendarUI reload
        ▼
GmailUI / CalendarUI（既存 · 小改修）
        └─ if !connected → placeholder / skip fetch
        └─ readonlyMode → hide write controls
```

### 4.3 変更対象ファイル

| ファイル | 変更内容 | 新規/改修 |
| --- | --- | --- |
| `admin-ai-secretary-google-readonly-coordinator.js` | 接続 sync · サマリ render · gating · custom event | **新規** |
| `admin-ai-secretary-google-connect-ui.js` | refresh 後に `tasu:secretary-google-connection-changed` dispatch | 改修 |
| `admin-ai-secretary-google-gmail-ui.js` | 接続 gating · labels 表示 · write hide · error 改善 | 改修 |
| `admin-ai-secretary-google-calendar-ui.js` | 接続 gating · calendar list · write hide · error 改善 | 改修 |
| `admin-operations-dashboard.html` | サマリ DOM · labels host · calendar list host · write 要素に `data-readonly-hide` | 改修 |
| `admin-operations-dashboard.css` | サマリ · labels chips · disconnected プレースホルダ | 改修 |
| `admin-ai-secretary-phase2.js` | coordinator `mount()` 追加（1 行） | 改修 |
| `scripts/test-secretary-google-readonly-ui-integration.mjs` | mock + live UI 統合テスト | **新規** |
| `scripts/verify-secretary-google-oauth-live-post-consent.mjs` | Dashboard: gmail cards / calendar tab assert 追加 | 改修 |
| `docs/AI/SECRETARY_AI.md` | read-only UI 統合フェーズ追記 | 改修（実装後） |

**変更しない（Go 条件）**

- `supabase/functions/**`（Edge）
- `admin-ai-secretary-google-gmail-client.js` / `calendar-client.js`（API surface 十分）
- Orchestrator / Contacts / Drive / Workspace Assistant
- Builder / Platform / TLV / TASFUL AI 全域

### 4.4 UI 整理案（Dashboard）

#### A. Google 接続バー（拡張）

既存 connect bar の直下に **read-only サマリ**（折りたたみ可）:

| 項目 | データ源 |
| --- | --- |
| 接続状態 | `OAuth.fetchStatus()` |
| アカウント | `googleAccountEmail`（token 非表示） |
| モード | `mock: true/false` バッジ |
| Gmail | labels 件数 · 未読 preset 件数（messages.list） |
| Calendar | calendar 数 · 今日の予定件数 |
| エラー | 最後の read エラーコード（sanitize 済） |

#### B. Gmail パネル

- **接続前:** 「Google 接続後にメールを表示します」+ 接続ボタンへの導線
- **接続後:** 既存 preset + **Labels chip 行**（`listLabels` · 最大 12 + 「すべて」）
- **Write hide:** 返信案ボタン · draft editor · Human Gate 文言 — `data-readonly-hide` で非表示
- **status:** `未読 N 件 · live` / `未読 N 件 · mock` / `エラー: not_connected`

#### C. Calendar パネル

- **接続前:** 同上プレースホルダ
- **接続後:** **Calendar list**（primary 強調）→ 選択 calendarId で `listEvents`
- **Write hide:** 作成フォーム · 詳細の変更/削除 · confirm panel
- **見出し:** 「Calendar（閲覧）」に統一（作成 UI 削除で「閲覧のみ」と一致）

#### D. mock / live 表示ルール

- Connect ラベル: 現行維持
- 各パネル status + サマリバッジ: `LIVE` / `MOCK` / `OFFLINE`
- mock 時も read-only 動作確認可能（Secret 未設定 dev 向け）

### 4.5 Gmail profile 方針

**Phase 1（本フェーズ）:** OAuth `status.googleAccountEmail` + `messages.list` 先頭 1 件の有無を「プロフィール OK」指標とする（Live E2E と同じ）。

**Phase 2（任意）:** `users.getProfile` を Edge `GMAIL_READ_METHODS` に追加する場合は **別 ADR / セキュリティレビュー** が必要。本フェーズでは **Edge 変更なし** を推奨。

---

## 5. テスト案

### 5.1 自動テスト（8788 必須）

| テスト | コマンド / ファイル | 内容 |
| --- | --- | --- |
| 回帰 unit | `node scripts/test-secretary-google-gmail-phase6c.mjs` | 既存 PASS 維持 |
| 回帰 unit | `node scripts/test-secretary-google-calendar-phase6e.mjs` | 既存 PASS 維持 |
| 回帰 OAuth | `node scripts/test-secretary-google-oauth-phase6b.mjs` | 接続 UI |
| **新規 統合** | `node scripts/test-secretary-google-readonly-ui-integration.mjs` | 下表 |
| Live post-consent | `node --env-file=.env scripts/verify-secretary-google-oauth-live-post-consent.mjs` | 拡張 assert |

**新規統合テスト（mock モード · 8788）**

1. 未接続（dev user なし）→ Workspace プレースホルダ · API 呼び出し 0（fetch stub）
2. mock 接続 → サマリ `MOCK` · Gmail cards ≥ 1 · Calendar tab cards ≥ 1
3. labels UI 表示 · calendar list 表示
4. write ボタン DOM `hidden` または不在
5. viewport 1280 / 768 / 390 · JS fatal 0 · 横スクロールなし

**Live 拡張（post-consent · Token Vault 1 row 前提）**

1. bootstrap `?secretary_auth_uid=…` で Dashboard 打开
2. Connect: `Google接続済み` · mock なし
3. Gmail: cards host に `.ops-secretary-gmail__card` ≥ 0（空 inbox も OK · empty 文言 assert）
4. Calendar tab: cards または empty 文言
5. labels / calendar list host が render 済
6. **Secret 値 · email 全文 · UUID を JSON に書かない**（pass/fail のみ）

### 5.2 手動チェック（8788）

| # | 操作 | 期待 |
| --- | --- | --- |
| 1 | 未接続で Dashboard 打开 | read プレースホルダ · write UI 非表示 |
| 2 | 接続後リロード | サマリ LIVE · Gmail 未読 / Calendar 今日が load |
| 3 | disconnect | プレースホルダに戻る · データクリア |
| 4 | mock 環境（任意） | MOCK バッジ · fixture 表示 |

### 5.3 Go / No-Go 条件

| 条件 | Go | No-Go |
| --- | --- | --- |
| Edge OAuth / tools | 変更なし · live API PASS 維持 | Edge 退行 · token 露出 |
| Write UI | Gmail/Calendar write 操作が UI から不可 | 送信/作成/削除が無 Gate で可能 |
| 未接続 | API 乱発なし · 案内表示 | 401 エラー連発 · 空白 |
| Live UI | post-consent 拡張 PASS | cards が永久「読込中」 |
| 回帰 | 6-C / 6-E / 6-B tests PASS | 既存 mock smoke FAIL |
| スコープ | Secretary Google のみ | Builder/TLV/Platform/TASFUL AI diff |
| 秘密情報 | レポート/JSON に token なし | secret ログ · DOM 露出 |
| Viewport | 1280 / 768 / 390 PASS | 横スクロール · JS fatal |

---

## 6. リスク

| リスク | 影響 | 緩和 |
| --- | --- | --- |
| **RELEASE FROZEN 抵触**（`.cursor/rules/pkg-secretary.mdc`） | レビュー指摘 | Critical 追従（Live OAuth 後 read-only 安全統合）としてスコープ文書化 · 最小 diff |
| Write UI hide 漏れ | 意図しない write | `data-readonly-hide` + coordinator ガード + テストで write ボタン assert |
| 未接続時 API 502 ログ | ノイズ · ユーザー混乱 | gating で fetch 抑止 |
| Live inbox 空 | テスト flaky | empty 文言も PASS 条件に含める |
| Playwright + Google | OAuth 不可 | Live UI は post-consent + bootstrap UUID のみ（現行と同じ） |
| coordinator 増加 | 複雑化 | 1 ファイル · 200 行未満目標 · 既存 UI mount は維持 |
| `messages.list` N+1（Edge） | 遅延 | 現行のまま · UI は maxResults=10 維持 · サマリは件数のみ |
| dist 同期忘れ | 8788 旧 HTML | 実装後 `npm run build:pages`（AD-009） |

---

## 7. 次に実装してよい最小単位

**推奨: Step 1 のみを 1 PR / 1 作業単位とする**（Go 確認後 Step 2 へ）

### Step 1 — 安全 gating + write hide + 接続 sync（Must）

**目的:** Live 接続済み環境で read-only のみ安全に触れる状態にする。

- 新規 `admin-ai-secretary-google-readonly-coordinator.js`
- Connect UI → connection changed event
- Gmail/Calendar UI: 未接続 gating · write DOM hide · disconnect 時クリア
- HTML: `data-readonly-hide` 付与 · 最小サマリ（接続 + mock/live のみ）
- テスト: mock 統合テスト（disconnected + connected mock）

**完了条件:** mock 8788 で gating / write 非表示 PASS · 6-C/6-E 回帰 PASS

### Step 2 — labels + calendar list + サマリ拡張（Should）

- Gmail labels chips UI
- Calendar list 選択 UI
- サマリに件数 · エラー集約
- post-consent live assert 拡張

**完了条件:** Live post-consent 拡張 PASS · 1280/390 cards/empty assert

### Step 3 — docs + polish（Could）

- `docs/AI/SECRETARY_AI.md` 追記
- 768 viewport スクショ（qa.mdc）
- status 文言整理（Human Gate 表記を read パネルから分離）

---

## 8. 参照ファイル一覧

| 種別 | パス |
| --- | --- |
| Dashboard | `admin-operations-dashboard.html` · `.css` · `admin-ai-secretary-phase2.js` |
| OAuth | `admin-ai-secretary-google-oauth-client.js` · `admin-ai-secretary-google-connect-ui.js` |
| Gmail | `admin-ai-secretary-google-gmail-client.js` · `admin-ai-secretary-google-gmail-ui.js` |
| Calendar | `admin-ai-secretary-google-calendar-client.js` · `admin-ai-secretary-google-calendar-ui.js` |
| Edge | `supabase/functions/secretary-google-tools/index.ts` |
| Shared | `supabase/functions/_shared/secretary-google-gmail.ts` · `secretary-google-calendar.ts` · `secretary-google-oauth.ts` |
| Tests | `scripts/test-secretary-google-gmail-phase6c.mjs` · `test-secretary-google-calendar-phase6e.mjs` · `verify-secretary-google-oauth-live-post-consent.mjs` |
| Docs | `docs/AI/SECRETARY_AI.md` |
| Live E2E | `reports/ai-secretary-google-oauth-live-e2e.md` |

---

**判定:** 調査完了 · **実装 Go（Step 1 から着手可）**  
**成果物:** 本ファイル `reports/ai-secretary-google-readonly-ui-integration-plan.md`
