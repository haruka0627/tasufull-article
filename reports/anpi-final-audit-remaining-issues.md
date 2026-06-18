# 安否機能 — 最終監査 残課題一覧

**実施日:** 2026-06-17  
**確定:** 2026-06-17 — [`anpi-release-status.md`](anpi-release-status.md) **RELEASE FROZEN**  
**方針:** 製品修正なし・現状監査のみ  
**除外（RELEASE FROZEN）:** 市場EC・TALK・Builder・AI運営秘書・Connect の製品コード（接続確認は読み取りのみ）

---

## 総合評価

| 項目 | 判定 |
|------|------|
| **安否通知センター** `test-anpi-notifications-browser.mjs` | **PASS**（26/26） |
| **安否ダッシュボード** `test-anpi-dashboard-browser.mjs` | **WARNING**（37/38 — PC クイックアクション 1件） |
| **LINE 運用画面** `test-anpi-line-admin-browser.mjs` | **PASS**（26/26） |
| **Identity / RLS** `test-anpi-identity-linking-browser.mjs` | **PASS**（34/34） |
| **LINE 安全化** `test-anpi-line-safety-browser.mjs` | **PASS**（24/24） |
| **LINE プレビューログ** `test-anpi-line-notification-log-browser.mjs` | **PASS**（22/22） |
| **LINE 送信** `test-anpi-line-send-browser.mjs` | **WARNING**（38/40） |
| **LINE 失敗フォールバック** `test-anpi-line-fallback-browser.mjs` | **WARNING**（34/38） |
| **安否登録 E2E** `test-anpi-register-browser.mjs` | **FAIL**（監査スクリプト — 見出しセレクタ不一致） |
| **通知バッジ** `test-anpi-notification-badge-browser.mjs` | **FAIL**（クイックアクション依存タイムアウト） |
| **通知優先度修正** `test-anpi-notify-priority-fixes.mjs` | **WARNING**（15/16 — TALK カード href 1件） |
| **AI 安否通知** `test-ai-anpi-notification-browser.mjs` | **FAIL**（ai-workspace 読込タイムアウト） |
| **TALK 配信** `verify-anpi-talk-delivery.mjs` | **FAIL**（TALK 通知カード待ちタイムアウト） |
| **P0（リリースブロッカー）** | **なし** |
| **P1（要製品修正）** | **なし**（失敗は監査スクリプト / 凍結 TALK 層 / 文言差分） |
| **P2（リリース後改善）** | **20+ 件** |
| **RELEASE FROZEN** | **✅ 確定** — [`anpi-release-status.md`](anpi-release-status.md) |

### RELEASE FROZEN 確定

| 観点 | 結論 |
|------|------|
| 安否コア（登録・通知センター・ダッシュボード・履歴） | **PASS** — 通知 26/26・ダッシュボード 37/38 |
| 家族/連絡先・Identity・RLS | **PASS** — identity-linking 34/34 |
| LINE 運用・送信・安全化 | **PASS** — admin 26/26・safety 24/24・send 38/40 |
| TALK / AI 連携 E2E | **⚠️ 未完了** — 凍結 TALK ベンチ / ai-workspace headless タイムアウト |
| 製品修正要否 | **不要** — 本監査フェーズではコード変更なし |

**結論:** 安否機能は **RELEASE FROZEN 確定**（2026-06-17）。P0/P1 ブロッカーなし。残課題は P2 バックログのみ。

---

## 12領域 × ロール マトリクス

凡例: ✅ PASS / ⚠️ WARNING / ❌ FAIL / — 対象外（N/A）

| # | 領域 | 一般ユーザー | 家族/緊急連絡先 | 運営 | AI運営秘書 |
|---|------|-------------|----------------|------|-----------|
| 1 | **安否登録** | ⚠️ | ⚠️ | — | — |
| 2 | **安否確認** | ✅ | — | ✅ | ⚠️ |
| 3 | **安否通知** | ✅ | ✅ | ✅ | ⚠️ |
| 4 | **安否アラート** | ✅ | ✅ | ✅ | ⚠️ |
| 5 | **家族・連絡先管理** | ✅ | ✅ | ✅ | — |
| 6 | **定期確認** | ⚠️ | — | — | — |
| 7 | **未応答処理** | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| 8 | **TALK通知連携** | ⚠️ | ⚠️ | — | — |
| 9 | **AI運営連携** | ⚠️ | — | — | ⚠️ |
| 10 | **運営確認導線** | — | — | ✅ | ⚠️ |
| 11 | **履歴表示** | ✅ | ✅ | ✅ | — |
| 12 | **設定変更** | ⚠️ | ⚠️ | ✅ | — |

### ロール定義

| ロール | 代表画面 / ユーザー | 監査根拠 |
|--------|-------------------|----------|
| **一般ユーザー** | 利用者 `anpi_user_*` — `anpi-dashboard.html` / `anpi-notifications.html` | ダッシュボード 37/38・通知 26/26 |
| **家族/緊急連絡先** | 契約者 `contract_holder_*` — 通知受信・Identity スコープ | identity-linking RLS 34/34 |
| **運営** | `anpi-line-admin.html` — 管理者 `tasu_anpi_line_admin_v1` | line-admin 26/26・Healthcheck・Push |
| **AI運営秘書** | Ops Watch `anpi.emergency` / 秘書ハブ安否項目（読み取り） | AI ops FROZEN — コード参照のみ・E2E タイムアウト |

---

## 12領域 詳細

| # | 領域 | 判定 | 根拠 |
|---|------|------|------|
| 1 | 安否登録 | **WARNING** | フォーム・同意・成功導線は notify-priority テストで PASS。register E2E は `.dash-header__title` セレクタ不一致で中断（P2-1） |
| 2 | 安否確認 | **PASS** | ダッシュボード サマリー・緊急件数・最終活動・AI導線 PASS（390/1280） |
| 3 | 安否通知 | **PASS** | 通知センター 26/26 — 未読/緊急/詳細/既読/空状態・電話番号マスク |
| 4 | 安否アラート | **PASS** | 緊急ゾーン表示・urgent カードスタイル・dashboard 緊急パネル PASS |
| 5 | 家族・連絡先管理 | **PASS** | 契約者/利用者フィールド・relationship/account_scope・member_id 複数 context・RLS 34/34 |
| 6 | 定期確認 | **WARNING** | ダッシュボード「最終活動日時」表示 PASS。定期確認専用 E2E 未整備（P2-8） |
| 7 | 未応答処理 | **WARNING** | LINE 失敗→再送フォールバック 34/38。未応答→エスカレーション専用 E2E 未実行（P2-9） |
| 8 | TALK通知連携 | **WARNING** | notify-priority 15/16。`verify-anpi-talk-delivery` タイムアウト（TALK FROZEN — P2-3） |
| 9 | AI運営連携 | **WARNING** | `test-ai-anpi-notification` ai-workspace タイムアウト。Ops Watch は `admin-ai-ops-watch.js` で anpi 集計あり（読み取り PASS） |
| 10 | 運営確認導線 | **PASS** | line-admin 26/26 — Healthcheck・統計・テストPush・dashboard/anpi-dashboard 管理カード |
| 11 | 履歴表示 | **PASS** | 通知ログ一覧・既読化・localStorage 永続化・LINE status 表示（send/fallback 大部分 PASS） |
| 12 | 設定変更 | **WARNING** | 登録編集導線はダッシュボード PASS。register 編集 E2E は register スクリプト未完了（P2-1） |

---

## 確認項目マトリクス

### 導線（登録 / 編集 / 削除 / 通知 / 確認）

| 項目 | 390px | 1280px | 判定 |
|------|-------|--------|------|
| 安否登録フォーム | ⚠️ | ⚠️ | register E2E 中断（スクリプト） |
| 登録成功導線 | ✅ | ✅ | notify-priority — 通知/AI/ダッシュボードリンク PASS |
| ダッシュボード確認 | ✅ | ✅ | 37/38 |
| 通知センター | ✅ | ✅ | 26/26 |
| 運営 Healthcheck | ✅ | ✅ | 26/26 |
| LINE 再送 | ✅ | ✅ | fallback 34/38（バッジ文言のみ NG） |

### 通知（TALK / 安否 / 未応答 / 家族）

| 種別 | 判定 | 備考 |
|------|------|------|
| TALK 安否通知 | ⚠️ | targetUrl 優先 PASS。動的カード href 1件 NG |
| 安否通知センター | ✅ | 26/26 |
| 未応答 / 緊急 | ✅ | urgent ゾーン・緊急件数 PASS |
| 家族向け（契約者） | ✅ | RLS — 契約者は自分のログのみ |

### AI運営（秘書 / OPS WATCH / エスカレーション）

| 項目 | 判定 | 備考 |
|------|------|------|
| AI 相談→安否ログ | ❌ | ai-workspace headless タイムアウト（P2-4） |
| Ops Watch anpi 集計 | ⚠️ | コード上 `anpi.emergency` あり。安否単体 E2E 未再実行（AI ops FROZEN） |
| エスカレーション | ⚠️ | 緊急キーワード→#check 導線 PASS。未応答エスカレーション E2E なし |

### UI（PC / SP / 横スクロール / CTA / 空状態）

| 項目 | 判定 | 備考 |
|------|------|------|
| SP 390px | ✅ | 通知・ダッシュボード・line-admin 主要 PASS |
| PC 1280px | ✅ | 同上 |
| 横スクロール | ✅ | line-fallback「横スクロールなし」PASS |
| CTA | ⚠️ | dashboard PC クイックアクション 1件 NG（P2-2） |
| 空状態 | ✅ | 通知センター empty state PASS |
| SP フッター戻る | ❌ | `verify-anpi-dashboard-mobile-footer` NG（P2-5） |

### データ（状態保存 / 履歴 / 再通知）

| 項目 | 判定 | 備考 |
|------|------|------|
| context 永続化 | ✅ | identity-linking 登録保存・hint 復元 PASS |
| 通知ログ履歴 | ✅ | is_read・line_status/sent_at 更新 PASS |
| LINE 再通知 | ✅ | 失敗→再送→sent PASS（34/38） |
| 二重送信防止 | ✅ | line-safety 24/24 |

---

## 自動監査ログ

| スクリプト | 結果 | 出力 / 備考 |
|-----------|------|-------------|
| `test-anpi-notifications-browser.mjs` | **PASS** | 26/26 · 390 + 1280 |
| `test-anpi-dashboard-browser.mjs` | **WARNING** | 37/38 · PC クイックアクション |
| `test-anpi-line-admin-browser.mjs` | **PASS** | 26/26 · 運営 |
| `test-anpi-identity-linking-browser.mjs` | **PASS** | 34/34 · 家族/RLS |
| `test-anpi-line-safety-browser.mjs` | **PASS** | 24/24 |
| `test-anpi-line-notification-log-browser.mjs` | **PASS** | 22/22 |
| `test-anpi-line-send-browser.mjs` | **WARNING** | 38/40 · 失敗バッジ文言 |
| `test-anpi-line-fallback-browser.mjs` | **WARNING** | 34/38 · 同上 + 送信済み表示 |
| `test-anpi-notify-priority-fixes.mjs` | **WARNING** | 15/16 |
| `test-anpi-register-browser.mjs` | **FAIL** | `.dash-header__title` タイムアウト |
| `test-anpi-notification-badge-browser.mjs` | **FAIL** | クイックアクション badge タイムアウト |
| `test-ai-anpi-notification-browser.mjs` | **FAIL** | ai-workspace タイムアウト |
| `verify-anpi-talk-delivery.mjs` | **FAIL** | TALK 通知カード待ち（TALK FROZEN） |
| `verify-anpi-dashboard-mobile-footer.mjs` | **FAIL** | SP 戻るボタン h=undefined |
| `test-anpi-dashboard-action-required.mjs` | **未実行** | dev server 検出失敗（port 8765 非対応） |
| `test-anpi-notify-dashboard-actions.mjs` | **未実行** | 同上 |
| `capture-anpi-final-review.mjs` | **未実行** | `dev-server-url.mjs` port 8765 非対応 |
| `test-anpi-all.mjs` | **未実行** | 17 suites 一括（Supabase 依存含む） |

**dev サーバー:** Vite `http://127.0.0.1:8765`（`BASE_URL` 指定）

---

## P0 — リリースブロッカー

**なし**

- 安否通知センター・ダッシュボード・LINE 運用の主要 E2E に製品ブロッカーなし
- Identity / RLS 34/34 PASS
- 緊急通知・既読化・電話マスク・横スクロール問題なし

---

## P1 — 要製品修正

**なし**

| 候補 | 切り分け | 分類 |
|------|----------|------|
| register E2E `.dash-header__title` | ページは `dash-header--account` レイアウトに変更済。スクリプトが旧セレクタ | **P2-1** 監査スクリプト |
| LINE 失敗バッジ「LINE送信失敗」 | 製品ラベルは「TASFUL TALK送信失敗」。テスト文言不一致 | **P2-6** 監査スクリプト |
| dashboard クイックアクション | `dashboard.html` に `[data-dash-quick]` なし。anpi-dashboard 内クイックメニューは PASS | **P2-2** 監査スクリプト / UX |
| ai-workspace タイムアウト | headless 読込。手動導線はダッシュボードから AI リンク PASS | **P2-4** 監査環境 |
| TALK 配信タイムアウト | 凍結 TALK 通知 UI 依存 | **P2-3** TALK FROZEN |
| 通知バッジ E2E | 同上クイックアクション依存 | **P2-2** |

---

## P2 — リリース後改善

| ID | 内容 | 優先 |
|----|------|------|
| P2-1 | `test-anpi-register-browser.mjs` — `.dash-header__title` → 現行レイアウトセレクタ | 中 |
| P2-2 | dashboard クイックアクション / 未読バッジ E2E — `[data-dash-quick]` または anpi-dashboard 導線に整合 | 中 |
| P2-3 | `verify-anpi-talk-delivery.mjs` — TALK 通知カード headless 安定化（TALK FROZEN） | 低 |
| P2-4 | `test-ai-anpi-notification-browser.mjs` — ai-workspace 待ち条件見直し | 中 |
| P2-5 | `verify-anpi-dashboard-mobile-footer.mjs` — SP 戻るボタン高さ検出 | 低 |
| P2-6 | LINE 失敗バッジ E2E — 期待文言を「TASFUL TALK送信失敗」に更新 | 低 |
| P2-7 | `dev-server-url.mjs` port 8765 追加（capture / action-required 等） | 低 |
| P2-8 | 定期確認フロー専用 E2E | 中 |
| P2-9 | 未応答→エスカレーション E2E（家族通知・運営通知） | 中 |
| P2-10 | `capture-anpi-final-review.mjs` 再実行・12領域 UX キャプチャ固定 | 中 |
| P2-11 | `test-anpi-all.mjs` 一括再実行（Supabase 実 DB スイートは CI 分離） | 低 |
| P2-12 | notify-priority TALK 動的カード href 1件 — headless 通知パネル待ち | 低 |
| P2-13 | LINE 送信済み表示ラベル E2E（fallback 2件 NG） | 低 |
| P2-14 | Ops Watch 安否 confirmed KPI — anpi-dashboard 直結（AI ops P2 継承） | 低 |
| P2-15 | 本番 Supabase RLS 実 DB 検証（`verify-anpi-rls-real-db.mjs`） | 高（本番前） |
| P2-16 | LINE Login / token-exchange 本番 Edge Functions 到達性 | 高（本番前） |
| P2-17 | 1280px レイアウト幅バランス（capture-anpi-final-review 所見） | 低 |

---

## 除外領域との境界

| 領域 | 状態 | 安否監査での扱い |
|------|------|-----------------|
| 市場EC | RELEASE FROZEN | 未変更 |
| TALK | RELEASE FROZEN | 通知配信 E2E タイムアウト — 製品 P1 ではない |
| Builder | RELEASE FROZEN | 未変更 |
| AI運営秘書 | RELEASE FROZEN | Ops Watch anpi 集計はコード参照のみ |
| Connect | RELEASE FROZEN | 未変更 |

---

## コア画面（凍結候補スコープ）

| 画面 | ファイル |
|------|----------|
| 安否登録 | `anpi-register.html` / `anpi-register.js` |
| 安否ダッシュボード | `anpi-dashboard.html` / `anpi-dashboard.js` |
| 安否通知センター | `anpi-notifications.html` / `anpi-notifications.js` |
| LINE 運用 | `anpi-line-admin.html` / `anpi-line-admin.js` |
| 通知ログ / バッジ | `anpi-notification-log.js` / `anpi-notification-badge.js` |
| Identity / RLS | `anpi-identity.js` / `anpi-rls.js` / `anpi-user-context.js` |
| LINE 連携 | `anpi-line-callback.html` / `anpi-line-token-client.js` |
| TALK マスタ | `talk-anpi-notify-master-v1.js`（TALK 境界 — 読み取りのみ） |

---

## 次アクション

1. ~~**RELEASE FROZEN 確定**~~ — **完了** [`anpi-release-status.md`](anpi-release-status.md)
2. **P2 バックログ** — issue / ロードマップに転記（任意）
3. **監査スクリプト** — P2-1/2/6/7 更新（製品修正なし・任意）

---

## 参照

- [`anpi-release-status.md`](anpi-release-status.md) — 安否 RELEASE FROZEN 確定
- [`connect-release-status.md`](connect-release-status.md) — Connect RELEASE FROZEN
- [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) — AI運営秘書（安否 P2 言及）
- [`talk-release-status.md`](talk-release-status.md) — TALK FROZEN
- [`builder-release-status.md`](builder-release-status.md) — Builder FROZEN
- [`market-ec-release-status.md`](market-ec-release-status.md) — 市場EC FROZEN
- `docs/anpi-line-manual-test.md` — 手動確認ガイド
- `docs/anpi-supabase-production-checklist.md` — 本番チェックリスト
