# AI 実行ゲート — Phase B 実装チケット（B1–B6）

**Status:** B1 **実装済（コード）** · B2以降は着手指示待ち · commit 未実施  
**最終更新:** 2026-07-28  
**計画正本:** [AI_EXECUTION_GATE_PHASE_B_PLAN.md](./AI_EXECUTION_GATE_PHASE_B_PLAN.md)  
**設計正本:** [AI_EXECUTION_GATE.md](./AI_EXECUTION_GATE.md)（FREEZE APPROVED 2026-07-28）

> B1 は `_shared/ai-exec-gate-*.mjs` + `scripts/test-ai-exec-gate-phase-b1-constants.mjs` まで。各後続チケットは **明示的な着手指示**があるまで実装しない。Production 非接触 · Staging only · ops only。

---

## 依存関係（概要）

```
B1 ──► B2 ──► B3 ──► B4 ──► B5 ──► B6
              │                ▲
              └────────────────┘（B5 は B3 GET 契約に依存 · B4 完了後に結合表示が完成）
```

| チケット | 依存 |
| --- | --- |
| **B1** | なし（最初に着手） |
| **B2** | B1 |
| **B3** | B1 · B2 |
| **B4** | B3 |
| **B5** | B3（最低限）· B4（E2E 表示完成） |
| **B6** | B1–B5 |

**Phase B 開始時の最初の 1 チケット: B1**

---

## 共通 NO-GO（全チケット）

Production 接続/変更 · Staging 以外への apply · Cron · Worker · MCP · Gmail/外部送信 · 業務データ変更 · MEDIUM/HIGH 実行 · Self Correction · Diff & Approve · 音声 · Gateway 契約変更 · SAFE-06/07 破壊 · Capability allowlist 外追加 · 子 execution · prompt/response 全文保存 · hard cap のフロント露出 · 自動超過/暗黙フォールバック · 指示なき commit/push/deploy

---

## B1 — 契約・定数・型・Feature Flag / Emergency Stop / hard cap

### 状態

**B1 PASS（コード実装 · 2026-07-28）** · commit / push は別途人間指示

### 目的

Phase B のコード定数・列挙・Flag/Stop/Budget hard cap・redaction の共有モジュールを追加し、後続 API が依存できる契約面を固定する。

### 対象ファイル

**新規**

- `deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-flags.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-budget.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-types.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-redaction.mjs`
- `scripts/test-ai-exec-gate-phase-b1-constants.mjs`（または同等）

**変更:** なし（または最小の export 配線のみ）

### allowlist

- Capability: `collect_daily_ops` · `generate_ops_report` のみ
- action: `ops_secretary.daily_pending.report_pipeline` のみ
- flag key: `ai_exec_gate.phase_b.daily_ops_report`
- env: Staging hard cap 名（例 `AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP`）— フロント非公開

### 依存関係

なし（先頭）

### テスト

- allowlist 外 capability 拒否
- flag state 判定（staging_only / disabled）
- emergency stop true → deny
- hard cap 超過 → blocked 相当の判定結果
- redaction が禁止キーを落とす

### 完了条件

- 定数モジュールが計画の shape を満たす
- unit テスト PASS
- DB / API / UI 未接続でも単体で意味が通る

### NO-GO

共通 NO-GO · DB migration · HTTP API · Dashboard · DeepSeek 呼出

### rollback

新規ファイル削除のみ（他依存なし）

### commit 境界

`docs` は含めず（既に別途更新済なら触らない）。`_shared/ai-exec-gate-*.mjs` + B1 テストのみ選別ステージ。

---

## B2 — 最小 DB migration と RLS / RPC 設計

### 目的

Staging 向けに `ai_execution_requests` / `events` / `results` / `feature_flags` / `emergency_controls` の最小スキーマと RLS（deny-all + service_role）を追加する。

### 対象ファイル

**新規**

- `supabase/migrations/YYYYMMDDHHMMSS_ai_exec_gate_phase_b.sql`
- （任意）`reports/ai-exec-gate-phase-b2-migration-notes.md` 設計メモのみ可

**変更:** なし（既存 SAFE migration 非破壊）

### allowlist

- 上記 5 表のみ（Capability テーブルシードなし）
- Production apply スクリプトを作らない

### 依存関係

B1（列・列挙・flag key 名の一致）

### テスト

- migration SQL の静的レビュー（CHECK · unique idempotency · append-only 方針）
- Staging apply は **別途人間承認後**（本チケット定義時点では「設計+SQL 作成」まででも可。apply は明示サブ指示）

### 完了条件

- SQL が計画 §4 と一致
- RLS deny-all + service_role
- SAFE-06/07 に ALTER 破壊なし
- Production 向け apply 手順を文書に **書かない / No-Go 明記**

### NO-GO

Production migration · Capability DB シード · proposals/approvals 本運用表 · データ backfill

### rollback

Staging で Flag disabled · 必要なら table drop（人間判断）· migration 取り消しは Staging 限定 runbook

### commit 境界

migration SQL + メモのみ。Functions/UI を混ぜない。

---

## B3 — Gate API と Policy 評価

### 目的

`create` / `execute`（骨格）/ `get` の Cloudflare Pages Functions と Policy 評価順を実装する。execute の executor 本体は stub または B4 接続点まで。

### 対象ファイル

**新規**

- `deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs`
- `deploy/cloudflare/functions/api/ai-exec-gate-create.js`
- `deploy/cloudflare/functions/api/ai-exec-gate-execute.js`
- `deploy/cloudflare/functions/api/ai-exec-gate-get.js`
- `scripts/test-ai-exec-gate-phase-b3-api.mjs`

**参照:** JWT shared · B1 modules · B2 表

### allowlist

- action_type / capability / service の固定セットのみ受付
- ops JWT のみ

### 依存関係

B1 · B2

### テスト

- 非 ops → 401/403
- allowlist 外 → blocked/4xx
- flag disabled / stop / hard cap → `blocked` + event
- 冪等キーで二重 create が同一 id
- 不正状態遷移拒否
- レスポンスに cap 生値なし

### 完了条件

- Policy 10 段のうち B サブセットがサーバ側で強制
- create/get が Staging で動作（execute は stub 可だが状態遷移は記録）
- prompt をログに残さない

### NO-GO

DeepSeek 本接続（B4）· Dashboard（B5）· MEDIUM 承認 API · Production

### rollback

Flag disabled · ルート削除 · 関数ファイル削除

### commit 境界

gate API + policy + B3 テスト。秘書 UI / DeepSeek 変更を混ぜない。

---

## B4 — Secretary executor 接続

### 目的

単一 pipeline 内で `ops_collector` → `secretary_deepseek` → `gate_audit_writer` を接続し、日次未対応レポートを完成させる。

### 対象ファイル

**変更（最小）**

- `admin-ai-daily-inbox.js`（読取再利用）
- `admin-ai-secretary-morning-report.js` / `admin-ai-secretary-ops-context.js`（材料再利用）
- `admin-ai-secretary-deepseek-adapter.js`（既存契約で呼出）
- `deploy/cloudflare/functions/api/ai-exec-gate-execute.js`（pipeline 実装）

**原則非変更**

- `deploy/cloudflare/functions/api/secretary-deepseek-chat.js`

**新規（任意）**

- `deploy/cloudflare/functions/_shared/ai-exec-gate-executor-secretary.mjs`

### allowlist

- Capability 2 つの内部 step のみ
- 外部送信・Gmail・業務テーブル UPDATE/DELETE なし

### 依存関係

B3

### テスト

- collect が LLM を呼ばない
- report が既存 Adapter 経路
- events に step_* が並ぶ
- 失敗時 failed + サニタイズ error
- 既存秘書回帰スクリプト維持

### 完了条件

- 1 execution で取得→要約→結果保存まで成功パス
- 子 execution なし
- AD-010 維持（Gateway 非混在）

### NO-GO

Orchestrator 大規模改修 · Human Send Gate 送信 · 問い合わせ送信 · max_attempts>1

### rollback

execute を stub に戻す · Flag disabled

### commit 境界

executor 接続 + 最小秘書再利用差分 + B4 テスト。Dashboard HTML は B5。

---

## B5 — Dashboard 読取表示

### 目的

運営ダッシュボードに当日 pipeline 結果の読取表示を最小追加する。

### 対象ファイル

**新規**

- `admin-ai-exec-gate-client.js`

**変更**

- `admin-operations-dashboard.html`（最小枠）
- （必要なら）関連 CSS 最小

### allowlist

- get API のサニタイズ結果のみ表示
- 承認 UI・送信 UI を追加しない
- cap / secret 非表示

### 依存関係

B3 必須 · B4 で E2E 完成

### テスト

- 8788 で HTTP 200
- Console Error 0
- viewport 1280 / 768 / 390
- blocked/failed 時の汎用メッセージ

### 完了条件

- ops ユーザーが当日レポート状態を確認できる
- 非 ops で API 失敗が安全

### NO-GO

承認キュー本実装 · 音声 · レイアウト大改修（秘書 FROZEN 尊重）

### rollback

HTML 枠と client を除去 · 旧 Morning Report 表示に戻す

### commit 境界

client + dashboard 最小差分 + 表示確認メモ。migration を混ぜない。

---

## B6 — テスト・Staging 検証・証跡

### 目的

B1–B5 の統合回帰・Staging 検証・証跡レポートを完了し Phase B 縦スライスを閉じる。

### 対象ファイル

**新規**

- `scripts/test-ai-exec-gate-phase-b-suite.mjs`（または分割の統合ランナー）
- `reports/ai-exec-gate-phase-b-verification.md`

**変更:** テストの足りない assert のみ

### allowlist

- 検証・レポートのみ。機能追加禁止

### 依存関係

B1–B5

### テスト

- 計画 §16 の全項目
- Negative: 非 ops · flag · stop · cap · 二重実行 · allowlist 外
- 秘書既存回帰
- Staging only であることの記録

### 完了条件

- 統合テスト PASS
- 8788 証跡（HTTP Status · Console Error · Viewport）
- Phase B NO-GO 再確認チェックリスト完了
- Production 非接触の証明（変更環境の記述）

### NO-GO

新機能 · Production deploy · 追加 Capability

### rollback

なし（検証チケット）。問題発見時は Flag disabled で機能停止。

### commit 境界

tests + reports のみ。機能コードのついで直しは禁止（別チケットへ）。

---

## 着手順序（再掲）

1. **B1** ← Phase B 開始時の最初のチケット  
2. B2  
3. B3  
4. B4  
5. B5  
6. B6  

各チケット開始前に人間の明示指示を要する。
