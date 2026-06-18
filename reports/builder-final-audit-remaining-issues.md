# Builder 全体フロー最終監査 — 残課題一覧

**実施日:** 2026-06-16（P1 テスト更新後 再監査）  
**方針:** 製品コード変更なし  
**除外:** 市場EC（RELEASE FROZEN）、TALK 製品コード（RELEASE FROZEN）

---

## 総合評価（P1 更新後）

| 項目 | 判定 |
|------|------|
| **P1-1** `test-builder-final-flow-inspection.mjs` | **PASS** |
| **P1-2** `verify-builder-general-flow-final.mjs` | **PASS** (78/78) |
| **P1-3** `verify-builder-ops-notify-routing.mjs` | **PASS** (7/7) |
| **P1-4** `verify-builder-dual-window-bench.mjs` | **P2 送り**（未変更） |
| **P0（リリースブロッカー）** | **なし** |
| **P1（要確認）** | **0 件**（本タスク範囲） |
| **総監査** `review-builder-user-flow.mjs` | **PASS** (44/0/0) |

---

## P0 — リリースブロッカー

**なし**

- Builder board 一般案件 E2E（総監査 PASS 水準）
- 完了報告専用チェーン PASS
- スレッド種別 PASS

---

## P1 — 要確認（本タスクで解消）

### ~~P1-1~~ board job 型完了承認 UI → **PASS**

| 項目 | 内容 |
|------|------|
| 対応 | `role=user&partnerId=u_job_demo_full`（`job_demo_full_001` の `owner_id` 整合） |
| 結果 | `OK: builder final flow inspection passed` |

### ~~P1-2~~ general flow Step1 → **PASS**

| 項目 | 内容 |
|------|------|
| 対応 | `genApply()` + `waitForFunction`（runtime store）+ 通知 iframe 読み取り順序・リトライ |
| 結果 | `All general flow final checks passed` |

### ~~P1-3~~ ops 通知ルーティング → **PASS**

| 項目 | 内容 |
|------|------|
| 対応 | `talkDev=1`、`[data-talk-notify-action="navigate"]`、シードタイトル（`adminOpsRows`） |
| 結果 | 7/7 OK |

### P1-4 → **P2 へ移動**

| 項目 | 内容 |
|------|------|
| 監査 | `verify-builder-dual-window-bench.mjs` |
| 現象 | `#builderBenchSendBBtn` headless タイムアウト |
| 扱い | デモベンチ専用・リリース後改善 |

---

## P2 — リリース後改善

| # | 項目 | 内容 |
|---|------|------|
| **1** | **2窓ベンチ ops_partner 送信（旧 P1-4）** | `verify-builder-dual-window-bench.mjs` 未対応 |
| 2 | partner-assignment 辞退クリック | 監査環境で状態永続が不安定 |
| 3 | 2窓ベンチ notify iframe 内ボタン | `btnClickable: false`（スクロールは可） |
| 4 | deal-detail 監査 port | `test-deal-detail-builder-cards.mjs` port 未対応 |
| 5 | audit-builder-notify-routing port | 同上 |
| 6 | board-thread レビュー UI | `openReview=1` 記述整理 |
| 7 | 完了通知 href 混在監視 | board-thread vs mvp-thread CI |
| 8 | job 型と project 型の完了 UI 差 | 仕様明文化 |
| 9 | 本番認証ロール統合 | JWT 将来対応 |
| 10 | Supabase 同期 | マルチ端末将来対応 |
| 11 | platform-verify / builder-board マスター重複 | 通知マスター整理 |
| 12 | 390px 完了報告/承認ボタン到達性 | #completion フォーカス |
| 13 | vendor / user フル E2E | カバレッジ拡張 |

---

## 再検証コマンド

```bash
# P1（本タスク）
node scripts/test-builder-final-flow-inspection.mjs
node scripts/verify-builder-general-flow-final.mjs
node scripts/verify-builder-ops-notify-routing.mjs

# 総合監査
node scripts/review-builder-user-flow.mjs

# P2（未対応）
node scripts/verify-builder-dual-window-bench.mjs
```

**前提:** ローカル dev サーバー `http://127.0.0.1:5500`

---

## 判断サマリー

| 区分 | 件数 | 扱い |
|------|------|------|
| P0 | 0 | リリースブロッカーなし |
| P1 | 0 | 本タスク 4 件は解消 or P2 送り |
| P2 | 13+ | 2窓ベンチ送信を P1-4 から繰り上げ記録 |

**結論:** Builder **コア導線は RELEASE 可能水準**。P1 監査スクリプト更新により、job 型・general flow・ops 通知の誤 FAIL は解消。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [`builder-p1-triage-conclusion.md`](builder-p1-triage-conclusion.md) | P1 テスト更新結論 |
| [`talk-release-status.md`](talk-release-status.md) | TALK RELEASE FROZEN |
| [`market-ec-release-status.md`](market-ec-release-status.md) | 市場EC RELEASE FROZEN |
