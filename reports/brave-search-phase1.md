# Brave Search API Migration — Phase 1（Edge drop-in）

**実施日:** 2026-06-28  
**Git HEAD（開始時）:** `d67631e`  
**スコープ:** Edge `serper-search` upstream 差替 · **Gateway / Workspace / UI 変更なし**  
**本番反映:** Edge deploy 済 · secrets 設定済 · **live Go**  
**コミット:** `feat(tasful-ai): add brave web search provider`

---

## 1. サマリー（最終）

| 項目 | 結果 |
| --- | --- |
| Edge deploy | ✅ **PASS** — `serper-search` 本番反映 |
| `WEB_SEARCH_PROVIDER=brave` | ✅ **設定済** |
| `BRAVE_SEARCH_API_KEY` | ✅ **設定済** |
| `SERPER_API_KEY` | ✅ **残存**（rollback 用） |
| Unit Test | ✅ **28/28 PASS** |
| Edge Live Test | ✅ **7/7 PASS** |
| 日本語 spot check | ✅ **PASS**（Edge live 7 クエリ + JA 相場/補助金/ニュース） |
| Hybrid（8788） | ✅ **PASS** — orchestrator 8/8 · route 6/6 |
| AD-005 | ✅ Gateway **未変更** |
| UI | ✅ **変更なし** |
| `search_lang` | ✅ **`jp`**（Brave は `ja` 不可 · 422 VALIDATION） |

---

## 2. 本番 Secrets

| Secret | 状態 | 備考 |
| --- | --- | --- |
| `WEB_SEARCH_PROVIDER` | ✅ `brave` | |
| `BRAVE_SEARCH_API_KEY` | ✅ 設定済 | Web Search API キー · `X-Subscription-Token` |
| `SERPER_API_KEY` | ✅ 残存 | rollback 用 |

---

## 3. 実装

| ファイル | 種別 |
| --- | --- |
| `supabase/functions/_shared/web-search-provider.ts` | 新規 — provider 切替 · Brave/Serper fetch · 正規化 |
| `supabase/functions/serper-search/index.ts` | 変更 — shared module 委譲 |
| `scripts/test-web-search-provider-unit.mjs` | 検証 |
| `scripts/test-web-search-provider-unit-runner.ts` | 検証 |
| `scripts/test-web-search-provider-edge.mjs` | 検証（live + JA spot） |
| `scripts/test-web-search-brave-ja-compare.mjs` | 検証（直接 Brave vs Serper 比較） |

**未変更:** `ai-model-gateway.js` · `ai-workspace-chat.js` · `serper-search-service.js` · HTML/CSS

### Brave fetch 契約

| 項目 | 値 |
| --- | --- |
| endpoint | `https://api.search.brave.com/res/v1/web/search` |
| 認証 | `X-Subscription-Token: <key>`（**Bearer 不使用**） |
| Accept | `application/json` |
| デフォルト locale | `country=JP` · `search_lang=jp` |
| API key | `normalizeBraveApiKey()` — trim · Bearer/引用符/改行除去 |

### レスポンス shape（Gateway 契約維持）

```json
{
  "ok": true,
  "query": "...",
  "provider": "brave",
  "results": [{ "title", "snippet", "link", "url", "source" }]
}
```

- トップレベル `provider: "brave"`
- result の `source` は **hostname**（Serper 時代と同じ）

---

## 4. テスト結果

### Unit

```bash
node scripts/test-web-search-provider-unit.mjs
```

**28/28 PASS** — provider 解決 · parse · mock fetch · `search_lang=jp` · `normalizeBraveApiKey`

### Edge Live

```bash
node scripts/test-web-search-provider-edge.mjs
```

**7/7 PASS** — 証跡: `reports/web-search-provider-edge-last.json`

| Probe | HTTP | provider | count |
| --- | --- | --- | --- |
| TASFUL | 200 | brave | 3 |
| 水漏れ修理 相場 | 200 | brave | 5 |
| 補助金 2026 中小企業 | 200 | brave | 3 |
| 2026年 補助金 中小企業 | 200 | brave | 5 |
| 埼玉 外壁塗装 相場 | 200 | brave | 5 |
| AI ニュース 日本 | 200 | brave | 5 |
| Cloudflare Pages Supabase Edge Functions | 200 | brave | 5 |

### Hybrid（8788 · mock 経路）

| テスト | 結果 |
| --- | --- |
| `test-ai-search-orchestrator-browser.mjs` — intent + prepare | ✅ **8/8 PASS** |
| `test-ai-serper-search-browser.mjs` — route classification | ✅ **6/6 PASS** |

**Gateway / searchContext:** mock 経路で `contextForAi` 生成 **PASS** · `ai-model-gateway.js` **未変更**

---

## 5. トラブルシュート（記録）

| 症状 | 原因 | 修正 |
| --- | --- | --- |
| 422 `SUBSCRIPTION_TOKEN_INVALID` | Secret 値不正 / Bearer 混入 | `normalizeBraveApiKey()` · Secret 再設定 |
| 422 VALIDATION | `search_lang=ja` 不可 | **`search_lang=jp`** に変更 |

---

## 6. Rollback

| 操作 | 効果 |
| --- | --- |
| `WEB_SEARCH_PROVIDER=serper` | Serper upstream に戻る（credits 必要） |
| `BRAVE_SEARCH_API_KEY` 削除 | 自動 fallback（BRAVE キーなし → serper default） |
| `SERPER_API_KEY` 残存 | ✅ rollback 可能 |
| git revert | `serper-search` + `web-search-provider.ts` |

---

## 7. TASFUL AI Production Ready への影響

| ブロッカー | Phase 1 後 |
| --- | --- |
| Serper credits 枯渇 | ✅ **解消**（Brave live PASS） |
| CF Access Service Token | **変更なし** — 仍ブロッカー |
| formal build → prod alias | **変更なし** |

**Production Ready 総合:** **No-Go**（CF Access + prod alias redeploy 残）

---

## 8. Go / No-Go

| 判定 | **Go（Phase 1）** |
| --- | --- |
| コミット | ✅ 実施 |

### コミット条件チェックリスト

- [x] Unit PASS
- [x] Edge Live PASS
- [x] Hybrid PASS
- [x] 日本語 spot check OK
- [x] Gateway / UI / Workspace 変更なし
- [x] `search_lang=jp` 反映
- [x] `SERPER_API_KEY` rollback 保持

---

## 9. 参照

- 調査: `reports/brave-search-migration-study.md`
- Edge JSON: `reports/web-search-provider-edge-last.json`
