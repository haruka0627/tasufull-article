# TASFUL 決定事項（Architecture Decisions）

**最終更新:** 2026-06-26  
**形式:** 決定 ID · 日付 · 状態 · 内容 · 根拠

---

## AD-001 — AI サーフェス分離

| 項目 | 内容 |
| --- | --- |
| **決定** | Builder AI · TASFUL AI · AI 秘書 · Platform/TLV 入口は **別 UI · 別 surface · 別データ境界** |
| **日付** | 2026-06-26（AI フェーズ） |
| **根拠** | `reports/builder-ai-architecture.md`, 回帰テスト isolation チェック |

---

## AD-002 — Builder AI は TASFUL AI と統合しない

| 項目 | 内容 |
| --- | --- |
| **決定** | Builder AI は **案件コンテキスト**（Project / Thread / Partner）専用。TASFUL AI Workspace へ統合しない |
| **Gateway** | `surface=builder_ai`。`ai-workspace` surface とは混在しない |
| **根拠** | `reports/builder-ai-p1-review.md` isolation · `5ed9672` テスト PASS |

---

## AD-003 — Platform 専用 AI エンジンを作らない

| 項目 | 内容 |
| --- | --- |
| **決定** | Platform は deterministic assist（検索/比較/バッジ）+ **TASFUL AI Workspace への遷移**（`source=platform`）のみ |
| **禁止** | Platform 専用 LLM ループ · Platform 専用 Gateway surface の新設 |
| **根拠** | `reports/platform-finish-phase.md`, `reports/platform-next-phase.md` |

---

## AD-004 — TLV 専用 AI を作らない

| 項目 | 内容 |
| --- | --- |
| **決定** | TLV は `live/tlv-tasful-ai-entry.js` → `ai-workspace.html?source=tlv` の **導線のみ** |
| **テンプレ** | `ai-workspace-tlv-source.js`（8 テンプレ · 無料枠 UI） |
| **根拠** | `reports/tlv-tasful-ai-entry.md` · 16/16 PASS |

---

## AD-005 — Gateway / AI Core 契約（凍結）

| 項目 | 内容 |
| --- | --- |
| **決定** | AI フェーズ（Final / Platform Finish / Builder P2）では **`ai-model-gateway.js` 契約を変更しない** |
| **例外** | working tree に未コミット diff あり → 別判断（[KNOWN_ISSUES.md](./KNOWN_ISSUES.md) KI-001） |
| **根拠** | 各フェーズレポート「Gateway untouched」 |

---

## AD-006 — AI 出力は下書き · 非確定

| 項目 | 内容 |
| --- | --- |
| **決定** | 全 AI サーフェス共通: 契約 · 請求 · 採用 · 完了承認 · 返金等の **自動確定禁止** |
| **表示** | `common-ai-disclaimer.js` · `ai-terms.html` · Builder guidelines |
| **根拠** | `reports/ai-terms-disclaimer.md` · 32/32 PASS |

---

## AD-007 — 選別コミット（`git add -A` 禁止）

| 項目 | 内容 |
| --- | --- |
| **決定** | 混在 working tree（622+ 件）では **`git add -A` 一括コミット禁止**。領域別選別のみ |
| **実施** | AI 186 件 → `5ed9672` |
| **根拠** | `reports/ai-selected-staging-plan.md`, `reports/pre-commit-final-check.md` |

---

## AD-008 — Production Ready 宣言（製品）

| 項目 | 内容 |
| --- | --- |
| **決定** | 以下は **Production Ready / RELEASE FROZEN**（Critical · Security · 仕様追従のみ変更可） |
| **対象** | Builder v1.0 · Platform · TLV v1.0 · AI 秘書 v1.1 |
| **注** | TASFUL AI Workspace は **機能完成 ≠ Production Ready**（本番接続タスク残） |

---

## AD-009 — dist ビルドフロー

| 項目 | 内容 |
| --- | --- |
| **決定** | 静的配信は `npm run build:pages` → `deploy/cloudflare/dist` を正とする |
| **コミット** | ソース + dist ミラーをセット（AI コミット `5ed9672` 参照） |

---

## 見送り / 未決定

| ID | 内容 | 記録先 |
| --- | --- | --- |
| UD-001 | `ai-model-gateway.js` +73 行をマージするか | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) KI-001 |
| UD-002 | Cloudflare Access 下の TASFUL AI 公開方針 | preflight §11 |
| UD-003 | Platform FE 本番昇格タイミング（NB-1M） | `reports/platform-nb1m-frontend-prod-deploy-ready.md` G1/G2 |
