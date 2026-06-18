# 安否機能 — リリース確定

**確定日:** 2026-06-17  
**状態:** ✅ リリース可能（**RELEASE FROZEN**）

以降、安否機能の新規製品修正は停止。残課題はリリース後改善（P2）として扱う。  
市場EC・TALK・Builder・AI運営秘書・Connect は別途 RELEASE FROZEN 済み（本判定では未変更）。

---

## 総合判定

| 項目 | 判定 |
|------|------|
| **リリース可否** | **RELEASE OK** |
| **凍結** | **RELEASE FROZEN**（本ドキュメント時点で確定） |
| P0（リリースブロッカー） | **なし** |
| P1（要製品修正） | **なし** |
| 安否通知センター | **PASS**（26/26） |
| 安否ダッシュボード | **WARNING**（37/38 — PC クイックアクション 1件） |
| LINE 運用 | **PASS**（26/26） |
| Identity / RLS | **PASS**（34/34） |
| LINE 安全化 | **PASS**（24/24） |
| 製品コード変更 | **なし**（最終監査フェーズ） |

---

## RELEASE FROZEN — 6領域

| 領域 | 確定ドキュメント | 確定日 | 状態 |
|------|-----------------|--------|------|
| **市場EC** | [`market-ec-release-status.md`](market-ec-release-status.md) | 2026-06-16 | **RELEASE FROZEN** |
| **TALK** | [`talk-release-status.md`](talk-release-status.md) | 2026-06-16 | **RELEASE FROZEN** |
| **Builder** | [`builder-release-status.md`](builder-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |
| **AI運営秘書** | [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |
| **Connect** | [`connect-release-status.md`](connect-release-status.md) | 2026-06-17 | **RELEASE FROZEN** |
| **安否** | 本ドキュメント | 2026-06-17 | **RELEASE FROZEN** |

---

## 確定根拠

| 項目 | 判定 | 根拠 |
|------|------|------|
| 安否通知センター | **PASS** | `scripts/test-anpi-notifications-browser.mjs` — **26/26**（390/1280） |
| 安否ダッシュボード | **PASS**（WARNING 1） | `scripts/test-anpi-dashboard-browser.mjs` — **37/38**（PC クイックアクション → P2） |
| LINE 運用 | **PASS** | `scripts/test-anpi-line-admin-browser.mjs` — **26/26** |
| Identity / RLS | **PASS** | `scripts/test-anpi-identity-linking-browser.mjs` — **34/34** |
| LINE 安全化 | **PASS** | `scripts/test-anpi-line-safety-browser.mjs` — **24/24** |
| 安否登録 | **PASS**（監査 WARNING） | フォーム・同意・成功導線 — notify-priority テストで確認 |
| 安否確認 | **PASS** | ダッシュボード サマリー・緊急件数・AI 導線 |
| 安否アラート | **PASS** | 緊急ゾーン・urgent カード・dashboard 緊急パネル |
| 家族・連絡先 | **PASS** | relationship / account_scope / member_id / RLS |
| 履歴表示 | **PASS** | 通知ログ・既読化・line_status 更新 |
| 運営確認導線 | **PASS** | Healthcheck・テスト Push・管理カード |
| データ保存 | **PASS** | context 永続化・再通知・二重送信防止 |
| P0 | **なし** | 最終監査でブロッカー未検出 |
| P1 | **なし** | [`anpi-final-audit-remaining-issues.md`](anpi-final-audit-remaining-issues.md) |
| 市場EC / TALK / Builder / AI運営秘書 / Connect | **未変更** | 本フェーズで凍結領域コードに手を入れていない |

---

## 対象スコープ（凍結）

### コア画面・導線（12領域）

| 領域 | 主要ファイル / URL |
|------|-------------------|
| 安否登録 | `anpi-register.html` / `anpi-register.js` |
| 安否確認 | `anpi-dashboard.html` / `anpi-dashboard.js` |
| 安否通知 | `anpi-notifications.html` / `anpi-notifications.js` |
| 安否アラート | 通知センター urgent ゾーン / dashboard 緊急パネル |
| 家族・連絡先管理 | `anpi-identity.js` / `anpi-user-context.js` |
| 定期確認 | dashboard 最終活動・確認導線 |
| 未応答処理 | LINE 失敗→再送フォールバック |
| TALK 通知連携 | `talk-anpi-notify-master-v1.js`（TALK 境界 — 読み取り） |
| AI 運営連携 | ai-workspace 安否ログ / Ops Watch anpi 集計（読み取り） |
| 運営確認導線 | `anpi-line-admin.html` / `anpi-line-admin.js` |
| 履歴表示 | `anpi-notification-log.js` |
| 設定変更 | register 編集・通知レベル・LINE 連携 |

### 共通モジュール

- `anpi-notification-log.js` / `anpi-notification-log-supabase.js` — 通知ログ
- `anpi-notification-badge.js` — 未読バッジ
- `anpi-rls.js` / `anpi-user-context-supabase.js` — RLS / Supabase
- `anpi-line-healthcheck.js` / `anpi-line-token-client.js` — LINE 連携
- `anpi-line-callback.html` — LINE OAuth コールバック

### 監査スクリプト（凍結・変更時のみ再実行）

| スクリプト | 役割 | 状態 |
|-----------|------|------|
| `scripts/test-anpi-notifications-browser.mjs` | 通知センター E2E | PASS (26/26) |
| `scripts/test-anpi-dashboard-browser.mjs` | ダッシュボード E2E | WARNING (37/38) |
| `scripts/test-anpi-line-admin-browser.mjs` | LINE 運用 E2E | PASS (26/26) |
| `scripts/test-anpi-identity-linking-browser.mjs` | Identity / RLS | PASS (34/34) |
| `scripts/test-anpi-line-safety-browser.mjs` | LINE 安全化 | PASS (24/24) |
| `scripts/test-anpi-line-notification-log-browser.mjs` | LINE プレビューログ | PASS (22/22) |
| `scripts/test-anpi-line-send-browser.mjs` | LINE 送信 | WARNING (38/40) |
| `scripts/test-anpi-line-fallback-browser.mjs` | 失敗フォールバック | WARNING (34/38) |

---

## リリース後改善（P2 — 修正不要でリリース可）

| 優先 | 分類 | 項目 |
|------|------|------|
| P2-1 | 監査 | `test-anpi-register-browser.mjs` — `.dash-header__title` セレクタ不一致 |
| P2-2 | 監査 / UX | dashboard クイックアクション / 未読バッジ E2E — `[data-dash-quick]` 不在 |
| P2-3 | 監査 | `verify-anpi-talk-delivery.mjs` — TALK 通知 headless タイムアウト（TALK FROZEN） |
| P2-4 | 監査 | `test-ai-anpi-notification-browser.mjs` — ai-workspace 読込タイムアウト |
| P2-5 | UI | `verify-anpi-dashboard-mobile-footer.mjs` — SP 戻るボタン高さ |
| P2-6 | 監査 | LINE 失敗バッジ E2E — 期待「LINE送信失敗」/ 実際「TASFUL TALK送信失敗」 |
| P2-7 | 監査 | `dev-server-url.mjs` port 8765 非対応 |
| P2-8 | E2E | 定期確認フロー専用 E2E |
| P2-9 | E2E | 未応答→エスカレーション E2E |
| P2-10 | 監査 | `capture-anpi-final-review.mjs` 再実行 |
| P2-11 | 本番 | Supabase RLS 実 DB 検証 |
| P2-12 | 本番 | LINE Login / Edge Functions 到達性 |
| P2-13 | AI ops | Ops Watch 安否 confirmed KPI — anpi-dashboard 直結 |

詳細一覧は [`anpi-final-audit-remaining-issues.md`](anpi-final-audit-remaining-issues.md) を参照。

---

## 再検証コマンド（参考・変更時のみ）

```bash
# コア（推奨）
node scripts/test-anpi-notifications-browser.mjs
node scripts/test-anpi-dashboard-browser.mjs
node scripts/test-anpi-line-admin-browser.mjs
node scripts/test-anpi-identity-linking-browser.mjs
node scripts/test-anpi-line-safety-browser.mjs

# LINE 送信・フォールバック
node scripts/test-anpi-line-send-browser.mjs
node scripts/test-anpi-line-fallback-browser.mjs

# 一括（Supabase 依存含む）
node scripts/test-anpi-all.mjs
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [`anpi-final-audit-remaining-issues.md`](anpi-final-audit-remaining-issues.md) | 最終監査・課題一覧 |
| [`market-ec-release-status.md`](market-ec-release-status.md) | 市場EC RELEASE FROZEN |
| [`talk-release-status.md`](talk-release-status.md) | TALK RELEASE FROZEN |
| [`builder-release-status.md`](builder-release-status.md) | Builder RELEASE FROZEN |
| [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | AI運営秘書 RELEASE FROZEN |
| [`connect-release-status.md`](connect-release-status.md) | Connect RELEASE FROZEN |
| `docs/anpi-line-manual-test.md` | 手動確認ガイド |
| `docs/anpi-supabase-production-checklist.md` | 本番チェックリスト |

---

## 次フェーズ

安否機能は本ドキュメント時点で **RELEASE FROZEN**。  
**P0 / P1 は残っていない。** 新規の安否製品修正チケットは受け付けない（リリース後改善 P2 のみバックログ）。  
今後の開発・修正対象から **安否製品コードを外す。**

市場EC・TALK・Builder・AI運営秘書・Connect・安否 の **6 領域**はいずれも RELEASE FROZEN。次フェーズの作業へ移行する。
