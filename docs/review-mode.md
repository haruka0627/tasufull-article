# Review Mode 運用ガイド

**最終更新:** 2026-07-03  
**目的:** UI 実装後のレビュー成果物（スクショ · 手動確認 · 対話確認）を **再現可能な手順** と **保存先** で統一する。

検証 URL は **`http://127.0.0.1:8788`** のみ（`file://` · 5173 禁止）。手順の正本は [local-dev.md](./local-dev.md)。

---

## 3 つの Review Mode

| Mode | 用途 | 主な成果物 | 典型コマンド |
| --- | --- | --- | --- |
| **Screenshot Review** | 実装後の UI を外部レビュー（ChatGPT 等）に渡す | `reports/ui-review/{機能}/` + `report.json` | `node scripts/capture-{機能}-ui-review.mjs` |
| **Manual Review** | 人間が画面を見ながら Enter で進める（**スクリプトが自動操作**） | `reports/manual-review/{領域}/` · before/after PNG | `--manual-review` |
| **Interactive Review** | 停止点でブラウザを自由操作 → Enter 後 **スクリプトが自動操作を続行** | 上記 + diagnostics JSON（失敗時） | `--interactive-review` |
| **Manual Review Flow** | 停止点で **ユーザーが実際に操作** → Enter 後 **状態 probe のみ**（先に進めても PASS） | 上記 + `{NNN}-{slug}.json` · `report.json` | `--manual-review-flow` |

**使い分け**

- UI を変えたら → まず **Screenshot Review**（必須成果物）
- フロー全体の目視（スクリプト任せ）→ **Manual Review**
- 手動操作込みの分岐確認だが Enter 後は自動進行 → **Interactive Review**
- **完了報告・運営承認まで自分で操作**し、Enter 時点の状態だけ判定したい → **Manual Review Flow**

レガシーの Screenshots QA Center（`screenshots/` · `screenshots-viewer.html`）は [screenshots-qa-rules.md](./screenshots-qa-rules.md) を参照。新規 UI レビューは **`reports/ui-review/`** を優先する。

---

## 前提

```bash
npm run build:pages   # ソース変更後
npm run dev           # http://127.0.0.1:8788
```

作業前チェック: 8788 LISTEN · wrangler Ready · 対象 URL HTTP 200 · Console Error 0（完了報告に記載）。

---

## 1. Screenshot Review

### 保存先

```
reports/ui-review/{機能名}/
```

例:

- `reports/ui-review/talk/`
- `reports/ui-review/talk-profile-card/`

### ファイル命名

**標準（STEP 連番 + viewport）** — `scripts/lib/ui-review-capture.mjs` 利用時:

```
{連番3桁}-{画面slug}-{viewport}.png
```

例: `003-worker-before-reveal-1280.png` · `002-profile-card-390.png`

**機能専用スクリプト**（固定ファイル名が必要な場合）:

```
001-default.png
002-cover-photo.png
004-mobile-390.png
```

→ `scripts/capture-talk-profile-card-ui-review.mjs` 参照。

### viewport

| ID | 幅 | 用途 |
| --- | --- | --- |
| `1280` | 1280×900 | PC |
| `768` | 768×1024 | タブレット |
| `390` | 390×844 | モバイル |

**変更があった画面のみ** 撮影すればよい（全 STEP × 全 viewport 必須ではない）。

### report.json

各 `{機能}/report.json` に以下を記録する。

| フィールド | 内容 |
| --- | --- |
| `feature` | 機能 slug |
| `capturedAt` | ISO 時刻 |
| `baseUrl` | 撮影時のベース URL（8788） |
| `consoleErrorCount` / `consoleErrors` | Console Error 集計 |
| `steps[]` | STEP ごとの slug · URL · ファイル一覧 · HTTP status |

**合格目安:** `consoleErrorCount === 0` · 対象要素の overflow なし（スクリプト定義に従う）。

### 共通ライブラリ · 既存スクリプト

| ファイル | 説明 |
| --- | --- |
| `scripts/lib/ui-review-capture.mjs` | `createUiReviewSession()` · viewport ループ · `report.json` |
| `scripts/capture-talk-ui-review.mjs` | Talk 全体（6 STEP） |
| `scripts/capture-talk-profile-card-ui-review.mjs` | プロフィールカード（001〜005） |
| `scripts/capture-connect-ui-review.mjs` | Connect |
| `scripts/capture-notify-ui-review.mjs` | 通知 UI |
| `scripts/capture-market-notify-ui-review.mjs` | 市場通知 |
| `scripts/capture-builder-ct-ui-review.mjs` | Builder CT |
| `scripts/capture-ai-workspace-ui-review.mjs` | AI Workspace（別パス · 下記） |

新機能追加時は `scripts/capture-{機能}-ui-review.mjs` を追加し、`createUiReviewSession()` を使う（`.cursor/rules/qa.mdc` 参照）。

```bash
node scripts/capture-talk-ui-review.mjs
node scripts/capture-talk-profile-card-ui-review.mjs
```

---

## 2. Manual Review

人間が **見るだけ**（停止中の自由操作なし）。スクリプトが自動操作し、各停止点で before スクショ → Enter → after スクショ。

### 保存先

```
reports/manual-review/{領域}/
```

例: `reports/manual-review/builder-talk/`

### ファイル

| パターン | 内容 |
| --- | --- |
| `{NNN}-{slug}-before.png` | Enter 前 |
| `{NNN}-{slug}-after.png` | Enter 後 |
| `error-{slug}-{timestamp}.png` | 失敗時フルページ |
| `trace-{viewport}.zip` | Playwright trace（失敗時） |

### 代表コマンド（Builder → Talk）

```bash
node scripts/check-builder-talk-flow-headed.mjs --manual-review --viewport=1280
node scripts/check-builder-talk-flow-headed.mjs --manual-review --flow=admin --viewport=1280
```

オプション: `--flow=admin|general|worker|vendor|normal` · `--viewport=1280|768|390` · `--visual-slow`

---

## 3. Interactive Review

Manual Review に加え、**停止点でブラウザを自由操作**できる。Enter 後はスクリプトが **自動操作を続行**し、現在画面状態に応じて分岐する（固定 locator 待ちで 30 秒ハングしない）。

**注意:** ユーザーが先に完了報告まで進めると、Enter 後の自動クリックと状態がズレて **FAIL** しうる。手動で最後まで操作して判定したい場合は **Manual Review Flow** を使う。

### 代表コマンド

```bash
node scripts/check-builder-talk-flow-headed.mjs --interactive-review --flow=admin --viewport=1280
```

### 運営案件 STEP 1（カレンダー）— **完了（2026-07-03）**

STEP 1 停止中にユーザーが先に進めた場合、Enter 後は `smartOpenAdminProjectFromCalendar` が状態を判定する。

| パターン | 停止中の操作 | Enter 後の挙動 |
| --- | --- | --- |
| A | カレンダーで案件を開く | 必要なら badge クリック · ログ出力 |
| B | Talk（`chat-detail`）まで進む | `skip (chat-detail)` |
| C | 「受ける」まで進む | `skip (accept-ready)` |
| D | 「Builderで確認」まで進む | `skip (project-detail)` または chat-detail |

**合格根拠（記録済み）**

- 非 interactive `--flow=admin` 回帰: Total 20 · FAIL 0 · Console Error 0
- interactive STEP 1 Enter 後: `[interactive] smartOpenAdminProjectFromCalendar` ログあり
- unknown 状態: **5 秒以内** に diagnostics 保存（30 秒固定待ちなし）

実装: `scripts/check-builder-talk-flow-headed.mjs` · `smartOpenAdminProjectFromCalendar` · `savePageReviewDiagnostics`

### コンソールログ例

```
[interactive] smartOpenAdminProjectFromCalendar
  partner current URL: http://127.0.0.1:8788/builder/project-calendar?role=partner
  detected: chat-detail=false accept=true builderConfirm=false projectTitle=true badgeCount=1
  [1280] [運営案件] ✓ 案件オープン — skip (accept-ready)
```

---

## 4. Manual Review Flow

**Interactive Review とは別モード。** 各 STEP で停止し、ユーザーがブラウザ上で **自由に操作**する。Enter 後は **自動クリックを行わず**、現在の URL · workflow 状態 · 表示ボタンを probe して PASS / FAIL を判定する。

### 目的

- ユーザーが **入場 · 完了報告 · 運営承認待ち** まで手動で進めても FAIL しない
- Enter 時点の状態を正しく認識する（`entered` / `ops_awaiting` / `completed` など **先に到達していれば PASS**）
- 成果物としてスクショ + 状態 JSON を残す

### 代表コマンド

```bash
node scripts/check-builder-talk-flow-headed.mjs --manual-review-flow --flow=admin --viewport=1280
```

### 3 モード比較（Builder → Talk 運営案件）

| 項目 | `--manual-review` | `--interactive-review` | `--manual-review-flow` |
| --- | --- | --- | --- |
| 停止中の操作 | 基本なし（見るだけ） | 自由に操作可 | **自由に操作（推奨）** |
| Enter 後 | スクリプトが自動操作 | スクリプトが自動操作 | **状態 probe のみ** |
| 先に完了報告まで進めた場合 | — | FAIL しうる | **PASS（phase 判定）** |
| 成果物 | before/after PNG | before/after PNG + error JSON | **`{NNN}-{slug}.png` + `{NNN}-{slug}.json` + `report.json`** |

### 運営案件 STEP フロー

1. スクリプトは **セットアップのみ**（localStorage リセット · パートナーカレンダー表示）
2. 以降 18 チェックポイント（calendar → … → owner-completed）
3. 各チェックポイント: 操作説明 → **Enter** → probe → PNG + JSON 保存 → PASS/FAIL
4. **STEP14（owner-talk-open）**: スクリプトが運営（owner）側 Talk URL を生成し **別タブで自動オープン** → 前面表示 → ユーザーは確認して Enter のみ

### probe 内容（`{NNN}-{slug}.json`）

| フィールド | 内容 |
| --- | --- |
| `phase` | 検出フェーズ（`calendar` · `entered` · `ops_awaiting` · `completed` 等） |
| `calendar` | カレンダー画面フラグ（`probeAdminProjectScreen`） |
| `meta` | MVP assignment / threadId |
| `partner` | URL · badge · status · 表示ボタン一覧 |
| `owner` | 運営タブが開いていれば同様のスナップショット |

フェーズは `MANUAL_FLOW_PHASE_RANK` で順序化。チェックポイントの `minPhase` **以上**なら PASS（先に進んでいれば `ahead` として記録）。

### 保存先

```
reports/manual-review/builder-talk/
  001-calendar.png
  001-calendar.json
  ...
  report.json          # 全 STEP サマリ
  error-*.png / *.json # 状態不一致時
```

### コンソールログ例

```
[manual-review-flow] probe partner-completion-reported
  URL: http://127.0.0.1:8788/chat-detail?thread=...&builderRole=partner
  phase: ops_awaiting · min: ops_awaiting
  partner badge: 運営承認待ち
  partner status: ops_confirming
  screenshot: reports/manual-review/builder-talk/013-partner-completion-reported.png
  state JSON: reports/manual-review/builder-talk/013-partner-completion-reported.json
  [1280] [運営案件] ✓ 完了報告送信後（パートナー） — phase=ops_awaiting (min=ops_awaiting)
```

実装: `scripts/check-builder-talk-flow-headed.mjs` · `flowOpsCaseManualReviewFlow` · `manualReviewFlowCheckpoint` · `buildManualFlowProbe`

---

## diagnostics JSON（失敗 · 状態不一致）

Interactive / スマート分岐で画面を解釈できないとき、**長時間待たず** diagnostics を保存する。

### 保存先

`reports/manual-review/builder-talk/error-{slug}-{timestamp}.json`

### 主なフィールド（`savePageReviewDiagnostics`）

| フィールド | 内容 |
| --- | --- |
| `detail` | 失敗理由 |
| `url` | 現在 URL |
| `onChatDetail` · `acceptVisible` · `builderConfirmVisible` | 画面状態フラグ |
| `adminCalBadgeCount` · `projectTitleVisible` | カレンダー関連 |
| `bodyText` | body テキスト先頭（最大 4000 文字） |

同名タイムスタンプの **`error-*.png`** スクリーンショットが同時に保存される。

別系統: `saveInteractiveReviewFailure` — 運営承認など **partner / owner タブ** 用（thread スナップショット · 両タブ PNG）。

---

## 完了報告チェックリスト

UI 変更タスク完了時に記載する項目:

| 項目 | 要件 |
| --- | --- |
| HTTP Status | 対象 URL 200（8788） |
| Console Error | **0 件** |
| Viewport | 1280 / 768 / 390 のうち変更影響があるもの |
| Screenshot Review | `reports/ui-review/{機能}/` + `report.json` |
| 回帰 | 該当 `scripts/test-*.mjs` または headed スクリプト PASS |

推測で「完了」にしない — コマンド出力または `report.json` を根拠にする。

---

## 関連ドキュメント · ルール

| ファイル | 内容 |
| --- | --- |
| [local-dev.md](./local-dev.md) | 8788 起動 · build |
| [screenshots-qa-rules.md](./screenshots-qa-rules.md) | Screenshots QA Center（レガシー canonical 画像） |
| `.cursor/rules/qa.mdc` | エージェント向け QA · ui-review 要約 |
| `scripts/lib/dev-server-url.mjs` | `STANDARD_LOCAL_BASE` · `buildLocalPageUrl()` |

---

## AI Workspace 注意

`scripts/capture-ai-workspace-ui-review.mjs` は歴史的経緯により出力が `screenshots/ai-workspace-ui-review/` と `reports/ai-workspace-ui-review-capture.json` の併用。新規領域は **`reports/ui-review/{機能}/`** に統一する。
