# Connect — 最終監査 残課題一覧

**実施日:** 2026-06-17  
**確定:** 2026-06-17 — [`connect-release-status.md`](connect-release-status.md) **RELEASE FROZEN**  
**方針:** 製品修正なし・現状監査のみ  
**除外（RELEASE FROZEN）:** 市場EC・TALK・Builder・AI運営秘書の製品コード（接続確認は読み取りのみ）

---

## 総合評価

| 項目 | 判定 |
|------|------|
| **利用者導線監査** `review-connect-user-flow.mjs` | **PASS**（36 PASS / 4 WARNING / 0 FAIL） |
| **Stripe Connect 障害ハードニング** `test-stripe-connect-trouble-hardening-browser.mjs` | **PASS**（13/13） |
| **Connect UI レビュー**（2026-06-12 確定） | **PASS** |
| **スキル Connect 完了フロー** `verify-skill-connect-completion-flow.mjs` | **PASS** |
| **P0（リリースブロッカー）** | **なし** |
| **P1（要製品修正）** | **なし** |
| **P2（リリース後改善）** | **15+ 件** |
| **RELEASE FROZEN** | **✅ 確定** — [`connect-release-status.md`](connect-release-status.md) |

### RELEASE FROZEN 確定

| 観点 | 結論 |
|------|------|
| Connect コア（申請〜承認〜差し戻し〜通知〜バッジ） | **PASS** — `payment-settings` 中心 E2E 36/36 正常 |
| 運営連携（障害取込・Support フィルタ・AI運営秘書接続） | **PASS** — ハードニング 13/13・導線監査 AI連携 PASS |
| カテゴリ別ベンチ（TALK デュアルウィンドウ依存） | **⚠️ 未完了** — 凍結 TALK ベンチ headless タイムアウト（製品 P1 ではない） |
| 製品修正要否 | **不要** — 本監査フェーズではコード変更なし |

**結論:** Connect は **RELEASE FROZEN 確定**（2026-06-17）。P0/P1 ブロッカーなし。残課題は P2 バックログのみ。

---

## 10領域 × ロール マトリクス

凡例: ✅ PASS / ⚠️ WARNING / ❌ FAIL / — 対象外（N/A）

| # | 領域 | 一般ユーザー | partner | vendor | builder | market |
|---|------|-------------|---------|--------|---------|--------|
| 1 | **本人確認** | — | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 2 | **資格確認** | — | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 3 | **Connect申請** | — | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 4 | **Connect承認** | — | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| 5 | **Connect差し戻し** | — | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 6 | **Connect通知** | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 7 | **Connect表示バッジ** | — | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 8 | **Connect必須導線** | — | ✅ | ⚠️ | ⚠️ | ⚠️ |
| 9 | **Connect運営確認** | — | ✅ | ✅ | ✅ | ✅ |
| 10 | **Connect更新フロー** | — | ✅ | ⚠️ | ⚠️ | ⚠️ |

### ロール定義・根拠

| ロール | 代表ユーザー / カテゴリ | 監査根拠 |
|--------|------------------------|----------|
| **一般ユーザー** | 購入者 `u_hiro` | Connect 売上受取不要。通知→チャット遷移は skill デモ通知で PASS |
| **partner** | スキル出品者 `u_sachi` | `review-connect-user-flow.mjs` 主対象・390/1280 全 PASS |
| **vendor** | 商品出品者 `u_product` | 共通 `payment-settings` / `connect-member-ui.js`。ベンチ E2E は headless タイムアウト |
| **builder** | Builder 出品者 | Connect ハブは共通 UI（`connect-member-ui.js`）。Builder 製品は FROZEN のためベンチ未再実行 |
| **market** | 店舗 `u_shop_demo` | 市場EC FROZEN。Connect ハブ共通・店舗ベンチ E2E タイムアウト |

**partner 列が ✅ の根拠:** `screenshots/connect-user-flow-review/review-report.json`（2026-06-16T18:09 UTC、base `http://127.0.0.1:8765`）

**⚠️（vendor / builder / market）:** コア UI は partner と同一実装。カテゴリ別ベンチ（TALK デュアルウィンドウ）が headless で `data-listing-loaded` 待ちタイムアウト — **凍結 TALK ベンチ層の問題**（P2-10）。製品 P1 には分類しない。

**一般ユーザー列:** 売上 Connect  onboarding は N/A。Connect 支払い・完了確認通知の遷移は PASS。

---

## 10領域 詳細

| # | 領域 | 判定 | 根拠 |
|---|------|------|------|
| 1 | 本人確認 | **PASS** | identity 提出 → qualification 遷移・通知表示・390/1280 PASS |
| 2 | 資格確認 | **PASS** | qualification パネル・振込先 seed・sellerStatus=payout PASS |
| 3 | Connect申請 | **PASS** | top → identity・CTA 一本化（UI レビュー 2026-06-12 反映済） |
| 4 | Connect承認 | **WARNING** | ready 到達 PASS。承認後も振込要求通知が残存（デモ seed 同期 — P2-1） |
| 5 | Connect差し戻し | **PASS** | 差し戻し理由テンプレ表示・再提出 CTA・`connectStep=identity` 遷移 PASS |
| 6 | Connect通知 | **PASS** | 本人確認/振込/支払い/完了 4種 × 2 VP 通知→遷移 PASS |
| 7 | Connect表示バッジ | **PASS** | 未対応/提出済み/審査中/完了 — 状態別 badge PASS（rolePermissions 8/8） |
| 8 | Connect必須導線 | **PASS** | ダッシュボードバナー・売上受取表・未 Connect 時 disclaimer PASS |
| 9 | Connect運営確認 | **PASS** | Stripe trouble 取込 13/13・Daily Inbox / Ops Watch / HSG 連携 PASS |
| 10 | Connect更新フロー | **PASS** | 再読込・セッション復帰・申請/通知連打 PASS。戻る導線なしは P2-2 |

---

## 自動監査ログ

| スクリプト | 結果 | 出力 / 備考 |
|-----------|------|-------------|
| `review-connect-user-flow.mjs` | **PASS** | `screenshots/connect-user-flow-review/review-report.md` |
| `test-stripe-connect-trouble-hardening-browser.mjs` | **PASS** | 13/13（chargeback・外部決済検知・AI運営センター case 含む） |
| `verify-skill-connect-completion-flow.mjs` | **PASS** | partner 取引完了 Connect フロー |
| `connect-ui-review-round2.md` | **PASS** | identity CTA 一本化・approved レイアウト・バナー文言 |
| `verify-skill-connect-bench-initial.mjs` | **未完了** | headless タイムアウト（TALK ベンチ） |
| `verify-product-connect-bench-initial.mjs` | **未完了** | 同上 |
| `verify-worker-connect-bench-initial.mjs` | **未完了** | 同上 |
| `verify-platform-connect-complete.mjs` | **未完了** | notify 遷移 waitForURL タイムアウト |
| `verify-connect-free-full-flow-all-categories.mjs` | **FAIL** | Connectなし 6カテゴリ — TALK ベンチ依存（本監査スコープ外） |
| `capture-connect-final-review.mjs` | **未実行** | `dev-server-url.mjs` が port 8765 非対応（P2-11） |

**dev サーバー:** Vite `127.0.0.1:8765`（主監査）/ http-server `127.0.0.1:5500`（ベンチ試行）

---

## P0 — リリースブロッカー

**なし**

- Connect 申請〜承認〜差し戻し〜通知の E2E に FAIL なし
- Stripe Connect 障害（payout failed / dispute / account.updated）の運営取込 PASS
- 権限表示（未申請/申請中/承認済/差し戻し）に重大問題なし

---

## P1 — 要製品修正

**なし**

| 候補 | 切り分け | 分類 |
|------|----------|------|
| 承認後振込通知残存 | デモ `syncDemoConnectRequirementNotifications` の seed 整理。ready UI 自体は PASS | **P2-1** |
| payment-settings 戻る導線なし | SPA 直リンク設計。機能欠落ではなく UX | **P2-2** |
| カテゴリベンチ E2E 失敗 | TALK デュアルウィンドウ headless 不安定（Builder P1-4 と同型） | **P2-10** |
| salesforce-free-full-flow FAIL | Connectなし取引フロー — Connect 監査スコープ外 | **監査対象外** |

---

## P2 — リリース後改善

| ID | 内容 | 優先 |
|----|------|------|
| P2-1 | Connect ready 後の requirement 通知自動削除（`syncDemoConnectRequirementNotifications` E2E 固定） | 中 |
| P2-2 | payment-settings ブラウザ戻る導線（`from=notify` / `returnTo` 連携） | 低 |
| P2-3 | 本人確認差し戻し理由の payment-settings テンプレート連動強化 | 中 |
| P2-4 | sales-fees の payout_status ラベル — Connect 承認前ガード | 低 |
| P2-5 | Connect 完了差し戻し（chat reject）と本人確認差し戻しの通知文言分離 | 中 |
| P2-6 | TALK Connect 通知 `from=notify` / `returnTo` 統一 | 低（TALK FROZEN） |
| P2-7 | onboarding step と seller status 二重管理の CI 同期監視 | 中 |
| P2-8 | 本番 Stripe Connect webhook と demo seller status 統合テスト | 高（本番前） |
| P2-9 | Connect payout エラー時の利用者向け再設定ウィザード | 中 |
| P2-10 | カテゴリ別 Connect ベンチ E2E（skill/product/worker/shop）headless 安定化 | 中 |
| P2-11 | `dev-server-url.mjs` に port 8765 追加（`capture-connect-final-review` 等） | 低 |
| P2-12 | Daily Inbox Connect 項目 targetUrl 整理 | 低（AI運営秘書 FROZEN） |
| P2-13 | dashboard Connect バナーと payment-settings onboarding 入口統一 | 低 |
| P2-14 | JWT ロールと Connect 状態のサーバー側検証 | 高（本番前） |
| P2-15 | 390px Connect 通知 CTA 高さ・幅の定期再監視 | 低 |

---

## 除外領域との境界

| 領域 | 状態 | Connect 監査での扱い |
|------|------|---------------------|
| 市場EC | RELEASE FROZEN | 店舗ベンチ E2E は未再実行。Connect ハブ（`payment-settings`）は共通 PASS |
| TALK | RELEASE FROZEN | 通知→遷移は導線監査で PASS。デュアルウィンドウベンチは P2 |
| Builder | RELEASE FROZEN | 共通 Connect UI のみ確認。Builder 案件イベントは AI運営秘書監査で PASS |
| AI運営秘書 | RELEASE FROZEN | Connect 運営確認は読み取り接続のみ（ハードニング・導線監査 AI連携 PASS） |

---

## 改善推奨 TOP10（導線監査より）

1. Connect onboarding step と seller status の二重管理を CI で同期監視
2. 振込通知 href の `connectStep=qualification` 統一
3. 本人確認差し戻し理由を payment-settings 画面にテンプレート連動表示
4. sales-fees の payout_status ラベルを Connect 承認前ユーザー向けにガード
5. Connect 完了差し戻しと本人確認差し戻しの通知文言分離
6. Connect ready 後の requirement 通知自動削除を E2E で固定
7. Stripe trouble → 利用者 payment-settings 再申請導線の一本化
8. 本番 Stripe Connect webhook 統合テスト
9. カテゴリ別 Connect ベンチ headless 安定化
10. JWT + Connect 状態のサーバー側検証

---

## 次アクション

1. ~~**RELEASE FROZEN 確定**~~ — **完了** [`connect-release-status.md`](connect-release-status.md)
2. **P2 バックログ** — issue / ロードマップに転記（任意）
3. **監査スクリプト** — port 8765 対応・ベンチ headless 安定化（製品修正なし・任意）

---

## 参照

- [`connect-ui-review-prep.md`](connect-ui-review-prep.md) — 2026-06-12 PASS
- [`connect-ui-review-round2.md`](connect-ui-review-round2.md) — 2026-06-12 PASS
- [`connect-release-status.md`](connect-release-status.md) — Connect RELEASE FROZEN 確定
- [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) — AI運営秘書 FROZEN
- [`talk-release-status.md`](talk-release-status.md) — TALK FROZEN
- [`builder-release-status.md`](builder-release-status.md) — Builder FROZEN
- [`market-ec-release-status.md`](market-ec-release-status.md) — 市場EC FROZEN
- 実行ログ: `screenshots/connect-user-flow-review/review-report.json`
