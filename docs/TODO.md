# TASFUL TODO（正本）

**最終更新:** 2026-06-26（Builder AI Vision Phase 2 commit `4aff9ec`）  
**Git HEAD:** `4aff9ec`（`cf-pages-deploy` · Vision Phase 2 **commit 済** · **git push 未実施**）  
**優先:** 上から順。完了したら本ファイルと [PROJECT_STATUS.md](./PROJECT_STATUS.md) を更新。

---

## P0 — 直近

### 1. 残存未コミット変更 440 件の整理

| 項目 | 内容 |
| --- | --- |
| 状態 | working tree に 440 件（196 M / 1 D / 243 ??） |
| 方針 | `git add -A` 禁止。領域別に選別ステージング（AI 時は `reports/ai-selected-staging-plan.md` 参照） |
| 主要カテゴリ | dist 248 · Live 54 · Builder HTML 36 · Admin AI/Ops 25 · Reports 17 · TLV sim 11 · ANPI 10 等 |
| 参照 | `reports/ai-selected-staging-result.md` §8 |

**サブタスク**

- [ ] カテゴリごとに「コミット / 破棄 / 保持」の判定表を作る
- [ ] `ai-model-gateway.js`（+73 行）— Gateway レビュー後に別コミットか revert
- [ ] `package.json`（wrangler compatibility-date）— 単独コミットか revert
- [ ] `supabase/functions/_shared/ai-attachments.ts` — Gateway セットで判断
- [ ] 本 `docs/` 正本セットのコミット（別 PR）

---

### 2. TASFUL AI 本番接続（Production Ready · §P0-2）

| 項目 | 内容 |
| --- | --- |
| 状態 | 機能は `5ed9672` で完成。Production Ready 判定は **NO**（preflight） |
| 参照 | `reports/tasful-ai-production-preflight.md`, `reports/tasful-ai-workspace-phase1-deploy.md` |
| **P0-2 残件（運用）** | Serper credits チャージ · CF Access Service Token · Phase 2（Edge + DB quota） |

**サブタスク**

| タスク | 状態 | 根拠 |
| --- | --- | --- |
| **Workspace 課金 enforcement Phase 1**（クライアント） | **完了** | commit `2a43fe5223457327edf525bf4b56604d0c5e43a1` · Production https://tasufull-article.pages.dev · Direct Upload deploy 2026-06-26 |
| Phase 1 prod smoke | **完了** | **12/12 PASS** · console 0 · network 0 |
| Phase 1 browser regression | **完了** | `test-ai-workspace-usage-enforcement-browser.mjs` **15/15** · `test-tasful-ai-final-smoke-browser.mjs` **53/53** |
| **Serper credits** | **未実装（運用）** | recovery §⑥ · `Not enough credits` |
| **CF Access Service Token** | **未実装（運用）** | `CF_ACCESS_CLIENT_ID/SECRET` — E2E 自動化 |
| **Workspace 課金 enforcement Phase 2** | **未実装** | Edge + DB quota · `reports/tasful-ai-workspace-enforcement-design.md` |

- [x] Workspace 課金 enforcement **Phase 1**（クライアント · `2a43fe5` · Production deploy）
- [ ] Supabase Edge デプロイ（chat functions · `ai-attachments.ts` 含む）→ Vision 再プローブ
- [ ] Gemini billing / Serper credits 解消（**Serper = 運用チャージ**）
- [ ] Cloudflare Access **Service Token** 設定
- [ ] Cloudflare Access 下での本番 URL E2E（MIME / 認証後到達）
- [ ] Workspace 課金 enforcement **Phase 2**（Edge + DB quota）
- [ ] 動画/音楽 API — `ai-media-gen-config.js` で `enabled: true` + Edge Function

---

## P1 — 製品別

### 3. Builder AI P2-C

| 項目 | 内容 |
| --- | --- |
| 状態 | P2-B まで staging 準備済み（`5ed9672`）。**本番 DB / RLS 未適用** |
| 参照 | `reports/builder-ai-p2-b.md` §9 |

- [ ] staging DB に `sql/builder-ai-drafts-staging.sql` 適用（本番禁止）
- [ ] `custom_access_token_hook` 拡張 — `builder_*` claims
- [ ] draft store の Supabase 正本化（list/read DB 優先）
- [ ] RLS JWT 自動検証
- [ ] Live Edge E2E（`BUILDER_AI_E2E_LIVE_EDGE=1`, staging のみ）
- [ ] 本番 URL から dev query role 無効化

---

### 4. Platform — Featured / お気に入り / Google OAuth

| 項目 | 内容 |
| --- | --- |
| 状態 | Finish Phase コミット済（`5ed9672`）。コード上の残は finish レポート §9 |
| 参照 | `reports/platform-finish-phase.md` §6, §9 |

- [ ] **index.html ホーム featured カード** — バッジ未組込（一覧カードは対応済）
- [ ] **お気に入り DB 同期** — Supabase favorites + folder meta サーバー保存
- [ ] **Google OAuth 実機確認** — Supabase Dashboard 設定後 E2E（staging → production）
- [ ] （任意）検索ハブ listing pool 初回ロード · 非 AI バッジ説明

---

## 方針（確定 · 2026-06-26）

### AI プロバイダ分担

| 領域 | 本番 API |
| --- | --- |
| AI 秘書 | **DeepSeek** |
| TASFUL AI | **OpenAI** |
| Builder AI | **OpenAI** |
| Builder AI 将来（Gemini Live 現場診断） | Gemini Live — [builder-ai-gemini-live-field-diagnosis-backlog.md](./builder-ai-gemini-live-field-diagnosis-backlog.md) |

Groq / Cerebras / Claude は **現時点では不要**。

### AI 秘書 — DeepSeek Adapter Phase 1 / OpsContextBuilder Phase 2（P0-3）

| 区分 | 状態 | 根拠 |
| --- | --- | --- |
| **Phase 1 実装** | **完了 · commit 済** | `6c70985` · `reports/secretary-deepseek-adapter-phase1.md` |
| **Phase 2 実装** | **完了 · commit 済** | `840a574` · `reports/secretary-ops-context-builder-phase2.md` |
| **DeepSeek API 到達** | **済** | `configured:true` · 502 `Insufficient Balance` まで（ローカル） |
| **本番 deploy** | **No-Go** | `reports/secretary-deepseek-deploy-triage.md` |

**Phase 1 完了（実装 · `6c70985`）**

- [x] DeepSeek 専用 Adapter + Cloudflare Pages Function（`/api/secretary-deepseek-chat`）
- [x] `admin-ai-secretary-phase2.js` を Gateway から Adapter へ切替（AD-010 · Gateway 非混在）
- [x] `DEEPSEEK_API_KEY` 読み込み（ローカル · リポジトリルート `.env` + Pages Functions 用 `deploy/cloudflare/dist/.dev.vars`）
- [x] DeepSeek API 到達（`configured:true` · 残高不足時 502 `Insufficient Balance` まで確認）
- [x] Secret 未設定時 503 · API エラー時 502 の graceful モックフォールバック
- [x] `npm run build:pages` · browser **12/12** + **8/8** PASS

**Phase 2 完了（実装 · `840a574`）**

- [x] **OpsContextBuilder** — 6 ドメイン正規化 · PII マスク · phase2 `systemPrompt` 注入
- [x] TLV stub · top-N / char budget · intent regex · inbox ID diff
- [x] 単体 **7/7** · **17/17** · E2E **11/11** PASS（file + dev server）
- [x] Gateway / DeepSeek Adapter 契約 **非変更**

**本番 deploy 前残件（未完了 · deploy No-Go）**

- [ ] Cloudflare Pages **Production** Secret `DEEPSEEK_API_KEY`（Encrypted）登録
- [ ] **DeepSeek 残高チャージ**（アカウント側）
- [ ] **HTTP 200** · `usedDeepSeek:true` · assistant text の実応答確認（ローカル / Staging）
- [ ] Production **smoke**（本番 URL · 秘書 1 往復 · 運営コンテキスト付き）
- [ ] **ahead 4** の push / deploy **スコープ整理**（secretary 2 + tasful-ai workspace 2 — secretary のみ載せる場合は要方針）
- [ ] working tree **124 件**を deploy に混ぜない（HEAD + clean `build:pages` を正とする）

- [x] 画面遷移 / 件数 / DB 検索 / フィルターは **プログラム処理のまま**（LLM 不使用）
- 参照: [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) · [DECISIONS.md](./DECISIONS.md) AD-010 · `reports/secretary-deepseek-deploy-triage.md`

---

## Backlog（将来実装 · P0/P1 優先度外）

**注:** 以下は実装予定の記録のみ。**Platform Critical / UI 修正の優先順位は変更しない。**

| 項目 | 状態 | 参照 |
| --- | --- | --- |
| **Platform Coupon System** | 📋 未着手 | [platform-coupon-system-backlog.md](./platform-coupon-system-backlog.md) |
| **AI Secretary Trend Scout** | 📋 未着手 | [ai-secretary-trend-scout-backlog.md](./ai-secretary-trend-scout-backlog.md) |
| **TASFUL Site Assistant Phase 1** | ✅ commit 済 | `ac864b4` · [tasful-site-assistant-backlog.md](./tasful-site-assistant-backlog.md) · `reports/tasful-site-assistant-phase1.md` |
| **TASFUL Site Assistant Phase 2+** | 📋 未着手 | 同上（Feedback Launcher · OPS 集約） |
| **Builder AI Vision Phase 2**（Gemini Vision · Gateway 流用） | ✅ commit 済 | `4aff9ec` · [BUILDER_AI.md](./AI/BUILDER_AI.md) · `reports/builder-ai-vision-phase2.md` |
| **Builder AI Gemini Live / Voice** | 📋 未着手 | [builder-ai-gemini-live-field-diagnosis-backlog.md](./builder-ai-gemini-live-field-diagnosis-backlog.md) |

- 店舗・出品者のクーポン発行・管理（円/％ OFF · 期間 · 上限 · 対象商品等）
- 購入者の表示・カート適用・利用済み/不可理由
- 運営一覧・強制停止・不正監視 · AI 秘書連携設計
- 将来: TASFUL 共通クーポン基盤として Builder / TLV / TASFUL AI へ拡張可能な設計前提

**AI Secretary Trend Scout（経営参謀 · トレンド提案）**

- 最新トレンド・市場・競合・補助金・法改正・SNS/検索傾向の収集と TASFUL 向け提案
- 表示候補: Morning Summary · Daily Inbox · Command Center · OPS WATCH · 月次レポート
- 提案カード: 活用案 · 優先度 · 難易度 · 期待効果 · **出典必須** · 採用/保留/却下
- 表現: 「流行っている」断定を避け **複数ソースからの増加傾向** で記載
- **実装なし** · P0/P1 外 · Platform Critical 優先順位は変更しない

**TASFUL Site Assistant Phase 1（サイトAI ウィジェット · ✅ 実装）**

- 全ページ右下 **「TASFUL サイトAI」** · cross-matching / FAQ 流用（Gateway / 秘書 非接続）
- 232 HTML 注入 · browser **18/18 PASS** · commit `ac864b4` · **未デプロイ**
- Phase 2+: 通報 · 問い合わせフォーム · OPS / AI 秘書集約 — **未着手**

**TASFUL Site Assistant Phase 2+（Feedback Launcher · 未着手）**

- 離脱防止: 問い合わせ · **通報** · 不具合報告 · サイト内検索の常設入口
- 必須7入口: 検索 / お問い合わせ / 通報 / 不具合 / 要望 / FAQ / **TASFUL AI を開く**
- OPS / AI 秘書へ将来集約 · P0/P1 外

**Builder AI Vision Phase 2（Gemini Vision · ✅ 実装）**

- 既存 Gateway → `gemini-chat` · 画像 + 相談文 · 4MB · 回答 8 項目 + 免責
- UI Phase 1 `5d28acc` 上に接続 · commit `4aff9ec` · **未デプロイ**
- Live / Voice — UI stub のみ · **未着手**

**Builder AI Gemini Live / Voice（未着手）**

- カメラ映像 · 画面共有でのリアルタイム相談 · 現場診断補助 · 劣化指摘 · 見積 / 資材 / 施工提案 · チェックリスト · 写真付き現場レポート
- **Builder AI のみ** — AI 秘書 · Platform · TLV · TASFUL AI には実装しない
- AI は補助ツール。最終判断は現地確認 · 有資格者 · 専門業者。**診断結果のみで施工判断しない**
- **着手:** 利益安定 · Builder AI 基本機能完成後 · P0/P1 外

---

## P2 — ドキュメント・運用

- [ ] `docs/` 正本をコミット
- [ ] `reports/ai-selected-staging-result.md` をコミットまたは docs へ統合
- [ ] 440 件整理後に `PROJECT_STATUS.md` の working tree 件数を更新

---

## 完了済み（参照用）

| 項目 | 完了根拠 |
| --- | --- |
| Builder AI P1 + tools adaptation | `5ed9672` · 85/85 + 135/135 PASS |
| Platform Next + Finish（AI 入口） | `5ed9672` · 37+37 PASS |
| TASFUL AI Final Phase | `5ed9672` · 31/31 PASS |
| AI 規約 / 免責 | `5ed9672` · 32/32 PASS |
| TLV → TASFUL AI 入口 | `5ed9672` · 16/16 PASS |
| AI 選別コミット | `5ed9672` |
| Workspace enforcement Phase 1 | `2a43fe5` · Production deploy · smoke 12/12 · browser 15/15 + 53/53 · `reports/tasful-ai-workspace-phase1-deploy.md` |
| AI 秘書 DeepSeek Adapter Phase 1 | `6c70985` · Adapter + CF Pages Function · AD-010 · 503/502 fallback · API 到達 · `reports/secretary-deepseek-adapter-phase1.md` |
| AI 秘書 OpsContextBuilder Phase 2 | `840a574` · 6 ドメイン context 注入 · PII マスク · `reports/secretary-ops-context-builder-phase2.md` |
| TASFUL Site Assistant Phase 1 | `ac864b4` · 232 HTML 注入 · cross-search/FAQ 流用 · browser 18/18 · `reports/tasful-site-assistant-phase1.md` |
| Builder AI UI Phase 1 | `5d28acc` · 現場診断 UI シェル · Live/Voice stub |
| Builder AI p1-review test follow-up | `46677eb` · legacy details open in UI checks |
| Builder AI Vision Phase 2 | `4aff9ec` · Gateway attachments → gemini-chat · vision 8/8 + ui 14/14 + review 135/135 · `reports/builder-ai-vision-phase2.md` |
