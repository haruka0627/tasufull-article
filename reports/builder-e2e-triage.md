# Builder E2E FAIL 切り分け — verify-builder-general-flow-final.mjs

**作成日:** 2026-06-18  
**対象:** `scripts/verify-builder-general-flow-final.mjs`  
**前提:** NB-3 STEP 6（`builder-actor-identity.js` + `builder.js` actor 委譲）実装済み  
**方法:** コード変更なし · 失敗ログ再現 · 読取専用プローブ（verify 同等フロー mirror）

---

## サマリ

| 症状 | 主分類 | 副分類 | STEP6 起因 |
|------|--------|--------|------------|
| phase 3B `btn_unavailable` | **D** 検証スクリプト | **B** 既存フレーク | **非主因** |
| phase 4 `spec.applicant` undefined → crash | **D** 検証スクリプト | **C** bridge 応答/タイムアウト | **非主因** |

**STEP6 ロールバック必要性: NO**

---

## 再現結果

### 本番 verify（2 回）

```
OK 3 B complete button — true
OK 3 B complete opens modal — btn_unavailable
TypeError: Cannot read properties of undefined (reading 'role')
  at verify-builder-general-flow-final.mjs:659 (phase4 evaluate)
```

- 実行時間: 約 10〜13 分 / 回
- exit code: 1（phase 4 未処理例外でプロセス終了）

### 読取専用 mirror プローブ（verify phase 1〜3B 同等）

| 条件 | B 側完了ボタン | `isSubmitter` | `canSubmit` | bridge `spec.applicant` |
|------|----------------|---------------|-------------|-------------------------|
| genReset → apply → startChat | enabled | true | true | あり |
| + genSendMessage A/B | enabled | true | true | あり |
| + phase1 notify 遷移 + phase2 selected 遷移（verify 同等） | enabled | true | true | あり |
| + scroll to compose（verify 同等） | enabled | true | true | あり |

→ **STEP6 コード存在下でも、正常フローでは phase 3B は通る。**

### 対照テスト（STEP6 関連）

| テスト | 結果 |
|--------|------|
| `test-builder-thread-completion-approval-flow.mjs` | PASS |
| `test-builder-actor-identity.mjs` | ALL PASS |

---

## phase 3B — `btn_unavailable`

### 症状

`phase3BCompleteUi` が `[data-builder-mvp-thread-complete-open]` をクリックしようとした時:

```javascript
if (!btn || btn.hidden || btn.disabled) return { ok: false, error: "btn_unavailable" };
```

### 発生条件（特定）

1. **ボタンは「見える」が「押せない」ケースが主**
   - 直前の `phase3Header` は `visible()` のみ判定（**disabled 未チェック**）
   - 記録行 `3 B complete button` は第 2 引数が **常に `true` 固定** → 見えさえすれば OK
   - その後の modal オープン試行で初めて `disabled` が検出 → `btn_unavailable`

2. **UI ロジック上 disabled になる条件**（`builder.js` `renderSlackStyleMvpThreadPage`）
   - `isCompletionSubmitter === true` かつ `threadCanSubmitCompletion === false`
   - 典型: 選定前 / 提出済み / chat lock / `selected_partner_ids` 空

3. **verify 固有の競合**
   - phase 3 直前の `genSendMessage` が **await されず fire-and-forget**（L496-500）
   - 内部で `callBridge("setContext")` + `refreshGeneralFrames()` が非同期実行
   - 長時間実行後（10min+）に iframe 再読込・bridge キュー混雜と phase 3B クリックが競合しうる

4. **STEP6 との関係**
   - B iframe: `urlRole=user` · `actorId=demo-builder-user` · `isSubmitter=true` · `canSubmit=true`（プローブ確認）
   - LS `tasful:builder:mvp:role=partner` は共有 storage 汚染だが、helper は **URL role 優先**（demo）
   - **恒常的な STEP6 権限拒否ではない**

### 分類

| 分類 | 判定 | 根拠 |
|------|------|------|
| **A STEP6 起因** | △ 低 | プローブ・completion 単体テストは PASS。恒常再現なし |
| **B 既存不具合** | ○ | 非同期 bench / 共有 LS / 長時間実行でのフレーク余地 |
| **C fixture/seed** | △ 低 | seed 自体は `selected_partner_ids: [demo-builder-user]` まで到達（プローブ確認） |
| **D 検証スクリプト** | **◎ 主** | disabled/visible 判定不一致 · `genSendMessage` 未 await · phase 3B/4 断言が緩い |

---

## phase 4 — `spec.applicant` undefined

### 症状

```javascript
const spec = await bridge("getBenchGeneralFlowSpec", f.id);
await bridge("setContext", { role: spec.applicant.role, partnerId: spec.applicant.id });
// TypeError: Cannot read properties of undefined (reading 'role')
```

（L649-657 および L659-667 — **null/timeout ガードなし**）

### 発生条件（特定）

1. **`spec` がオブジェクトでない場合**
   - `callBridge` 15s timeout → `{ ok: false, error: "bridge_timeout", method }`
   - bridge 未 ready → `{ ok: false, error: "no_bridge" }` / `method_not_found`
   - いずれも `spec.applicant` は undefined

2. **phase 3B 失敗後もスクリプトは継続**
   - `3 B complete opens modal` は `phase3BCompleteUi.ok !== false || true` → **常に OK**
   - 完了報告未実施のまま phase 4 前置処理（L649）へ進む

3. **長時間実行後の bridge 飽和**
   - verify 全体 ~12min · 多数の `callBridge` 直列キュー
   - phase 3 付近で timeout しやすい環境差

4. **正常時の bridge 応答**（プローブ）

```json
{
  "spec": {
    "poster": { "role": "partner", "id": "demo-partner-002" },
    "applicant": { "role": "user", "id": "demo-builder-user" }
  },
  "hasApplicant": true
}
```

→ **fixture/spec 定義自体は健全。**

### 分類

| 分類 | 判定 | 根拠 |
|------|------|------|
| **A STEP6 起因** | × | bridge API / general-flow spec 未変更。bench-bridge 経由で spec 取得可能 |
| **B 既存不具合** | ○ | 長時間 bench bridge キュー・タイムアウト |
| **C fixture/seed** | × | `getBenchGeneralFlowSpec("partner_user")` は applicant 付きで返る |
| **D 検証スクリプト** | **◎ 主** | `spec?.applicant` 未チェック · 例外で全中断 |

---

## STEP6 変更との因果整理

| STEP6 変更 | phase 3B への影響 | phase 4 への影響 |
|------------|-------------------|------------------|
| `builder-actor-identity.js` 追加 | demo では URL role 優先 · submitter 判定 OK（プローブ） | なし |
| `getRole` / completion helper 委譲 | 正常 seed 下 `canSubmit=true` | なし |
| auth stack HTML 追加 | iframe ロード +数百 ms（bridge ready 以前から存在） | なし |
| `getActor` `const st` 重複（修正済） | 修正前は builder.js **パースエラー** → 別症状（UI 全体崩壊）。今回 FAIL ログとは不一致 |

**結論:** 今回 E2E FAIL の直接原因は STEP6 actor ポリシーではなく、**verify スクリプトの断言/非同期/例外処理**と **bench 長時間実行フレーク**。

---

## STEP6 ロールバック必要性

### **NO**

| 理由 | 詳細 |
|------|------|
| 代替検証 PASS | `test-builder-thread-completion-approval-flow.mjs` · `test-builder-actor-identity.mjs` |
| プローブ PASS | verify 同等フロー mirror で phase 3B · bridge spec 正常 |
| FAIL 主因 | 検証スクリプト（D）+ フレーク（B）、not 権限設計破壊 |
| ロールバック副作用 | 本番 host URL/LS role 昇格防止が巻き戻る |

### 推奨（実装は別タスク — 本切り分けでは未実施）

1. verify: `genSendMessage` を `await Promise.all([...])`
2. verify: `spec?.applicant` ガード + bridge error 明示 fail
3. verify: phase 3B で `disabled` を header 断言に含める
4. verify: `phase3BCompleteUi.ok !== false || true` 等の **常真断言** を修正

---

## 分類一覧（最終）

| ID | 内容 | 該当 |
|----|------|------|
| **A** | STEP6 起因 | 低（非主因） |
| **B** | 既存ベンチ不具合 | 中（非同期/長時間フレーク） |
| **C** | fixture/seed 不整合 | 低（否定的に確認） |
| **D** | 検証スクリプト不具合 | **高（主因）** |

---

**判定:** STEP6 維持 · verify スクリプト硬化を別 PR/タスクで実施
