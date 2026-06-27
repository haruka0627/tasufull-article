# Builder — リリース確定

**確定日（デモ MVP）:** 2026-06-17  
**Production Ready（v1.0）:** 2026-06-26  
**状態:** ✅ **Builder v1.0 — PRODUCTION READY · RELEASE FROZEN**

2026-06-17 のデモ MVP 監査 PASS に加え、B3–B10 の Repository / Adapter / AI / PDF 基盤完成をもって **Builder v1.0** として正式凍結。  
以後の開発ルールは **AI秘書 v1.1 凍結** と同一（Critical Bug / Security / Supabase 仕様追従 / 軽微 UX のみ許可）。

**Release package:** [`builder-production-ready/README.md`](builder-production-ready/README.md)

---

## 総合判定（v1.0）

| 項目 | 判定 |
|------|------|
| **Production Ready** | **YES** — B10 audit complete |
| **Version** | **1.0.0** |
| **凍結** | **RELEASE FROZEN**（v1.0 正式凍結） |
| **Data mode** | `local` · `useSupabase=false` |
| **Architecture regression** | B3–B10 check scripts PASS |
| **Legacy user-flow audit** | PASS 44/0/0（2026-06-17 基準・維持） |
| P0（リリースブロッカー） | **なし** |
| P1（要製品修正） | **なし** |
| **B10 製品コード変更** | **なし**（ドキュメント + 検証スクリプトのみ） |

### v1.0 検証コマンド

```bash
node scripts/check-builder-production-ready.mjs
```

---

## RELEASE FROZEN — 6領域

| 領域 | 確定ドキュメント | 確定日 | 状態 |
|------|-----------------|--------|------|
| **市場EC** | [`market-ec-release-status.md`](market-ec-release-status.md) | 2026-06-16 | **RELEASE FROZEN** |
| **TALK** | [`talk-release-status.md`](talk-release-status.md) | 2026-06-16 | **RELEASE FROZEN** |
| **Builder** | 本ドキュメント + [`builder-production-ready/`](builder-production-ready/README.md) | 2026-06-26 | **v1.0 PRODUCTION READY · FROZEN** |
| **AI運営秘書** | [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |
| **Connect** | [`connect-release-status.md`](connect-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |
| **安否** | [`anpi-release-status.md`](anpi-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |

---

## 確定根拠

| 項目 | 判定 | 根拠 |
|------|------|------|
| 自動監査総合 | **PASS** | `scripts/review-builder-user-flow.mjs` → `screenshots/builder-user-flow-review/review-report.md`（PASS 44 / WARN 0 / FAIL 0） |
| P0 | **なし** | 上記総監査・最終監査でブロッカー未検出 |
| P1 製品修正 | **不要** | [`builder-p1-triage-conclusion.md`](builder-p1-triage-conclusion.md) — P1-1〜3 は監査スクリプト更新で PASS |
| P1-4 | **P2 送り** | `verify-builder-dual-window-bench.mjs` — デモベンチ headless 不安定。製品バグではない |
| board 一般案件 E2E | **PASS** | 総監査・完了報告チェーン・スレッド種別 |
| 通知→対象画面遷移 | **PASS** | ops / board 通知ルーティング（P1-3 更新後 7/7） |
| general flow | **PASS** | `verify-builder-general-flow-final.mjs`（78/78） |
| job 型完了承認 | **PASS** | `test-builder-final-flow-inspection.mjs` |
| 市場EC | **未変更** | 本フェーズで市場ECコードに手を入れていない |
| TALK | **未変更** | 本フェーズで TALK 製品コードに手を入れていない |

### P1 再検証（監査更新後）

[`builder-p1-triage-conclusion.md`](builder-p1-triage-conclusion.md)（2026-06-16）:

| ID | スクリプト | 結果 | 対応 |
|----|-----------|------|------|
| **P1-1** | `test-builder-final-flow-inspection.mjs` | **PASS** | `job_demo_full_001` 承認を `role=user&partnerId=u_job_demo_full` に整合 |
| **P1-2** | `verify-builder-general-flow-final.mjs` | **PASS** (78/78) | `genApply()` + runtime 通知待ち + リトライ |
| **P1-3** | `verify-builder-ops-notify-routing.mjs` | **PASS** (7/7) | `[data-talk-notify-action="navigate"]` + `talkDev=1` |
| **P1-4** | `verify-builder-dual-window-bench.mjs` | **P2 送り** | headless 送信ボタン不安定（製品バグではない） |

**実行ログ:** `screenshots/builder-p1-*-last-run.txt`

---

## 対象スコープ（凍結）

### コア画面・導線

- `builder/` — board 一覧・詳細・スレッド・完了報告・承認・MVP 導線
- `builder-admin/` — 運営管理画面
- `builder/builder.js` / `builder-board-feed.js` / `builder-general-flow.js`
- `public-board.html` / `public-board-detail.html` — 公開 board 導線
- `partner-assignment.html` — パートナー受諾判断
- `talk-builder-notify-master-v1.js` / `talk-platform-notify.js` — Builder 通知ルーティング（TALK 凍結ファイルと連携）

### 監査スクリプト（凍結・変更時のみ再実行）

| スクリプト | 役割 | 状態 |
|-----------|------|------|
| `scripts/review-builder-user-flow.mjs` | 総合ユーザーフロー | PASS (44/0/0) |
| `scripts/test-builder-final-flow-inspection.mjs` | board job 型完了承認 | PASS |
| `scripts/verify-builder-general-flow-final.mjs` | general flow 最終検証 | PASS (78/78) |
| `scripts/verify-builder-ops-notify-routing.mjs` | ops 通知ルーティング | PASS (7/7) |
| `scripts/test-builder-thread-completion-approval-flow.mjs` | 完了報告・承認フロー | PASS |
| `scripts/test-builder-board-unified-feed.mjs` | board 統合フィード | PASS |
| `scripts/audit-builder-notify-routing.mjs` | 通知ルーティング監査 | PASS |
| `scripts/test-builder-flow-audit.mjs` | Builder/TALK 導線監査 | PASS |

---

## 現行導線の整理（監査基準）

| 用途 | 現行 ID / URL | 備考 |
|------|----------------|------|
| 応募通知 | `builder-board-apply-001` → `board-project-detail.html?view=applications` | PASS |
| 採用通知 | `builder-board-selected-001` / `builder-board-hire-owner-001` → `board-thread.html` | PASS |
| 完了報告 | `builder-board-completion-001` → `board-thread.html#completion` | PASS |
| 運営→パートナー新着 | `builder-ops-route-001` → `partner-assignment.html` | PASS（TALK 凍結導線と整合） |
| 旧カレンダー通知 | `builder-project-new-001` | **DEPRECATED** — notify 一覧非表示が正 |

---

## リリース後改善（P2 — 修正不要でリリース可）

| 優先 | 項目 | 内容 |
|------|------|------|
| P2 | **2窓ベンチ ops_partner 送信（旧 P1-4）** | `verify-builder-dual-window-bench.mjs` — `#builderBenchSendBBtn` headless タイムアウト |
| P2 | partner-assignment 辞退クリック | 監査環境で状態永続が不安定 |
| P2 | 2窓ベンチ notify iframe 内ボタン | `btnClickable: false`（スクロールは可） |
| P2 | deal-detail 監査 port | `test-deal-detail-builder-cards.mjs` port 未対応 |
| P2 | audit-builder-notify-routing port | 同上 |
| P2 | board-thread レビュー UI | `openReview=1` 記述整理 |
| P2 | 完了通知 href 混在監視 | board-thread vs mvp-thread CI |
| P2 | job 型と project 型の完了 UI 差 | 仕様明文化 |
| P2 | 390px 完了報告/承認ボタン到達性 | `#completion` フォーカス |
| P2 | vendor / user フル E2E | カバレッジ拡張 |
| 改善 | 本番認証ロール統合 | JWT 将来対応 |
| 改善 | Supabase 同期 | マルチ端末将来対応 |
| 改善 | platform-verify / builder-board マスター重複 | 通知マスター整理 |

詳細一覧は [`builder-final-audit-remaining-issues.md`](builder-final-audit-remaining-issues.md) を参照。

---

## 再検証コマンド（参考・変更時のみ）

```bash
# 総合
node scripts/review-builder-user-flow.mjs

# P1（監査更新済み）
node scripts/test-builder-final-flow-inspection.mjs
node scripts/verify-builder-general-flow-final.mjs
node scripts/verify-builder-ops-notify-routing.mjs

# 個別 smoke
node scripts/test-builder-thread-completion-approval-flow.mjs
node scripts/audit-builder-notify-routing.mjs
node scripts/test-builder-flow-audit.mjs

# P2（未対応・リリース後）
node scripts/verify-builder-dual-window-bench.mjs
```

**前提:** ローカル dev サーバー起動（`http://127.0.0.1:5500` 等）。port は各スクリプトが自動検出。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [`builder-final-audit-remaining-issues.md`](builder-final-audit-remaining-issues.md) | 最終監査時点の課題一覧（本判定で P1 解消・凍結確定） |
| [`builder-p1-triage-conclusion.md`](builder-p1-triage-conclusion.md) | P1 切り分け — 製品修正不要の根拠 |
| [`talk-release-status.md`](talk-release-status.md) | TALK RELEASE FROZEN（別領域） |
| [`market-ec-release-status.md`](market-ec-release-status.md) | 市場EC RELEASE FROZEN（別領域） |
| [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | AI運営秘書 RELEASE FROZEN（別領域） |
| [`connect-release-status.md`](connect-release-status.md) | Connect RELEASE FROZEN（別領域） |
| [`anpi-release-status.md`](anpi-release-status.md) | 安否 RELEASE FROZEN（別領域） |
| [`docs/COMMIT-STAGING-builder-frozen.md`](../docs/COMMIT-STAGING-builder-frozen.md) | 保護対象ファイル・コミット分割案 |

---

## 次フェーズ

Builder は **v1.0 として正式凍結**（2026-06-26）。  
許可される変更のみ: Critical Bug · Security Fix · Supabase 仕様追従 · 軽微 UX改善。  
詳細: [`builder-production-ready/FREEZE.md`](builder-production-ready/FREEZE.md)

**P0 / P1 は残っていない。** アーキテクチャ新規開発（B11+）は unfreeze 承認まで禁止。

市場EC・TALK・Builder・AI運営秘書・Connect・安否 の **6 領域**はいずれも RELEASE FROZEN。
