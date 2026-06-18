# TASFUL Release Readiness Overview（全体リリース準備監査）

**実施日:** 2026-06-17  
**種別:** 監査のみ（**コード変更なし / SQL 変更なし / UI 変更なし**）  
**根拠:** 既存レポート・release-status・Final Review・検証スクリプト結果・Phase7.2 プローブ

**credential 記載:** なし（本レポートに VAPID / TURN / Stripe 秘密鍵は含めない）

---

## 総合判定: **WARNING**

| 観点 | 判定 |
|------|------|
| **限定公開（デモ / パイロット）** | **可** — 6 領域 RELEASE FROZEN · 主要 E2E PASS |
| **フル本番公開** | **不可** — インフラ接続・RLS dev 残存・Push/TURN 未接続 |
| **製品 P0 / P1（凍結 6 領域）** | **なし** — 各 `*-release-status.md` 確定 |
| **本番接続 P0（インフラ / 運用）** | **あり** — 下記 BLOCKER 参照 |

---

## 最終サマリー表

| カテゴリ | 状態 | 判定 | 本番ブロッカー数 |
|----------|------|------|------------------|
| **TALK（コア）** | 完了 | PASS | 0 |
| **TALK（通話 Phase1〜7.1）** | 限定公開可 | WARNING | 3 |
| **Marketplace** | 完了 | WARNING | 1 |
| **Connect** | 完了 | PASS | 0 |
| **Builder** | 完了 | PASS | 0 |
| **安否** | 完了 | WARNING | 1 |
| **決済（Stripe）** | 開発中 | WARNING | 2 |
| **AI Workspace** | 完了 | PASS | 0 |
| **AI運営秘書** | 完了 | WARNING | 0 |
| **共通基盤** | 開発中 | FAIL | 2 |

**BLOCKER 合計（重複除く横断）: 5 件**（詳細は §9）

---

## 1. 各カテゴリ状態整理

### 凡例

| 分類 | 意味 |
|------|------|
| **完了** | RELEASE FROZEN または Final Review PASS。デモ / 限定公開の導線が検証済 |
| **限定公開可** | コアは動作。本番接続・実機・NAT 等に未完了あり |
| **本番前必須** | フル本番前にインフラ / 接続作業が必要（製品修正不要のもの含む） |
| **将来対応** | P2 バックログ。リリース後改善 |

---

### TALK

| 観点 | 分類 | 根拠 |
|------|------|------|
| **機能（通知・チャット・Builder 連携）** | 完了 | [`talk-release-status.md`](talk-release-status.md) RELEASE FROZEN · `review-talk-user-flow.mjs` PASS |
| **機能（1:1 音声通話 foreground）** | 限定公開可 | Phase1〜4 E2E PASS · [`talk-call-final-release-review.md`](talk-call-final-release-review.md) |
| **機能（背景 Web Push 通話）** | 本番前必須 | Phase7.1 コード PASS · Edge 404 · migration 7.1 未適用 · VAPID 未投入 |
| **セキュリティ（Push payload）** | 完了 | Phase7.1 テスト PASS · credential 漏洩なし |
| **RLS（通話）** | 完了 | `talk_call_*` prod RLS のみ（[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md)） |
| **E2E（コア）** | 完了 | notify 9 種 · chat-detail · 完了報告 PASS |
| **E2E（通話）** | 限定公開可 | `SUPABASE_STRICT=1` Phase1〜7.1 回帰 PASS（2026-06-17） |
| **UI** | 完了 | RELEASE FROZEN · P2 のみ |
| **本番接続（Push）** | 本番前必須 | Edge 未 deploy · Phase7.1 DB 未 migration |
| **外部依存（TURN）** | 本番前必須 | STUN のみ · relay 未検証 |
| **実機** | 将来対応 | Web Push 実機 E2E **未確認**（Phase7.2 記録） |

**TALK 通話 詳細（Phase7.2 反映）**

| 項目 | 状態 |
|------|------|
| Phase1〜7.1 コード | ✅ 完了 |
| foreground 通話（通知センター着信） | ✅ 限定公開可 · E2E PASS |
| Push 通話（背景） | ❌ 本番前必須 · Edge 404 / migration 未適用 |
| TURN | ⚠️ STUN のみ · 厳格 NAT 未検証 |
| 通知センター着信 | ✅ PASS |
| 通話履歴 | ✅ PASS |
| 実機（Chrome / Android / iPhone Push） | ⬜ 未確認 |

---

### Marketplace

| 観点 | 分類 | 根拠 |
|------|------|------|
| **機能（公開閲覧・owner CRUD）** | 完了 | [`market-ec-release-status.md`](market-ec-release-status.md) RELEASE FROZEN |
| **セキュリティ** | 限定公開可 | [`marketplace-rls-final-lock-review.md`](marketplace-rls-final-lock-review.md) WARNING · 漏洩経路なし |
| **RLS P1〜P3** | 完了 | `verify-marketplace-rls.mjs` **38/38 PASS** |
| **Final Lock Review** | 限定公開可 | 総合 WARNING · FAIL 0 |
| **users/profile review** | 限定公開可 | [`users-profile-public-exposure-review.md`](users-profile-public-exposure-review.md) WARNING · FAIL 0 |
| **決済導線（payment_url）** | 完了 | owner RLS · safe view 分離 PASS |
| **公開閲覧** | 完了 | safe view 第一選択 · 行動検証 PASS |
| **E2E** | 完了 | `review-market-user-flow.mjs` PASS |
| **本番接続** | 本番前必須 | 横断 dev RLS 残存時は Marketplace も影響（§共通基盤） |

---

### Connect

| 観点 | 分類 | 根拠 |
|------|------|------|
| **本人確認 / 資格 / 申請 / 承認 / 差し戻し** | 完了 | [`connect-release-status.md`](connect-release-status.md) 36 PASS / 0 FAIL |
| **Connect 認証・バッジ** | 完了 | onboarding step · badge PASS |
| **通知** | 完了 | 4 種 × 390/1280 PASS |
| **購入 / 受取導線** | 完了 | payment-settings · seller confirm PASS |
| **Stripe 障害ハードニング** | 完了 | 13/13 PASS |
| **本番 Webhook** | 本番前必須 | ingest は sim · 実 Connect payout イベント未配線（§決済） |
| **E2E** | 完了 | `review-connect-user-flow.mjs` PASS |

---

### Builder

| 観点 | 分類 | 根拠 |
|------|------|------|
| **MVP / board 案件** | 完了 | [`builder-release-status.md`](builder-release-status.md) 44/0/0 PASS |
| **カレンダー / partner-assignment** | 完了 | ops 通知 → partner-assignment PASS |
| **通知** | 完了 | 7/7 ops routing PASS |
| **完了報告** | 完了 | `#completion` 承認/差し戻し PASS |
| **ベンチ** | 将来対応 | 2 窓ベンチ headless 不安定 → P2 |
| **残件** | 将来対応 | P2 一覧 [`builder-final-audit-remaining-issues.md`](builder-final-audit-remaining-issues.md) |

---

### 安否

| 観点 | 分類 | 根拠 |
|------|------|------|
| **通知 / 応答 / ダッシュボード** | 完了 | 通知 26/26 · Identity 34/34 PASS |
| **未応答フロー Phase2** | 完了 | [`anpi-no-response-phase2-implementation.md`](anpi-no-response-phase2-implementation.md) LOCK 可 · E2E PASS |
| **家族通知（TALK 連携）** | 完了 | Phase2 実装 · bridge 経由 |
| **LINE 運用 / 安全化** | 完了 | 26/26 · 24/24 PASS |
| **Phase2 候補（将来）** | 将来対応 | エスカレーション E2E 専用 · 本番 LINE 到達性 P2 |
| **RLS 実 DB** | 本番前必須 | `verify-anpi-rls-real-db.mjs` 9/18（JWT expired）· Phase2 dev+prod 併存 |
| **E2E** | 限定公開可 | dashboard 37/38 · LINE send 38/40 WARNING |

---

### 決済

| 観点 | 分類 | 根拠 |
|------|------|------|
| **Stripe Webhook（GenAI / featured）** | 限定公開可 | [`stripe-webhook-final-check.md`](stripe-webhook-final-check.md) · Edge ACTIVE · Dashboard 配線 **未確認** |
| **payment_url（Marketplace）** | 完了 | owner RLS · Final Lock PASS |
| **Connect 決済** | 限定公開可 | デモ sim PASS · 実 Webhook 未配線 |
| **Marketplace shop checkout** | 本番前必須 | `stripe-create-shop-checkout` / confirm **未デプロイ** |
| **product/shop 購入フロー** | 完了 | [`product-shop-payment-final-verify/final-summary.md`](product-shop-payment-final-verify/final-summary.md) 6/6 business OK |
| **TALK 関連決済** | 完了 | 通話機能に Stripe 依存なし |

---

### AI Workspace

| 観点 | 分類 | 根拠 |
|------|------|------|
| **AI チャット（比較支援 4 カテゴリ）** | 完了 | [`ai-workspace-category-flow-audit.md`](ai-workspace-category-flow-audit.md) 29 OK / 0 NG |
| **TALK 下書き連携** | 完了 | [`ai-workspace-inquiry-to-talk.md`](ai-workspace-inquiry-to-talk.md) |
| **内検索連携** | 完了 | [`ai-workspace-search-integration.md`](ai-workspace-search-integration.md) PASS |
| **RELEASE FROZEN 文書** | — | **なし**（監査レポートのみ） |
| **本番 API** | 限定公開可 | [`ai-real-api-verification.md`](ai-real-api-verification.md) 参照 |

---

### AI運営秘書

| 観点 | 分類 | 根拠 |
|------|------|------|
| **AI 運営（Phase1〜12）** | 完了 | [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) RELEASE FROZEN |
| **通知 / Inbox / Ops Watch** | 完了 | 司令塔 43/43 · Support 14/14 PASS |
| **学習（Outcome / Decision）** | 完了 | 本番接続レビュー PASS |
| **運営導線** | 完了 | Support / Connect / 安否 / Builder → Inbox PASS |
| **本番イベント未配線** | 将来対応 | TALK bus · 市場 KPI · 実 Stripe → P2 |
| **大量件数 UX** | 将来対応 | volume FAIL → P2 |

---

### 共通基盤（認証・RLS・通知・プロフィール）

| 観点 | 分類 | 根拠 |
|------|------|------|
| **認証（デモ）** | 完了 | talkDev / userId / 安否 member_id 解決 PASS |
| **認証（本番 JWT）** | 本番前必須 | 横断監査 WARNING · JWT expired · サーバー側未統合 P2 |
| **RLS（Marketplace P1〜P3）** | 完了 | 38/38 PASS |
| **RLS（横断 dev ポリシー）** | 本番前必須 | [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) **投入不可** |
| **プロフィール公開** | 限定公開可 | users-profile review WARNING · PII 漏洩 FAIL 0 |
| **通知横断** | 完了 | 6 領域 通知→遷移 PASS |
| **Supabase JWT 最終確認** | 限定公開可 | [`supabase-jwt-auth-final-check.md`](supabase-jwt-auth-final-check.md) |

---

## 2. TALK 判定（Phase7.2 反映）

| サブ領域 | 判定 | 説明 |
|----------|------|------|
| TALK コア（chat / notify / Builder 連携） | **完了 / PASS** | RELEASE FROZEN 2026-06-16 |
| 通話 foreground（Phase1〜4） | **限定公開可 / WARNING** | E2E PASS · STUN-only |
| 通話 Push 背景（Phase7.1） | **本番前必須 / FAIL** | Edge 404 · migration 未適用 |
| TURN 厳格 NAT | **本番前必須** | env 未設定 |

---

## 3. Marketplace 判定（RLS Final Lock 反映）

| 項目 | 判定 |
|------|------|
| P1 RLS | ✅ 適用 · 21/21 PASS |
| P2 safe view | ✅ 9/9 PASS |
| P3 owner-only | ✅ 適用 |
| Final Lock Review | **WARNING**（FAIL 0 · W-PUB-1/2 · W-OWN-1） |
| users/profile review | **WARNING**（FAIL 0 · `users` 直読 · `review_scores` RLS 未整備） |
| 決済導線 | ✅ owner payment_url RLS PASS |
| 公開閲覧 | ✅ safe view 経由 PASS |

---

## 4. Connect 判定

| 項目 | 状態 |
|------|------|
| 本人確認 → qualification | ✅ PASS |
| Connect 認証 / onboarding | ✅ PASS |
| 通知 4 種 | ✅ PASS |
| 購入 / 受取（payment-settings） | ✅ PASS |
| 実 Stripe Connect Webhook | ⬜ 本番前必須（sim のみ） |

**判定: 完了 / PASS**（フロント導線）。本番 Stripe 配線は §決済 BLOCKER。

---

## 5. Builder 判定

| 項目 | 状態 |
|------|------|
| MVP / board / general flow | ✅ PASS (78/78) |
| カレンダー / partner-assignment | ✅ PASS |
| 通知 routing | ✅ PASS (7/7) |
| 完了報告 | ✅ PASS |
| 2 窓ベンチ | ⚠️ P2（headless 不安定） |

**判定: 完了 / PASS**

---

## 6. 安否 判定

| 項目 | 状態 |
|------|------|
| 通知センター | ✅ 26/26 |
| 応答 / ダッシュボード | ✅ 37/38（PC クイック 1 WARNING） |
| 未応答 Phase2 | ✅ LOCK 可 · DB 適用済 |
| 家族 TALK 通知 | ✅ 実装済 |
| LINE send / fallback | ⚠️ 38/40 · 34/38 WARNING |
| 実 DB RLS JWT | ❌ 9/18 FAIL |

**判定: 完了 / WARNING**

---

## 7. 決済 判定

| 項目 | 状態 |
|------|------|
| `stripe-webhook` Edge | ✅ ACTIVE v21 · secrets 設定済 |
| Stripe Dashboard 配線 | ⬜ **未確認** |
| GenAI checkout smoke | ✅ PASS |
| shop checkout Functions | ❌ 未デプロイ |
| Connect ingest | ⚠️ localStorage sim |
| product/shop 6 CASE | ✅ business OK |

**判定: 開発中 / WARNING**

---

## 8. AI Workspace / AI運営秘書 判定

| 領域 | 状態 | 判定 |
|------|------|------|
| AI Workspace 比較 4 カテゴリ | 29 OK / 0 NG | PASS |
| AI Workspace → TALK 下書き | レポート PASS | PASS |
| AI運営秘書 Phase1〜12 | RELEASE FROZEN | PASS |
| 本番接続レビュー | 要修正 0 | PASS |
| 実 Stripe / TALK bus 未配線 | P2 | WARNING（運営のみ） |

---

## 9. 本番ブロッカー抽出

### BLOCKER（フル本番前に必須 · 製品修正不要含む）

| ID | カテゴリ | 内容 | 根拠 |
|----|----------|------|------|
| **B-1** | 共通基盤 | **dev RLS ポリシー（`using(true)`）が本番 DB に残存** — permissive OR で本番 RLS 無効化 | [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) |
| **B-2** | TALK 通話 | **Phase7.1 DB migration 未適用**（`retry_eligible` / `subscriptions.status`） | [`talk-call-final-release-review.md`](talk-call-final-release-review.md) · `probe-talk-call-phase72-review.mjs` |
| **B-3** | TALK 通話 | **`talk-call-push-notify` Edge 未 deploy（404）** | 同上 |
| **B-4** | 決済 | **Stripe Dashboard → Webhook 本番配線未確認** | [`stripe-webhook-final-check.md`](stripe-webhook-final-check.md) |
| **B-5** | 決済 | **shop checkout Edge Functions 未デプロイ** | 同上 |

### HIGH

| ID | カテゴリ | 内容 |
|----|----------|------|
| H-1 | TALK 通話 | VAPID secrets 未投入 · 背景 Push 実機未確認 |
| H-2 | TALK 通話 | TURN 未設定 · 厳格 NAT 未検証 |
| H-3 | 安否 | Phase2 テーブル dev+prod RLS 併存 · 実 DB JWT expired（9/18） |
| H-4 | 共通基盤 | 本番 JWT / サーバー側ロール検証未統合 |
| H-5 | Marketplace | `users` base 直読 · `review_scores` RLS 未整備（FAIL 0 だが深度不足） |

### MEDIUM

| ID | カテゴリ | 内容 |
|----|----------|------|
| M-1 | Marketplace | `fetchBusinessListingByDemoId` base 直叩き（W-PUB-1） |
| M-2 | AI運営 | TALK bus / chat_started 未配線 · 市場 KPI sim |
| M-3 | 安否 | LINE send/fallback E2E WARNING · dashboard 1 件 |
| M-4 | Connect | 実 Stripe Connect Webhook 統合（P2-8） |
| M-5 | 横断 | `review-tasful-final.mjs` WARNING 115 件（UX / 監査系） |

### LOW

| ID | カテゴリ | 内容 |
|----|----------|------|
| L-1 | TALK | official_builder カレンダー案内 P2 |
| L-2 | Builder | 2 窓ベンチ headless P2 |
| L-3 | UI | CTA モバイル Builder 応募 1 FAIL（凍結 P2） |
| L-4 | AI運営 | 大量件数 virtual scroll P2 |
| L-5 | 監査 | dev-server port 8765 統一 P2 |

---

## 10. リリース判定マトリクス

### 今すぐ限定公開可能

| カテゴリ | 条件付き GO の内容 |
|----------|-------------------|
| TALK コア | 通知 · チャット · Builder/Connect/安否 連携 |
| TALK 通話 | **foreground のみ** · STUN-only · 背景 Push なしと明記 |
| Marketplace | 公開閲覧 · owner 管理（RLS 行動検証 PASS 前提） |
| Connect | デモ / sim 上の onboarding · 通知導線 |
| Builder | board / 完了報告 / ops 通知 |
| 安否 | 通知 · ダッシュボード · Phase2 未応答（デモ JWT 前提） |
| AI Workspace | 比較支援デモ 4 カテゴリ |
| AI運営秘書 | 司令塔 · Support · Ops Watch（sim イベント） |
| product/shop 購入フロー | 6 CASE business OK（ベンチ検証） |

### 本番前に必須

| # | 項目 |
|---|------|
| 1 | dev RLS ポリシー一括 DROP + 本番 RLS 再確認（[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md)） |
| 2 | TALK Push: Phase7.1 migration · VAPID secrets · Edge deploy |
| 3 | Stripe Dashboard Webhook 登録 · Live 疎通確認 |
| 4 | shop checkout Functions デプロイ（市場EC 本番決済時） |
| 5 | 安否 RLS JWT 再発行 · Phase2 dev ポリシー解消確認 |
| 6 | TURN 投入 + relay 実機（厳格 NAT 必須時） |
| 7 | Web Push 実機 E2E（Chrome PC + Android 最低各 1） |

### 将来対応

- 6 領域 P2 バックログ（各 `*-final-audit-remaining-issues.md`）
- AI運営 ↔ TALK / 市場 本番イベントパイプライン
- 本番 JWT 統合 · サーバー側承認 API
- iPhone PWA Web Push 運用方針
- ビデオ通話（スコープ外）

---

## 11. credential 漏洩チェック（横断）

| 領域 | 結果 | 根拠 |
|------|------|------|
| TALK Push | ✅ | Phase7.2 · payload / ログ / DB サンプル clean |
| TURN | ✅ | リポジトリに credential なし · env 名のみ |
| Stripe | ✅ | secrets は Supabase Dashboard のみ（レポート非記載） |
| Marketplace RLS | ✅ | payment_url owner-only · safe view マスク |
| users/profile | ✅ | email/phone/address API 経路未露出（FAIL 0） |
| 本レポート | ✅ | **credential 未記載** |

---

## 12. 回帰テスト（TALK 通話 · Phase7.2 実施分）

2026-06-17 · `SUPABASE_STRICT=1` 含む:

| スクリプト | 結果 |
|------------|------|
| `test-talk-call-push-delivery.mjs` | PASS |
| `test-talk-call-push-notification-design.mjs` | PASS |
| `test-talk-call-service-worker.mjs` | PASS |
| `test-talk-webrtc-call-browser.mjs` | PASS |
| `test-talk-call-chat-detail.mjs` | PASS |
| `test-talk-call-notification-center.mjs` | PASS |
| `test-talk-call-history-ui.mjs` | PASS |
| `test-talk-call-turn-config.mjs` | PASS |
| `test-talk-call-relay-candidate.mjs` | SKIP PASS |

---

## 13. 参照ドキュメント索引

| カテゴリ | 主要レポート |
|----------|--------------|
| TALK コア | [`talk-release-status.md`](talk-release-status.md) |
| TALK 通話 | [`talk-call-final-release-review.md`](talk-call-final-release-review.md) |
| Marketplace | [`marketplace-rls-final-lock-review.md`](marketplace-rls-final-lock-review.md) · [`users-profile-public-exposure-review.md`](users-profile-public-exposure-review.md) |
| Connect | [`connect-release-status.md`](connect-release-status.md) |
| Builder | [`builder-release-status.md`](builder-release-status.md) |
| 安否 | [`anpi-release-status.md`](anpi-release-status.md) · [`anpi-no-response-phase2-implementation.md`](anpi-no-response-phase2-implementation.md) |
| 決済 | [`stripe-webhook-final-check.md`](stripe-webhook-final-check.md) · [`product-shop-payment-final-verify/final-summary.md`](product-shop-payment-final-verify/final-summary.md) |
| AI Workspace | [`ai-workspace-category-flow-audit.md`](ai-workspace-category-flow-audit.md) |
| AI運営 | [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) |
| 横断 | [`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md) · [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) |

---

## 最終行（必須）

### 現在の TASFUL は限定公開可能か

**はい — WARNING 付きで限定公開可能です。**

根拠: 市場EC / TALK / Builder / Connect / 安否 / AI運営秘書 の **6 領域は RELEASE FROZEN** で主要利用者導線 E2E が PASS。TALK 1:1 音声通話（foreground）と AI Workspace 比較支援も検証済み。ただし **背景 Web Push 通話 · TURN 厳格 NAT · 本番 Stripe 配線 · 横断 dev RLS 解消** は限定公開のスコープ外として明示する必要があります。

### フル本番公開までの主要残件

1. **横断 dev RLS ポリシー削除** — 本番 DB で RLS を実効化（BLOCKER）
2. **TALK Web Push 本番接続** — Phase7.1 migration · VAPID · Edge deploy · 実機 E2E（BLOCKER × 2 + HIGH）
3. **Stripe 本番配線** — Dashboard Webhook 確認 · shop checkout デプロイ（BLOCKER × 2）
4. **安否 RLS 実 DB 検証** — JWT 更新 · Phase2 dev ポリシー解消（HIGH）
5. **TURN 投入** — 厳格 NAT 環境向け（HIGH · 必須度は運用要件依存）
6. **本番 JWT 統合** — デモ userId からの移行（HIGH）

### 最優先で潰すべき上位 5 項目

| 優先 | 項目 | 理由 |
|------|------|------|
| **1** | dev RLS ポリシー一括 DROP（横断） | セキュリティ上、他項目の前提。[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) が「投入不可」判定 |
| **2** | TALK Push Phase7.1 migration 適用 | Edge 実送信の DB 前提（`retry_eligible` / `status`） |
| **3** | `talk-call-push-notify` Edge deploy + VAPID secrets | 背景通話着信の本番接続（現状 404） |
| **4** | Stripe Dashboard Webhook 登録・疎通確認 | 本番決済イベント到達（Edge は deploy 済みだが配線未確認） |
| **5** | 安否 RLS JWT 再発行 + Phase2 dev/prod 併存解消 | 実 DB 検証 9/18 FAIL · Phase2 テーブルが dev OR で開放 |

---

*監査のみ実施。コード / SQL / UI 変更なし。推測は既存レポート・プローブ結果に限定。*
