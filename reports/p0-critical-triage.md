# P0-CRITICAL-TRIAGE — CRITICAL 10 件 再分類

**実施日:** 2026-06-18  
**種別:** 調査のみ（**コード変更なし**）  
**入力:** [`p0-final-platform-audit.md`](p0-final-platform-audit.md) CRITICAL C-1〜C-10  
**目的:** 本番ブロッカー順への再分類 · 4 件の深掘り確認

---

## 再分類サマリ

| 新分類 | 件数 | ID |
|--------|------|-----|
| **BLOCKER** | 4 | C-1 · C-2 · C-4 · C-10（apex） |
| **MAJOR** | 4 | C-3 · C-5 · C-9 · C-10（SITE_URL） |
| **MINOR** | 0 | — |
| **POST_LAUNCH** | 2 | C-6 · C-7 · C-8（※C-8 は GMV スコープ外時） |

> **注:** C-8 は **市場 GMV 本番** をスコープに含める場合 **BLOCKER**（下記 §C-8）。

---

## 深掘り 4 問 — 結論

### Q1. `DEV_SKIP_AUTH=true` は本番経路で本当に有効か？

**結論: はい。host 非依存で常時有効。**

| 確認 | 結果 |
|------|------|
| 定義 | `member-auth.js` L18: `const DEV_SKIP_AUTH = true`（**ビルド定数** · env 分岐なし） |
| ガード短絡 | L518 `guardMemberPage()` 先頭で `if (DEV_SKIP_AUTH) return true` |
| 認証判定 | L441 `isAuthenticatedSync` · L462 `isAuthenticated` も同様 |
| 起動経路 | L610 `DOMContentLoaded` → `bootAuthGuards()` → `guardMemberPage()` |
| pages.dev | **有効** |
| tasful.jp（将来） | **同じバンドル · 同じく有効** |
| `auth-current-user.js` | **別モジュール** — `requireCurrentUser` は JWT 要求するが、`member-auth` ガードをバイパス済みのページでは **到達前に会員 UI 表示** |

**影響ページ（`MEMBER_GUARD_PAGES`）:** `dashboard` · `payment-settings` · `profile-settings` · `my-listings` · `listing-management` · `sales-fees` · `chat-list` 等。

**再分類:** **BLOCKER** — 本番会員・Connect・seller いずれのロールでも **ログイン強制が機能しない**。

---

### Q2. Builder role は実 DB 利用時も破綻するか？

**結論: UI 権限は破綻。DB/RLS が書き込みを止めても、操作面・情報漏えいリスクは残る。**

| 層 | 状態 |
|----|------|
| **`builder.js` `getRole()`** | L1189–1202: `?role=` → sessionStorage → localStorage → **default `"owner"`**。`TasuBuilderActorIdentity` **参照 0 件** |
| **`builder-actor-identity.js`** | 本番 host では JWT + deal 参加者照合 · `isDealParticipant` でガード — **設計は正しいが未使用** |
| **HTML 配線** | auth stack は `builder/index.html` のみ。案件/応募/スレッド/完了/レビュー **30+ ページ未配線** |
| **実 DB 時** | Supabase 書き込みは **RLS/JWT で拒否される可能性**（[`auth-step8-rls-reverification.md`](auth-step8-rls-reverification.md) 前提） |
| **それでも残る問題** | ① 非当事者に **採用/完了/管理 UI が表示** ② URL 共有で **意図的昇格** ③ クライアント側 demo seed / general-flow が **DB 参加者 ID と無関係に動く** ④ 通知/表示が **誤ロール** で生成される可能性 |

**再分類:** **BLOCKER**（Builder を本番公開するなら）— DB があっても **認可モデルはクライアント側で破綻**。RLS は最後の砦であり **リリース条件を満たさない**。

---

### Q3. Connect UI/DB 分裂は実利用を止めるレベルか？

**結論: 単独では「全停止」ではないが、本番 Connect 信頼性では MAJOR。実 payout には NB-6 未実装がより大きい BLOCKER。**

| 経路 | 挙動 |
|------|------|
| **`connect-state.js`** | 本番 host で LS fallback **禁止** · `refreshConnectStateFromDb()` で listing payout 列を読む |
| **`payment-settings.js`** | L184–191: `saveConnectOnboarding()` が **無条件 localStorage 書込** |
| **描画** | L199–201: `resolveConnectStep()` → **`connect-member-ui.js`（LS/URL 優先）** |
| **自動 refresh** | L353–359: DB refresh 後 `renderConnectOnboarding()` → **再び LS ベース描画** |
| **実 payout** | [`connect-production-gap.md`](connect-production-gap.md) · NB-6: **Stripe AccountLink Edge 未実装** — UI が ready でも **実口座開設不可** |

| シナリオ | 分裂の影響 |
|----------|------------|
| **デモ frozen / パイロット** | LS で step 進行 **意図的** — 利用は止まらない · **誤 ready 表示** |
| **本番 seller onboarding** | DB≠UI · **規制/サポートリスク** — onboarding 判断不能 |
| **実売上受取** | UI 分裂より **NB-6 不在** が先に利用を停止 |

**再分類:** **MAJOR** — 本番 Connect **正規フロー** の信頼性を損なう。ただし **現時点の実利用停止の主因は NB-6（実 onboarding 未実装）**。

---

### Q4. 市場 checkout（C-8）は Stripe 本番切替で解消されるか？

**結論: いいえ。Stripe Live 単独では解消しない。**

| 前提 | 内容 |
|------|------|
| **現行 Path A** | `shop-market-checkout.js` / `shop-store-checkout.js` — **モック** · LS のみ |
| **Path B（Stripe）** | `checkout.html` + `shop-checkout.js` + Edge `stripe-create-shop-checkout` — **コード存在** |
| **配線 gap** | 商品詳細 buy → **Path A 固定**（[`marketplace-payment-production-gap.md`](marketplace-payment-production-gap.md)） |
| **Stripe Live が効くもの** | Featured · GenAI · Path B **が配線済みの** Checkout |
| **Stripe Live だけでは不足** | ① **NB-4** 導線 Path B 接続 ② **NB-5** `shop_orders` DDL ③ **NH-7** Edge deploy/confirm ④ seller/buyer 注文 UI の Supabase 化 |

```
Stripe Live 切替 ──×──> Path A モック自動解消
Stripe Live 切替 ──+──> Path B + NB-4/5/7 完了 ──> 市場 GMV 可能
```

**再分類:**

| リリーススコープ | 分類 |
|------------------|------|
| **市場 GMV / 実決済を含む** | **BLOCKER**（C-8） |
| **RELEASE FROZEN デモ市場のみ**（現行宣言） | **POST_LAUNCH** — 意図的モック · ラベル/UX で明示 |

---

# 個別再分類（C-1〜C-10）

## C-1 · `DEV_SKIP_AUTH=true`

| 項目 | 値 |
|------|-----|
| **新分類** | **BLOCKER** |
| **根拠** | Q1 — 全 `member-auth` 経路でガード無効 · host 非依存 |
| **ブロックするリリース** | 本番会員 · Connect · seller · ログイン必須ページ一切 |
| **pages.dev パイロット** | 技術的には可能 · **セキュリティ上は同じ BLOCKER** |

---

## C-2 · `auth-ops-guard` 未配線 / git 未含有

| 項目 | 値 |
|------|-----|
| **新分類** | **BLOCKER** |
| **根拠** | ops 5 画面が静的公開 · `auth-ops-guard.js` HTML 参照 0 · main 未 commit |
| **ブロックするリリース** | `tasful.jp` 公開後の **AI 運営司令塔 / センター / 問い合わせ / ops TALK** |
| **pages.dev** | **同様に全開** |

---

## C-3 · ANPI LINE admin URL/LS 昇格

| 項目 | 値 |
|------|-----|
| **新分類** | **MAJOR** |
| **根拠** | `?anpi_admin=1` / LS で管理 UI · LINE Push テスト可能 — **ops ほど広範囲ではない** |
| **BLOCKER にしない理由** | 到達 URL が限定 · 安否本体 RLS browser PASS（[`anpi-release-status.md`](anpi-release-status.md)）· **本番 ANPI 利用は JWT 経路が主** |
| **昇格条件** | LINE 本番 Push 有効化 + 管理 URL 露出時 → **BLOCKER 昇格** |

---

## C-4 · Builder `getRole()` URL/LS · actor 未統合

| 項目 | 値 |
|------|-----|
| **新分類** | **BLOCKER** |
| **根拠** | Q2 — 実 DB でも UI 認可破綻 · 30+ ページ未配線 |
| **ブロックするリリース** | Builder MVP **本番当事者フロー**（応募/採用/完了/レビュー） |
| **POST_LAUNCH 化条件** | Builder を **read-only デモ** に限定し URL 非公開 — 現実的でない |

---

## C-5 · Connect UI/DB 分裂

| 項目 | 値 |
|------|-----|
| **新分類** | **MAJOR** |
| **根拠** | Q3 — 利用全停止ではない · 実 payout は NB-6 が先 |
| **ブロックするリリース** | **Connect 本番 onboarding 正規運用** |
| **同時解消** | NB-6 実装時に UI を `TasuConnectState` 一本化すべき |

---

## C-6 · TALK 通話未配線

| 項目 | 値 |
|------|-----|
| **新分類** | **POST_LAUNCH** |
| **根拠** | チャット/通知は別経路で動作 · 通話は **未リリース機能**（[`talk-call-final-release-review.md`](talk-call-final-release-review.md) foreground-only 限定 GO） |
| **BLOCKER にしない理由** | RELEASE FROZEN TALK の **コア（通知/チャット）** は通話なしで成立 |
| **昇格条件** | 通話を **ローンチ必須** と宣言した時点で **MAJOR** |

---

## C-7 · `_headers` microphone 禁止

| 項目 | 値 |
|------|-----|
| **新分類** | **POST_LAUNCH** |
| **根拠** | C-6 に従属 · 通話未配線なら現状影響なし |
| **昇格条件** | C-6 配線時 **MAJOR**（WebRTC 必須） |

---

## C-8 · 市場 checkout モック

| 項目 | 値 |
|------|-----|
| **新分類** | **POST_LAUNCH**（デモ市場スコープ） / **BLOCKER**（GMV スコープ） |
| **根拠** | Q4 — Stripe Live **単独では未解消** · RELEASE FROZEN 意図 |
| **解消に必要** | NB-4 + NB-5 + NH-7 + Path B 配線（Stripe Live はその一部） |

---

## C-9 · 市場 notify `u_me` 固定

| 項目 | 値 |
|------|-----|
| **新分類** | **MAJOR** |
| **根拠** | 購入通知が誤 TALK ユーザーへ · `market-identity.js` 未統合 |
| **BLOCKER にしない理由** | Path A モック購入とセット · **実 GMV 前** はデモ通知 |
| **昇格条件** | Path B 本番決済 + 実 buyer 通知 → **BLOCKER** |

---

## C-10 · SITE_URL / apex 未到達

**監査上 2 要素に分解:**

### C-10a · `tasful.jp` apex 未到達（NB-1D 未適用）

| 項目 | 値 |
|------|-----|
| **新分類** | **BLOCKER** |
| **根拠** | DNS NXDOMAIN · `isProductionHost()` 実機未検証 · Auth Phase A 未開始 |
| **pages.dev** | **BLOCKER 対象外**（NB-1C READY） |

### C-10b · Edge Secret `SITE_URL` 未設定

| 項目 | 値 |
|------|-----|
| **新分類** | **MAJOR** |
| **根拠** | Featured Checkout（`origin` 未送信）· referer 欠落時 `localhost:5173` fallback |
| **pages.dev** | ブラウザ referer で **多くは動作** · Secret なしでも静的パイロット可 |
| **apex 切替時** | **`https://tasful.jp` 投入必須**（[`nb1d-manual-dashboard-apply-checklist.md`](nb1d-manual-dashboard-apply-checklist.md) §4） |
| **GenAI/Shop** | body `origin` あり — SITE_URL は **保険** |

---

# 本番ブロッカー順（実行優先度）

| 順位 | ID | 新分類 | 解消アクション（調査結果 · 実装は別タスク） |
|------|-----|--------|---------------------------------------------|
| 1 | C-10a | BLOCKER | NB-1D: DNS · Pages Custom Domain · apex 200 |
| 2 | C-1 | BLOCKER | `DEV_SKIP_AUTH = false` + 回帰 smoke |
| 3 | C-2 | BLOCKER | commit `auth-ops-guard.js` + ops 5 HTML 配線 |
| 4 | C-4 | BLOCKER | `builder.js` → `TasuBuilderActorIdentity` + HTML 一括 auth |
| 5 | C-10b | MAJOR | `supabase secrets set SITE_URL=https://tasful.jp`（apex 200 後） |
| 6 | C-5 | MAJOR | Connect UI → `TasuConnectState` 一本化（NB-6 と同時が効率的） |
| 7 | C-9 | MAJOR | `shop-market-notify.js` → `TasuMarketIdentity` |
| 8 | C-3 | MAJOR | ANPI admin JWT 化（LINE 本番前） |
| 9 | C-8 | POST_LAUNCH* | NB-4/5/7 + Path B（*GMV 時 BLOCKER） |
| 10 | C-6/C-7 | POST_LAUNCH | talk-call 配線 + mic policy（機能ローンチ時） |

---

# 最短リリース条件

## ティア A — **pages.dev 静的パイロット**（現状到達可能）

| # | 条件 | 状態 |
|---|------|------|
| A-1 | NB-1C deploy Success + smoke PASS | ✅ READY |
| A-2 | スコープ明示: **デモ / DEV_SKIP_AUTH 前提** | ⚠️ 要 Ops 宣言 |
| A-3 | ops URL **非公開** · 通話/GMV **非売り** | 運用ルール |
| **判定** | **限定公開可** — [`p0-final-platform-audit.md`](p0-final-platform-audit.md) NOT_READY は **本番 apex 定義** |

---

## ティア B — **最短 `tasful.jp` 限定公開**（デモ frozen · 実決済なし）

| # | 条件 | 対応 CRITICAL |
|---|------|---------------|
| B-1 | NB-1D 完了 · apex/www 200 · www→apex | C-10a |
| B-2 | Supabase Site URL = `https://tasful.jp` | C-10b（Auth） |
| B-3 | **`DEV_SKIP_AUTH = false`** | C-1 |
| B-4 | **ops 5 ページ auth-ops-guard 配線 + git commit** | C-2 |
| B-5 | Phase A PASS（[`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md)） | C-10 検証 |
| B-6 | スコープ固定: **市場 Path A デモ** · **Connect 実 payout なし** · **通話なし** | C-6/7/8 POST_LAUNCH |
| B-7 | Builder **本番 URL 非公開** または tier B では **未提供** | C-4 回避 |
| **判定** | **READY_WITH_WARNINGS** — Builder/Connect/市場 GMV は未提供 |

---

## ティア C — **本番会員 + TALK/Connect 正規**（Auth Runbook Phase B 前段）

ティア B に加え:

| # | 条件 | 対応 |
|---|------|------|
| C-1 | `auth-current-user.js` 主要 HTML 配線（dashboard · chat-detail · profile） | H-1 |
| C-2 | Builder `getRole()` JWT 統合 + auth HTML 一括 | C-4 |
| C-3 | Connect UI = `TasuConnectState` | C-5 |
| C-4 | `SITE_URL` Secret 投入 | C-10b |
| C-5 | market notify → market-identity | C-9 |
| C-6 | ANPI admin JWT 化 | C-3 |
| C-7 | Auth Phase A–C PASS | Runbook |
| **判定** | **READY**（9 シナリオ Phase B 別途） |

---

## ティア D — **市場 GMV / 実 Connect payout**

ティア C に加え:

| # | 条件 | 対応 |
|---|------|------|
| D-1 | NB-4 Path B 配線 + NB-5 `shop_orders` + NH-7 | C-8 → BLOCKER |
| D-2 | NB-6 Stripe Connect onboarding Edge | C-5 実利用 |
| D-3 | NB-7 Connect webhook ingest | Connect 運用 |
| D-4 | Stripe Live（[`stripe-ready-check.md`](stripe-ready-check.md)） | 決済 |
| **判定** | **フル本番 GMV** |

---

## 総合 triage 判定

| リリース定義 | 判定 |
|--------------|------|
| pages.dev パイロット | **READY_WITH_WARNINGS** |
| tasful.jp デモ限定（Tier B） | **NOT_READY** — C-1 · C-2 · C-10a 未了 |
| tasful.jp 本番会員（Tier C） | **NOT_READY** — BLOCKER 4 + MAJOR 多数 |
| 市場 GMV（Tier D） | **NOT_READY** — C-8 Path B 未配線 · Stripe Live 単独不可 |

---

**ステータス:** P0-CRITICAL-TRIAGE 完了 — **BLOCKER 4 · MAJOR 4 · POST_LAUNCH 2（+C-8 条件付き BLOCKER）**
