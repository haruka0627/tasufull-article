# AI秘書 — Google Integration Phase 4-T1 完了報告

**実施日:** 2026-06-28  
**前提 commit:** `fda88a1` (Phase 4-3 Gmail Send 設計) · `6e6b616` (Phase 4-2 draft execute)

**Secret / Token / UUID / messageId / threadId / bodyText 生データは記載しない**

---

## 1. 目的

問い合わせメール向けの **簡単返信テンプレ** を Chat から選択・文案生成まで接続。  
**送信 · drafts.create 直接実行 · executeWriteApproved は禁止** — 下書きは既存 Phase 4-1/4-2 HSG 導線へ渡すのみ。

---

## 2. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `admin-ai-secretary-google-reply-templates.js` | **新規** — 4 種テンプレ · intent マッチ · 文案生成 |
| `admin-ai-secretary-google-chat-router.js` | `context_reply_template` · `runContextReplyTemplate` |
| `admin-ai-secretary-google-chat-write-bridge.js` | `persistReplyPlanFromDraft` meta · footer strip 拡張 |
| `admin-operations-dashboard.html` | reply-templates script 追加 |
| `deploy/cloudflare/dist/` | 上記ミラー（build 同期） |
| `scripts/test-secretary-google-phase4-t1-reply-templates.mjs` | **新規** |

**変更なし:** Edge · OAuth · DeepSeek 本体 · Gmail send · Calendar

---

## 3. テンプレ一覧

| ID | ラベル | トリガー例 |
| --- | --- | --- |
| `tasful_ai_guidance` | TASFUL AI誘導 | TASFUL AIに誘導して |
| `assignee_followup` | 担当確認 | 担当確認で返して |
| `receipt_ack` | 受付完了 | 受付テンプレで返して |
| `detail_request` | 詳細依頼 | 詳細聞いて |

**自動選択:** 「テンプレで返信して」→ focus の subject/snippet から heuristic（デフォルト: 受付完了）

**TASFUL AI URL:** `{origin}/ai-workspace.html`（相対 fallback `/ai-workspace.html`）

---

## 4. フロー

```
未読一覧 → 詳細表示（Gmail focus）
  → 「TASFUL AIに誘導して」等
  → context_reply_template
  → テンプレ文案を Chat 表示
  → replyPlan 保存（内部 id · body 全文）
  → 「下書き保存して」
  → 既存 write_enqueue_gmail_draft → HSG Pending（API 0 まで）
```

---

## 5. Intent 分離

| 入力 | intent |
| --- | --- |
| TASFUL AIに誘導して / 受付テンプレで返して 等 | `context_reply_template` |
| 返信案作って | `context_reply_draft`（既存） |
| 下書き保存して | `write_enqueue_gmail_draft`（既存 · replyPlan 必須） |
| メールを送信して | `write_blocked` |

---

## 6. セキュリティ

- Router / Templates に `executeWriteApproved` なし
- replyPlan preview — subject · bodyPreview · recipient のみ（内部 id 非 export）
- Chat 表示 — messageId / threadId / draftId 非露出
- gmail_write — T1 フローでは **0**（下書き enqueue 時点まで）

---

## 7. 検証（8788）

| スクリプト | 結果 |
| --- | --- |
| `test-secretary-google-phase4-t1-reply-templates.mjs` | **43/43 PASS** |
| `test-secretary-google-phase4-2-gmail-draft-execute.mjs` | **58/58 PASS** |
| `test-secretary-google-phase4-1-gmail-draft-enqueue.mjs` | **24/24 PASS** |
| `test-secretary-google-chat-integration-phase3c-3.mjs` | **56/56 PASS** |

### T1 主要アサート

| 項目 | 結果 |
| --- | --- |
| 4 テンプレ文案 | PASS |
| focus なし安全応答 | PASS |
| replyPlan 保存 | PASS |
| 下書き HSG 導線接続 | PASS |
| gmail_write / send | **0**（テンプレ生成時） |
| Viewport 1280 / 768 / 390 | HTTP 200 · Console Error 0 |

---

## 8. 完了条件チェック

- [x] テンプレ返信案が作れる
- [x] replyPlan に保存される
- [x] 送信はされない
- [x] 既存下書き HSG 導線に接続できる
- [x] 回帰 4-2 · 4-1 · 3c-3 PASS

---

## 9. 次フェーズ

- Phase 4-3a: Gmail Send enqueue（設計書 `reports/ai-secretary-google-phase4-3-gmail-send-plan.md`）
