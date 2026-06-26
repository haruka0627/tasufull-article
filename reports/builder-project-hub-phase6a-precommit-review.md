# Builder Project Hub Phase 6-A — コミット前レビュー

**実施日:** 2026-06-26  
**レビュー方針:** コード変更なし（テスト再実行 · 調査のみ）  
**commit / push / deploy:** **未実施**

---

## 総合判定: **Go（条件付き）**

Phase 6-A の実装 · テスト · docs は整合。**選別ステージング**（AD-007）で Project Hub 関連のみコミットすれば問題なし。`git status` 上の unrelated 変更および **dist/builder 一括 M** は **含めない**。

---

## 1. git status 要約

### Phase 6-A 対象（コミット候補）

| 区分 | 状態 | ファイル |
| --- | --- | --- |
| **新規（untracked）** | `??` | `builder/builder-project-store.js` |
| | | `builder/builder-project-hub.js` |
| | | `builder/builder-project-detail.js` |
| | | `builder/builder-project-hub.css` |
| | | `builder/project-hub.html` |
| | | `builder/project-detail.html` |
| | | `scripts/test-builder-project-hub-phase6a.mjs` |
| | | `reports/builder-project-hub-phase6a.md` |
| **変更（tracked）** | `M` | `builder/builder-ai-ui.js` |
| | | `builder/builder-ai.html` |
| | | `builder/index.html` |
| | | `docs/AI/BUILDER_AI.md` |
| | | `docs/TODO.md` |
| | | `docs/ROADMAP.md` |
| **dist mirror（新規）** | `??` | `deploy/cloudflare/dist/builder/project-hub.html` |
| | | `deploy/cloudflare/dist/builder/project-detail.html` |
| | | `deploy/cloudflare/dist/builder/builder-project-store.js` |
| | | `deploy/cloudflare/dist/builder/builder-project-hub.js` |
| | | `deploy/cloudflare/dist/builder/builder-project-detail.js` |
| | | `deploy/cloudflare/dist/builder/builder-project-hub.css` |
| **dist mirror（変更）** | `M` | `deploy/cloudflare/dist/builder/builder-ai.html` |
| | | `deploy/cloudflare/dist/builder/builder-ai-ui.js` |
| | | `deploy/cloudflare/dist/builder/index.html` |

**推奨コミット件数: 23 ファイル**（ソース 15 + dist 9 — 本レビュー md は任意で同梱可）

### ソース diff 規模（HEAD 比 · tracked のみ）

```
builder/builder-ai-ui.js | 47 +++++
builder/builder-ai.html  |  8 +++++
builder/index.html       |  1 +
docs/*                   | 49 +++++
6 files, 97 insertions(+), 8 deletions(-)
```

新規 6 モジュール + HTML 2 は **untracked**（上表）。

### 混在（コミット除外）

| 区分 | 例 |
| --- | --- |
| **dist/builder 一括 M** | `builder-ai-core.js` 等 100+ ファイル — HEAD 比で **内容変更が Phase 6-A 以外** · **ステージ禁止** |
| **TLV / Platform** | `deploy/cloudflare/dist/live/tlv-feature-flags.js`, `reports/platform-*` |
| **AI 秘書 / TASFUL AI** | triage レポート · probe JSON（秘書 Phase 5 は `025e685` コミット済 · 作業ツリー残差分） |
| **PNG / 検証ログ** | `scripts/tmp-channel-audit/*.png` |
| **dist ノイズ** | `dist/.cursor/`, unrelated `dist/docs/*` |

---

## 2. Project Hub のみか

**判定: PASS（ステージング時の選別が前提）**

- 変更 tracked ソースは **Builder AI 連携 3 ファイル + docs 3** のみ
- 新規は **project-hub 系 6 + test + report** のみ
- AI 秘書 · Platform · TLV · TASFUL AI の **ソース変更なし**

---

## 3. Builder AI 連携確認

| 項目 | 実装 | 結果 |
| --- | --- | --- |
| 詳細 → AI | `project-detail.js` · `builder-ai.html?projectId=` | PASS |
| 案件コンテキスト UI | `data-builder-ai-project-context` バナー | PASS |
| store 読込 | `builder-ai.html` に `builder-project-store.js` | PASS |
| 診断保存トリガ | `builder-ai-ui.js` · `usedVision && diagnosis && projectId` | PASS |
| 保存 API | `TasuBuilderProjectStore.saveVisionDiagnosis` | PASS（テスト） |
| ユーザー通知 | `pushSystem` 保存完了メッセージ | PASS |

**フロー:** 案件詳細 → Builder AI → Vision（写真）→ JSON → `saveVisionDiagnosis` → タイムライン + 診断履歴

---

## 4. Vision JSON 保存確認

| 項目 | 結果 |
| --- | --- |
| 正本 | `diagnosis` オブジェクト（Phase 5 JSON スキーマ）を `visionDiagnoses[]` に保存 |
| タイムライン | `ai_diagnosis` イベント自動追加 |
| 上限 | 診断履歴 20 件 |
| テスト | `saveVisionDiagnosis` + timeline assert **PASS** |

---

## 5. Timeline 確認

| 項目 | 結果 |
| --- | --- |
| イベント型 | `project_created` · `estimate_submitted` · `ai_diagnosis` · `contract_signed` · `construction_started` · `completed` · `memo_updated` · `status_changed` |
| UI | `project-detail.html` · `data-builder-pd-timeline` · **閲覧のみ** |
| seed | デモ 3 件に初期タイムライン |
| メモ保存 | `updateProject` → `memo_updated` イベント |

---

## 6. 検索確認

| フィルタ | 実装 |
| --- | --- |
| キーワード | 案件名 · 顧客 · 業者 · ID · カテゴリ/ステータスラベル |
| カテゴリ | select · 7 カテゴリ |
| ステータス | select · 5 ステータス |
| UI | `project-hub.html` · リアルタイム refresh |

**テスト:** `search filter`（水回り + inquiry）**PASS**

---

## 7. UI 確認

| 画面 | 内容 | 結果 |
| --- | --- | --- |
| **案件ハブ** | 一覧テーブル 7 列 · 空状態 | PASS（static + seed） |
| **案件詳細** | 案件/顧客/業者 · メモ · 診断履歴 · タイムライン | PASS |
| **Builder AI** | 案件連携バナー · 既存 Vision UI 維持 | PASS |
| **ナビ** | `index.html`「案件ハブ」リンク | PASS |
| **デザイン** | `builder-project-hub.css` · Builder 既存トークン | PASS |

---

## 8. Builder 専用境界（AD-002）

| 項目 | 結果 |
| --- | --- |
| 名前空間 | `TasuBuilderProjectStore` / `Hub` / `Detail` — `builder/` のみ |
| 他 surface | store に secretary/platform/tlv 実装参照 **なし**（コメントのみ） |
| ストレージ | `localStorage` · Builder 専用キー `tasu_builder_project_hub_v1` |
| Gateway / 秘書 | **非変更** |

**判定: PASS**

---

## 9. テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-builder-project-hub-phase6a.mjs` | **18/18 PASS** |
| phase5 vision 回帰（同スクリプト内） | **28/28 PASS** |
| `node scripts/test-builder-ai-vision-phase5.mjs`（再確認） | **28/28 PASS** |
| `npm run build:pages` | **PASS** |

---

## 10. docs 確認

| ドキュメント | 整合性 |
| --- | --- |
| `docs/AI/BUILDER_AI.md` | Phase 6-A セクション · モジュール表 · テスト — **整合** |
| `docs/TODO.md` | Phase 6-A 実装 · 未コミット — **整合** |
| `docs/ROADMAP.md` | Project Hub Phase 6-A 行 — **整合** |

---

## コミット対象ファイル一覧（推奨 · 選別ステージング）

```
builder/builder-project-store.js
builder/builder-project-hub.js
builder/builder-project-detail.js
builder/builder-project-hub.css
builder/project-hub.html
builder/project-detail.html
builder/builder-ai.html
builder/builder-ai-ui.js
builder/index.html
scripts/test-builder-project-hub-phase6a.mjs
reports/builder-project-hub-phase6a.md
reports/builder-project-hub-phase6a-precommit-review.md
docs/AI/BUILDER_AI.md
docs/TODO.md
docs/ROADMAP.md
deploy/cloudflare/dist/builder/project-hub.html
deploy/cloudflare/dist/builder/project-detail.html
deploy/cloudflare/dist/builder/builder-project-store.js
deploy/cloudflare/dist/builder/builder-project-hub.js
deploy/cloudflare/dist/builder/builder-project-detail.js
deploy/cloudflare/dist/builder/builder-project-hub.css
deploy/cloudflare/dist/builder/builder-ai.html
deploy/cloudflare/dist/builder/builder-ai-ui.js
deploy/cloudflare/dist/builder/index.html
```

**コミット前:** `npm run build:pages` 実行済みであること · `git diff --cached --name-status` で上記のみであることを確認。

---

## コミット除外すべきファイル

- 上記 **24 以外すべて**
- 特に: `deploy/cloudflare/dist/builder/*` の **project-hub 系 9 以外**（100+ M は site-assistant / タイムスタンプノイズの可能性）
- TLV · Platform · 秘書 · TASFUL AI 検証ログ · PNG · `dist/.cursor`
- **`git add -A` 禁止**（AD-007）

---

## Go / No-Go 判定

| 項目 | 判定 |
| --- | --- |
| Phase 6-A スコープ | **Go** |
| unrelated 排除 | **要対応**（選別ステージング必須） |
| Builder AI 連携 | **Go** |
| Vision JSON · Timeline · 検索 | **Go** |
| AD-002 境界 | **Go** |
| テスト | **Go** — 18 + 28 + build |
| docs | **Go** |
| dist 状態 | **注意** — 一括 M をステージしない |

**最終: Go（条件付き）**

---

## 推奨コミットメッセージ

```
feat(builder): Project Hub Phase 6-A MVP

Add project hub list/detail with localStorage store, search filters,
read-only timeline, and Vision diagnosis JSON persistence from Builder AI.

Wire builder-ai.html?projectId= to save structured diagnoses on usedVision.
Builder-only (AD-002); no Platform/secretary/TASFUL AI integration.

Tests: phase6a 18/18, phase5 vision regression 28/28, build:pages PASS.
```

---

## 実施していないこと

- **git commit** — 未実施
- **git push** — 未実施
- **deploy** — 未実施
