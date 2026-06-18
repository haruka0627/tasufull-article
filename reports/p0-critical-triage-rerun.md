# P0-CRITICAL-TRIAGE — 再実行（P0-BLOCKER-FIX 後）

**実施日:** 2026-06-18  
**入力:** [`p0-final-platform-audit-rerun.md`](p0-final-platform-audit-rerun.md)  
**前回:** [`p0-critical-triage.md`](p0-critical-triage.md)

---

## 再分類サマリ（更新）

| 新分類 | 前回件数 | 今回件数 | 変化 |
|--------|----------|----------|------|
| **BLOCKER** | 4 | **1** | C-1 · C-2 · C-4 **解消** |
| **MAJOR** | 4 | **5** | C-3 · C-5 · C-9 · C-10b + C-3 継続 |
| **POST_LAUNCH** | 2 | **3** | C-6 · C-7 · C-8（スコープ外確認） |
| **MINOR** | 0 | 0 | — |

**残 BLOCKER:** **C-10a のみ**（`tasful.jp` apex / NB-1D — infra 手動 · HP 移植タスク本体）

---

## 深掘り 4 問 — 再確認

### Q1. `DEV_SKIP_AUTH` は本番経路で有効か？

**結論: いいえ（解消済み）。**

| 確認 | 結果 |
|------|------|
| 定義 | `isDevSkipAuthAllowed()` — host 判定 |
| pages.dev / tasful.jp | **false** |
| localhost / file | true（開発用） |
| dist | `const DEV_SKIP_AUTH = true` **なし** |

**再分類:** ~~BLOCKER~~ → **解消**

---

### Q2. Builder role は実 DB 利用時も破綻するか？

**結論: 本番 host では helper 委譲で解消。デモ host は従来 fallback。**

| 層 | 結果 |
|----|------|
| `getRole()` / `getPartnerId()` / `getActor()` | 本番 → `TasuBuilderActorIdentity` |
| HTML 配線 | 34 ページ `builder-actor-identity.js` |
| completion 判定 | `isCompletionSubmitter/Reviewer` 委譲 |
| テスト | `test-builder-actor-identity.mjs` ALL PASS |

**再分類:** ~~BLOCKER~~ → **解消**

---

### Q3. Connect UI/DB 分裂 — 変更なし

**結論: MAJOR 継続**（Q3 前回と同じ · NB-6 未実装）

**再分類:** **MAJOR**

---

### Q4. 市場 checkout — スコープ外

**結論: POST_LAUNCH**（GMV スコープ外 · 意図的モック）

**再分類:** **POST_LAUNCH**

---

## 個別再分類（C-1〜C-10）

| ID | 前回 | 今回 | 根拠 |
|----|------|------|------|
| C-1 | BLOCKER | ✅ **解消** | P0-1 FIX |
| C-2 | BLOCKER | ✅ **解消** | P0-2 FIX · 5 HTML 配線 |
| C-3 | MAJOR | **MAJOR** | ANPI healthcheck LS 未修正 |
| C-4 | BLOCKER | ✅ **解消** | P0-3 FIX |
| C-5 | MAJOR | **MAJOR** | Connect UI 未一本化 |
| C-6 | POST_LAUNCH | **POST_LAUNCH** | スコープ外 |
| C-7 | POST_LAUNCH | **POST_LAUNCH** | スコープ外 |
| C-8 | POST_LAUNCH* | **POST_LAUNCH** | GMV スコープ外 |
| C-9 | MAJOR | **MAJOR** | market notify 未統合 |
| C-10a | BLOCKER | **BLOCKER（infra）** | apex 未到達 · NB-1D |
| C-10b | MAJOR | **MAJOR** | SITE_URL 未設定 |

---

## 本番ブロッカー順（更新）

| 順位 | ID | 分類 | 状態 |
|------|-----|------|------|
| ~~1~~ | ~~C-1~~ | ~~BLOCKER~~ | ✅ 完了 |
| ~~2~~ | ~~C-2~~ | ~~BLOCKER~~ | ✅ 完了 |
| ~~3~~ | ~~C-4~~ | ~~BLOCKER~~ | ✅ 完了 |
| **1** | C-10a | BLOCKER | ⏳ NB-1D 手動 |
| 2 | C-10b | MAJOR | apex 後 |
| 3 | C-5 | MAJOR | Connect UI |
| 4 | C-9 | MAJOR | market notify |
| 5 | C-3 | MAJOR | ANPI JWT 化 |
| 6+ | C-6/7/8 | POST_LAUNCH | 機能ローンチ時 |

---

## ティア判定（HP 移植）

### ティア A — pages.dev パイロット

| 条件 | 状態 |
|------|------|
| NB-1C deploy + smoke | ✅ PASS |
| C-1/C-2 解消 | ✅ |
| ops URL 公開時 403 | ✅（コード · redeploy 要） |
| **判定** | **READY** |

### ティア B — `tasful.jp` 限定公開（デモ frozen）

| 条件 | 状態 |
|------|------|
| B-1 NB-1D apex | ⏳ BLOCKER |
| B-2 Site URL | ⏳ |
| B-3 DEV_SKIP_AUTH false | ✅ |
| B-4 ops guard | ✅ |
| B-5 Builder actor | ✅ |
| **判定** | **READY_WITH_WARNINGS**（NB-1D 待ち） |

---

## HP 移植 GO/NO-GO

| 判定 | **READY_WITH_WARNINGS** |
|------|-------------------------|
| 理由 | コード BLOCKER 3 件解消 · 自動検証 PASS · **apex infra（C-10a）と MAJOR 残存が警告** |
| 次段 | NB-1D 実施 → redeploy → apex smoke |

---

**ステータス:** P0-CRITICAL-TRIAGE 再実行完了
