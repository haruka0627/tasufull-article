# AI 秘書 — 現在地レポート（P0-1 / Bundle E 完了後）

**実施日:** 2026-06-28  
**種別:** 調査・整理のみ（**build / deploy / commit なし**）  
**Git HEAD:** `bce78cc` — `build(tlv): sync live dist html after production cleanup`  
**working tree:** **clean**

---

## 1. Git 現在地

### 1.1 `git status --short`

```
（出力なし — clean）
```

### 1.2 直近 `git log --oneline -10`

| Hash | Message |
| --- | --- |
| `bce78cc` | build(tlv): sync live dist html after production cleanup |
| `778e61b` | build(docs): sync generated docs and config mirrors |
| `742cb9b` | build(admin): sync operations dashboard dist html |
| `ff1bbbf` | build(builder): sync builder dist html |
| `88ac0e1` | build(voice): sync voice core dist assets |
| `344f0f2` | build(business-directory): sync member auth routes to dist |
| `28b1fdd` | test(builder): refresh builder ai qa report for local server |
| `2d7d374` | test(tasful-ai): archive voice 5d1b manual verification evidence |
| `0e81055` | docs(builder): update release and mobile audit reports |
| `68b1023` | docs(repo): archive final working tree cleanup plan |

**判定:** Bundle E 完了後 HEAD ✓ · working tree clean ✓

### 1.3 AI 秘書関連コミット（参考 · ブランチ内）

| Hash | Message |
| --- | --- |
| `aa209d2` | feat(secretary): add Workspace activity and audit log |
| `2af444a` | feat(secretary): add Google Workspace orchestrator |
| `8ca7b7f` … `67ec43a` | Google Workspace Phase 6-B〜6-H |
| `025e685` | feat(secretary): Phase 5 Operations Orchestrator |
| `6c70985` / `840a574` | DeepSeek Adapter + OpsContextBuilder |
| `e08f394` | feat(secretary): text chat phases |

**注:** P0-1 選別コミット前の「未コミット」表記は **2026-06-28 docs refresh で解消**（KI-008 · `docs/KNOWN_ISSUES.md` 解決済み表へ移動）。

---

## 2. 用語整理（Phase 番号の衝突）

| 名称 | 意味 | 状態 |
| --- | --- | --- |
| **製品 Phase 5** | Operations Orchestrator（5-A/B/C） | ✅ 実装 · commit 済 |
| **`admin-ai-secretary-phase5.js`** | 仕事履歴フル表示 **UI スタブ** | スタブのみ（Orchestrator とは無関係） |
| **製品 Phase 6（Google）** | Gmail / Calendar / Contacts / Drive | ✅ 6-B〜6-H 実装 · commit 済 |
| **`admin-ai-secretary-phase6.js`** | Intelligence パネル（Operations Engine） | ✅ 実装 · Action 実行は disabled |
| **製品 Phase 7（Google）** | Workspace Orchestrator + Activity | ✅ 7-A/B 実装 · commit 済 |
| **`admin-ai-secretary-phase7.js`** | Command Center 最小ラッパ | △ 最小（本格 UI は `command-center-ui.js`） |
| **`admin-ai-secretary-phase8.js`** | 拡張パネル | スタブ |

---

## 3. ドキュメント整理

### 3.1 Phase ごとの完了状況

| Phase | 内容 | 実装 | commit | 本番運用 |
| --- | --- | --- | --- | --- |
| **Text Chat** | phase2 テキストチャット | ✅ | ✅ `e08f394` | mock fallback 可 |
| **DeepSeek P1** | Adapter + Pages Function | ✅ | ✅ `6c70985` | **No-Go**（Secret · 残高 · smoke） |
| **OpsContext P2** | 6 ドメイン context 注入 | ✅ | ✅ `840a574` | TLV stub |
| **Voice 5-D** | Voice Core opt-in | ✅ | ✅ `c6aa7a9` 等 | flags OFF デフォルト |
| **Orchestrator 5-A** | Registry · Classifier · Gate · Queue | ✅ | ✅ `025e685` | Agent 実行 stub |
| **Orchestrator 5-B** | OpsEvent · CI · HSG · 朝レポート · DeepSeek 分類 | ✅ | ✅ 同上 | CI fetch は dist 未同梱時 cache |
| **Orchestrator 5-C** | Command Center UI | ✅ | ✅ 同上 | — |
| **Google 6-A** | 調査・設計 | ✅ | ✅ docs/reports | — |
| **Google 6-B** | OAuth + Token Vault | ✅ | ✅ `67ec43a` | **mock モード可** · GCP Secret 未設定時 |
| **Google 6-C** | Gmail read-only | ✅ | ✅ `ff86582` | Edge mock fixtures |
| **Google 6-D** | Gmail write + HSG | ✅ | ✅ | Human Gate 必須 |
| **Google 6-E/F** | Calendar read/write + HSG | ✅ | ✅ | 同上 |
| **Google 6-G/H** | Contacts / Drive read-only | ✅ | ✅ | 同上 |
| **Google 7-A** | Workspace Orchestrator | ✅ | ✅ `2af444a` | 既存 API 横断のみ |
| **Google 7-B** | Activity / Audit Log | ✅ | ✅ `aa209d2` | sessionStorage 100 件 |
| **Intelligence** | phase6.js + engines | ✅ | ✅ | Action 候補 **未実行** |
| **Work History** | phase3/4/5.js | スタブ | ✅（空実装） | — |
| **phase8** | 拡張パネル | スタブ | ✅（空実装） | — |

### 3.2 未完了項目（P0 / MVP）

| 優先 | 項目 | 根拠 |
| --- | --- | --- |
| **P0** | DeepSeek 本番接続 | `DEEPSEEK_API_KEY` · 残高 · HTTP 200 · prod smoke — `secretary-deepseek-deploy-triage.md` |
| **P0** | Google OAuth 本番 Secret | `SECRETARY_GOOGLE_*` · 実 API 到達確認 |
| **MVP** | Agent Task 票 UI（Cursor 用 Markdown 出力） | Phase 5 設計 §7.4 · **未実装** |
| **MVP** | Workflow 定義（`wf_*` チェーン） | 設計 §5.7 · Registry は 19 Agent 登録のみ |
| **MVP** | Agent 実行（stub 脱却） | `executeAgentStub` のみ |
| **MVP** | dist / prod への secretary deploy smoke | admin dashboard + `/api/secretary-deepseek-chat` |

### 3.3 Backlog（将来 · P0/P1 外）

| 項目 | 参照 |
| --- | --- |
| **Trend Scout** | `docs/ai-secretary-trend-scout-backlog.md` |
| **Site Assistant → OPS 集約** | `docs/tasful-site-assistant-backlog.md` Phase 2+ |
| **Cursor SDK / Agent Runtime** | `ai-secretary-phase5-orchestrator-plan.md` §9.3 |
| **cron 朝/夜レポート** | 手動ボタンのみ実装 |
| **L1 完全自動返信** | Human Gate 統合後も送信未実装 |
| **TLV collector** | OpsContext stub · FEATURE FROZEN |
| **Floating shell 常駐** | `PERSISTENT_SHELL` スタブ |
| **Work History 本実装** | phase3/4/5 スタブ |
| **OpsEvent / Queue DB 永続化** | 現状メモリ / localStorage |
| **Automation Engine ↔ Orchestrator** | 別モジュール · 未統合 |

### 3.4 依存関係

```
DeepSeek Adapter (P1)
  └─ OpsContextBuilder (P2) ── phase2 systemPrompt
       └─ Orchestrator (5-A/B/C) ── phase2 sendMessage hook
            ├─ Human Send Gate (L3/L4)
            ├─ OpsEvent ← Daily Inbox / OPS WATCH / CI ingest
            └─ Command Center UI

Google OAuth (6-B) ── 6-C〜6-H clients ── 7-A Orchestrator ── 7-B Activity

Voice Core (5-D) ── phase2 イベント（DeepSeek とは独立 · OpenAI Realtime）

Automation Engine ── ✕ Orchestrator 未接続
ops-watch-analyzer ── Gateway 経由（秘書 DeepSeek とは別経路 · AD-010 遵守）
```

---

## 4. コード確認 — `admin-ai-secretary-phase*.js`

| ファイル | 状態 | グローバル | 呼び出し元 | 未接続 |
| --- | --- | --- | --- | --- |
| **phase2.js** | **実装済** | `TasuAdminAiSecretaryPhase2` | dashboard · talk-ops-room | — |
| **phase3.js** | **スタブ** | `TasuAdminAiSecretaryPhase3` | dashboard HTML | Work History 本体 |
| **phase4.js** | **スタブ** | `TasuAdminAiSecretaryPhase4` | 同上 | 同上 |
| **phase5.js** | **スタブ** | `TasuAdminAiSecretaryPhase5` | 同上 | 仕事履歴フル（名前衝突注意） |
| **phase6.js** | **実装済** | `TasuAdminAiSecretaryPhase6` | Intelligence パネル | Action 実行ボタン disabled |
| **phase7.js** | **最小実装** | `TasuAdminAiSecretaryPhase7` | Command Center home | CC 本体は `command-center-ui.js` |
| **phase8.js** | **スタブ** | `TasuAdminAiSecretaryPhase8` | dashboard HTML | 拡張パネル |

### 4.1 phase2 呼び出し関係（要約）

```
sendMessage(text)
  → TasuSecretaryOrchestrator.processMessageAsync (5-B)
  → TasuSecretaryOpsContextBuilder.build → buildSystemPrompt
  → TasuSecretaryDeepSeekAdapter.completeTurn (AD-010 · Gateway 非経由)
  → renderOrchestratorPanelFromLast / CommandCenterUI / GoogleOrchestratorUI
```

### 4.2 関連モジュール（phase ファイル外 · 実装済）

| モジュール | 責務 |
| --- | --- |
| `admin-ai-secretary-orchestrator.js` | パイプライン · stub 実行 · UI 委譲 |
| `admin-ai-secretary-agent-registry.js` | 19 Agent 登録 |
| `admin-ai-secretary-classifier.js` | regex + parseTalkOpsCommand + DeepSeek unified |
| `admin-ai-secretary-human-gate.js` | L1–L4 判定 · HSG bridge |
| `admin-ai-secretary-task-queue.js` | メモリ Queue |
| `admin-ai-secretary-command-center-ui.js` | Command Center 本体 UI |
| `admin-ai-secretary-ops-event.js` | OpsEventV1 ingest |
| `admin-ai-secretary-google-*.js` | OAuth · Gmail/Cal/Contacts/Drive · Orchestrator |
| `admin-ai-secretary-operations-engine.js` | Intelligence データ供給 |

---

## 5. Gateway / 連携確認（変更なし）

| 項目 | 状態 | AD-010 |
| --- | --- | --- |
| **DeepSeek Adapter** | `TasuSecretaryDeepSeekAdapter` → `/api/secretary-deepseek-chat` | ✅ Gateway 非混在 |
| **Gateway 契約** | `ai-model-gateway.js` — 秘書 phase2 **非経由** | ✅ AD-005 非変更 |
| **Human Gate** | `admin-ai-human-send-gate.js` + orchestrator L3 bridge | ✅ 送信は承認後のみ（Gmail/Calendar 6-D/F） |
| **Automation** | `admin-ai-automation-engine.js` | △ 存在 · **Orchestrator 未統合** |
| **Voice** | Voice Core · `surface: ops_secretary` · OpenAI Realtime | ✅ DeepSeek とは独立 |
| **Gmail** | 6-C read · 6-D write+HSG · 7-A 横断 | ✅ mock + live Edge |
| **Calendar** | 6-E read · 6-F write+HSG | ✅ 同上 |
| **OPS WATCH** | `ops-watch-analyzer.js` — **Gateway** 経由 | 秘書 LLM とは別経路（意図的） |

---

## 6. Operations Orchestrator — 設計 vs 実装

設計正本: `reports/ai-secretary-phase5-orchestrator-plan.md`

### 6.1 実装済み（Phase 5 設計 §8 順 1–7, 9）

| # | 設計項目 | 実装 |
| --- | --- | --- |
| 1 | Registry + classify（regex） | ✅ |
| 2 | phase2 統合 + L1–L4 UI | ✅ |
| 3 | parseTalkOpsCommand 併用 | ✅ `classifyWithCommand` |
| 4 | Human Gate / Queue 連携 | ✅ L3 HSG bridge |
| 5 | OpsEvent ingest | ✅ inbox · ops-watch |
| 6 | 朝レポート（手動） | ✅ |
| 7 | CI report ingest | ✅ fetch/cache |
| 9 | DeepSeek structured 分類 | ✅ + regex fallback |

### 6.2 未実装 / 部分実装

| # | 設計項目 | 状態 |
| --- | --- | --- |
| 8 | **Workflow 結果 · Agent Task 票 UI** | ❌ Markdown / clipboard 出力なし |
| 10 | DeepSeek 本番運用完了 | ❌ deploy No-Go |
| — | Workflow 定義（`wf_builder_consult` 等） | ❌ 19 Agent 映射のみ |
| — | Agent 実実行 | stub のみ |
| — | 14 業務フロー完全自動化 | 分類 + 表示まで |
| — | cron 朝/夜 | 手動のみ |
| — | L1 自動送信 | 未実装 |
| — | OpsEvent DB 永続化 | メモリ |

### 6.3 MVP vs 将来

| MVP（次スプリント候補） | 将来 |
| --- | --- |
| DeepSeek prod smoke | Cursor SDK Agent Routing |
| Agent Task 票 UI | L1 限定 auto-send |
| Google OAuth 実接続 smoke | cron · Edge Cron |
| Orchestrator deploy 確認 | Trend Scout |
| | Work History phase3–5 |
| | Queue / OpsEvent Supabase |
| | Floating shell |

---

## 7. 完成度（2026-06-28 推定）

| 観点 | 完成度 | 備考 |
| --- | ---: | --- |
| OPS UI / Command Center | **90%** | 5-C + Google タブ |
| テキストチャット + Voice | **85%** | phase2 + Voice opt-in |
| DeepSeek 接続（コード） | **95%** | Adapter 実装済 |
| DeepSeek 接続（本番運用） | **40%** | Secret · 残高 · smoke 未 |
| OpsContext / データ注入 | **75%** | TLV stub |
| Google Workspace 統合（コード） | **85%** | mock 経路あり |
| Google Workspace（本番 OAuth） | **30%** | Secret 未設定想定 |
| Operations Orchestrator | **65%** | 5-C レポート準拠 |
| 19 Agent 実行 | **5%** | stub のみ |
| Work History / Memory | **5%** | phase3–5/8 スタブ |
| **総合（製品）** | **≈ 72%** | コード偏重 |
| **総合（本番 Ready）** | **≈ 55%** | deploy · OAuth · DeepSeek 運用込み |

---

## 8. 次フェーズ優先順位

```
P0 — DeepSeek + Google 本番接続 smoke
  （Secret · 残高 · HTTP 200 · admin dashboard 1 往復 · OAuth 実 API）

↓

Phase 5 残 — Agent Task 票 UI + Workflow 定義（最小 wf_3 本）
  （Orchestrator 設計 §8 項 8 · Cursor 手動連携 MVP）

↓

Phase 6 — Agent Routing（Cursor SDK / Task 自動起動 · 設計どおり）
  （executeAgentStub 置換 · セキュリティ設計必須）

↓

Phase 7 — Command Center 完成
  （Automation 統合 · parseTalkOpsCommand 結果のチャット内表示 · CI dist 同梱検討）

↓

Phase 8 — Memory / History
  （phase3/4/5 Work History · 判断履歴横断 · Queue 永続化）
```

**現在の Phase 位置:** **Phase 7-B（Google Workspace）コード完了 · Phase 5 Orchestrator コア完了** → 次は **P0 本番接続** と **Phase 5 設計残（項 8）** が最短経路。

---

## 9. 推奨コミット単位（将来 · 今回は未実施）

| 順 | 単位 | 内容 |
| --- | --- | --- |
| 1 | `docs(secretary): refresh status after p0-1 cleanup` | KI-008 解消 · TODO/ROADMAP/SECRETARY_AI 更新 · 本レポート |
| 2 | `ops(secretary): deepseek production smoke evidence` | prod Secret 設定後 · 200/`usedDeepSeek` 証跡（.env 非公開） |
| 3 | `feat(secretary): add agent task ticket ui` | Phase 5 設計 §7.4 · clipboard Markdown |
| 4 | `feat(secretary): add orchestrator workflow definitions` | `wf_*` 最小 3 本 |
| 5 | `build(admin): sync secretary dist after oauth smoke` | dist-only · AD-007 選別 |
| 6 | `feat(secretary): agent routing phase6 cursor bridge` | SDK 調査成果 + stub 置換 |

**禁止遵守:** `git add -A` 不使用 · 領域混在 dist コミット禁止。

---

## 10. 参照

| 種別 | パス |
| --- | --- |
| 正本 | `docs/AI/SECRETARY_AI.md` · `docs/TODO.md` §P0-3 · `docs/ROADMAP.md` |
| Orchestrator 設計 | `reports/ai-secretary-phase5-orchestrator-plan.md` |
| DeepSeek | `reports/secretary-deepseek-adapter-design.md` · `reports/secretary-deepseek-deploy-triage.md` |
| Text Chat | `reports/ai-secretary-text-chat-first.md` |
| Phase 5 実装 | `reports/secretary-orchestrator-phase5a.md` · `5b` · `5c` |
| テスト | `scripts/test-secretary-orchestrator-phase5*.mjs` · `test-secretary-deepseek-adapter-browser.mjs` |

---

**調査完了:** build / deploy なし · docs refresh commit 対象。
