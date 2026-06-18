# Connect — リリース確定

**確定日:** 2026-06-17  
**状態:** ✅ リリース可能（**RELEASE FROZEN**）

以降、Connect の新規製品修正は停止。残課題はリリース後改善（P2）として扱う。  
市場EC・TALK・Builder・AI運営秘書・安否 は別途 RELEASE FROZEN 済み（本判定では未変更）。

---

## 総合判定

| 項目 | 判定 |
|------|------|
| **リリース可否** | **RELEASE OK** |
| **凍結** | **RELEASE FROZEN**（本ドキュメント時点で確定） |
| P0（リリースブロッカー） | **なし** |
| P1（要製品修正） | **なし** |
| 利用者導線監査 | **PASS**（36 PASS / 4 WARNING / 0 FAIL） |
| Stripe 障害ハードニング | **PASS**（13/13） |
| Connect UI レビュー | **PASS**（2026-06-12 確定） |
| 製品コード変更 | **なし**（最終監査フェーズ） |

---

## RELEASE FROZEN — 6領域

| 領域 | 確定ドキュメント | 確定日 | 状態 |
|------|-----------------|--------|------|
| **市場EC** | [`market-ec-release-status.md`](market-ec-release-status.md) | 2026-06-16 | **RELEASE FROZEN** |
| **TALK** | [`talk-release-status.md`](talk-release-status.md) | 2026-06-16 | **RELEASE FROZEN** |
| **Builder** | [`builder-release-status.md`](builder-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |
| **AI運営秘書** | [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |
| **Connect** | 本ドキュメント | 2026-06-17 | **RELEASE FROZEN** |
| **安否** | [`anpi-release-status.md`](anpi-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |

---

## 確定根拠

| 項目 | 判定 | 根拠 |
|------|------|------|
| 利用者導線監査 | **PASS** | `scripts/review-connect-user-flow.mjs` → **36 PASS / 4 WARNING / 0 FAIL** |
| Stripe 障害ハードニング | **PASS** | `scripts/test-stripe-connect-trouble-hardening-browser.mjs` — **13/13** |
| Connect UI レビュー | **PASS** | [`connect-ui-review-round2.md`](connect-ui-review-round2.md) |
| 本人確認 | **PASS** | identity 提出 → qualification 遷移・390/1280 |
| 資格確認 | **PASS** | qualification パネル・振込先 seed |
| Connect申請 | **PASS** | top → identity・CTA 一本化 |
| Connect承認 | **PASS**（WARNING 1） | ready 到達 OK。振込通知残存は P2-1 |
| Connect差し戻し | **PASS** | 差し戻し理由テンプレ・再提出 CTA |
| Connect通知 | **PASS** | 本人確認/振込/支払い/完了 4種 × 2 VP |
| Connect表示バッジ | **PASS** | 未対応/提出済み/審査中/完了 |
| Connect必須導線 | **PASS** | ダッシュボードバナー・売上受取・disclaimer |
| Connect運営連携 | **PASS** | Stripe trouble 取込・Daily Inbox / Ops Watch / HSG |
| Connect更新フロー | **PASS** | 再読込・セッション復帰・連打ガード |
| スキル Connect 完了 | **PASS** | `verify-skill-connect-completion-flow.mjs` |
| P0 | **なし** | 最終監査でブロッカー未検出 |
| P1 | **なし** | [`connect-final-audit-remaining-issues.md`](connect-final-audit-remaining-issues.md) |
| 市場EC / TALK / Builder / AI運営秘書 | **未変更** | 本フェーズで凍結領域コードに手を入れていない |

---

## 対象スコープ（凍結）

### コア画面・導線（10領域）

| 領域 | 主要ファイル / URL |
|------|-------------------|
| 本人確認 | `payment-settings.html` / `payment-settings.js` — `[data-connect-identity-panel]` |
| 資格確認 | `payment-settings.html` — `[data-connect-qualification-panel]` |
| Connect申請 | `connect-member-ui.js` / onboarding step `top` → `identity` |
| Connect承認 | onboarding step `reviewing` → `approved` → `ready` |
| Connect差し戻し | `platform-chat-connect-chat-flow.js` — rejection テンプレ |
| Connect通知 | `platform-chat-connect-*.js` / TALK notify シード |
| Connect表示バッジ | `[data-connect-status-badge]` / `CONNECT_BADGE` |
| Connect必須導線 | `connect-member-ui.js` — ダッシュボードバナー / sales-fees |
| Connect運営確認 | `stripe-connect-ingest.js` / `stripe-connect-trouble-ui.js` / Support `?filter=connect` |
| Connect更新フロー | `connect-member-ui.js` — step 永続化 / seller status 同期 |

### 共通モジュール

- `payment-settings.html` / `payment-settings.js` — Connect ハブ
- `connect-member-ui.js` — 会員向けバナー・step 解決
- `platform-chat-connect-chat-flow.js` — デモ seller status・通知同期
- `platform-chat-connect-seller-confirm.js` — 売上確定・手数料ゲート
- `stripe-connect-ingest.js` / `stripe-connect-trouble-ui.js` — 運営障害取込

### 監査スクリプト（凍結・変更時のみ再実行）

| スクリプト | 役割 | 状態 |
|-----------|------|------|
| `scripts/review-connect-user-flow.mjs` | 利用者導線 10領域 | PASS (36/4/0) |
| `scripts/test-stripe-connect-trouble-hardening-browser.mjs` | Stripe 障害・運営連携 | PASS (13/13) |
| `scripts/verify-skill-connect-completion-flow.mjs` | partner 取引完了 | PASS |
| `scripts/capture-connect-ui-review.mjs` | UI キャプチャ | PASS（2026-06-12） |
| `scripts/capture-connect-ui-round2.mjs` | UI 2回目 | PASS（2026-06-12） |

---

## リリース後改善（P2 — 修正不要でリリース可）

| 優先 | 分類 | 項目 |
|------|------|------|
| P2-1 | デモ seed | 承認後も振込要求通知が残る（`syncDemoConnectRequirementNotifications` 整理） |
| P2-2 | UX | payment-settings のブラウザ「戻る」導線（`from=notify` / `returnTo`） |
| P2-3 | 文言 | 本人確認差し戻し理由の payment-settings テンプレート連動強化 |
| P2-4 | 表示 | sales-fees の payout_status ラベル — Connect 承認前ガード |
| P2-5 | 通知 | Connect 完了差し戻し（chat reject）と本人確認差し戻しの文言分離 |
| P2-6 | 通知 | TALK Connect 通知 `from=notify` / `returnTo` 統一（TALK FROZEN） |
| P2-7 | 整合 | onboarding step と seller status 二重管理の CI 同期監視 |
| P2-8 | 本番 | Stripe Connect webhook と demo seller status 統合テスト |
| P2-9 | UX | Connect payout エラー時の利用者向け再設定ウィザード |
| P2-10 | 監査 | カテゴリ別 TALK ベンチ headless タイムアウト（skill/product/worker/shop） |
| P2-11 | 監査 | `verify-platform-connect-complete.mjs` waitForURL タイムアウト |
| P2-12 | 監査 | `verify-connect-free-full-flow-all-categories.mjs` ベンチ依存 NG |
| P2-13 | 監査 | `dev-server-url.mjs` port 8765 非対応（`capture-connect-final-review`） |
| P2-14 | 本番 | JWT ロールと Connect 状態のサーバー側検証 |
| P2-15 | UX | 390px Connect 通知 CTA 高さ・幅の定期再監視 |

詳細一覧は [`connect-final-audit-remaining-issues.md`](connect-final-audit-remaining-issues.md) を参照。

---

## 再検証コマンド（参考・変更時のみ）

```bash
# 利用者導線（推奨）
node scripts/review-connect-user-flow.mjs

# Stripe 障害ハードニング
node scripts/test-stripe-connect-trouble-hardening-browser.mjs

# partner 取引完了
node scripts/verify-skill-connect-completion-flow.mjs
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [`connect-final-audit-remaining-issues.md`](connect-final-audit-remaining-issues.md) | 最終監査・課題一覧 |
| [`connect-ui-review-prep.md`](connect-ui-review-prep.md) | UI レビュー準備（2026-06-12 PASS） |
| [`connect-ui-review-round2.md`](connect-ui-review-round2.md) | UI 2回目レビュー PASS |
| [`market-ec-release-status.md`](market-ec-release-status.md) | 市場EC RELEASE FROZEN |
| [`talk-release-status.md`](talk-release-status.md) | TALK RELEASE FROZEN |
| [`builder-release-status.md`](builder-release-status.md) | Builder RELEASE FROZEN |
| [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | AI運営秘書 RELEASE FROZEN |
| [`anpi-release-status.md`](anpi-release-status.md) | 安否 RELEASE FROZEN |
| `screenshots/connect-user-flow-review/review-report.md` | 利用者導線監査詳細 |

---

## 次フェーズ

Connect は本ドキュメント時点で **RELEASE FROZEN**。  
**P0 / P1 は残っていない。** 新規の Connect 製品修正チケットは受け付けない（リリース後改善 P2 のみバックログ）。  
今後の開発・修正対象から **Connect 製品コードを外す。**

市場EC・TALK・Builder・AI運営秘書・Connect・安否 の **6 領域**はいずれも RELEASE FROZEN。次フェーズの作業へ移行する。
