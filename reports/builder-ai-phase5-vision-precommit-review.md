# Builder AI Vision Phase 5 — コミット前レビュー

**実施日:** 2026-06-26  
**レビュー方針:** コード変更なし（テスト再実行・調査のみ）  
**commit / push / deploy:** **未実施**

---

## 総合判定: **Go（条件付き）**

Phase 5 の実装・テスト・docs は整合。**選別ステージング**（AD-007）で Builder AI Vision 関連のみコミットすれば問題なし。`git status` 上の unrelated 変更（dist/builder 他 HTML · TLV · reports 等）は **含めない**。

---

## 1. git status / diff

### 1.1 Phase 5 対象（コミット候補）

| 区分 | ファイル |
| --- | --- |
| **新規** | `builder/builder-ai-vision-analyzer.js` |
| **変更** | `builder/builder-ai-core.js` |
| | `builder/builder-ai-vision.js` |
| | `builder/builder-ai-ui.js` |
| | `builder/builder-ai-ui.css` |
| | `builder/builder-ai.html` |
| **テスト** | `scripts/test-builder-ai-vision-phase5.mjs` |
| **レポート** | `reports/builder-ai-phase5-vision.md` |
| **docs** | `docs/AI/BUILDER_AI.md`, `docs/TODO.md`, `docs/ROADMAP.md` |
| **dist mirror** | `deploy/cloudflare/dist/builder/builder-ai-vision-analyzer.js`（新規） |
| | `deploy/cloudflare/dist/builder/builder-ai-core.js` |
| | `deploy/cloudflare/dist/builder/builder-ai-vision.js` |
| | `deploy/cloudflare/dist/builder/builder-ai-ui.js` |
| | `deploy/cloudflare/dist/builder/builder-ai-ui.css` |
| | `deploy/cloudflare/dist/builder/builder-ai.html` |

**合計: 17 ファイル**（ソース 7 + テスト 1 + レポート 1 + docs 3 + dist 6）

### 1.2 diff 規模（HEAD 比 · Phase 5 ソース + docs）

```
builder/builder-ai-core.js   |  8 +-
builder/builder-ai-ui.css    | 76 +++++++++
builder/builder-ai-ui.js     | 69 +++++++--
builder/builder-ai-vision.js |  6 +
builder/builder-ai.html      | 11 +++
docs/AI/BUILDER_AI.md        | 28 +++++--
docs/ROADMAP.md               |  3 +-
docs/TODO.md                  | 11 +++++-
8 files changed, 197 insertions(+), 15 deletions(-)
```

### 1.3 混在（コミット除外）

`git status` には Phase 5 以外の modified / untracked が多数残存:

| 区分 | 例 |
| --- | --- |
| **dist/builder 他 HTML** | `admin.html`, `index.html` 等 — `git diff HEAD` では **内容差分なし**（status のみ M の可能性 · **ステージしない**） |
| **TLV / Platform** | `deploy/cloudflare/dist/live/tlv-feature-flags.js`, `reports/platform-*` |
| **AI 秘書 / TASFUL AI** | 各種 triage レポート · probe JSON（Phase 5 秘書は `025e685` でコミット済 · 本作業ツリーに残差分あり） |
| **検証ログ / PNG** | `scripts/tmp-channel-audit/*.png`, `reports/gemini-*` |
| **dist ノイズ** | `dist/.cursor/`, `dist/docs/*` untracked |

### 1.4 dist mirror 確認

`git diff --name-status HEAD -- deploy/cloudflare/dist/builder/builder-ai*`

- **M:** core · vision · ui.js · ui.css · html（5）
- **??:** vision-analyzer.js（1）
- **他 `builder-ai-*.js`（page · live 等）:** HEAD 比 **差分なし** → ステージ不要

**判定:** dist は `builder-ai-*` mirror **6 ファイルのみ** で足りる。

---

## 2. Gateway 契約確認

| 項目 | 結果 |
| --- | --- |
| `ai-model-gateway.js` | **変更なし**（`git diff HEAD` 空） |
| Text Gateway (`runAction` / `query`) | **非変更** — `completeTurn` 呼び出しパターン同一 |
| Vision 経路 | `runFieldVision` → `Gateway.completeTurn({ attachments, systemPrompt, ... })` **維持** |
| Phase 5 拡張 | `systemPromptOverride` · `rawOutput` · `rawReply` — **Analyzer 専用オプション**（既存呼び出しは従来どおり wrapDraft） |
| JSON prompt | Analyzer が `buildStructuredVisionPrompt` を override 渡し |
| fallback | Gateway 未接続 / 空応答 / JSON 解析失敗 → **`mockDiagnosis`**（テスト確認済） |

**判定:** PASS — AD-005 契約破壊なし。

---

## 3. Builder 専用境界確認（AD-002）

| 項目 | 結果 |
| --- | --- |
| 新規モジュール | `TasuBuilderAIVisionAnalyzer` — `builder/` のみ |
| 他 surface 参照 | analyzer 内に secretary / platform / tlv / deepseek **実装参照なし**（コメントの非混在宣言のみ） |
| surface | `builder_ai` · `SURFACE` / `MODE_ID` 維持 |
| TASFUL AI / 秘書 | プロンプトで「代わりにはならない」明示（Phase 2 から継承） |
| HTML / script | `builder/builder-ai.html` のみ変更 |

**判定:** PASS — Builder 専用 surface のみ。

---

## 4. UI 確認

### 4.1 自動テスト

| 項目 | 手段 | 結果 |
| --- | --- | --- |
| 診断パネル slot | phase5 static | PASS |
| `setVisionState` / `renderVisionDiagnosis` | phase5 static | PASS |
| script 順 vision → analyzer → ui | phase5 static | PASS |
| 解析中 / 完了 / エラー / 画像なし | phase5 vm + UI コードレビュー | PASS |
| Quick 相談 | ui-phase1 **15/15** | PASS |
| Live カメラ | ui-phase1 browser | PASS |
| Voice | ui-phase1 hooks | PASS |
| Legacy gateway section | ui-phase1 | PASS |

### 4.2 UI 状態マッピング（コード）

| 状態 | トリガー | 表示 |
| --- | --- | --- |
| `analyzing` | 送信開始（写真あり）/ Live スナップショット | ステータス「解析中…」 |
| `complete` | `diagnosis` + `displayHtml` あり | AI参考診断パネル |
| `error` | `!ok && reply` | エラーステータス + system メッセージ |
| `no_image` | `photoRequired` / 外壁キーワード等 | ヒント「写真を添付すると…」 |
| `idle` | 履歴クリア | パネル非表示 |

**判定:** PASS — 既存 Live / Voice / quick 相談の bind は未削除。

---

## 5. Safety 確認

| 文言要素 | 所在 | 結果 |
| --- | --- | --- |
| 「AIの参考診断」 | `SAFETY_NOTICE` · プロンプト · UI タイトル | **統一** |
| 断定・保証しない | `SAFETY_NOTICE` · structured prompt 禁止項 | **あり** |
| 現地確認・専門業者優先 | `SAFETY_NOTICE` · mock テンプレート · hero notice | **あり** |
| Phase 2 免責 | `builder-ai-vision.js` `VISION_DISCLAIMER` | Analyzer 経路では `SAFETY_NOTICE` が正本 · legacy path 用に残存 |

**判定:** PASS — Phase 5 正本は `SAFETY_NOTICE` で統一。

---

## 6. テスト再実行

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-builder-ai-vision-phase5.mjs` | **28/28 PASS**（build:pages 含む） |
| `node scripts/test-builder-ai-vision-phase2.mjs` | **8/8 PASS** |
| `npm run build:pages` | **PASS**（phase5 内で実行済） |
| `node scripts/test-builder-ai-ui-phase1.mjs` | **15/15 PASS**（browser smoke 相当） |

---

## 7. docs 確認

| ドキュメント | 整合性 |
| --- | --- |
| `docs/AI/BUILDER_AI.md` | Phase 5 セクション · テスト表 · Analyzer 記載 — **整合**（`直近コミット: 66051f7` は Phase 5 コミット後に更新推奨だがブロッカーではない） |
| `docs/TODO.md` | Phase 5 実装・未コミット · 28/28 — **整合** |
| `docs/ROADMAP.md` | Vision Phase 5 行追加 — **整合** |

---

## コミット対象ファイル一覧（推奨 · 選別ステージング）

```
builder/builder-ai-vision-analyzer.js
builder/builder-ai-core.js
builder/builder-ai-vision.js
builder/builder-ai-ui.js
builder/builder-ai-ui.css
builder/builder-ai.html
scripts/test-builder-ai-vision-phase5.mjs
reports/builder-ai-phase5-vision.md
docs/AI/BUILDER_AI.md
docs/TODO.md
docs/ROADMAP.md
deploy/cloudflare/dist/builder/builder-ai-vision-analyzer.js
deploy/cloudflare/dist/builder/builder-ai-core.js
deploy/cloudflare/dist/builder/builder-ai-vision.js
deploy/cloudflare/dist/builder/builder-ai-ui.js
deploy/cloudflare/dist/builder/builder-ai-ui.css
deploy/cloudflare/dist/builder/builder-ai.html
```

---

## コミット除外すべきファイル一覧

- 上記 17 以外の **すべて**
- 特に: `dist/builder/*.html`（`builder-ai.html` 以外）, TLV, platform/builder/tasful-ai 検証レポート, PNG, `dist/.cursor`, unrelated `dist/docs`
- **`git add -A` 禁止**（AD-007）

---

## Go / No-Go 判定

| 項目 | 判定 |
| --- | --- |
| Phase 5 スコープ | **Go** |
| unrelated 排除 | **要対応**（選別ステージング必須） |
| Gateway 契約 | **Go** |
| AD-002 境界 | **Go** |
| UI / Safety | **Go** |
| テスト | **Go** — 28 + 8 + 15 + build |
| docs | **Go** |

**最終: Go（条件付き）**

---

## 推奨コミットメッセージ

```
feat(builder): Vision Phase 5 structured Gemini diagnosis

Add builder-ai-vision-analyzer with JSON-canonical field diagnosis,
11 category templates, and AI reference-only safety notice. Extend
runFieldVision with prompt override and raw JSON output. Wire UI
states (analyzing/complete/error/no-image) with minimal layout change.

Tests: phase5 28/28, phase2 regression 8/8, ui-phase1 15/15, build:pages PASS.
```

---

## 実施していないこと

- **git commit** — 未実施
- **git push** — 未実施
- **deploy** — 未実施
