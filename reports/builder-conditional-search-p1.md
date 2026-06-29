# Builder AI Conditional Search — P1 実装レポート

**日付:** 2026-06-28  
**Phase:** P1（Repository 実動 · UI adapter · fetchCandidates · demo/Supabase fallback）  
**Status:** ✅ 実装 · テスト PASS

---

## 概要

P0 の `builder-conditional-search.js` を基盤に、条件検索を **Repository 経由で実動化**。Supabase 未設定時は deterministic demo fallback。UI は3画面に script 追加 + `builder.js` 最小変更のみ。

---

## 追加・変更ファイル

| ファイル | 変更 |
| --- | --- |
| `builder/builder-search-repository.js` | **新規** — searchWorkers/Partners/Jobs · cache · Supabase try |
| `builder/builder-search-ui-adapter.js` | **新規** — フォーム/タブ → SearchFilter |
| `builder/builder-ai-candidate-recommend.js` | `fetchCandidates` → Repository |
| `builder/builder.js` | `renderPartnerSearchPage` · `renderBoardProjectsPage` 最小連携 |
| `builder/find-workers.html` | script + submit → repository |
| `builder/partners.html` | script 3本 |
| `builder/board-projects.html` | script 3本 |
| `scripts/test-builder-conditional-search-p1.mjs` | **新規** 36 ケース |

---

## Repository API

```javascript
TasuBuilderSearchRepository.searchWorkers(filter)   // Promise<SearchResult>
TasuBuilderSearchRepository.searchPartners(filter)
TasuBuilderSearchRepository.searchJobs(filter, { sourceRows? })
TasuBuilderSearchRepository.fetchCandidates(kind, requirements)
TasuBuilderSearchRepository.filterSourceRows(rows, filter, target)  // sync · board用
TasuBuilderSearchRepository.clearSearchCache()
```

### SearchResult

```javascript
{
  ok: true,
  items: [],
  total: number,
  filter: normalizedSearchFilter,
  query: buildSearchQuery output,
  cacheKey: string,
  cacheHit: boolean,
  fallback: boolean,      // true = demo data
  apiReady: boolean,      // Supabase client 存在
  source: "demo" | "supabase" | "memory-cache"
}
```

### Supabase 方針

- **新規** 認証 · Gateway · Edge Function **なし**
- `TasuSupabaseClient.getClient()` が存在する場合のみ `builder_workers|partners|jobs` を query
- エラー · テーブル未存在 → demo fallback（UI 非破壊）

### Memory cache

- TTL **60秒**
- キー: P0 `createSearchCacheKey(normalizedFilter)`
- 命中時 `cacheHit: true`

---

## UI 連携

| 画面 | 内容 |
| --- | --- |
| find-workers | `filterFromFindWorkersForm` → `searchWorkers` · 結果0件時 demo 全件 |
| partners | 既存フォーム → `filterFromPartnerQuery` → `searchPartners` → DEMO_PARTNERS と ID 突合 |
| board-projects | タイプタブ `project`/`worker` → `filterSourceRows`（`all` 時は Repository 非適用） |

---

## fetchCandidates

`builder-ai-candidate-recommend.js`:

- Repository 成功時はその rows を deterministic `SCORE_WEIGHTS` へ
- 失敗時は従来 `SAMPLE_WORKERS` / `SAMPLE_PARTNERS`
- **LLM ランキングなし**

---

## テスト

```bash
node scripts/test-builder-conditional-search-p0.mjs   # 58/58
node scripts/test-builder-conditional-search-p1.mjs   # 36/36
node scripts/test-builder-ai-tools-adaptation.mjs       # 85/85
```

P1 カバレッジ: fallback · query filter · UI adapter · cache hit · Supabase error fallback · fetchCandidates · applyQuery

---

## 次フェーズ（P2）

- Pro LLM 自然文 → SearchFilter（Gateway `surface=builder_ai`）
- 統合検索 UI · 条件チップ
- Supabase 本番 schema 確定後のテーブル mapping 更新

---

## 参照

- [BUILDER_AI_CONDITIONAL_SEARCH.md](../docs/AI/BUILDER_AI_CONDITIONAL_SEARCH.md)
- [builder-conditional-search-p0.md](./builder-conditional-search-p0.md)
