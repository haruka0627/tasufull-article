# AI 運営秘書（Secretary AI）

**最終更新:** 2026-06-27（Phase 6-A Google Workspace 設計）  
**ステータス:** **Production Ready** · RELEASE FROZEN  
**確定日:** 2026-06-17

---

## 概要

AI 運営秘書は **TASFUL 運営 OPS 専用**（`admin-operations-dashboard` 系）。Builder AI · TASFUL AI Workspace · Platform 入口とは **独立**。

| 項目 | 内容 |
| --- | --- |
| **リリース** | RELEASE OK · **RELEASE FROZEN** |
| **P0 / P1** | なし（2026-06-17 時点） |
| **本番 AI API** | **DeepSeek API**（確定 · [DECISIONS.md](../DECISIONS.md) AD-010） |
| **本番接続レビュー** | PASS（要修正 0） |

---

## 本番 AI API — DeepSeek（確定）

| 項目 | 内容 |
| --- | --- |
| **プロバイダ** | **DeepSeek API** |
| **理由** | 運営データ要約 · 優先順位付け · DB 検索結果の整理 · 問い合わせ / 通知 / チケット内容の自然文要約 · **API コスト削減** |
| **非採用（現時点）** | Groq · Cerebras · Claude — **不要** |
| **TASFUL AI Gateway との関係** | AI 秘書は **独立 surface**。**`TasuAiModelGateway` に混在させない**。本番は **秘書専用 DeepSeek Adapter** + **Cloudflare Pages Function**（`/api/secretary-deepseek-chat`） |
| **API Key 管理** | **`DEEPSEEK_API_KEY`** — 本番 Cloudflare Pages/Workers Secret · ローカル `.env` + Pages Functions ローカル dev 用 `deploy/cloudflare/dist/.dev.vars` · **Supabase Secret 不使用** · クライアント非公開 |

### 基本データフロー（本番想定）

```
DB / Supabase
  ↓ 必要データ取得（プログラム）
DeepSeek API
  ↓ 要約 · 優先順位付け · 自然文生成
管理者画面（admin-operations-dashboard 系）へ表示
```

### AI を使わない処理（必須）

以下は **通常のプログラム処理** とし、LLM を呼ばない。

- 画面遷移
- 件数表示
- DB 検索
- フィルター処理

AI は **取得済みデータの要約・優先付け・自然文化** に限定する。

---

## TASFUL 全体の AI プロバイダ分担（参照）

| 製品 / 領域 | 本番 AI API | 備考 |
| --- | --- | --- |
| **AI 秘書** | **DeepSeek** | 本ドキュメント |
| **TASFUL AI** | **OpenAI** | [TASFUL_AI.md](./TASFUL_AI.md) |
| **Builder AI** | **OpenAI** | [BUILDER_AI.md](./BUILDER_AI.md) |
| **Builder AI 将来 Phase 1** | Gemini Vision（静止画現場診断） | [builder-ai-gemini-live-field-diagnosis-backlog.md](../builder-ai-gemini-live-field-diagnosis-backlog.md) · P2-C 後 |
| **Builder AI 将来 Phase 2** | Gemini Live（リアルタイム現場診断） | 同上 · Phase 1 後 |
| Groq / Cerebras / Claude | — | 現時点では採用しない |

---

## スコープ

| 担当 | 非担当 |
| --- | --- |
| Inbox · Connect triage · OPS 支援 | Builder 案件文案 |
| 運営ダッシュボード AI | Platform 掲載マッチング |
| Action Registry / postUserCommand | TASFUL AI 一般チャット |

---

## AI コミット `5ed9672` との関係

| 項目 | 内容 |
| --- | --- |
| **含む** | なし — secretary ファイルは意図的に除外 |
| **working tree** | `admin-ai-secretary-phase*.js` 等が **未コミット** で存在（[KNOWN_ISSUES.md](../KNOWN_ISSUES.md) KI-008） |
| **未確認** | phase ファイルが v1.1 凍結と矛盾するか — diff 監査待ち |

---

## AI秘書 Voice — Realtime Live opt-in（✅ Phase 5-D · `e43c9c0`）

| 項目 | 内容 |
| --- | --- |
| **方式** | OpenAI Realtime Live opt-in（Voice Core Phase 5-D） |
| **surface** | `ops_secretary` |
| **ページ** | `admin-operations-dashboard.html`（talk-ops-room ではない） |
| **コントローラ** | `admin-ai-secretary-voice-controller.js` · `admin-ai-secretary-voice-integration.js` |
| **フラグ（両方 ON で live）** | `window.__TASU_VOICE_CORE_OPENAI_LIVE__` · `window.__TASU_VOICE_LIVE_OPS_SECRETARY__` |
| **デフォルト** | mock（flags OFF） |
| **live 失敗時** | mock fallback |
| **Edge** | Supabase `openai-realtime-session` · ephemeral token · Kill Switch + Rate Limit Phase 1 |

**テスト:** `scripts/test-secretary-voice-integration-phase1.mjs` **25/25** · `scripts/test-secretary-ai-voice-integration-phase1.mjs` **35/35 PASS**

**報告:** `reports/voice-phase5d-complete.md`

**注:** DeepSeek テキストチャット（AD-010）とは独立。Voice は OpenAI Realtime の opt-in パス。

---

## テスト（参考）

| スクリプト | 備考 |
| --- | --- |
| `scripts/test-admin-ai-secretary-text-chat-browser.mjs` | dashboard + talk-ops-room テキストチャット |
| `scripts/test-secretary-deepseek-adapter-browser.mjs` | DeepSeek Adapter · OpsContext ロード |
| `scripts/test-secretary-ops-context-intent.mjs` | intent 解決（7 checks） |
| `scripts/test-secretary-ops-context-builder-unit.mjs` | build / sanitize / prompt（17 checks） |
| `scripts/test-secretary-ops-context-e2e.mjs` | systemPrompt 注入 E2E（3 intent パターン） |

---

## 残タスク — DeepSeek 接続（P0 · Phase 1 / 運用）

| 項目 | 内容 |
| --- | --- |
| **優先度** | **P0** — 凍結 v1.1 内の接続 / Critical タスク |
| **Phase 1 実装** | **完了（未コミット）** — `reports/secretary-deepseek-adapter-phase1.md` |
| **アーキテクチャ** | 秘書専用 **DeepSeek Adapter** + **Cloudflare Pages Function** — Gateway ルート追加なし |
| **参照** | [TODO.md](../TODO.md) §P0-3 · [DECISIONS.md](../DECISIONS.md) AD-010 |

### Phase 1 — 完了（実装）

- [x] DeepSeek 専用 Adapter / Pages Function 設計 · 実装
- [x] Cloudflare Pages Function 経由（`/api/secretary-deepseek-chat` · 同一オリジン）
- [x] `DEEPSEEK_API_KEY` 読み込み（ローカル dev 確認済）
- [x] DeepSeek API 到達（`configured:true` · 残高不足時 502 まで）
- [x] `admin-ai-secretary-phase2.js` を Gateway から秘書専用 Adapter へ切替（AD-010）
- [x] 503（Secret 未設定）/ 502（API エラー）時の graceful モックフォールバック
- [x] ブラウザ回帰 **10/10** · **8/8** PASS

### 運用残件 — 未完了

- [ ] DeepSeek **残高チャージ**
- [ ] **HTTP 200** · `usedDeepSeek:true` · assistant text の実応答確認
- [ ] 本番 Cloudflare Pages Secret `DEEPSEEK_API_KEY`（Encrypted）登録
- [ ] Production **deploy** + **smoke**

---

## OpsContextBuilder — Phase 2（実装完了 · 未コミット）

**レポート:** `reports/secretary-ops-context-builder-phase2.md` · 設計: `reports/secretary-ops-context-builder-design.md`

| 項目 | 内容 |
| --- | --- |
| **新規** | `TasuSecretaryOpsContextBuilder`（`admin-ai-secretary-ops-context.js`）+ PII サニタイズ（`admin-ai-secretary-ops-context-sanitize.js`） |
| **6 ドメイン** | support · builder · platform · stripe_connect · ai_usage · **tlv（stub）** |
| **注入経路** | `admin-ai-secretary-phase2.js` — `buildSystemPrompt()` → `Adapter.completeTurn({ systemPrompt })` |
| **top-N / summary** | ドメイン別 top-5 · KPI / 優先候補 · ~6000 字 char budget |
| **PII マスク** | email / phone / URL / UUID / Stripe acct / パートナー名 |
| **intent** | 軽量 regex（例: Builderだけ · 昨日から増えた · 本日の優先） |
| **非変更** | **`TasuSecretaryDeepSeekAdapter` 契約** · **`ai-model-gateway.js` / Gateway** · Edge body スキーマ |

### Phase 2 — 完了（実装）

- [x] OpsContextBuilder 新規 · 既存 collector 委譲（Daily Inbox · Hub · KPI）
- [x] 6 ドメイン正規化 · TLV stub · AI利用状況集計
- [x] PII サニタイズ · inbox ID diff（localStorage `tasu_secretary_inbox_ids_v1`）
- [x] phase2 context 注入 · dashboard snapshot TTL 60s
- [x] 単体 **7/7** · **17/17** · ブラウザ回帰 **12/12** · **8/8** · E2E **11/11**（file + dev server）

（DeepSeek 本番応答 · deploy は上記 Phase 1 運用残件を参照）

---

## Operations Orchestrator — Phase 5-A（実装完了 · 未コミット）

**レポート:** `reports/secretary-orchestrator-phase5a.md` · 設計: `reports/ai-secretary-phase5-orchestrator-plan.md`

| 項目 | 内容 |
| --- | --- |
| **新規** | `TasuSecretaryOrchestrator` + Registry / Classifier / Human Gate / Task Queue |
| **19 Agent** | Registry 登録のみ — **実行は stub**（Cursor SDK 未接続） |
| **分類** | Phase 5-A: regex + keyword。Phase 5-B: DeepSeek structured（`TasuSecretaryDeepSeekClassifier`）+ regex fallback |
| **Human Gate** | L1–L4 **判定のみ** — 送信 · 自動返信 **なし** |
| **Task Queue** | メモリ · status: pending / running / waiting_human / completed / failed |
| **phase2 統合** | `sendMessage` → Classifier → Registry → Queue → Gate → `[data-ops-phase2-agent-levels]` |
| **非変更** | Builder / Platform / TLV · Gateway · 既存 `admin-ai-human-send-gate.js` |

### Phase 5-A — 完了（実装）

- [x] 5 モジュール新規 · dashboard / talk-ops-room スクリプト読込
- [x] `admin-ai-secretary-phase2.js` 最小 hook
- [x] `scripts/test-secretary-orchestrator-phase5a.mjs` — Registry / Classifier / Gate / Queue / phase2 / build

### Phase 5-B — 完了（実装）

- [x] OpsEvent ingest（inbox · ops-watch · CI）
- [x] parseTalkOpsCommand 併用 · DeepSeek structured 分類 + regex fallback
- [x] Human Send Gate L3 統合 · L4 オーナー固定
- [x] Queue UI · 朝レポート手動ボタン
- [x] `scripts/test-secretary-orchestrator-phase5b.mjs` — 5-B 26 + 5-A 回帰 34 + build

### Phase 6 以降

| Phase | 内容 | 状態 |
| --- | --- | --- |
| **6-A Google Workspace** | Gmail / Calendar / Contacts / Drive 調査・設計 | ✅ 設計完了 — `reports/secretary-google-workspace-plan.md` |
| **6-B OAuth + Token Vault** | OAuth PKCE · Edge skeleton · Vault RLS · UI 接続状態 | ✅ 実装 — `reports/secretary-google-phase6b-oauth-token-vault.md` |
| **6-D Gmail write + HSG** | 返信案 · drafts.create · drafts.send · Human Gate | ✅ 実装 — `reports/secretary-google-phase6d-gmail-write-human-gate.md` |
| **6-E Calendar read-only** | calendarList · events.list/get · preset · keyword · UI カード | ✅ 実装 — `reports/secretary-google-phase6e-calendar-readonly.md` |
| **6-F Calendar write + HSG** | events.insert/update/delete · Human Gate · 自然言語作成 | ✅ 実装 — `reports/secretary-google-phase6f-calendar-write-human-gate.md` |
| **6-G Contacts read-only** | people.connections/search/get · UI カード · 補助導線 | ✅ 実装 — `reports/secretary-google-phase6g-contacts-readonly.md` |
| **6-H Drive read-only** | files.list/get/export · フォルダ · 検索 · mimeType · recent | ✅ 実装 — `reports/secretary-google-phase6h-drive-readonly.md` |
| **7-A Orchestrator 拡張** | Cursor SDK · cron · L1 自動送信 · OpsEvent 永続化（旧 Phase 6 計画） | 📋 未着手 |

---

## Google Workspace Integration — Phase 6-A（✅ 設計 · 2026-06-27）

**調査・設計のみ** — 実装 · OAuth 作成 · Secret · API 呼び出しは **未実施**。

| 項目 | 内容 |
| --- | --- |
| **優先順位** | ① Gmail → ② Calendar → ③ Contacts → ④ Drive |
| **Runtime Agent** | `google-mail` · `google-calendar` · `google-contacts` · `google-drive`（Registry 拡張案） |
| **Text / Voice** | 共通 Orchestrator → Workspace Facade → Edge API（Voice は transcript 共用） |
| **LLM** | DeepSeek = 要約 · 返信案のみ（AD-010）· **Google API = プログラム** |
| **OAuth** | Authorization Code + PKCE · offline · refresh token は **サーバー vault のみ** |
| **Platform OAuth 分離** | 別 GCP プロジェクト推奨 · Supabase Auth ユーザー OAuth とは独立 |
| **Human Gate** | 送信 · 予定作成/変更/削除 · Drive 共有 = **L3+** |
| **MVP 候補** | 6-B + 6-C + 6-D（Gmail read/write） |

**報告:** `reports/secretary-google-workspace-plan.md`

**対象外（Phase 6-A）:** Builder · TASFUL AI · Platform · Voice Core 変更

---

## Google Workspace Integration — Phase 6-B（✅ 実装 · 2026-06-27）

OAuth + Token Vault + Edge skeleton。**Gmail 等の実 API は Phase 6-C 以降。**

| 項目 | 内容 |
| --- | --- |
| **OAuth** | Authorization Code + PKCE · `access_type=offline` · mock モード対応 |
| **Edge** | `secretary-google-oauth` · `secretary-google-tools`（501 stub） |
| **Vault** | `secretary_google_token_vault` · RLS · service_role のみ |
| **Client** | `admin-ai-secretary-google-oauth-client.js` — token 非露出 |
| **UI** | `Google未接続` / `Google接続済み` · 接続/切断ボタン |
| **Secret 名** | `SECRETARY_GOOGLE_CLIENT_ID` · `SECRETARY_GOOGLE_CLIENT_SECRET` · `SECRETARY_GOOGLE_REDIRECT_URI` |

**テスト:** `scripts/test-secretary-google-oauth-phase6b.mjs`

**報告:** `reports/secretary-google-phase6b-oauth-token-vault.md`

---

## Google Workspace Integration — Phase 6-C（✅ 実装 · 2026-06-27）

Gmail **read-only**。送信 · 下書き · 削除は **Phase 6-D まで禁止**。

| 項目 | 内容 |
| --- | --- |
| **API** | `messages.list` · `messages.get` · `threads.get` · `labels.list` |
| **検索** | Gmail `q` · preset（未読 / 重要 / 添付 / 受信トレイ） |
| **添付** | metadata のみ（filename · mimeType · size · attachmentId）— 本文 DL なし |
| **Token** | `ensureGoogleAccessToken` — 期限 60s 前に refresh |
| **Edge** | `secretary-google-tools` · `action=gmail` · mock fixtures |
| **Client** | `admin-ai-secretary-google-gmail-client.js` |
| **UI** | Gmail カード · preset chips · 検索フォーム · read-only 注記 |

**テスト:** `scripts/test-secretary-google-gmail-phase6c.mjs`

**報告:** `reports/secretary-google-phase6c-gmail-readonly.md`

**禁止（6-D まで）:** `messages.trash` · `messages.delete` → `gmail_write_forbidden`

---

## Google Workspace Integration — Phase 6-D（✅ 実装 · 2026-06-27）

Gmail **write + Human Gate**。自動送信禁止。

| 項目 | 内容 |
| --- | --- |
| **返信案** | DeepSeek 文案生成のみ · `buildReplyPlan` で deterministic To/Subject |
| **下書き** | `drafts.create` — HSG 承認後のみ Edge 実行 |
| **送信** | `drafts.send` 優先 · `messages.send` は fallback · HSG + 確認チェック必須 |
| **HSG** | `enqueueFromGmailDraft` · `source: gmail` · `executeHumanSendAction` 拡張 |
| **UI** | 返信案を作る · 下書き保存 · 送信確認 · キャンセル · 状態バッジ |
| **禁止** | trash/delete · 確認なし送信 · token クライアント露出 |

**テスト:** `scripts/test-secretary-google-gmail-phase6d.mjs`

**報告:** `reports/secretary-google-phase6d-gmail-write-human-gate.md`

---

## Google Workspace Integration — Phase 6-E（✅ 実装 · 2026-06-27）

Google Calendar **read-only**。予定変更 · Human Gate · DeepSeek は **今回なし**。

| 項目 | 内容 |
| --- | --- |
| **API** | `calendarList.list` · `events.list` · `events.get` |
| **検索** | today · tomorrow · this_week · next_7_days · keyword · custom range |
| **Edge** | `action=calendar_read` · mock fixtures |
| **Client** | `admin-ai-secretary-google-calendar-client.js` |
| **UI** | Mail / Calendar タブ · 予定カード · 詳細表示 |
| **OAuth** | `calendar.readonly` scope 追加 · Token Vault 共用 |

**テスト:** `scripts/test-secretary-google-calendar-phase6e.mjs`

**報告:** `reports/secretary-google-phase6e-calendar-readonly.md`

**禁止:** `events.insert/update/delete` on `calendar_read` → `calendar_read_only` (403). Write は **Phase 6-F** `action=calendar_write` + Human Gate。

---

## Google Workspace Integration — Phase 6-F（✅ 実装 · 2026-06-27）

Google Calendar **write + Human Gate**。確認なし実行禁止。定期予定編集は対象外。

| 項目 | 内容 |
| --- | --- |
| **API** | `events.insert` · `events.update` · `events.delete` |
| **Edge** | `action=calendar_write` · `humanGateApproved` + `pendingId` 必須 |
| **HSG** | `enqueueFromCalendarEvent` · `source: calendar` |
| **DeepSeek** | `parseEventIntent` — 日時/タイトル/場所/参加者/説明の抽出のみ |
| **UI** | 予定を作成/変更/削除 · 内容確認 · 承認/キャンセル · 状態バッジ |
| **OAuth** | `calendar.events` scope 追加 · Token Vault 共用 |
| **Read 維持** | Phase 6-E `calendar_read` は read-only のまま |

**テスト:** `scripts/test-secretary-google-calendar-phase6f.mjs`

**報告:** `reports/secretary-google-phase6f-calendar-write-human-gate.md`

**禁止:** Human Gate なし write → `human_gate_required` (403) · token クライアント露出 · 定期予定編集

---

## Google Workspace Integration — Phase 6-G（✅ 実装 · 2026-06-27）

Google Contacts **read-only**。作成/更新/削除 · Human Gate · DeepSeek は **今回なし**。

| 項目 | 内容 |
| --- | --- |
| **API** | `people.connections.list` · `people.searchContacts` · `people.get` |
| **Edge** | `action=contacts_read` · mock fixtures |
| **Client** | `admin-ai-secretary-google-contacts-client.js` |
| **UI** | Mail / Calendar / **Contacts** タブ · 名前/メール/電話/会社/メモ |
| **補助導線** | Gmail返信へ（`to:` 検索）· Calendar参加者へ（作成入力プリフィル） |
| **OAuth** | `contacts.readonly` scope 追加 · Token Vault 共用 |

**テスト:** `scripts/test-secretary-google-contacts-phase6g.mjs`

**報告:** `reports/secretary-google-phase6g-contacts-readonly.md`

**禁止:** `people.createContact/updateContact/deleteContact` → `contacts_read_only` (403)

---

## Google Workspace Integration — Phase 6-H（✅ 実装 · 2026-06-27）

Google Drive **read-only**。作成/更新/削除 · 権限変更 · アップロード · Human Gate は **今回なし**。

| 項目 | 内容 |
| --- | --- |
| **API** | `files.list` · `files.get` · `files.export` |
| **検索** | keyword · mimeType filter · recent preset · フォルダ表示 |
| **Export** | Google Docs/Sheets/Slides → テキスト抽出（plain/csv） |
| **Edge** | `action=drive_read` · mock fixtures |
| **Client** | `admin-ai-secretary-google-drive-client.js` |
| **UI** | Mail / Calendar / Contacts / **Drive** タブ · パンくず · 詳細 · 抽出プレビュー |
| **OAuth** | `drive.readonly` scope 追加 · Token Vault 共用 |

**テスト:** `scripts/test-secretary-google-drive-phase6h.mjs`

**報告:** `reports/secretary-google-phase6h-drive-readonly.md`

**禁止:** `files.create/update/delete` · `permissions.*` · `files.upload` → `drive_read_only` (403)

---

## Operations Orchestrator — Phase 5-C（実装完了 · 未コミット）

**レポート:** `reports/secretary-orchestrator-phase5c.md`

| 項目 | 内容 |
| --- | --- |
| **Command Center UI** | Queue 表 · フィルタ · L3/L4 パネル · 朝レポート · OpsEvent 詳細 |
| **L3 UI** | Human Send Gate pending · 承認（送信なし）/ 却下 / 編集保存 |
| **L4 UI** | `あなた対応` badge · ownerOnly 行強調 |
| **空状態** | Queue / CI / HSG 未接続でも崩れない |
| **テスト** | `scripts/test-secretary-orchestrator-phase5c.mjs` — 20 + 5-B + 5-A + build |

### Phase 5-C — 完了（実装）

- [x] `TasuSecretaryCommandCenterUI` · dashboard / talk-ops-room 統合
- [x] `approvePendingWithoutSend` · `updatePendingProposal`（HSG 最小拡張）
- [x] Queue `urgency` + 多軸フィルタ

---

## 変更ルール（凍結）

- **許可:** Critical Bug · Security · Supabase 仕様追従
- **禁止:** 新機能 · UI 変更（v1.1 計画まで）

---

## 将来 Backlog（未着手 · v1.2 以降想定）

| 項目 | 参照 |
| --- | --- |
| **Trend Scout** — トレンド・市場・競合・補助金・法改正・SNS/検索傾向の収集と TASFUL 向け「検討してみては？」提案 | [ai-secretary-trend-scout-backlog.md](../ai-secretary-trend-scout-backlog.md) |
| **Site Assistant 受信** — 問い合わせ · **通報** · 不具合 · 要望の OPS 集約（`inquiry` / `report` / `bug_report` / `feature_request` / `navigation_help`） | [tasful-site-assistant-backlog.md](../tasful-site-assistant-backlog.md) |

- 経営参謀 · マーケ支援 · 新機能/事業アイデア提案 · TASFUL 成長支援
- 表示候補: Morning Summary · Daily Inbox · Command Center · OPS WATCH · 月次レポート
- 出典必須 · 「複数ソースから増加傾向」表現 · 採用/保留/却下の判断フロー
- **P0/P1 外** · Platform Critical 優先順位は変更しない

---

## 関連

- [TASFUL_AI.md](./TASFUL_AI.md) — 一般 Workspace（別製品）
- [BUILDER_AI.md](./BUILDER_AI.md) — Builder 専用（別 surface）

**レポート:** `reports/secretary-deepseek-adapter-phase1.md`, `reports/secretary-ops-context-builder-phase2.md`, `reports/secretary-ops-context-builder-design.md`, `reports/ai-ops-secretary-release-status.md`, `reports/ai-secretary-text-chat-first.md`, `reports/secretary-google-workspace-plan.md`
