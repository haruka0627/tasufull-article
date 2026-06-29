# TASFUL 既知の問題・未確認事項

**最終更新:** 2026-06-29  
**ルール:** 推測で「完了」にしない。解消したら項目を削除または「解決」に更新。

---


## 解決済み

| ID | 解決 |
| --- | --- |
| KI-003 | TASFUL AI Production Ready — 2026-06-28 Go · `reports/tasful-ai-production-ready-verification.md` |
| KI-008 | AI 秘書 phase ファイル — P0-1 選別コミット後 git 追跡済 |
| KI-009 | `docs/` status 正本 — 2026-06-29 sync · `e5c4d24` 整合 |

---

## KI-014 — TASFUL AI Media Edge smoke · Gemini 503 flake

| 項目 | 内容 |
| --- | --- |
| **状態** | 外部 API 一時負荷 · コード欠陥ではない |
| **症状** | `test-tasful-ai-media-generate-edge.mjs` / monitoring の media-edge が **503** — `This model is currently experiencing high demand` |
| **影響** | monitoring が **6/7 PASS** になることがある · Final Phase 31/31 · Voice 32/32 · Workspace severe 0 は独立 |
| **正本** | `f4cf7d8` · `reports/tasful-ai-p1-implementation.md` |
| **対応** | 再実行で解消することが多い · 日次 monitoring で追跡 · 専用 Provider（Veo/Suno 等）は Future |

---

## KI-005 — TASFUL AI Monitoring 定期実行

| 項目 | 内容 |
| --- | --- |
| **状態** | 横断 smoke 統合済 · prod alias は CF_ACCESS 要 |
| **正本** | `scripts/verify-tasful-ai-monitoring.mjs` · `reports/tasful-ai-monitoring-runbook.md` |
| **対応** | 日次 CI / 週次 Service Token smoke |

---

## KI-002 — working tree 未整理

| 項目 | 内容 |
| --- | --- |
| **状態** | `e5c4d24` 以降も **~299 件**（dist / reports / Live-Zego PoC 等） |
| **リスク** | 次の `git add -A` で ANPI / Live / Gateway 等が混入 |
| **対応** | [TODO.md](./TODO.md) · [PROJECT_STATUS.md](./PROJECT_STATUS.md) §Working tree · 領域別選別ステージングのみ |
| **HEAD までコミット済** | TLV T1/T2/T4 · Design Audit ソース · Builder 条件検索 · TASFUL AI P1 · Platform Live P5 · Builder 6-H `c66c587` |

---

## KI-003 — （解決済み · 上記）

TASFUL AI Production Ready = **Go**（2026-06-28）。CF Access E2E · build · deploy · Brave live 完了。

---

## KI-004 — Platform 本番 FE 昇格のタイミング

| 項目 | 内容 |
| --- | --- |
| **状態** | NB-1M レポート時点で Production FE は旧 commit · G1/G2 No-Go 記載 |
| **矛盾** | PROJECT_STATUS は「Platform Production Ready」（製品品質）と「デプロイ未反映」を併記 |
| **対応** | 本番 deploy 前に `reports/platform-nb1m-frontend-prod-deploy-ready.md` を再確認 |

---

## KI-005 — Platform Finish 残（コード上）

| 項目 | 内容 |
| --- | --- |
| **未完了** | index featured バッジ · お気に入り Supabase 同期 · Google OAuth 実機 E2E |
| **参照** | `reports/platform-finish-phase.md` §9 |

---


## KI-007 — `package.json` wrangler compatibility-date

| 項目 | 内容 |
| --- | --- |
| **状態** | unstaged · AI 無関係 |
| **内容** | `dev` スクリプトに `--compatibility-date=2026-06-24` |

---

## KI-009 — 本 `docs/` status 正本

| 項目 | 内容 |
| --- | --- |
| **状態** | **解消** — 2026-06-29 `docs: sync project status after release polish`（`e5c4d24`）· housekeeping 本更新で追補 |
| **内容** | TODO / PROJECT_STATUS / ROADMAP / KNOWN_ISSUES を HEAD 整合 |
| **残** | 設計 Backlog 個別 docs · `reports/tasful-ai-monitoring-runbook.md` は別バンドル |

---

## KI-010 — TLV ビジネスシミュレータ変更（AI スコープ外）

| 項目 | 内容 |
| --- | --- |
| **状態** | `reports/tlv-business-simulator/**` 等が working tree に modified |
| **対応** | AI コミットから除外済。別 PR または revert 判断 |

---

## KI-011 — dist 未同期（部分解消）

| 項目 | 内容 |
| --- | --- |
| **状態** | `deploy/cloudflare/dist/` に広範な modified/untracked が残存 |
| **同期済（HEAD）** | TASFUL AI media 3 ファイル（`f4cf7d8`）· Builder 条件検索（`b80d868`）· Platform Live 一部（`9006ead`） |
| **未同期（代表）** | Design Audit polish（`ee2efea` ソースのみ）· その他 dist 一括変更 |
| **対応** | 領域別 `npm run build:pages` + 選別 add · `git add -A` 禁止 |

---

## 解決済み

| ID | 解決 |
| --- | --- |
| KI-013 | Phase 2 quota SQL + Edge live — 2026-06-28 · `reports/tasful-ai-workspace-phase2-production.md` |


| 項目 | 内容 |
| --- | --- |
| **状態** | `sql/builder-ai-drafts-staging.sql` はコミット済みだが **DB 未適用**（staging も未実施の可能性） |
| **次** | P2-C — `reports/builder-ai-p2-b.md` §9 |

---

## 解決済み

| ID | 解決 |
| --- | --- |
| — | AI 186 件選別コミット `5ed9672` 完了（2026-06-26） |
| KI-001 | `ai-model-gateway.js` 未コミット差分 — `35d72b2`（source）+ `0f6328d`（dist）で解消（2026-06-28 確認 · `reports/tasful-ai-gateway-attachments-head-sync.md`） |
| KI-006 | `ai-attachments.ts` untracked — `35d72b2` でコミット済み · live Edge Vision PASS（2026-06-28 確認） |
