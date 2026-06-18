# P0-FINAL-AUDIT — 再実行（P0-BLOCKER-FIX 後）

**実施日:** 2026-06-18  
**種別:** 静的解析 + dist 検証 + smoke / 単体テスト  
**前回:** [`p0-final-platform-audit.md`](p0-final-platform-audit.md) — **NOT_READY**（CRITICAL 10 · HIGH 12）  
**除外（本 rerun スコープ）:** TALK 通話 · 市場 GMV · Stripe Live · NB-1D Dashboard 手動

---

## 総合判定: **READY_WITH_WARNINGS**（HP 移植観点）

| 判定 | 前回 | 今回 |
|------|------|------|
| 本番 apex 全面投入 | NOT_READY | **NOT_READY**（C-10a 継続） |
| pages.dev パイロット | NOT_READY（C-1/C-2） | **PASS 可能** |
| **HP 移植フェーズ進行** | BLOCKED | **READY_WITH_WARNINGS** |

---

## CRITICAL 再評価（C-1〜C-10）

| ID | 前回 | 今回 | 根拠 |
|----|------|------|------|
| **C-1** DEV_SKIP_AUTH | ❌ CRITICAL | ✅ **解消** | `isDevSkipAuthAllowed()` · `*.pages.dev` / tasful.jp で false |
| **C-2** ops guard 未配線 | ❌ CRITICAL | ✅ **解消** | 5 ops HTML + dist に auth stack |
| **C-3** ANPI LS 昇格 | ❌ CRITICAL | ⚠️ **MAJOR 継続** | `anpi-line-healthcheck.js` 別経路 · ops guard は配線済み |
| **C-4** Builder role | ❌ CRITICAL | ✅ **解消** | `builder.js` → `TasuBuilderActorIdentity` · 34 HTML |
| **C-5** Connect UI/DB | ❌ CRITICAL | ⚠️ **MAJOR 継続** | `connect-member-ui.js` LS 優先描画 未変更 |
| **C-6** TALK 通話 | ❌ CRITICAL | ⏸ **POST_LAUNCH** | スコープ外 · 未配線のまま |
| **C-7** mic `_headers` | ❌ CRITICAL | ⏸ **POST_LAUNCH** | C-6 従属 |
| **C-8** 市場 checkout モック | ❌ CRITICAL | ⏸ **POST_LAUNCH** | GMV スコープ外 |
| **C-9** market notify | — HIGH | ⚠️ **MAJOR 継続** | `market-identity.js` 未統合 |
| **C-10a** apex 未到達 | ❌ CRITICAL | ⚠️ **BLOCKER（infra）** | DNS/NB-1D 手動 · コード外 |
| **C-10b** SITE_URL | — | ⚠️ **MAJOR** | apex 後投入 |

**CRITICAL コード系:** 10 → **3 解消 · 4 POST_LAUNCH/スコープ外 · 3 MAJOR/infra 継続**

---

## 領域サマリ（更新）

| 領域 | 未ログイン | 一般会員 | ops | 総合 |
|------|------------|----------|-----|------|
| **Auth** | ✅ pages.dev でガード有効 | ✅ member guard 復帰 | ✅ ops 403 | **PASS*** |
| **TALK** | ⚠️ 公開閲覧可 | ⚠️ chat-detail 身份 | ✅ ops ガード | **WARN** |
| **Builder** | ✅ 本番 actor 委譲 | ✅ JWT+deal 照合 | ⚠️ admin ページは actor 経由 | **PASS*** |
| **市場** | ⚠️ 閲覧可 | ⚠️ モック決済 | — | **POST_LAUNCH** |
| **Connect** | — | ⚠️ LS 偽装可 | — | **MAJOR** |
| **AI Workspace** | ⚠️ 静的デモ | ⚠️ JWT 未接続 | — | **WARN** |

\* pages.dev / tasful.jp 本番 host 前提。localhost デモ fallback は意図的。

---

## 検証エビデンス

| 検証 | 結果 |
|------|------|
| `npm run build:pages` | PASS |
| `npm run verify:pages-stage` | PASS |
| pages.dev smoke | PASS |
| dist `member-auth.js` | `DEV_SKIP_AUTH = true` なし |
| dist ops HTML ×5 | `auth-ops-guard.js` あり |
| dist builder HTML ×34 | `builder-actor-identity.js` あり |

---

## HIGH 残存（抜粋 · 未着手）

| ID | 内容 | HP 移植ブロック |
|----|------|-----------------|
| H-1 | 多数 HTML auth stack 未配線（会員系） | 警告 |
| H-3 | chat-detail 身份 | 警告 |
| H-10 | AI workspace JWT | 警告 |
| H-12 | verify/smoke 拡張 | 警告 |

---

## 前回との差分

```
NOT_READY (CRITICAL 10)
    ↓ P0-BLOCKER-FIX
READY_WITH_WARNINGS (HP migration)
    · C-1 C-2 C-4 解消
    · C-10a infra BLOCKER 残存（HP 作業本体）
    · C-5 C-3 C-9 MAJOR 残存
    · C-6/C-7/C-8 POST_LAUNCH（宣言スコープ外）
```

---

**ステータス:** P0-FINAL-AUDIT 再実行完了 — **READY_WITH_WARNINGS**（HP 移植 GO · 本番全面投入は NOT_READY）
