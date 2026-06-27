# AI 秘書 P0 本番接続 Smoke

**実施日:** 2026-06-28  
**Git HEAD:** `ca74d08`  
**種別:** 調査・検証・証跡のみ（**実装変更なし · deploy なし · commit 未実施**）  
**検証環境:** ローカル `http://127.0.0.1:8788`（`npm run dev`）+ Production `https://tasufull-article.pages.dev`（read-only probe）

---

## 総合判定: **No-Go**

| 領域 | 判定 |
| --- | --- |
| **DeepSeek 本番到達** | ❌ FAIL |
| **Google OAuth / Workspace 本番到達** | ❌ FAIL |
| **Admin Dashboard UI** | ✅ PASS |
| **Gateway 経路（AD-010）** | ✅ 設計どおり（コード確認 + Adapter ロード） |

**JSON 証跡:** `reports/ai-secretary-p0-production-smoke.json`

---

## 1. 前提確認

| 項目 | 結果 |
| --- | --- |
| `git status --short` | **clean** |
| 専用 P0 smoke script | **なし** — 既存 script は mock/hook 中心 |
| 使用方針 | 既存 script パターンを参考に **ephemeral read-only probe** を実行（repo 未追加 · 実行後削除） |

### 既存 script 調査

| Script | 用途 | P0 live smoke に使えるか |
| --- | --- | --- |
| `test-secretary-deepseek-adapter-browser.mjs` | Adapter + OpsContext · **hook で mock 応答** | ❌ live API 非対象 |
| `test-secretary-google-oauth-phase6b.mjs` | unit + mock fetch + dashboard UI | △ UI のみ · Edge live 非対象 |
| `test-secretary-google-gmail-phase6c.mjs` | unit + mock Gmail | ❌ live 非対象 |
| `test-secretary-google-calendar-phase6e.mjs` | unit + mock Calendar | ❌ live 非対象 |

---

## 2. DeepSeek 結果

| Probe | HTTP | Key presence | `usedDeepSeek` | 判定 |
| --- | ---: | --- | --- | --- |
| **local-8788** `/api/secretary-deepseek-chat` | **503** | `configured: false` | false | ❌ **DEEPSEEK_API_KEY 未設定**（Pages Function 到達 · Secret なし） |
| **production** `/api/secretary-deepseek-chat` | 200* | — | — | ❌ **Function 未到達**（`Content-Type: text/html` · SPA fallback · JSON なし） |

\* Production の HTTP 200 は **誤検知**。実体は ~30KB HTML（Pages SPA）で、DeepSeek Function 応答ではない。

### Gateway 経路（AD-010）

| 項目 | 結果 |
| --- | --- |
| 経路 | `TasuSecretaryDeepSeekAdapter` → `/api/secretary-deepseek-chat` |
| `TasuAiModelGateway` 混在 | **なし**（`admin-ai-secretary-phase2.js` は Adapter 経由） |
| Dashboard Adapter ロード | ✅ 1280 / 390 |

**原因分類（DeepSeek）**

| ID | 分類 | 内容 |
| --- | --- | --- |
| DS-1 | **Secret 未設定（local）** | `.dev.vars` / wrangler local に `DEEPSEEK_API_KEY` なし → 503 |
| DS-2 | **Production Function 未配信** | prod URL が HTML fallback · JSON API 未到達 |
| DS-3 | **残高 / 200+usedDeepSeek 未確認** | live 200 応答未到達のため未検証 |

---

## 3. Google OAuth 結果

| Probe | HTTP | 結果 |
| --- | ---: | --- |
| `secretary-google-oauth` · connect | **404** | `NOT_FOUND` — **Edge Function 未デプロイ** |
| `secretary-google-oauth` · status | **404** | 同上 |
| `secretary-google-tools` · health | **404** | 同上 |
| `secretary-google-tools` · capabilities | **404** | 同上 |
| `chat-supabase-config.js` @ 8788 | 200 | Supabase URL 設定 **あり** |

### OAuth client presence

| 項目 | 結果 |
| --- | --- |
| Edge 到達 | ✅ Supabase ホスト応答あり |
| `SECRETARY_GOOGLE_CLIENT_ID` 等 | **未確認**（Function 404 のため health 未到達） |
| Mock モード | **未確認** |

**原因分類（Google OAuth）**

| ID | 分類 | 内容 |
| --- | --- | --- |
| GO-1 | **Edge 未デプロイ** | `secretary-google-oauth` · `secretary-google-tools` が Supabase 上 404 |
| GO-2 | **Secret 未登録（推定）** | deploy 後に `google_oauth_not_configured` / mock 判定が必要 |
| GO-3 | **Dashboard UI** | 「Google未接続」表示 — **期待どおり**（未接続状態） |

---

## 4. Gmail 結果（read-only）

| Probe | HTTP | 期待 | 結果 |
| --- | ---: | --- | --- |
| `labels.list` | **404** | 200 + labels | ❌ Edge 未デプロイ |
| `messages.send`（write 拒否確認） | **404** | 403 `gmail_write_forbidden` | ❌ 未到達（write は実行せず POST のみ） |

**判定:** Gmail read-only 経路は **コード上実装済 · 本番 Edge 未到達**。

---

## 5. Calendar 結果（read-only）

| Probe | HTTP | 期待 | 結果 |
| --- | ---: | --- | --- |
| `calendarList.list` | **404** | 200 + calendarList | ❌ Edge 未デプロイ |
| `events.insert` on read action | **404** | 403 `calendar_read_only` | ❌ 未到達 |

**判定:** Calendar read-only 経路は **コード上実装済 · 本番 Edge 未到達**。

---

## 6. Admin Dashboard 結果

| Viewport | HTTP | Adapter | Phase2 | Google UI | JS errors |
| --- | ---: | --- | --- | --- | ---: |
| **1280×900** | 200 | ✅ | ✅ | 「Google未接続」+ 接続ボタン | 0 |
| **390×844** | 200 | ✅ | ✅ | 同上 | 0 |

**判定:** ✅ **PASS** — UI · モジュールロード · 接続表示は正常。

---

## 7. 次に必要な修正（P0 ブロッカー）

| 優先 | 作業 | 担当領域 |
| --- | --- | --- |
| **1** | ローカル `DEEPSEEK_API_KEY` を wrangler Pages dev 用に設定（`.dev.vars`） | DevOps / 運用 |
| **2** | Cloudflare Pages Production Secret `DEEPSEEK_API_KEY` 登録 + **Function ルート配信確認** | DevOps |
| **3** | Supabase Edge deploy: `secretary-google-oauth` · `secretary-google-tools` | DevOps / DB |
| **4** | Supabase Secret: `SECRETARY_GOOGLE_CLIENT_ID` · `CLIENT_SECRET` · `REDIRECT_URI` | DevOps |
| **5** | DeepSeek 残高チャージ → **HTTP 200 · `usedDeepSeek:true`** 再 smoke | 運用 |
| **6** | Google OAuth 接続 smoke（mock または live）→ Gmail/Calendar read-only 再 smoke | QA |

**実装コード変更:** 現時点 **不要**（到達性・Secret・deploy 問題）。

---

## 8. Commit 候補か

| 項目 | 判定 |
| --- | --- |
| **本レポート + JSON** | ✅ **commit 候補** — `docs/ops` 系 evidence として `reports/ai-secretary-p0-production-smoke.{md,json}` |
| **専用 smoke script 追加** | 📋 **別タスク推奨** — 今回 ephemeral probe。恒久化する場合は `scripts/test-secretary-p0-production-smoke.mjs` を新規作成（ユーザー判断後） |
| **deploy / Secret 操作** | ❌ 本タスク外 |

**推奨 commit message（将来）:**  
`docs(secretary): add p0 production smoke evidence`

---

## 9. 参照

- `reports/secretary-deepseek-deploy-triage.md`
- `reports/ai-secretary-current-status-after-p0-1.md`
- `docs/TODO.md` §P0-3
- `docs/AI/SECRETARY_AI.md`
