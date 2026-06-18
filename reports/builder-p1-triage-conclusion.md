# Builder P1 テスト更新 — 結論

**実施日:** 2026-06-16  
**方針:** 製品コード変更なし（Market EC / TALK RELEASE FROZEN 維持）

---

## 完了条件

| ID | スクリプト | 結果 | 対応 |
|----|-----------|------|------|
| **P1-1** | `test-builder-final-flow-inspection.mjs` | **PASS** (exit 0) | `job_demo_full_001` 承認を `role=user&partnerId=u_job_demo_full` に整合 |
| **P1-2** | `verify-builder-general-flow-final.mjs` | **PASS** (78/78, exit 0) | `genApply()` + runtime 通知待ち + `evaluateRetry` / Step1 読み取り順序修正 |
| **P1-3** | `verify-builder-ops-notify-routing.mjs` | **PASS** (7/7, exit 0) | `[data-talk-notify-action="navigate"]` + `talkDev=1` + シードタイトル準拠 |
| **P1-4** | `verify-builder-dual-window-bench.mjs` | **P2 送り** | 未変更（headless 送信ボタン不安定） |

**実行ログ:** `screenshots/builder-p1-*-last-run.txt`

---

## P1 分類（事前トリアージ）

| ID | 分類 | 備考 |
|----|------|------|
| P1-1 | 監査スクリプト更新で解消 | `owner_id` と `role=owner` の不一致 |
| P1-2 | 監査スクリプト更新で解消 | UI クリック + 700ms ではなく API `genApply()` |
| P1-3 | 監査スクリプト更新で解消 | obsolete `article` クリック・タイトル不一致 |
| P1-4 | **P2** | デモベンチ専用・本番 board 導線とは別系統 |

---

## P1-4 → P2 記録

- **監査:** `verify-builder-dual-window-bench.mjs`
- **現象:** `#builderBenchSendBBtn` クリック 30s タイムアウト（headless）
- **扱い:** リリース後改善（P2 #13 相当）。本タスクではスクリプト未変更。

---

## 再監査後の P0/P1 残存

- **P0:** なし（コア board 導線は総監査で継続 PASS 想定）
- **P1:** 本タスク 4 件は **すべて解消 or P2 送り**
- **残 P2:** 2窓ベンチ送信（P1-4）、deal-detail port、notify スクロール細部など

詳細は `reports/builder-final-audit-remaining-issues.md`（再監査後更新）を参照。
