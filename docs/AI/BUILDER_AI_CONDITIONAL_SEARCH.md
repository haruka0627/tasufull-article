# Builder AI — 条件検索機能（設計 Draft）

**Status:** P0 ✅ · P1 ✅ · P2 以降 Backlog  
**最終更新:** 2026-06-28  
**正本:** [BUILDER_AI.md](./BUILDER_AI.md) · AD-002（TASFUL AI 非統合）  
**凍結:** Builder v1.0 **RELEASE FROZEN** — 本設計は **Backlog / P2 以降**（Critical 以外の HTML 大改修は別判断）

---

## 目的

業者 · ワーカー · 案件を **条件ベースで検索**する。  
AI は **検索エンジンではなく**「条件構造化 · クエリ生成 · 結果要約 · ランキング補助」に徹する。

> **マッチング精度向上のための UI + AI 補助層** — 外部検索エンジン代替ではない。

---

## 1. 対象データ

| entity | 日本語 | 現行 UI / データ |
| --- | --- | --- |
| `jobs` | 案件 | `board-projects.html` · `mvp-projects.html` · MVP store / 掲示板 feed |
| `workers` | ワーカー | `find-workers.html`（demo · 準備中） |
| `companies` | 業者 | `partners.html` · `partner-list` Edge · admin partners |

**データソース（優先順）:**

1. **Supabase** — `partner-list` 等 Edge · `builder-repositories-supabase.js`（将来 `TasuBuilderDataProvider` 接続）
2. **Airtable** — 既存運用がある場合のみ adapter 層（正本は Supabase 優先）
3. **localStorage / demo** — 開発 · オフライン preview（`find-workers.html` DEMO_WORKERS 等）

**AI は DB を走査しない。** 検索実行は **Repository / PostgREST / Edge のみ**。

---

## 2. 検索方式

### 2-1. 基本検索（DB フィルタ · AI 不使用）

**高速 · キャッシュ可能 · FREE コア**

| フィルタ | workers | companies | jobs |
| --- | --- | --- | --- |
| 地域（都道府県 · 市区町村） | ✅ `area` | ✅ `area` | ✅ 施工エリア |
| カテゴリ（外壁 · 屋根 · 設備等） | ✅ `trade` | ✅ `trade` | ✅ `category` |
| 単価レンジ | ✅ 日当 | ✅ 予算感 | ✅ 予算 |
| 稼働日 · 納期 | ✅ 対応条件 | ✅ `availability` | ✅ 工期 · 開始日 |
| スキル · 資格 | ✅ `license` | ✅ `license` | ✅ 要件 |
| 評価 · 実績 | ✅ `rating` | ✅ `rating` | ✅ 実績タグ |

**実装方針:**

```text
UI フィルタ → SearchFilter JSON → Repository.query(filters) → 結果
```

- インデックス付き列のみ WHERE（全文 LLM ランキング禁止）
- レスポンス **キャッシュキー** = `entity + canonicalFilterHash + sort + page`
- TTL 推奨: 60〜300s（entity 別）

**現行資産:**

| 画面 | ファイル | 状態 |
| --- | --- | --- |
| 職人検索 UI | `builder/find-workers.html` | フィルタ UI + **demo 固定 6 件** |
| 協力会社検索 | `builder/partners.html` | フィルタ + `builder.js` partner search |
| 案件掲示板 | `builder/board-projects.html` | タイプタブ filter のみ |

---

### 2-2. AI 補助検索（検索前 1 回のみ）

**AI の役割（許可）:**

| # | 処理 | 実行主体 |
| --- | --- | --- |
| 1 | 自然文 → **構造化条件**（`SearchFilter`） | LLM **1 回** |
| 2 | 構造化条件 → **DB クエリパラメータ** | **deterministic** コード |
| 3 | DB 結果取得後 → **要約 · おすすめ理由**（任意） | LLM **0〜1 回**（Pro · 同一セッション内） |

**AI の禁止（§7 と同義）:**

- 全データ走査 · 検索実行
- 毎回 LLM でランキング再生成
- 結果ページ表示後の **再 AI 呼び出し**
- 外部 Web 検索 API

**現行資産（regex · sample · 未 DB 接続）:**

| モジュール | 役割 |
| --- | --- |
| `builder/builder-ai-search-assist.js` | Worker/Partner **条件抽出**（regex）· `WORKER_FIELDS` / `PARTNER_FIELDS` |
| `builder/builder-ai-candidate-recommend.js` | **deterministic スコアリング** · `fetchCandidates` フック · sample データ |
| `builder/builder-ai-actions.js` | `worker_search_assist` · `partner_search_assist` · `candidate_recommendation` |

**統合後フロー:**

```text
[ユーザー自然文 or フィルタ UI]
        ↓
  (Pro) LLM → SearchFilter JSON   ← 検索前 1 回
        ↓
  merge UI chips + AI filters
        ↓
  Repository.query (Supabase)      ← AI 不参加
        ↓
  deterministic rank (既存 SCORE_WEIGHTS)  ← LLM 不参加
        ↓
  (Pro) LLM 結果要約（任意 · 1 回まで）
        ↓
  結果カード UI（AI コメント欄 optional）
```

**例:** 「埼玉で外壁できる安い業者」

| 段階 | 出力 |
| --- | --- |
| AI 条件抽出 | `{ entity:"companies", area:"埼玉", category:"外壁", sort:"rate_asc", priority:["low_rate"] }` |
| DB クエリ | `WHERE area LIKE '%埼玉%' AND category ~ '外壁' ORDER BY rate_yen ASC LIMIT 10` |
| ランキング | `scorePartner()` — 既存 weights（`builder-ai-candidate-recommend.js`） |
| AI 要約 | 上位 3〜10 件 · 各 1 行理由 · 注意点 |

---

## 3. UI 要件

### 3-1. 検索 UI（統合画面 or タブ）

| 要素 | 要件 |
| --- | --- |
| フリーワード | 自然文 · Pro で AI 変換トリガ |
| 条件フィルタ | entity 別フォーム（既存 `find-workers` / `partners` 統合） |
| チップ | 適用中条件の可視化 · 個別削除 |
| 並び替え | `newest` · `rate_desc` · `rate_asc` · `rating` · `available_first` |
| entity 切替 | 案件 / ワーカー / 業者 タブ |

**統合 UI 候補:** 新規 `builder/conditional-search.html` または `find-workers.html` 拡張（実装時判断）

### 3-2. 検索結果 UI

| 要素 | 要件 |
| --- | --- |
| レイアウト | カード統一（`builder-fw-card` 系） |
| entity 差 | バッジ（案件 / ワーカー / 業者） |
| AI コメント | 任意 · Pro · 折りたたみ · 「参考 · 採用確定ではない」免責 |
| 件数 | 上位 **3〜10 件**（ページネーションは DB 側） |

---

## 4. AI 挙動ルール

### 入力

```text
ユーザー: 「埼玉で外壁できる安い業者」
```

### 処理（Pro）

1. **条件抽出** — LLM → JSON Schema `SearchFilter`（下記）
2. **DB クエリ生成** — TypeScript/JS deterministic（LLM 禁止）
3. **結果取得** — Repository
4. **ランキング** — `scoreWorker` / `scorePartner` / `scoreJob`（新規 · deterministic）
5. **補助説明**（任意）— 取得済み結果のみを LLM に渡す · **再検索禁止**

### 出力

- 上位 3〜10 件
- 各 **簡潔な理由**（deterministic reasons 配列 · Pro で LLM 整形可）
- **注意点**（NG フラグ · エリア不一致 · 資格未確認）

### SearchFilter JSON Schema（Draft）

```json
{
  "entity": "jobs | workers | companies",
  "area": { "prefecture": "埼玉県", "city": null },
  "category": ["外壁"],
  "rateYen": { "min": null, "max": null, "prefer": "low" },
  "availability": "available_first",
  "license": [],
  "ratingMin": null,
  "sort": "rate_asc",
  "keywords": [],
  "excludeNg": true
}
```

**正規化:** `TasuBuilderAISearchAssist.extractFields` フィールドキーと **同一命名**（`builder-ai-search-assist.js`）。

---

## 5. パフォーマンス要件

| ルール | 内容 |
| --- | --- |
| DB 検索 | 必ず **キャッシュ可能**（filter hash + sort + page） |
| AI 呼び出し | **検索前 1 回**（自然文 → SearchFilter） |
| 結果ページ | **再 AI 呼び出し禁止**（コスト制御） |
| Pro 要約 | 同一 `searchSessionId` 内 **最大 1 回** · 結果 JSON のみ入力 |
| ランキング | **常に deterministic**（`SCORE_WEIGHTS`） |

---

## 6. FREE / PRO 制御

| 機能 | FREE | PRO |
| --- | --- | --- |
| DB 条件検索（フィルタ UI） | ✅（件数 cap · 例 20 件/回） | ✅ |
| 並び替え | ✅ 基本 2 種 | ✅ 全種 |
| AI 自然文 → 条件変換 | ❌ or 月 N 回 | ✅ |
| deterministic ランキング | ✅ 基本スコア | ✅ + 重み最適化 |
| AI 結果要約 · 理由文 | ❌ | ✅（検索 1 セッション 1 回） |
| AI コメント on カード | ❌ | ✅ |

**Gate 実装:** `builder-ai-live-gate.js` パターンを拡張 or 専用 `builder-search-gate.js`（課金未接続時は `?tier=pro` debug）。

---

## 7. 非対象（禁止）

- AI による全データ走査
- 毎回 LLM でランキング生成
- 外部 API 依存検索（Google 等）
- 採用 · 契約 · 手配 **確定**（既存 Builder AI 禁止ルール維持）
- TASFUL AI Workspace への統合（AD-002）

---

## 8. 実装フェーズ（Backlog）

| Phase | 内容 | 依存 |
| --- | --- | --- |
| **P0** | `SearchFilter` schema · Repository.query インターフェース · キャッシュキー | — | ✅ **`builder-conditional-search.js`** · [P0 レポート](../../reports/builder-conditional-search-p0.md) |
| **P1** | Repository 実動 · UI adapter · `fetchCandidates` 接続 · demo fallback | P0 | ✅ **`builder-search-repository.js`** · [P1 レポート](../../reports/builder-conditional-search-p1.md) |
| **P1** | 案件（jobs）フィルタ — board feed 拡張 | MVP store / listings | ✅ board-projects タイプタブ連携（最小） |
| **P2** | Pro: LLM 自然文 → SearchFilter（Gateway `surface=builder_ai`） | quota |
| **P2** | 統合検索 UI · チップ · sort | P1 |
| **P3** | Pro: 結果要約 1 回 · カード AI コメント | P2 |
| **P3** | `fetchCandidates` → 本番 API 差し替え | `builder-ai-candidate-recommend.js` L378 |

---

## 9. 既存コードマップ

| ユーザー要件 | 既存 |
| --- | --- |
| Worker フィルタ UI | `find-workers.html` |
| Partner フィルタ UI | `partners.html` · `builder.js` L6596+ |
| 条件フィールド定義 | `builder-ai-search-assist.js` WORKER/PARTNER_FIELDS |
| スコアリング | `builder-ai-candidate-recommend.js` SCORE_WEIGHTS |
| AI アクション | `worker_search_assist` · `partner_search_assist` · `candidate_recommendation` |
| DB 接続 stub | `fetchCandidates` · `TasuBuilderDataProvider` · `apiReady: false` |

---

## 10. テスト（実装時）

| スクリプト | 内容 |
| --- | --- |
| `test-builder-ai-search-assist`（新規） | extractFields · SearchFilter 正規化 |
| `test-builder-conditional-search-query`（新規） | DB フィルタ · キャッシュキー · sort |
| 既存 `test-builder-ai-tools-adaptation.mjs` | search action 回帰 |

## 11. P0 実装メモ（2026-06-28）

**モジュール:** `builder/builder-conditional-search.js`（`TasuBuilderConditionalSearch`）

| API | 説明 |
| --- | --- |
| `normalizeSearchFilter(filter)` | target 正規化 · 配列 sort/dedupe · sort whitelist · limit cap 100 |
| `buildSearchQuery(filter)` | `{ target, where[], order[], limit, offset }` — Supabase 未実行 |
| `createSearchCacheKey(filter)` | `builder-search:v1:` + stableSerialize(normalized) |
| `searchAssistParsedToFilter(target, parsed)` | `extractFields` → SearchFilter |
| `adaptSearchAssist(actionId, userText)` | worker/partner search assist ラッパ · `apiReady: false` |
| `adaptSearchAssistText(target, userText)` | job 含む任意 target |

**テスト:** `node scripts/test-builder-conditional-search-p0.mjs`（58 PASS）

**レポート:** [reports/builder-conditional-search-p0.md](../../reports/builder-conditional-search-p0.md)

**P0 スコープ外:** HTML · Supabase 本番 schema · Gateway/LLM · `builder-ai.html` script タグ追加（P2 以降）

---

## 12. P1 実装メモ（2026-06-28）

**モジュール:**

| ファイル | 役割 |
| --- | --- |
| `builder/builder-search-repository.js` | `searchWorkers` / `searchPartners` / `searchJobs` · memory cache 60s · Supabase optional |
| `builder/builder-search-ui-adapter.js` | フォーム/タブ → SearchFilter |

**Repository 挙動:**

- P0 の `normalizeSearchFilter` / `buildSearchQuery` / `createSearchCacheKey` を内部使用
- Supabase: 既存 `TasuSupabaseClient.getClient()` のみ · テーブル `builder_workers|partners|jobs` を試行 · 失敗時 demo fallback
- 未設定時: `{ fallback: true, apiReady: false, source: "demo" }`
- キャッシュ命中: `{ cacheHit: true }`

**UI 連携（最小）:**

| 画面 | 変更 |
| --- | --- |
| `find-workers.html` | script 3本追加 · submit → `searchWorkers` |
| `partners.html` | script 3本追加 · `builder.js` `renderPartnerSearchPage` が Repository 経由 |
| `board-projects.html` | script 3本追加 · タイプタブ ≠ all 時 `filterSourceRows` |

**fetchCandidates:** `builder-ai-candidate-recommend.js` → Repository 接続（SCORE_WEIGHTS 維持）

**テスト:**

```bash
node scripts/test-builder-conditional-search-p0.mjs   # 58 PASS
node scripts/test-builder-conditional-search-p1.mjs   # 36 PASS
node scripts/test-builder-ai-tools-adaptation.mjs     # 85 PASS
```

**レポート:** [reports/builder-conditional-search-p1.md](../../reports/builder-conditional-search-p1.md)

**P1 スコープ外:** LLM/Gateway · DB migration · カード UI 大改修 · 認証変更

---

*P1 完了 · P2 LLM 条件変換 / 統合 UI は Backlog*
