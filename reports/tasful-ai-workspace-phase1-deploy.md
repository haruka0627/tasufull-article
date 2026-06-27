# TASFUL AI Workspace — Phase 1 Deploy 報告

**実施日:** 2026-06-26  
**Commit:** `2a43fe5223457327edf525bf4b56604d0c5e43a1` — `feat(tasful-ai): enforce workspace usage phase1`  
**状態:** Production 反映完了

---

## Deploy 前確認

| 項目 | 結果 |
| --- | --- |
| `git rev-parse HEAD` | `2a43fe5223457327edf525bf4b56604d0c5e43a1` ✅ |
| 未コミット件数 | 121+ 件（deploy 対象外 · ステージングなし） ✅ |
| 追加 commit | なし ✅ |
| force push | なし ✅ |

**deploy 方法:** 未コミット 121 件を含めないため、commit `2a43fe5` 専用 **git worktree**（`tasufull-article-wt-2a43fe5`）から `node scripts/deploy-cloudflare-pages.mjs` を実行。

---

## Deploy 実施

| 段階 | Branch | Deployment ID | URL |
| --- | --- | --- | --- |
| 1（Preview） | `cf-pages-deploy` | `14c9c22c` | https://14c9c22c.tasufull-article.pages.dev |
| 2（**Production**） | `main` | `8ea65f3b` | https://8ea65f3b.tasufull-article.pages.dev |

**Production 公開 URL:** https://tasufull-article.pages.dev  
（`wrangler pages deployment list` — Production / main / Source `2a43fe5`）

> 初回 deploy は `cf-pages-deploy` Preview のみだったため、Production（`tasufull-article.pages.dev`）は旧 `3b030ab` のままだった。続けて **branch=main** で同一 worktree から再 deploy し Production を更新。

---

## Deploy 後 Smoke（Production · Access 認証済）

`scripts/tmp-ai-workspace-phase1-deploy-smoke.mjs`  
（`reports/gate-d-auth-storage.json` + `PAGES_BASE_URL=https://tasufull-article.pages.dev`）

| チェック | 結果 |
| --- | --- |
| ai-workspace.html 表示 | PASS (HTTP 200) |
| `TasuAiWorkspaceUsage` ロード | PASS |
| usage banner（残り 5/5） | PASS |
| `ai-workspace-usage.js` / chat / stripe-config assets | PASS (200) |
| canUse block（枯渇時送信停止） | PASS |
| consume（usedRemote 成功後） | PASS |
| mock/fallback 非課金 | PASS |
| 通常チャット回帰（`.ai-msg-row`） | PASS |
| console error | **0** |
| network error | **0** |

**合計: 12/12 PASS**

詳細 JSON: `reports/tasful-ai-workspace-phase1-deploy-smoke.json`

---

## ローカル回帰（deploy 後 · ファイル直読み）

| スクリプト | 結果 |
| --- | --- |
| `test-ai-workspace-usage-enforcement-browser.mjs` | 15/15 PASS |
| `test-tasful-ai-final-smoke-browser.mjs` | 53/53 PASS |

※ Production URL 向け enforcement スクリプトは Access 未対応のため、上記 prod smoke で同等項目を検証。

---

## P0-2 残件（運用側）

| # | 項目 | 担当 |
| --- | --- | --- |
| 1 | **Serper credits チャージ** | 運用 · 外部クレジット補充 |
| 2 | **Cloudflare Access Service Token 設定** | 運用 · `CF_ACCESS_CLIENT_ID/SECRET`（CI/E2E 自動化用） |
| 3 | **Phase 2（Edge + DB quota）** | 開発 · サーバー正本 enforcement · bypass 防止 |

Phase 1（クライアント localStorage enforcement）は **本番反映済み**。本番課金 Ready には Phase 2 が必要。

---

## 備考

- main リポジトリ working tree: **未コミット変更は deploy に含めていない**
- git push: **未実施**（Pages Direct Upload のみ）
- Preview alias: https://cf-pages-deploy.tasufull-article.pages.dev（同一 commit `2a43fe5`）

---

## Deploy 後 Cleanup（2026-06-26）

### 1. Worktree 削除

| 項目 | 結果 |
| --- | --- |
| 対象 | `C:/Users/rubih/tasufull-article-wt-2a43fe5` |
| コマンド | `git worktree remove --force tasufull-article-wt-2a43fe5` |
| 結果 | **削除成功** |
| 残 worktree | `tasufull-article`（`cf-pages-deploy` @ `2a43fe5`）· `tasufull-article-main-push`（別用途 · 触っていない） |

### 2. リポジトリ状態（cleanup 後）

| 項目 | 値 |
| --- | --- |
| **HEAD** | `2a43fe5223457327edf525bf4b56604d0c5e43a1`（`feat(tasful-ai): enforce workspace usage phase1`） |
| **未コミット件数** | **124 行**（`git status --short`） |
| Phase 1 コミットファイル vs HEAD | **差分なし**（deploy 対象 14 ファイルは HEAD と一致） |
| deploy に未コミット混入 | **なし**（Direct Upload は worktree @ `2a43fe5` のみ） |
| build / deploy / commit（cleanup 時） | **未実施** |

> 未コミット 124 件は docs / reports / dist 無関係変更等の既存作業ツリー。Phase 1 deploy とは無関係。

### 3. 最終固定状態

| 項目 | 内容 |
| --- | --- |
| **Production URL** | https://tasufull-article.pages.dev |
| **Production deployment** | https://8ea65f3b.tasufull-article.pages.dev |
| **Source commit** | `2a43fe5223457327edf525bf4b56604d0c5e43a1` |
| **Deploy 方式** | Cloudflare Pages **Direct Upload**（`wrangler pages deploy` · worktree から stage + upload） |
| **git push** | **未実施**（リモートブランチは deploy 前のまま · ローカル `cf-pages-deploy` @ `2a43fe5`） |
| **Smoke（Production）** | 12/12 PASS · console 0 · network 0 |

### 4. P0-2 残件（運用側 · 再掲）

| # | 残件 |
| --- | --- |
| 1 | **Serper credits チャージ** |
| 2 | **Cloudflare Access Service Token 設定**（`CF_ACCESS_CLIENT_ID/SECRET`） |
| 3 | **Phase 2 — Edge + DB quota**（サーバー正本 · bypass 防止） |

**Phase 1 状態:** クライアント enforcement · Production 反映済み · cleanup 完了 · 作業ツリー固定。
