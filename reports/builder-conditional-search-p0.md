# Builder AI Conditional Search — P0 実装レポート

**日付:** 2026-06-28  
**Phase:** P0（schema · query builder · cache key · SearchAssist adapter）  
**Status:** ✅ 実装 · ユニットテスト PASS

---

## 概要

`builder/builder-conditional-search.js` を新規追加。Worker / Partner / Job の条件検索に共通利用できる **SearchFilter 正規化 · Repository 渡し query object · キャッシュキー · SearchAssist adapter** を提供する。

**スコープ外（未実施）:** HTML 改修 · Supabase 本接続 · Gateway/LLM · AI ランキング · dist のみ編集

---

## 追加ファイル

| ファイル | 内容 |
| --- | --- |
| `builder/builder-conditional-search.js` | P0 コアモジュール（`TasuBuilderConditionalSearch`） |
| `scripts/test-builder-conditional-search-p0.mjs` | ユニットテスト（50+ アサーション） |

---

## API 概要

### `normalizeSearchFilter(filter)`

- `target`: `worker` \| `partner` \| `job`（`companies` / `jobs` 等 alias 対応）
- 未定義値除去 · 配列正規化 · `priceRange` min/max 補正
- `sort` whitelist: `newest` · `rate_desc` · `rate_asc` · `rating` · `available_first`
- `limit` cap **100**（default 20）· `offset` cap 10000
- target 別に不要フィールド除去（例: worker から `insurance` / `invoiceSupported`）

### `buildSearchQuery(filter)`

Repository 渡し用 deterministic object:

```json
{
  "target": "worker",
  "where": [{ "column": "rate_yen", "op": "lte", "value": 20000 }],
  "order": [{ "column": "rate_yen", "direction": "asc" }],
  "limit": 20,
  "offset": 0
}
```

Supabase 実行は **行わない**（P1 で Repository 接続）。

### `createSearchCacheKey(filter)`

- normalize 後の filter を `stableSerialize`（キー順固定 JSON）
- 形式: `builder-search:v1:{...}`
- 同一条件 → 同一キー保証

### SearchAssist 連携

| 関数 | 用途 |
| --- | --- |
| `searchAssistParsedToFilter(target, parsed)` | `extractFields` 結果 → SearchFilter |
| `adaptSearchAssist(actionId, userText, opts)` | `worker_search_assist` / `partner_search_assist` ラッパ |
| `adaptSearchAssistText(target, userText, opts)` | job 含む任意 target（job は簡易 regex） |

`apiReady: false` 維持 · LLM/Gateway 非接続。

---

## テスト

```bash
node scripts/test-builder-conditional-search-p0.mjs
```

| カテゴリ | 件数（概算） |
| --- | --- |
| normalize | 18 |
| buildSearchQuery | 12 |
| cache key | 5 |
| SearchAssist adapter | 15 |
| stableSerialize / alias | 4 |
| **合計** | **58 PASS** |

回帰:

```bash
node scripts/test-builder-ai-tools-adaptation.mjs
```

---

## 次フェーズ（P1 以降）

| Phase | 内容 |
| --- | --- |
| P1 | `builder-repositories-supabase.js` 接続 · `fetchCandidates` 差し替え |
| P2 | Pro LLM 自然文 → SearchFilter · 統合 UI |
| P3 | 結果要約 · カード AI コメント |

---

## 参照

- [docs/AI/BUILDER_AI_CONDITIONAL_SEARCH.md](../docs/AI/BUILDER_AI_CONDITIONAL_SEARCH.md)
- `builder/builder-ai-search-assist.js`
- `builder/builder-ai-candidate-recommend.js`（将来 `fetchCandidates` 連携）
