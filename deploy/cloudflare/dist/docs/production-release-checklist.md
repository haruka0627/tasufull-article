# TASFUL 本番公開前チェックリスト

**プロジェクト:** `ddojquacsyqesrjhcvmn`（`tasful-ai`）  
**実施日:** 2026-06-04  
**ローカル検証:** `http://127.0.0.1:5173`（Vite dev）  
**本番 URL:** リポジトリ未確定 → デプロイ後 `https://<本番ドメイン>` で再実行

---

## サマリー

| 区分 | 件数 |
|------|------|
| OK（公開前クリア） | ローカル E2E・Gemini Edge・TALK RLS 検証・AI 音声スモーク 等 |
| 要確認 | Stripe test/live、Cloudflare ホスト、Anpi JWT 検証トークン、本番 URL E2E |
| 未完了 | TALK 本番一斉配信 Edge Function、Cloudflare OCR |
| **ブロッカー** | 本番 URL E2E 未実施・本番ホスト未確定（静的文字化けは **2026-06-04 解消**） |

---

## 1. Supabase（`ddojquacsyqesrjhcvmn`）

| 項目 | 状態 | 根拠 / メモ |
|------|------|-------------|
| Project URL / anon key が本番用 | **OK** | `chat-supabase-config.js` → `https://ddojquacsyqesrjhcvmn.supabase.co` + anon JWT（`service_role` なし） |
| クライアントに API キー直書き（Gemini） | **OK** | `GEMINI_API_KEY` は Edge のみ（`supabase/functions/gemini-chat`） |
| Edge Function `gemini-chat` ACTIVE | **OK** | `supabase functions list` → ACTIVE v13（2026-05-29 UTC） |
| Secret `GEMINI_API_KEY` 設定済み | **OK** | `supabase secrets list` に `GEMINI_API_KEY` あり |
| `verify-gemini-deploy.mjs` | **OK** | 6/6 PASS（基本応答・キャラ・履歴・404・静的 mouth UI） |
| RLS 本番ポリシー（TALK） | **OK** | `node scripts/verify-talk-rls-staging.mjs` → Production RLS verification passed |
| dev policy 削除（TALK） | **OK** | 同上（`dev policies remaining: 0`） |
| anon 横読み不可（TALK） | **OK** | 同上（anon cannot read without auth） |
| JWT claim（TALK `talk_user_id`） | **要確認** | 本番 Auth で JWT に claim 付与。手順: [talk-staging-prelaunch-checklist.md](./talk-staging-prelaunch-checklist.md) |
| RLS（Anpi）本番 SQL 適用 | **要確認** | SQL 手順: [anpi-supabase-production-checklist.md](./anpi-supabase-production-checklist.md) |
| Anpi dev policy 削除 | **要確認** | `sql/anpi-rls-drop-dev-policies.sql` を本番で実行済みか Dashboard 確認 |
| Anpi RLS 自動検証 | **要確認** | `verify-anpi-rls-real-db.mjs` → **9/18**（テスト用 JWT **expired**）。トークン再発行後に再実行 |
| 会員 `member_id` JWT（Anpi） | **要確認** | [anpi-rls-jwt-setup.md](./anpi-rls-jwt-setup.md) |

**Edge Functions（デプロイ済み・抜粋）**

| SLUG | STATUS |
|------|--------|
| `gemini-chat` | ACTIVE |
| `gemini-image-character-analyze` | ACTIVE |
| `stripe-webhook` | ACTIVE |
| `stripe-create-checkout` / `confirm-checkout` | ACTIVE |
| `stripe-create-genai-checkout` / `confirm-genai-checkout` | ACTIVE |
| `stripe-create-shop-checkout` / `confirm-shop-checkout` | ACTIVE |
| `genai-3d-generate` | ACTIVE |
| `tasful-chat` | ACTIVE |

**Secrets（名前のみ・値は記載しない）**

- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_GENAI_PRICE_BASIC_300`, `STRIPE_GENAI_PRICE_PRO_980`, `STRIPE_GENAI_PRICE_2D_LIVE_300`, `STRIPE_GENAI_PRICE_3D_GENERATE_500`, 他

---

## 2. AI（Gemini / 音声 / 標準キャラ）

| 項目 | 状態 | 根拠 |
|------|------|------|
| Gemini **2.5 Flash** | **OK** | `supabase/functions/gemini-chat/index.ts` → `gemini-2.5-flash` |
| Edge 応答（本番プロジェクト） | **OK** | `verify-gemini-deploy.mjs` 6/6 |
| 標準キャラ（近衛木乃香・関西弁） | **OK** | deploy 検証 + `browser-test-gen-ai.mjs` 応答ログ |
| 音声 ON/OFF / mouth / 3D タブ | **OK** | `browser-test-gen-ai.mjs` 7/7、`verify-gen-ai-voice-ui-smoke.mjs` 37/37 |
| クライアント API キー直書き | **OK** | フロント JS に `AIzaSy` / `GEMINI_API_KEY` なし |

**手動（推奨）:** [gen-ai-voice-manual-checklist.md](./gen-ai-voice-manual-checklist.md)

---

## 3. TASFUL TALK

| 項目 | 状態 | メモ |
|------|------|------|
| Realtime publication | **要確認** | `sql/talk-realtime-publication.sql` 本番適用済みか Dashboard |
| fanout（RLS・admin） | **OK** | `verify-talk-rls-staging.mjs`（admin fanout / non-admin 拒否） |
| 通知センター | **要確認** | 本番 Auth + `talk-home.html` 手動 |
| AI 下書き | **要確認** | RLS OK。UI は本番 JWT で手動 |
| 配信下書き | **要確認** | 同上 |
| **本番一斉配信 Edge Function** | **未完了** | `supabase functions list` に **broadcast 系なし**。`talk-home.html` はモック/Edge 未設定時ガード想定（[talk-staging-prelaunch-checklist.md](./talk-staging-prelaunch-checklist.md) §6） |
| `chat-supabase-config.js` の `talkBroadcastEdgeUrl` | **未設定** | 現状キーなし → 本番 direct fanout 禁止設計のまま |

---

## 4. Platform（ローカル 5173・自動）

| 項目 | 状態 | コマンド結果 |
|------|------|----------------|
| UI 最終スモーク（20ページ×3幅） | **OK** | `test-tasful-ui-final-smoke.mjs` → **552/552** |
| 横スクロール / console | **OK** | レポート `pageErrors` 全空 |
| フッター高さ（detail-shop 含む） | **OK** | PC 267px / SP 50px（閾値内） |
| プラットフォーム導線 | **OK** | `test-platform-all-browser.mjs` → 0 failures |
| 詳細リンク・掲載管理・AI バッジ | **OK** | `test-listing-detail-link-browser.mjs` → **57/57** |
| お気に入り永続化（general / shop / biz） | **OK** | `test-favorite-actions-browser.mjs` → **32/32** |
| detail 掲載管理リンク | **OK** | UI スモーク内 PASS |
| **静的 HTML 文字化け（Phase 2-D）** | **OK**（2026-06-04 再修復） | `detail-shop.html` **0**、`detail-business-service.html` **0**（`apply-phase2d-static-restore.mjs` + `merge-detail-favorite-scripts.mjs`） |

> 再発時: `node scripts/apply-phase2d-static-restore.mjs --verify-vite detail-shop.html detail-business-service.html` → `node scripts/merge-detail-favorite-scripts.mjs`

---

## 5. Builder

| 項目 | 状態 | メモ |
|------|------|------|
| builder-top | **OK** | UI スモーク PASS |
| mvp-threads | **OK** | 同上 |
| mvp-project-detail | **OK** | 同上・戻る・スレッド導線 PASS |
| 本番データ連携 | **要確認** | MVP はデモ導線中心。Supabase Builder 関数は別途 |

---

## 6. 決済（Stripe）

| 項目 | 状態 | メモ |
|------|------|------|
| Edge Functions デプロイ | **OK** | checkout / webhook / genai / shop 系 ACTIVE |
| Secrets 設定 | **OK** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 価格 ID 系 |
| **test / live モード** | **要確認** | リポジトリ手順は `sk_test_...` 例（`supabase/STRIPE_FEATURED_SETUP.md`）。Secret 名に `*_LIVE_*` あり → **Dashboard で `STRIPE_SECRET_KEY` が `sk_test_` か `sk_live_` か必ず確認** |
| 本番公開時 live 切替 | **要確認** | 公開課金を有効にする場合: live キー・live Webhook・live Price ID に差し替え + 再デプロイ |
| Stripe Connect（店舗振込） | **未導入** | `shop-payout.js` に `stripe_account_id` 参照あり。オンボーディングフローはデモ/未設定扱い（`useDemoCheckout` フォールバック） |
| 店舗 Checkout | **要確認** | `stripe-create-shop-checkout` ACTIVE。本番で E2E 購入テスト推奨 |

---

## 7. Cloudflare / 本番ホスト

| 項目 | 状態 | メモ |
|------|------|------|
| Cloudflare Pages / Workers 設定 | **要確認** | リポジトリに `wrangler.toml` なし。ホスト名・ビルドコマンド（`vite build` or 静的コピー）は運用側で確定 |
| OCR（Cloudflare） | **未完了** | `chat-ocr.js` → `cloudflare_not_configured` |
| HTTPS / キャッシュ | **要確認** | デプロイ後に本番 URL で確認 |
| `chat-supabase-config.js` の本番 URL 一致 | **要確認** | デプロイ先が別ドメインでも Supabase URL は同一プロジェクトで可 |

---

## 8. ローカルで実行済み（2026-06-04）

```bash
BASE_URL=http://127.0.0.1:5173 node scripts/test-tasful-ui-final-smoke.mjs          # 552/552
BASE_URL=http://127.0.0.1:5173 node scripts/test-platform-all-browser.mjs            # PASS
BASE_URL=http://127.0.0.1:5173 node scripts/test-listing-detail-link-browser.mjs   # 57/57
BASE_URL=http://127.0.0.1:5173 node scripts/test-favorite-actions-browser.mjs        # 32/32
node scripts/verify-gemini-deploy.mjs                                              # 6/6
node scripts/browser-test-gen-ai.mjs                                                 # 7/7
node scripts/verify-gen-ai-voice-ui-smoke.mjs                                        # 37/37
node scripts/verify-phase2d-static-restore.mjs                                       # Vite OK / mojibake NG×2
node scripts/scan-phase2d-mojibake.mjs                                             # shop 361, biz 618
node scripts/verify-talk-rls-staging.mjs                                           # PASS
```

---

## 9. 公開後に実行するテスト（本番 URL）

`<本番ドメイン>` を実際のホストに置き換えて実行。

```bash
export BASE_URL=https://<本番ドメイン>

node scripts/test-tasful-ui-final-smoke.mjs
node scripts/test-platform-all-browser.mjs
node scripts/test-listing-detail-link-browser.mjs
node scripts/test-favorite-actions-browser.mjs

GEN_AI_TEST_URL=https://<本番ドメイン>/gen-ai-workspace.html node scripts/browser-test-gen-ai.mjs
node scripts/verify-gen-ai-voice-ui-smoke.mjs

# Supabase はリポジトリの chat-supabase-config.js を参照（本番プロジェクト向けであること）
node scripts/verify-gemini-deploy.mjs
```

**追加推奨（本番のみ）**

```bash
node scripts/verify-phase2d-static-restore.mjs
node scripts/verify-talk-rls-staging.mjs    # 本番 DB 向け。実行環境に注意
# Anpi: JWT 再発行後
node scripts/verify-anpi-rls-real-db.mjs
```

**レポート出力**

- `screenshots/tasful-ui-final-smoke-report.json`

---

## ブロッカー一覧（公開前に解消必須）

1. ~~**静的文字化け（shop / business-service）**~~ → **解消済み**（2026-06-04）
2. **本番 URL での E2E 未実施** — デプロイ直後に §9 を実行し 552/552・32/32 を確認。
3. **本番ホスト（Cloudflare 等）未確定** — URL・HTTPS・静的アセット配信パス。

---

## 非ブロッカーだが公開前に決めること

- Stripe **test → live** 切替タイミングと Webhook エンドポイント
- TALK **本番一斉配信 Edge**（必要なら実装・デプロイ後に `talkBroadcastEdgeUrl` 設定）
- Anpi RLS 本番 SQL + dev policy 削除 + JWT 検証スクリプト再実行
- `member_id` / `talk_user_id` の Auth クレーム運用

---

## 最終判定

| 判定 | 内容 |
|------|------|
| **ローカル機能回帰** | **合格** — UI / Platform / お気に入り / Gemini / 音声 / TALK RLS（スクリプト） |
| **インフラ・Secrets** | **概ね合格** — `gemini-chat` ACTIVE、`GEMINI_API_KEY` あり |
| **公開 GO** | **条件付き GO**（デプロイ可。本番 URL スモーク後にトラフィック切替推奨） |

**次に進める条件**

1. ~~shop / business-service 静的文字化け **0**~~ → **完了**  
2. 本番デプロイ後、§9 のスモークを **本番 `BASE_URL`** で全 PASS。  
3. Stripe live/test と Cloudflare ホストを運用メモで確定。

**デプロイ作業**には進める。**本番トラフィック切替**は §9 完了後を推奨。

---

## 10. 運営センター・サポート・Builderパートナー評価・総合ダッシュボード・TASFUL TALK（2026-06-04 デプロイ準備コミット）

**コミット（push 前・ローカル）**

| # | Hash | メッセージ |
|---|------|------------|
| 1 | `0c4e3a9` | Deploy prep: support trouble center |
| 2 | `4df3eb1` | Deploy prep: AI operations center |
| 3 | `c92d80a` | Deploy prep: builder partner evaluation |
| 4 | `400c818` | Deploy prep: admin operations dashboard |
| 5 | `dfca8e9` | Deploy prep: TASFUL TALK operations assistant |

| 項目 | 状態 | 確認方法 |
|------|------|----------|
| Supportトラブルセンター E2E | **OK** | `node scripts/test-support-trouble-center-browser.mjs` → 9/9 PASS |
| AI運営センター E2E | **OK** | `node scripts/test-ai-operations-center-browser.mjs` → 12/12 PASS |
| Builderパートナー評価 E2E | **OK** | `node scripts/test-builder-partner-evaluation-browser.mjs` → 10/10 PASS |
| 総合運営ダッシュボード E2E | **OK** | `node scripts/test-admin-operations-dashboard-browser.mjs` → 12/12 PASS |
| 確認モーダル（返金/BAN/非表示等） | **OK** | 上記 E2E でモーダル必須を検証（ダッシュボードは実行ボタンなし） |
| 運営通知（localStorage + console） | **OK** | high/critical / 重要カテゴリで通知記録 |
| Stripe / Connect **API実行** | **未実施（意図）** | ステータス記録・操作予定のみ。本番 Edge 連携は別フェーズ |
| パートナー評価合算・バッジ | **OK** | 期日±1 / クレーム±1 履歴から再計算、優良/安定/要注意 |
| 非表示パートナー表示・一覧 | **OK** | 合算スコア横に非表示バッジ、管理画面 `#hidden-partners` に一覧 |
| ドタキャン非表示 | **OK** | 確認モーダル後に通常一覧から除外、管理画面に残存 |
| 総合ダッシュボード集計 | **OK** | 未対応・要確認・high/critical・Connect・違反/通報・非表示数・本日新規・AI返信済み |
| 重要アラート（最大5件） | **OK** | legal / chargeback / connect_issue / abuse_or_policy 優先、専用画面へリンク |
| Builder index / 公開ページ / AI Workspace / TALK 非破壊 | **OK** | 各 E2E + 独立画面構成 |
| TASFUL TALK 運営ルーム E2E | **OK** | `node scripts/test-talk-ops-assistant-browser.mjs` → 10/10 PASS |

### §10 TASFUL TALK 運営ルーム確認（AI運営秘書）

| 確認項目 | 状態 | メモ |
|----------|------|------|
| 運営専用ルーム（AI運営秘書）が表示される | **OK** | `talk-home.html` チャットタブ → 「AI運営秘書」／`talk-ops-room.html` |
| 高リスク / critical / Connect / 通報 / 違反 / ドタキャン通知が受信される | **OK** | Support・AI運営・Builder ストア連携（E2Eで検証） |
| 通知カード（分類・内容・推奨対応・優先度バッジ・管理画面リンク） | **OK** | `data-talk-ops-card` / `data-talk-ops-detail-link` |
| ページ表示時に本日のサマリーが生成される（1日1回） | **OK** | `ops-daily-YYYYMMDD` メッセージ ID で重複防止 |
| 運営コマンド（未対応だけ / 高リスク / Connect問題 / 通報 / 違反 / 要確認） | **OK** | `talk-ops-room.html` 入力欄 → 抽出結果表示 |
| 実行ボタンなし（返金 / BAN / Connect / Stripe は管理画面へ誘導） | **OK** | E2Eで `data-ai-ops-action` 等の不在を確認 |
| ストア更新イベントで自動追記 | **OK** | `tasu:support-tickets-updated` / `tasu:ai-ops-cases-changed` / `tasu:builder-partner-eval-changed` |
| 既存チャット一覧・Builderチャット・AI Workspaceに影響なし | **OK** | 運営カード1件追加のみ。取引チャット・Builder MVP ロジック不変 |

**手動確認 URL（ローカル）**

- `talk-ops-room.html` — 運営通知ルーム（閲覧・コマンド・誘導のみ）
- `talk-home.html`（チャットタブ）— 「TASFUL運営通知 / AI運営秘書」カード
- `admin-operations-dashboard.html` — 運営トップ（閲覧専用）
- `support-trouble-center.html`
- `admin-ai-operations-center.html`
- `builder/admin-partner-evaluations.html`（非表示: `#hidden-partners`）
- `builder-admin/admin-index.html` — 上記4画面への導線

**公開前（10月予定）:** 本番 `BASE_URL` で上記5 E2E を再実行。push・Cloudflare 反映は別承認。

```bash
# ローカル（file:// または静的サーバー）
node scripts/test-support-trouble-center-browser.mjs
node scripts/test-ai-operations-center-browser.mjs
node scripts/test-builder-partner-evaluation-browser.mjs
node scripts/test-admin-operations-dashboard-browser.mjs
node scripts/test-talk-ops-assistant-browser.mjs

# 本番（デプロイ後）
export BASE_URL=https://<本番ドメイン>
node scripts/test-support-trouble-center-browser.mjs
node scripts/test-ai-operations-center-browser.mjs
node scripts/test-builder-partner-evaluation-browser.mjs
node scripts/test-admin-operations-dashboard-browser.mjs
node scripts/test-talk-ops-assistant-browser.mjs
```

---

## 11. 公開前最終確認（10月公開・本番トラフィック切替前）

デプロイ完了後、本番 URL で以下を順に実施。チェックは手動で `[x]` に更新する。

### 本番 E2E・運営センター

- [ ] 本番URLでE2E実行（§9 + §10 のスクリプト）
- [ ] Supportトラブルセンター確認（一覧・フィルタ・詳細・確認モーダル・通知バー）
- [ ] AI運営センター確認（タブ・運営コマンド・案件詳細・確認モーダル・通知）
- [ ] Builderパートナー評価確認（自然文入力・スコア合算・非表示モーダル・履歴）
- [ ] 総合運営ダッシュボード確認（サマリー・アラート最大5件・タスク・ショートカット・読込ステータス・実行ボタンなし）
- [ ] TASFUL TALK 運営ルーム確認（§10 運営ルーム表・`test-talk-ops-assistant-browser.mjs`）

### 既存プロダクト

- [ ] AI Workspace確認（Gemini 応答・音声 UI・キャラ）
- [ ] TASFUL TALK確認（ログイン・スレッド・通知・RLS・運営ルーム導線）
- [ ] 安否サービス確認（Anpi 登録・ダッシュボード・LINE 連携・RLS）
- [ ] Builder MVP確認（index・threads・project-detail 導線）

### インフラ・決済・データ

- [ ] Cloudflare SSL確認（HTTPS・証明書有効）
- [ ] Cloudflare Redirect確認（www / apex・404 ルール）
- [ ] Cloudflare Cache確認（HTML/静的アセット・パurge 手順）
- [ ] Stripe確認（test/live モード・Webhook・Checkout）
- [ ] Stripe Connect確認（オンボーディング・本人確認・ステータス記録）
- [ ] Supabase接続確認（anon key・Edge・RLS）

### 品質・端末

- [ ] Console Errorなし（主要導線を DevTools で確認）
- [ ] Mobile表示確認（390px 幅・横スクロールなし）
- [ ] Desktop表示確認（1280px 幅）
- [ ] お気に入り確認（追加・削除・永続化）
- [ ] チャット確認（一覧・詳細・送信）
- [ ] 管理画面確認（`builder-admin/admin-index.html`・運営4画面リンク）

---

## 11.1 Stripe / Connect トラブル強化（Deploy prep・本番 API 未接続）

| 項目 | 状態 | メモ |
|------|------|------|
| イベント分類マップ（14種） | **OK** | `stripe-connect-event-map.js` — payout / dispute / account / payment 等 |
| webhook 風取込（シミュレーション） | **OK** | `stripe-connect-ingest.js` → support_tickets / connect_issues / ai_ops_cases |
| チャージバック証拠パック | **OK** | `chargeback-evidence-pack.js` — Stripe 自動提出なし |
| 本人確認テンプレ（10種） | **OK** | `connect-identity-templates.js` — 審査通過を保証しない文言 |
| 返金判断チェックリスト | **OK** | `should_auto_refund: false` 固定 |
| 外部決済・直営業検知 | **OK** | `offplatform-risk-detector.js` |
| 運営 UI 連携（4画面） | **OK** | 表示・作成ボタンのみ。返金/出金/BAN/Stripe API 実行なし |
| E2E | **OK** | `node scripts/test-stripe-connect-trouble-hardening-browser.mjs` |
| 本番 Stripe Webhook endpoint | **未** | 意図どおり後フェーズ |
| Supabase DDL（3テーブル案） | **草案のみ** | `sql/stripe-connect-trouble-ddl-draft.sql` |

**手動確認（任意）:** `support-trouble-center.html` で Stripe 取込チケットを選択 → Connect パネル → 証拠パック作成 / テンプレ表示。

---

## 12. 公開後確認（本番トラフィック切替後）

本番稼働直後〜48時間で実施。

- [ ] 問い合わせ受信（Support intake → トラブルセンターにチケット表示）
- [ ] 通知受信（運営通知・high/critical・未読カウント）
- [ ] Connectイベント受信（Webhook / ステータス更新・Connect問題タブ）
- [ ] AI運営センター集計確認（support 連携・案件タブ・要確認件数）
- [ ] 総合運営ダッシュボード集計確認（サマリー・アラート・非表示パートナー数が実データと一致）
- [ ] TASFUL TALK 運営ルーム通知確認（Support/AI運営/Builder イベント → `talk-ops-room.html` にカード追記）
- [ ] エラー監視開始（Console / Edge logs / Stripe Dashboard）

---

## 関連ドキュメント

- [tasful-ui-final-checklist.md](./tasful-ui-final-checklist.md)
- [talk-staging-prelaunch-checklist.md](./talk-staging-prelaunch-checklist.md)
- [anpi-supabase-production-checklist.md](./anpi-supabase-production-checklist.md)
- [gen-ai-voice-manual-checklist.md](./gen-ai-voice-manual-checklist.md)
- [supabase/STRIPE_FEATURED_SETUP.md](../supabase/STRIPE_FEATURED_SETUP.md)
