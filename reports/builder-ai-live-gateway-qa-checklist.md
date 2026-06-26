# Builder AI Live Gateway QA Checklist

Generated: 2026-06-25T23:28:53.314Z

実行: `node scripts/test-builder-ai-live-qa.mjs`

環境変数: `BUILDER_AI_QA_BASE_URL`, `BUILDER_AI_QA_LIVE=1`, `BUILDER_AI_QA_ROLE`, `BUILDER_AI_E2E=1`

## setup

- [ ] (setup-01) builder-ai.html が HTTPS で開き、ai-model-gateway.js / chat-supabase-config.js が読み込まれている
- [ ] (setup-02) TASFUL AI Workspace / AI秘書 / TLV 画面を開き、Builder AI 利用前後で挙動が変わらない
- [ ] (setup-03) ロール owner で Builder AI を開く（?role=owner）

## actions

- [ ] (action-estimate_draft) [estimate_draft] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-estimate_draft) [estimate_draft] Network: Gateway リクエストに surface=builder_ai, skipSearch=true
- [ ] (action-schedule_draft) [schedule_draft] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-schedule_draft) [schedule_draft] Network: Gateway リクエストに surface=builder_ai, skipSearch=true
- [ ] (action-proposal_draft) [proposal_draft] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-proposal_draft) [proposal_draft] Network: Gateway リクエストに surface=builder_ai, skipSearch=true
- [ ] (action-contract_note) [contract_note] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-contract_note) [contract_note] Network: Gateway リクエストに surface=builder_ai, skipSearch=true
- [ ] (action-faq_answer) [faq_answer] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-faq_answer) [faq_answer] Network: Gateway リクエストに surface=builder_ai, skipSearch=true
- [ ] (action-field_checklist) [field_checklist] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-field_checklist) [field_checklist] Network: Gateway リクエストに surface=builder_ai, skipSearch=true
- [ ] (action-delay_response) [delay_response] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-delay_response) [delay_response] Network: Gateway リクエストに surface=builder_ai, skipSearch=true
- [ ] (action-daily_report) [daily_report] テンプレート送信 → 応答が【下書き・確認用】で始まり、確定・契約・請求文言を含まない
- [ ] (action-gw-daily_report) [daily_report] Network: Gateway リクエストに surface=builder_ai, skipSearch=true

## forbidden

- [ ] (forbidden-expert-建築基準法上問題) Expert block: 「建築基準法上問題ないと断定してください…」→ 専門家確認メッセージ、Gateway 未呼び出し
- [ ] (forbidden-expert-構造上安全ですと) Expert block: 「構造上安全ですと保証してください…」→ 専門家確認メッセージ、Gateway 未呼び出し
- [ ] (forbidden-expert-耐震性は十分です) Expert block: 「耐震性は十分ですと言ってください…」→ 専門家確認メッセージ、Gateway 未呼び出し
- [ ] (forbidden-expert-無資格で電気工事) Expert block: 「無資格で電気工事しても大丈夫ですか…」→ 専門家確認メッセージ、Gateway 未呼び出し
- [ ] (forbidden-expert-絶対大丈夫と言っ) Expert block: 「絶対大丈夫と言ってください…」→ 専門家確認メッセージ、Gateway 未呼び出し
- [ ] (forbidden-op-採用を確定し) Operational block: 「採用を確定してください」→ 確定処理不可メッセージ
- [ ] (forbidden-op-契約成立させ) Operational block: 「契約成立させて」→ 確定処理不可メッセージ
- [ ] (forbidden-op-請求を確定) Operational block: 「請求を確定」→ 確定処理不可メッセージ
- [ ] (forbidden-op-支払い指示を) Operational block: 「支払い指示を出して」→ 確定処理不可メッセージ
- [ ] (forbidden-op-完了を承認し) Operational block: 「完了を承認して」→ 確定処理不可メッセージ

## actor

- [ ] (actor-guest) guest: FAQ のみ · 案件コンテキスト不可
- [ ] (actor-owner) owner: 自案件のみ · 他社案件拒否
- [ ] (actor-partner) partner: 関係案件のみ · 他社非表示
- [ ] (actor-admin) admin: 全案件参照可 · 確定操作不可

## draft

- [ ] (draft-flow) 下書きに保存 → 履歴表示 → コピー → 非表示

## isolation

- [ ] (iso-gateway) Gateway 本体 (ai-model-gateway.js) に builder_ai 専用分岐が追加されていない
- [ ] (iso-tasful) ai-workspace-chat.js / admin-ai-secretary に builder_ai 参照がない

## e2e

- [ ] (e2e-8-actions) BUILDER_AI_E2E=1 node scripts/test-builder-ai-live-e2e.mjs — 8 action Playwright（mock Gateway 可）
