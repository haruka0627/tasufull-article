# NB-3 STEP 7: localStorage / URL fallback 全体制限レポート

**作成日:** 2026-06-18  
**前提:** STEP 2〜6 helper（`TasuAuthCurrentUser` / `TasuAuthOpsGuard` / `TasuConnectState` / `TasuMarketIdentity` / `TasuBuilderActorIdentity`）  
**種別:** 本番 host での本人・権限・状態偽装経路の遮断（RLS / DB / Stripe Live / Connect 本番 onboarding **未実施**）

---

# 実装内容

## ① 本番 fallback 禁止ポリシー統一

`TasuAuthCurrentUser.canUseLocalStorageFallback()` を全領域の基準とした。

| 条件 | 本番 `tasful.jp` / `www.tasful.jp` | デモ許可 |
|------|-------------------------------------|----------|
| `isProductionHost()` | **常に true** | false |
| `isDemoMode()` | **常に false**（`?talkDev=1` も無効） | localhost / 127.0.0.1 / file / `?talkDev=1` / `?demo=1` / `?preview=1` / `?benchEmbed=1` / `sessionStorage.tasu_ops_bench_mode` |
| `canUseLocalStorageFallback()` | **常に false** | `isDemoMode()` と同値 |

本番で本人・権限・状態判定に使わないもの（STEP 7 で遮断または helper 経由化）:

- `localStorage` userId / role / admin / ops / seller / buyer / connect ready / builder role / notification owner / order owner
- `sessionStorage` user identity（builder MVP session role）
- URL `role` / `userId` / `sellerId` / `buyerId` / `talkAdmin` / `anpi_admin` / `connectStep` / `demoConnect`
- `u_me` 固定フォールバック
- demo seed / preview flag / bench role による昇格

## ② 例外許可（本番以外）

- localhost / 127.0.0.1 / file://
- `?talkDev=1`（**tasful.jp では無効**）
- 明示的 demo / bench / preview モード
- `TASU_CHAT_SUPABASE_CONFIG.talkDevMode = true`（開発ビルドのみ想定）

## ③ UI 状態 localStorage は維持

filter / sort / tab / theme / viewport / draft / recently viewed / dismissed banner / layout / GenAI 履歴・キャラ保存 / 通知 read キャッシュ等は**変更なし**。本人・権限・決済・Connect・ops 判定には使用禁止を徹底。

## ④ 共通 helper への集約

| 領域 | 基準 API |
|------|----------|
| 本人 | `TasuAuthCurrentUser.getCurrentUser()` |
| 本番判定 | `TasuAuthCurrentUser.isProductionHost()` |
| fallback 可否 | `TasuAuthCurrentUser.canUseLocalStorageFallback()` |
| ops / admin | `TasuAuthOpsGuard.canAccessOps()` |
| Connect | `TasuConnectState.getConnectState()` |
| 市場 buyer/seller | `TasuMarketIdentity.getMarketIdentity()` |
| Builder actor | `TasuBuilderActorIdentity.getBuilderActor()` |
| TALK 表示用 ID | `TasuChatUserIdentity.getEffectiveUserId()`（内部で auth helper 委譲） |

## ⑤ 主要修正（直接 LS / URL / u_me 判定の除去）

| ファイル | 変更概要 |
|----------|----------|
| `talk-runtime.js` | `isTalkDevMode` / `isTalkProductionMode` を auth helper 委譲。`isBuilderUser` の LS/URL 昇格を本番遮断 |
| `member-auth.js` | `shouldDevSkipAuth` 本番で常に false。`isAuthenticatedSync` 本番は JWT のみ（`tasu_member_session` 不可） |
| `anpi-identity.js` | 本番: JWT のみ。LS hint / member_session による本人・家族判定遮断 |
| `anpi-user-context.js` | 本番: LS context が JWT と不一致なら null（未確認扱い） |
| `anpi-line-healthcheck.js` | 本番: `setAnpiLineAdmin` LS 書込禁止（既存 `isAnpiLineAdmin` は ops guard 優先） |
| `anpi-line-admin-page.js` | `anpi_admin=1` は `canUseLocalStorageFallback() === true` のみ |
| `anpi-notify-cards.js` | actor userId: JWT 優先、本番 URL/LS/u_me 遮断 |
| `dashboard-data.js` | `resolveAuthContext` / `getUserId` 本番 LS session 遮断 |
| `my-listings.js` | `resolveUserId` / `isLoggedIn` helper 経由 |
| `talk-notifications-store.js` | 通知 owner: `getEffectiveUserId()` のみ（u_me 除去） |
| `talk-home.js` / `chat-list.js` / `chat-service.js` / `chat-supabase.js` | `getMeId` 系 u_me 除去 |
| `talk-official-rooms.js` / `talk-follow-store.js` | 同上 |
| `sales-fees.js` | URL userId 本番遮断 |
| `shop-payout.js` | `demoConnect` URL 本番遮断 |
| `shop-market-notify.js` | URL userId 厳格化（`=== true`） |
| `listing-contact-requests-store.js` | requesterId u_me 除去 |
| `detail-favorites.js` | 本番: identity helper 優先、URL u_me 遮断 |
| `admin-ai-action-executor.js` | `getExecutedBy` JWT / ops guard 優先 |

## ⑥ 新規検証

`scripts/test-auth-step7-fallback-lockdown.mjs` — 本番シミュレーション一括（u_me / URL role / LS role / talkAdmin / anpi_admin / connect / market / ops）

---

# 追加/変更ファイル

| ファイル | 種別 |
|----------|------|
| `scripts/test-auth-step7-fallback-lockdown.mjs` | 新規 — STEP 7 検証 |
| `reports/auth-step7-localstorage-fallback-lockdown.md` | 新規 — 本レポート |
| `talk-runtime.js` | 変更 |
| `member-auth.js` | 変更 |
| `anpi-identity.js` | 変更 |
| `anpi-user-context.js` | 変更 |
| `anpi-line-healthcheck.js` | 変更 |
| `anpi-line-admin-page.js` | 変更 |
| `anpi-notify-cards.js` | 変更 |
| `dashboard-data.js` | 変更 |
| `my-listings.js` | 変更 |
| `talk-notifications-store.js` | 変更 |
| `talk-home.js` | 変更 |
| `chat-list.js` / `chat-service.js` / `chat-supabase.js` | 変更 |
| `talk-official-rooms.js` / `talk-follow-store.js` | 変更 |
| `sales-fees.js` / `shop-payout.js` / `shop-market-notify.js` | 変更 |
| `listing-contact-requests-store.js` / `detail-favorites.js` | 変更 |
| `admin-ai-action-executor.js` | 変更 |
| `auth-current-user.js` | コメント更新（STEP 7 注記） |

STEP 2〜6 helper 本体のポリシーは既存実装を維持（本レポート時点で回帰なし）。

---

# 本番で禁止した fallback 一覧

| 経路 | 本番の扱い |
|------|------------|
| `localStorage.tasu_member_session` | 本人判定・認証同期に不使用 → login required |
| `localStorage` Supabase auth 以外の userId / role | 不使用 |
| `localStorage.tasu_talk_admin_preview` | ops 昇格不可 → 403 |
| `localStorage.tasu_anpi_line_admin_v1` | 新規書込禁止 · 読取は ops guard のみ |
| `localStorage.tasu_builder_member` | builder 昇格不可 |
| `localStorage.tasful:builder:mvp:role` | actor 昇格不可 |
| `localStorage.tasful_connect_onboarding_v1` | connect ready 不可 → onboarding required |
| `localStorage.tasful_demo_connect_seller_status_v1` | 同上 |
| `localStorage.tasu_market_seller_profile` | seller 偽装不可 |
| `localStorage.tasu_anpi_user_context_v1` | JWT 不一致 context は null（未確認） |
| `localStorage.tasu_anpi_*_hint_*` | 本人・家族 ID 解決に不使用 |
| `sessionStorage.tasful:builder:mvp:session:role` | actor 昇格不可 |
| URL `?userId=` | 無視（警告ログ） |
| URL `?role=` / `?partnerId=` | builder actor 昇格不可 |
| URL `?talkAdmin=1` / `?anpi_admin=1` | ops 昇格不可 → 403 |
| URL `?connectStep=` / `?demoConnect=` | Connect / checkout 状態偽装不可 |
| `u_me` 固定 ID | 本人として信用しない |
| `TASU_CHAT_SUPABASE_CONFIG.currentUserId = u_me` | 本番では `getEffectiveUserId()` が空 |
| `?talkDev=1` on tasful.jp | **無効**（demo 扱いにしない） |

---

# 残存を許可した localStorage 一覧（UI / キャッシュ）

| キー例 | 用途 |
|--------|------|
| `tasful_talk_notifications` / fanout map | 通知キャッシュ · read 状態 |
| `tasu_market_notify_sent_v1` | 重複送信防止（owner 判定には不使用） |
| `tasful:builder:mvp:v1` 等 | Builder **データ** seed（本番 actor は helper が JWT 照合） |
| `tasu_genai_*` / `tasful_last_profile` | UI · 表示キャッシュ |
| theme / tab / filter / draft 各種 | UI 状態 |
| `tasu-supabase-auth` / `sb-*-auth-token` | **正規** JWT セッション（fallback ではない） |

---

# demo / bench / preview 互換条件

| 条件 | 互換 |
|------|------|
| localhost + `?talkDev=1&userId=u_me` | ✅ u_me · LS fallback |
| localhost bench (`benchEmbed=1` / `builderFlow` / `tasu_ops_bench_mode`) | ✅ URL role · dual-window |
| `?talkAdmin=1` on localhost | ✅ ops preview |
| `?anpi_admin=1` on localhost | ✅ LINE admin preview（LS 書込可） |
| `connectStep` / `demoConnect` on localhost | ✅ Connect / platform-chat demo |
| tasful.jp + 上記いずれも | ❌ すべて無効 |

---

# 領域別対応結果

| 領域 | 結果 |
|------|------|
| **TALK** | `getEffectiveUserId` / `getAuthTalkUserIdSync` 本番 JWT のみ。通知 owner は `talk-notifications-store` 修正。bench 関数は bench コンテキスト限定 |
| **Builder** | STEP 6 helper 維持 + `talk-runtime.isBuilderUser` 本番遮断。MVP LS はデータ用のみ |
| **Connect** | STEP 4 helper 維持。`shop-payout` demoConnect URL 本番遮断 |
| **市場** | STEP 5 helper 維持。notify / fees URL 厳格化 |
| **AI Workspace / AI秘書** | GenAI LS は UI のみ。`admin-ai-action-executor` ops 実行者 JWT 化。ops 画面は `TasuAuthOpsGuard` |
| **安否** | `anpi-identity` / `anpi-user-context` 本番 JWT 基準。不一致 LS → null |
| **admin / ops** | ops guard 回帰 PASS。`member-auth` 本番ガード強化 |
| **通知** | recipient は current user helper 基準 |
| **注文 / 完了報告 / レビュー** | platform-chat demo 関数内 u_me はデモ専用コードパス（本番 host では demo モード外） |

---

# 未対応箇所

| 箇所 | 理由 / 後続 |
|------|-------------|
| `tasu_market_order_history` 等の注文 owner LS | STEP 8 以降 · DB owner 照合へ（本番 checkout 未実装のため現状影響限定的） |
| `platform-chat-*.js` 内 `demoConnect` 読取 | デモ専用フロー · 本番 host では `isDemoMode=false` で実質未到達。ステージング host では要運用注意 |
| `chat-data.js` / `index-home.js` 静的 demo seed | デモデータ定義 · 本番判定に未使用 |
| `scripts/anpi-talk-call-bridge.js` 等 Node スクリプトの `u_me` | ローカル E2E 用 · 本番 Edge とは別経路 |
| `anpi-rls.js` `tasu_member_role` LS | UI 補助 · DB `tasu_admin` は JWT（コメント済み） |
| `builder/builder.js` MVP LS データ読込 | 取引データキャッシュ · actor 権限は helper が本番遮断 |
| ステージング host（tasful.jp 以外の HTTPS） | `talkProductionMode` 未設定時は preview 扱いになり得る · デプロイ時 `talkProductionMode: true` 推奨 |

---

# セキュリティ上の残リスク

1. **ステージング host 設定漏れ** — `tasful.jp` 以外で `talkProductionMode` 未設定の場合、非 localhost でも旧 preview 挙動が残る。本番デプロイは hostname + config 両方で本番モードを明示すること。
2. **JWT 改ざん** — クライアント側 fallback 遮断は完了。真の権限は STEP 8 RLS / Edge 検証が必須。
3. **注文 owner LS** — 市場 checkout 本格化時に DB 照合へ移行必須。
4. **platform-chat デモモジュール** — 大量の bench コードが残存。本番 host では到達しない設計だが、誤設定時の防御は config 依存。

---

# 検証結果

| テスト | 結果 |
|--------|------|
| `node scripts/test-auth-current-user.mjs` | **PASS** |
| `node scripts/test-auth-ops-guard.mjs` | **PASS** |
| `node scripts/test-connect-state.mjs` | **PASS** |
| `node scripts/test-market-identity.mjs` | **PASS** |
| `node scripts/test-builder-actor-identity.mjs` | **PASS** |
| `node scripts/test-builder-thread-completion-approval-flow.mjs` | **PASS** |
| `node scripts/test-auth-step7-fallback-lockdown.mjs` | **PASS** |
| `node scripts/verify-builder-general-flow-final.mjs` | **未実行**（長時間 E2E · 単独実行推奨） |

### STEP 7 チェックリスト（本番シミュレーション）

| # | 項目 | 結果 |
|---|------|------|
| 1 | u_me 無効 | ✅ |
| 2 | URL role 無効 | ✅ |
| 3 | LS role 無効 | ✅ |
| 4 | talkAdmin / anpi_admin 無効 | ✅ |
| 5 | LS connect ready 無効 | ✅ |
| 6 | LS buyer/seller 無効 | ✅ |
| 7 | Builder role 昇格無効 | ✅ |
| 8 | localhost demo 互換 | ✅ |
| 9 | localhost bench 互換（既存 STEP 6 テスト） | ✅ |
| 10 | `?talkDev=1` 互換 | ✅ |
| 11 | ops guard 回帰 | ✅ |
| 12 | Connect state 回帰 | ✅ |
| 13 | Market identity 回帰 | ✅ |
| 14 | Builder actor 回帰 | ✅ |

---

# STEP7判定

## **PASS**

- 本番 host（`talkProductionMode` / `tasful.jp`）で URL / LS / u_me / demo による権限昇格が不可
- 主要領域が helper 経由に集約
- UI 状態用 localStorage は維持
- localhost / demo / bench 互換は維持
- **STEP 8 RLS 再検証へ進行可能**

---

*次ステップ: RLS 最終検証 · ステージング `talkProductionMode` デプロイ確認 · 市場注文 owner DB 化（checkout 本格化時）*
