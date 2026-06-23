# 非公開本番テスト — Gate-D smoke 実施記録

| 項目 | 内容 |
|------|------|
| 実施日 | **2026-06-23** |
| ベース URL | `https://tasufull-article.pages.dev` |
| 手順書 | [`production-private-test-gate-d-smoke-plan.md`](production-private-test-gate-d-smoke-plan.md) |
| 認証方式 | **Playwright storage-state**（OTP 手動 · Service Token なし） |
| storage-state | `reports/gate-d-auth-storage.json`（**Git 管理外** · `.gitignore` 済） |
| 再実行 | CORS 修正後 `node scripts/smoke-gate-d-production.mjs --storage-state reports/gate-d-auth-storage.json` |

---

## 最終判定

# Gate-D: **GO**

| 理由 |
|------|
| 必須 7 URL すべて **PASS** |
| `/talk-home.html` の `gemini-chat` CORS ブロック解消 |
| MATCH 3 URL — 未ログイン想定の login gate / 空 CTA を **想定内** として PASS |

---

## CORS 修正（gemini-chat）

| 項目 | 内容 |
|------|------|
| 原因 | `_shared/cors.ts` の `isAllowedOrigin` が `tasufull-article.pages.dev` を許可せず **OPTIONS preflight が 403** |
| 修正 | `isTasufullArticlePagesHost()` 追加（production + `*.tasufull-article.pages.dev` preview） |
| 付随 | `x-supabase-authorization` を Allow-Headers に追加 · `gemini-chat` の `jsonResponse` に `req` を渡してエラー応答にも CORS 付与 |
| デプロイ | `npx supabase functions deploy gemini-chat --project-ref ddojquacsyqesrjhcvmn` |
| 検証 | `npm run verify:gemini-chat-cors` — production / preview origin とも **OPTIONS 204 · Allow-Origin エコー OK** |

---

## 実施サマリー（最終 run）

| 判定 | 件数 |
|------|------|
| **PASS** | **7**（必須すべて） |
| HOLD | 0 |
| FAIL | 0（必須） |
| BLOCKED | 0 |

任意 LIVE 2 URL は未認証 RLS 42501 で FAIL（必須判定外）。

---

## URL 別記録（必須 7）

### `/index.html`

- 表示: **OK**
- Console: 重大 error なし
- Network document: **200**
- chat-supabase-config.js: **200**
- Supabase API: 401+200 混在（**想定内** · Supabase ユーザ未ログイン）
- Edge / Storage: n/a
- 判定: **PASS**

### `/talk-home.html`

- 表示: **OK** — `TASFUL TALK | TASFUL`
- Console: **重大 error なし**（`gemini-chat` CORS 解消）
- Network document: **200**
- chat-supabase-config.js: **304**
- Supabase API / Edge: ページロード時に未発火（CORS preflight **OK** 確認済）
- 判定: **PASS**

### `/match/match-top.html`

- 表示: **OK**
- Console: 重大 error なし
- Network document: **200**
- chat-supabase-config.js: 未観測（静的 LP · 他画面で 304 確認済）
- 判定: **PASS**

### `/match/match-list.html`

- 表示: **OK**
- Console: 重大 error なし
- Network document: **200**
- chat-supabase-config.js: **304**
- 備考: CTA 未検出 — **MATCH 未ログイン想定内**
- 判定: **PASS**

### `/match/match-talk-bridge.html`

- 表示: **OK** — login gate 表示
- Console: 重大 error なし
- Network document: **200**
- chat-supabase-config.js: **304**
- 備考: `data-match-login-gate` — **MATCH JWT なし想定内**
- 判定: **PASS**

### `/builder/index.html`

- 表示: **OK**
- Console: 重大 error なし
- Network document: **200**
- chat-supabase-config.js: **304**
- 判定: **PASS**

### `/shop-store.html`

- 表示: **OK**
- Console: 重大 error なし
- Network document: **200**
- chat-supabase-config.js: **304**
- Supabase API: **401**（想定内）
- 判定: **PASS**

---

## 参照

| 成果物 | パス |
|--------|------|
| CORS 共有 | `supabase/functions/_shared/cors.ts` |
| gemini-chat | `supabase/functions/gemini-chat/index.ts` |
| CORS 検証 | `scripts/verify-gemini-chat-cors.mjs` |
| smoke 結果 JSON | `reports/gate-d-smoke-last.json` |

---

**署名:** Gate-D smoke run — 2026-06-23 · **GO**（CORS 修正後再実行）
