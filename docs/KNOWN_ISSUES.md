# TASFUL 既知の問題・未確認事項

**最終更新:** 2026-07-25（Step 2a · working tree / シークレット対策）  
**ルール:** 推測で「完了」にしない。解消したら項目を削除または「解決」に更新。

---


## 解決済み

| ID | 解決 |
| --- | --- |
| KI-003 | TASFUL AI Production Ready — 2026-06-28 Go · `reports/tasful-ai-production-ready-verification.md` |
| KI-008 | AI 秘書 phase ファイル — P0-1 選別コミット後 git 追跡済 |
| KI-009 | `docs/` status 正本 — 2026-06-29 sync（以降 Step 2a で現在HEAD `d0ed090` へ再同期） |
| KI-015 | Workspace UI レビュー QA デモ vs AD-015 — **2026-06-30 解決** · AD-015 改定で ui-review = QA 記事コンポーネント参照実装に整合 |
| KI-016 | dotenv 系の Pages dist 混入 — **2026-07-25 対策** · 履歴へのコミットなし · ビルド除外 + dist 事後検査（値は記録しない） |

---

## KI-017 — October RC Phase 3 BLOCKED（2026-07-26）

| 項目 | 内容 |
| --- | --- |
| **状態** | **RELEASE BLOCKED**（既存 REL-P0 · application security P1 は 3-A で解消） |
| **正本** | [tasful-phase3-release-candidate-audit.md](../reports/tasful-phase3-release-candidate-audit.md) · [tasful-phase3a-security-unblock.md](../reports/tasful-phase3a-security-unblock.md) |
| **P0** | REL-P0-01 tree · REL-P0-04 prod alias · REL-P0-03 secretary secrets · REL-P0-02（TLV scope時） |
| **P1** | **Cleared in Phase 3-A** — secretary / tlv-zego JWT · Pages gemini-live-proxy 410 · AI Workspace **31/31** |
| **非阻害** | Platform AI ページ生成は 2-E READY WITH FOLLOW-UP（単独では RC 全体を通せない） |
| **対応** | REL-P0 解除後に October RC 再判定 · TALK voice 切替は [talk-voice-server-migration-readiness.md](../reports/talk-voice-server-migration-readiness.md) |

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
| **状態** | 大量の未整理差分を領域別に分類済み。分割コミット予定（`git add -A` 禁止） |
| **調査時点の概数** | 2026-07-25 時点で porcelain 約 1500 件前後（分類・ignore・再ビルドで変動） |
| **リスク** | 一括 add で PoC / scratch / 秘密ファイル候補が混入 |
| **対応** | [PROJECT_STATUS.md](./PROJECT_STATUS.md) §Working tree · 領域別選別のみ |
| **関連** | REL-P0-01 · REL-P0-04 |

---

## KI-016 — （解決済み · 上記）dotenv dist 混入対策

| 項目 | 内容 |
| --- | --- |
| **事象** | ステージングビルドがリポジトリ直下の dotenv 系を dist へコピーしうる状態だった |
| **確認** | Git **追跡なし** · **履歴へのコミットなし** |
| **対策** | `.gitignore` 拡充 · `stage-cloudflare-pages.mjs` で dotenv 系をコピー除外 · dist 事後検査で検出時はビルド失敗 |
| **注意** | 秘密の値は docs / ログに書かない |

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
