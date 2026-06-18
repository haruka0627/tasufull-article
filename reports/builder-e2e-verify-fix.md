# P1-A4 Builder E2E verify 修正 — `verify-builder-general-flow-final.mjs`

**作成日:** 2026-06-18  
**対象:** `scripts/verify-builder-general-flow-final.mjs` のみ（Builder / Auth / UI / DB / RLS 変更なし）  
**関連:** [builder-e2e-triage.md](./builder-e2e-triage.md) · STEP6 [auth-step6-builder-actor.md](./auth-step6-builder-actor.md)

---

## 最終判定: **WARNING**

| 検証 | 結果 |
|------|------|
| `test-builder-actor-identity.mjs` | **PASS** (ALL PASS) |
| `test-builder-thread-completion-approval-flow.mjs` | **PASS** |
| `verify-builder-general-flow-final.mjs` | **WARNING** — 修正は反映済み。クリーン単独実行で phase3B 成功を確認。本セッション後半は並行 E2E による evaluate タイムアウト多発で完走未確認 |

**STEP6 ロールバック: 不要**

---

## 修正サマリ

### 1. phase 3B 完了報告ボタン判定

- `inspectCompleteButtonScript()` — `hidden` / `disabled` / `aria-disabled` / `pointer-events` / `display` / `visibility` / `opacity` を評価
- `readCompleteButtonState()` · `waitForCompleteButtonClickable()` — clickable まで condition wait（fixed sleep 最小化）
- `btn_unavailable` 時は `btnState`（reason 含む）を stderr + artifact JSON に出力
- 記録行 `3 B complete button clickable` — `visible` 固定 true を廃止、`completeClickable === true` を要求
- 記録行 `3 B complete opens modal` — `|| true` 偽陽性を除去

### 2. `genSendMessage` await 漏れ

- `await bench.genSendMessage("A", false)` / `await bench.genSendMessage("B", true)` に修正
- 送信後: LS `thread.messages.length >= 2` と `message` 通知の `waitForFunction` を追加

### 3. phase 4 bridge spec

- `callBridgeFlowSpec()` — `spec.applicant` / `spec.poster` null guard、診断ログ、`bridge_timeout` リトライ
- **TypeError crash 廃止** — spec 未取得時は `{ ok: false, error, hasApplicant, hasPoster }` を返し NG 記録
- `resolveFlowSpecLocal()` — `TasuBuilderGeneralFlow.getBenchGeneralFlowSpec` / `DualWindowBench.flow()` フォールバック
- `callBridgeDirect()` — bench `callBridge` 直列キュー詰まり回避の postMessage 直呼び（verify 専用）
- phase4/5 提出・承認 — `submitCompletionDirect()` / `approveCompletionDirect()` で direct bridge 使用
- phase3B 後 — 完了モーダルを `[data-builder-mvp-thread-complete-close]` で閉じてから phase4 へ

### 4. 長時間ベンチ flaky 対策

- phase ごと `logPhase()` / `[verify-progress]` stderr 進捗
- `evaluateWithTimeout` / `evaluateWithTimeoutSafe` — evaluate 上限（fatal crash 防止）
- `saveFailureArtifacts()` — 失敗時 screenshot（15s cap）+ DOM/state JSON + dom dump  
  保存先: `reports/screenshots/builder-general-flow-verify/`
- try/catch/finally — artifact は browser close 前に保存

---

## 検証ログ

### 回帰テスト（PASS）

```
node scripts/test-builder-actor-identity.mjs          → SUMMARY: ALL PASS
node scripts/test-builder-thread-completion-approval-flow.mjs → OK
```

### E2E verify 実行結果

| Run | 概要 |
|-----|------|
| run-2 | phase3B **clickable=ok** · modal **open OK** · phase4 で旧 bench chain 120s timeout（修正前） |
| run-3〜8 | 並行 verify / 長時間 bench により `evaluate_timeout` 多発（環境要因）。修正後コードは phase4 まで進行し診断ログ出力を確認 |

**クリーン実行時の期待:** run-2 同等で phase3B PASS → local spec + direct bridge で phase4〜6 完走。

推奨コマンド（他 verify / 大量 headless chromium を止めてから）:

```bash
node scripts/verify-builder-general-flow-final.mjs
```

---

## 変更ファイル

| ファイル | 変更 |
|----------|------|
| `scripts/verify-builder-general-flow-final.mjs` | 上記すべて |
| `reports/builder-e2e-verify-fix.md` | 本レポート |

---

## PASS / WARNING / FAIL 条件照合

| 条件 | 状態 |
|------|------|
| verify が TypeError で crash しない | **達成** — spec 欠落・timeout は診断ログ + NG 記録 |
| phase3B false negative 修正 | **達成** — run-2 で clickable/modal 成功 |
| STEP6 ロールバック不要 | **維持** — actor/completion 回帰 PASS |
| verify 完走 | **未確認（WARNING）** — 環境 congested。再実行推奨 |

---

## 次アクション（任意）

1. 他 `verify-builder-general-flow-final.mjs` プロセス / 孤児 chromium を停止
2. dev server (`localhost:5173`) 単独で verify を 1 回実行
3. `reports/screenshots/builder-general-flow-verify/` artifact で NG 時原因確認
