# 本番前 P1/P2/P3 残件棚卸し

**作成日:** 2026-06-17  
**種別:** 調査のみ（**コード / UI 変更なし**）  
**前提:** P0 完了済み · RELEASE FROZEN 6 領域維持 · 新機能追加禁止

**根拠レポート:**  
[`supabase-rls-p0-fix.md`](supabase-rls-p0-fix.md) · [`supabase-jwt-auth-final-check.md`](supabase-jwt-auth-final-check.md) · [`stripe-webhook-p0-w1-delivery-check.md`](stripe-webhook-p0-w1-delivery-check.md) · [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) · [`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md) · 各 `*-final-audit-remaining-issues.md` / `*-release-status.md`

---

## エグゼクティブサマリー

| 項目 | 判定 |
|------|------|
| **P0** | ✅ 完了（RLS dev DROP / JWT 更新 / Stripe Webhook Test P0-W1） |
| **凍結 6 領域の利用者導線** | ✅ RELEASE FROZEN — 導線監査 PASS |
| **残 P1（全体）** | **~18 件**（Supabase marketplace RLS / Stripe Live / Auth運用 / 未デプロイ Functions） |
| **残 P2** | **~80 件**（接続強化・監査・UX・mock 整理） |
| **本番投入（現状）** | ⚠️ **条件付き可** — デモ/localStorage 主体の 6 領域は可。**PII 公開 RLS・Live 決済・本番 Auth 統合**は P1 残 |

---

## 0. P0 完了確認（棚卸し起点）

| ID | 内容 | 状態 | 根拠 |
|----|------|------|------|
| P0-RLS | TALK / 安否 Phase2 dev ポリシー DROP | ✅ | `supabase-rls-p0-fix.md` |
| P0-JWT | ANPI RLS JWT 再発行 + 17/17 PASS | ✅ | `supabase-jwt-auth-final-check.md` |
| P0-W1 | Stripe Webhook Test 配線 + DB 反映 | ✅ | `stripe-webhook-p0-w1-delivery-check.md` |
| P0-W2 | Stripe **Live** 切替 | ⏳ **未** | 本棚卸し P1-ST1 |

---

## 1. 発見事項一覧（ドメイン横断）

### 1.1 Supabase テーブル（リンク DB 実態）

| 区分 | 件数 | 状態 |
|------|------|------|
| RLS 有効テーブル | **37** | 全 public ユーザテーブル |
| **P0 対象 6 テーブル** | 6 | ✅ dev 削除済・検証 PASS |
| **marketplace / PII 系** | 4+ | ⚠️ anon 読取可（実測 2026-06-17） |
| **legacy chat 系** | 8+ | ⚠️ `Allow all public` 残存 |
| **GenAI 系** | 5+ | ✅ deny all / service_role 経由 |
| **talk_call_*** | 2 | ✅ prod RLS のみ |
| **未デプロイ** | `shop_orders`, Builder コア等 | REST 404 |

### 1.2 Edge Functions（リポジトリ 25 / デプロイ ~20）

| 状態 | 関数例 |
|------|--------|
| **デプロイ済 ACTIVE** | `stripe-*`, `gemini-*`, `openai-chat`, `claude-chat`, `genai-3d-generate`, `serper-search`, `tasful-chat` |
| **リポジトリのみ（未デプロイ）** | `anpi-line-send`, `anpi-line-token-exchange`, `builder-create-signed-url`, `stripe-create-shop-checkout`, `stripe-confirm-shop-checkout`, `neural4d-vrm-proxy` |
| **本番リスク（Test/E2E 用）** | `stripe-e2e-simulate-*`, `stripe-e2e-pay-genai-checkout`, `stripe-setup-genai-catalog` |
| **JWT 厳格** | `builder-create-signed-url`（未デプロイ） |
| **anon  callable（設計）** | 大半の AI / Stripe create / get-plan |

### 1.3 認証モデル（現状）

| レイヤ | 実態 |
|--------|------|
| 本番 End-user Auth | **未統合** — デモ `userId` / `currentUserId` / localStorage 主体 |
| RLS 検証 Auth | `@tasful-dev.test` テストユーザー + JWT クレーム |
| GenAI 課金 | Stripe + Edge（**user JWT 未突合**） |
| Connect | ブラウザ seed + `stripe-connect-ingest.js` sim |

---

## 2. P1 一覧（本番前にできればやる）

### 2.1 Supabase RLS / テーブル（重点候補）

| ID | 対象 | 内容 | 実測 / 根拠 | 工数 | FROZEN |
|----|------|------|-------------|------|--------|
| **P1-S1** | `listings` | dev SELECT/CRUD 全許可 → anon **5 行読取** | `supabase-jwt-auth-final-check.md` | **0.5〜1d** | SQL のみ ✅ |
| **P1-S2** | `business_listings` | 同上 **5 行** | 同上 | **0.5d** | SQL のみ ✅ |
| **P1-S3** | `profiles` | dev SELECT 全許可 → anon **4 行（PII）** | 同上 | **0.5d** | SQL のみ ✅ |
| **P1-S4** | `members` | 同上 **4 行** | 同上 | **0.5d** | SQL のみ ✅ |
| **P1-S5** | `transaction_*` | `Allow all public` — 取引チャット全公開 | `supabase-rls-final-audit.md` H-2 | **1〜2d** | SQL のみ ✅ |
| **P1-S6** | `favorites` | public 全 CRUD | H-4 | **0.5〜1d** | SQL のみ ✅ |
| **P1-S7** | `ai_messages` / `chats` / `reviews` 等 | Allow all public | M-1 | **1〜2d** | SQL のみ ✅ |
| **P1-S8** | Realtime publication | `favorites` / `transaction_*` 過剰公開の可能性 | M-3 | **0.5d** | SQL のみ ✅ |
| **P1-S9** | `gen_ai_subscriptions` | deny all — **問題なし** | ✅ 監視のみ | — | — |
| **P1-S10** | `gen_ai_entitlements` | explicit deny — **問題なし** | ✅ | — | — |
| **P1-S11** | `shop_orders` | テーブル未デプロイ | REST 404 | **1d** | SQL + Functions ⚠️ |
| **P1-S12** | SQL リポジトリ | `talk-sync-schema.sql` 等に **dev ポリシー CREATE 残存** — 再適用事故リスク | 静的調査 | **0.5d** | ドキュメント/SQL整理 |

**P1-S1〜S4 推奨:** オーナー scoped prod ポリシー設計 → dev DROP（[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) P1-1 案）。**アプリ変更不要。**

### 2.2 Auth / JWT

| ID | 内容 | 根拠 | 工数 | FROZEN |
|----|------|------|------|--------|
| **P1-A1** | GenAI Edge `user_id` と Authorization JWT 突合未実装 | `stripe-confirm-genai-checkout`, `stripe-get-genai-plan` | **1d** | ⚠️ コード |
| **P1-A2** | RLS 検証 JWT **~1h 失効** — CI / 手動で再発行必要 | `issue-anpi-rls-jwt.mjs` | **0.5d** | 運用 ✅ |
| **P1-A3** | `chat-supabase-config.js` `currentUserId: "u_me"` 固定 | クライアント mock | **0.5〜1d** | ⚠️ コード |
| **P1-A4** | End-user Supabase Auth ログイン未接続 | cross-audit §認証 | **Epic 3〜5d** | 大規模 → **P2 昇格可** |

### 2.3 Stripe

| ID | 内容 | 根拠 | 工数 | FROZEN |
|----|------|------|------|--------|
| **P1-ST1** | **Live 切替** — `sk_live_`, Live `whsec_`, Live Price IDs | `stripe-webhook-p0-w1` P0-W2 | **0.5〜1d** | 運用 ✅ |
| **P1-ST2** | `SITE_URL` 本番ドメイン未確定 / secret 未設定 | STRIPE_FEATURED_SETUP | **0.25d** | 運用 ✅ |
| **P1-ST3** | Test E2E Functions 本番残存 | `stripe-e2e-*`, `stripe-setup-genai-catalog` | **0.5d** | 運用/設定 ✅ |
| **P1-ST4** | `stripe-confirm-service-fee` **未実装**（config のみ参照） | 静的調査 | **1d** | コード ⚠️ |
| **P1-ST5** | 市場EC shop Checkout Functions **未デプロイ** | functions list | **1d** | Functions ⚠️ |

**Connect / 市場 KPI Webhook:** スコープ外（P2）。GenAI + Featured Test Webhook は ✅。

### 2.4 TALK

| ID | 内容 | 根拠 | 工数 | FROZEN |
|----|------|------|------|--------|
| **P1-T1** | `talkDev=1` URL パラメータがベンチ / デバッグ導線に残存 | `platform-chat-*.js` | **0.5d** | 監査整理 ✅ |
| **P1-T2** | やりとり一覧 `tab=chat` 専用 PASS なし | `talk-final-audit` P1 | **1d** | 監査 ⚠️ |

**TALK 通知 RLS / JWT:** ✅ P0 済。本番導線 PASS。

### 2.5 Builder / Connect / 市場EC / 安否 / AI運営 / AI音声

| ID | 領域 | 内容 | 分類 | 工数 |
|----|------|------|------|------|
| **P1-B1** | Builder | `demo-builder-user` / `thread-demo-*` seed 残存 | P2 昇格可 | — |
| **P1-C1** | Connect | サーバー Connect Webhook 未実装（sim のみ） | **P2** | 2〜3d |
| **P1-M1** | 市場EC | `shop_orders` Supabase 未配線（localStorage デモ） | P1-ST5 と一体 | 1〜2d |
| **P1-AN1** | 安否 | `anpi-line-*` Edge **未デプロイ**（LINE 本番送信） | **P1**（LINE 本番時） | 1d |
| **P1-AI1** | AI運営 | Inbox 100+/500+ volume UX FAIL | **P2** | 2d |
| **P1-V1** | AI音声 | Web Speech API のみ・ブラウザ差異・Premium 未実装 | **P3** Epic | 5d+ |

---

## 3. P2 一覧（本番後でも可）

### 3.1 接続・バックエンド

| ID | 内容 | 出典 |
|----|------|------|
| P2-CONN-1 | TALK `chat_started` / block → AI運営 KPI | cross-audit P2-3/4 |
| P2-CONN-2 | 市場 注文/キャンセル/返金 → Inbox | P2-5 |
| P2-CONN-3 | `tasu_shop_orders` KPI 本番反映 | ai-ops P2 |
| P2-CONN-4 | Connect payout Webhook + seller status 統合 | connect P2-8 |
| P2-CONN-5 | サーバー側承認 API（localStorage 脱却） | P2-9 |
| P2-CONN-6 | JWT ロール + Connect/安否 状態サーバー検証 | P2-10 |

### 3.2 凍結領域 — UX / 監査

| ID | 領域 | 内容 |
|----|------|------|
| P2-TALK-1 | TALK | 通知 URL 正規化・インライン composer |
| P2-TALK-2 | TALK | カレンダー通知専用 E2E 未実施 |
| P2-TALK-3 | TALK | マルチ端末 Supabase 同期 |
| P2-BLD-1 | Builder | 2窓ベンチ headless 不安定 |
| P2-CON-1 | Connect | 承認後 requirement 通知 seed 整理 |
| P2-CON-2 | Connect | payment-settings 戻る導線 |
| P2-CON-3 | Connect | vendor/builder/market ベンチ timeout |
| P2-MKT-1 | 市場EC | PC CTA 42px / カードリンク WARNING |
| P2-AN-1 | 安否 | register E2E セレクタ不一致 |
| P2-AN-2 | 安否 | TALK/AI E2E headless timeout |
| P2-AI-1 | AI運営 | Phase9 スクロール 2835px |
| P2-AI-2 | AI運営 | virtual scroll 100+/500+ |
| P2-UI-1 | 横断 | CTA Builder 応募 FAIL（監査） |
| P2-DEV-1 | 横断 | `dev-server-url.mjs` port 8765 統一 |

### 3.3 Supabase / Stripe 運用

| ID | 内容 |
|----|------|
| P2-SUP-1 | Builder コアテーブルデプロイ時 `builder-rls-policies.sql` |
| P2-SUP-2 | `moderation_logs` / `reports` anon INSERT → Edge 経由化 |
| P2-SUP-3 | ops テーブル Realtime 要否整理 |
| P2-ST-1 | Connect / shop Webhook 拡張 |
| P2-ST-2 | `stripe_webhook_events` 冪等ログ表 |

---

## 4. P3 一覧（将来）

| ID | 内容 | 備考 |
|----|------|------|
| P3-1 | **AI音声 Phase1 Epic** — 声カタログ / Premium / TTS API | [`ai-voice-selection-phase1-design.md`](ai-voice-selection-phase1-design.md) |
| P3-2 | 通知読み上げ / 安否音声案内 | 未実装 |
| P3-3 | ElevenLabs / Gemini TTS 接続 | 調査メモのみ |
| P3-4 | Builder Supabase コア移行（projects / threads） | テーブル未作成 |
| P3-5 | 本番 End-user Auth 全面統合 + マルチ端末 | Epic |
| P3-6 | anon key `sb_publishable_` 形式移行 | Dashboard 次第 |
| P3-7 | AI運営秘書 音声返答 | FROZEN 外 Epic |
| P3-8 | 市場EC 完全サーバー注文（Connect payout 含む） | shop + Webhook |

---

## 5. 確認項目マトリクス（ユーザー指定 8 テーブル）

| テーブル | RLS | anon | authenticated | JWT 整合 | 分類 |
|----------|-----|------|---------------|----------|------|
| `profiles` | ✅ | **READ 可** | 同上 | N/A（dev 全許可） | **P1-S3** |
| `members` | ✅ | **READ 可** | 同上 | N/A | **P1-S4** |
| `listings` | ✅ | **READ 可** | CRUD 可（dev） | N/A | **P1-S1** |
| `business_listings` | ✅ | **READ 可** | 同上 | N/A | **P1-S2** |
| `transaction_*` | ✅ | **全操作可** | 同上 | N/A | **P1-S5** |
| `favorites` | ✅ | **全操作可** | 同上 | N/A | **P1-S6** |
| `gen_ai_subscriptions` | ✅ | **deny（0 行）** | deny | Edge only | ✅ OK |
| `gen_ai_entitlements` | ✅ | **deny（0 行）** | deny | Edge only | ✅ OK |

---

## 6. ドメイン別サマリー

| ドメイン | P1 | P2 | 本番導線 | DB/Auth |
|----------|----|----|----------|---------|
| **TALK** | T1,T2 | 多数 | ✅ FROZEN PASS | ✅ RLS/JWT |
| **Builder** | — | B1, ベンチ | ✅ FROZEN PASS | localStorage |
| **Connect** | — | Webhook 等 | ✅ FROZEN PASS | sim |
| **市場EC** | ST5,M1,S1-S2 | UX | ✅ FROZEN PASS | shop 未配線 |
| **AI運営秘書** | — | volume UX | ✅ FROZEN PASS | localStorage |
| **安否** | AN1 | E2E timeout | ✅ FROZEN PASS | ✅ RLS/JWT |
| **AI音声** | — | — | N/A（WS API のみ） | P3 Epic |
| **Stripe** | ST1-ST4 | Connect WH | Test ✅ | Edge OK |

---

## 7. 推定工数（P1 合計）

| バンドル | 内容 | 工数 | FROZEN |
|----------|------|------|--------|
| **A. Marketplace RLS** | P1-S1〜S4 + 検証 | **2〜3 人日** | SQL のみ ✅ |
| **B. Legacy chat RLS** | P1-S5〜S7 | **2〜4 人日** | SQL のみ ✅ |
| **C. Stripe Live 運用** | P1-ST1〜ST3 | **1〜2 人日** | 運用 ✅ |
| **D. Shop / LINE 配線** | P1-ST5, S11, AN1 | **2〜3 人日** | Functions ⚠️ |
| **E. Auth 強化** | P1-A1, A3 | **1.5〜2 人日** | コード ⚠️ |
| **F. CI / 運用** | P1-A2, S12, T1 | **1 人日** | ✅ |

**P1 全体（並行なし）:** おおよそ **9〜15 人日**  
**FROZEN 非抵触のみ（A+C+F）:** **4〜6 人日** でセキュリティ・決済運用の大半をカバー

---

## 8. RELEASE FROZEN 影響

| 作業 | FROZEN 抵触 | 備考 |
|------|-------------|------|
| Supabase dev policy DROP + prod 適用 | **非抵触** | 推奨 P1 |
| Stripe Secrets / Live 切替 / E2E Function 無効化 | **非抵触** | 運用 |
| JWT 再発行・CI secrets | **非抵触** | 運用 |
| GenAI Edge JWT 突合 | **抵触** | 解凍 or 例外承認 |
| `currentUserId` mock 除去 | **抵触** | Auth Epic |
| UI 変更（CTA 等） | **抵触** | P2 |
| 新 Epic（AI音声 / Auth 全面） | **抵触** | P3 |

---

## 9. 本番投入への影響

| 観点 | 影響 |
|------|------|
| **6 領域デモリリース** | ✅ **投入可** — 凍結判定維持 |
| **TALK / 安否 / Call / GenAI RLS** | ✅ P0/P1（重点）クリア |
| **Marketplace PII 漏えいリスク** | ❌ **P1-S1〜S4 未対応なら本番 DB 公開非推奨** |
| **Live 決済** | ❌ **P1-ST1 完了まで不可** |
| **LINE 安否本番送信** | ⚠️ `anpi-line-*` デプロイ + secrets 要 |
| **市場EC Supabase 注文** | ⚠️ 現状 localStorage デモ — 本番 EC DB は P1 |

---

## 10. 推奨順序

```text
Phase 1（今すぐ・FROZEN 非抵触）
  1. P1-A2  JWT CI / 手順書固定化
  2. P1-S1〜S4  marketplace dev RLS DROP + prod 適用
  3. P1-ST2  SITE_URL 本番 secret
  4. P1-ST3  E2E Stripe Functions 本番無効化方針

Phase 2（本番直前・運用）
  5. P1-ST1  Stripe Live 切替 + Webhook Live endpoint
  6. P1-S5〜S7  transaction / favorites / chats RLS（時間があれば）
  7. P1-S8  Realtime publication 見直し

Phase 3（本番後 or 解凍後）
  8. P1-A1 / A3  GenAI JWT + mock user
  9. P1-ST5 / S11 / AN1  shop + LINE Functions
  10. P2 接続 Epic（Webhook Connect / KPI / Auth 統合）
  11. P3 AI音声 / Builder DB / 全面 Auth
```

---

## 11. 最終回答

### 1. 今すぐやるべき P1

| 優先 | ID | 理由 |
|------|-----|------|
| 1 | **P1-S1〜S4** | anon から listings / profiles **実データ読取** — 唯一のセキュリティ P1 |
| 2 | **P1-A2** | JWT 失効で CI/検証が再び赤くなる — 運用固定化 |
| 3 | **P1-ST2, ST3** | 本番 URL / Test-only Functions 整理 |
| 4 | **P1-S12** | SQL 再適用で dev ポリシー復活事故を防止 |

### 2. 本番直前でよい P1

| ID | 理由 |
|----|------|
| **P1-ST1** | Live 決済開始の直前で十分（Test は ✅） |
| **P1-S5〜S8** | legacy chat 系 — 現行プロダクト主経路外だが DB 公開は残る |
| **P1-ST5 / S11** | 市場EC を Supabase 注文に載せる場合のみ |
| **P1-AN1** | LINE 本番送信を有効にする場合のみ |
| **P1-T2** | 監査スクリプト更新 — 導線本体は PASS |

### 3. 本番後でよい P2 / P3

- **P2:** Connect Webhook、KPI パイプライン、mock/talkDev 整理、ベンチ timeout、AI運営 volume UX、CTA 監査 WARNING
- **P3:** AI音声 Epic、全面 Auth、Builder DB 移行、Connect 完全自動化

### 4. 現時点での本番投入可否

| スコープ | 可否 |
|----------|------|
| **RELEASE FROZEN 6 領域（デモ / localStorage 利用者導線）** | ✅ **可** |
| **TALK / 安否 / Call / GenAI（Supabase RLS + JWT）** | ✅ **可** |
| **Stripe GenAI + Featured（Test mode）** | ✅ **可** |
| **Marketplace データを Supabase に載せる本番** | ❌ **P1-S1〜S4 まで非推奨** |
| **Live 決済** | ❌ **P1-ST1 まで不可** |
| **LINE 安否本番送信** | ⚠️ **P1-AN1 まで不可** |

**総合:** プロダクトデモ / 凍結スコープの **ソフトローンチは可能**。**PII を含む DB 公開・Live 課金・LINE 本番**は P1 残完了後。

---

**検証実施:** 既存レポート統合 + `verify-*-rls-*.mjs` 再実行（2026-06-17）+ `supabase functions list` + 静的 grep  
**コード変更:** なし
