# AI 実行ゲート — Phase C チケット（First Real Use Case）

**Status:** Design Freeze Candidate（実装未着手）  
**Baseline:** Phase B6 `0af6968`  
**Design:** [AI_EXECUTION_GATE_PHASE_C_FIRST_USE_CASE_DESIGN.md](./AI_EXECUTION_GATE_PHASE_C_FIRST_USE_CASE_DESIGN.md)  
**Audit:** [ai-exec-gate-phase-c-design-audit.md](../../reports/ai-exec-gate-phase-c-design-audit.md)  
**Freeze parent:** [AI_EXECUTION_GATE.md](./AI_EXECUTION_GATE.md)

---

## 関係（FREEZE §16）

FREEZE の Phase C 見出しは「費用台帳接続・予算・可観測性」。  
本チケット列は **Phase B 縦スライス上の最初の実実行ユースケース**を設計凍結し、SAFE-06/07 連携を併記する。FREEZE 本文は変更しない。

---

## C0 — First use case design freeze

### 状態

**DESIGN_FREEZE_CANDIDATE（2026-07-28）** · Implementation Not Started · Provider Not Connected

### 目的

最初の Gate 実ユースケースを **1 つだけ**選定し、契約・安全境界・失敗/orphan・費用・プライバシーを確定する。

### 採択

**AI Secretary Daily Operations Summary**  
Capabilities: `collect_daily_ops` · `generate_ops_report`  
Action: `ops_secretary.daily_pending.report_pipeline`

### 対象ファイル（C0）

- `docs/AI/AI_EXECUTION_GATE_PHASE_C_FIRST_USE_CASE_DESIGN.md`
- `docs/AI/AI_EXECUTION_GATE_PHASE_C_TICKETS.md`
- `reports/ai-exec-gate-phase-c-design-audit.md`
- （ポインタ）`docs/AI/AI_EXECUTION_GATE_PHASE_B_TICKETS.md`

### allowlist

設計・チケット・監査レポートのみ。

### NO-GO

実装 · provider 接続 · API key · SDK · MCP · Cron · Worker · Queue · send · approve · Staging/Production apply · FREEZE 破壊的改訂

### 完了条件

- ユースケース 1 件選定 + 不採用理由
- Request / Provider interface / Result / Cost / Retry-orphan / Approval / Privacy / Threat 記載
- 人間による **Design Freeze Approved** は別明示指示

### 次チケット（未起票 · 実装禁止まで）

| ID | 概要 | 前提 |
| --- | --- | --- |
| C1 | Staging read-only count collector（provider なし） | C0 Approved |
| C2 | Provider adapter behind flag（AD-010） | C1 |
| C3 | SAFE-06/07 Gate 連携 · hard cap 検証 | C2 |
| C4 | Ops dogfood · evidence | C3 |

各チケットは人間の明示指示後のみ着手。

---

## Phase B 境界

B1–B6 はローカル証跡完了（`PASS_WITH_KNOWN_RISKS`）。  
Dashboard page-load execute は引き続き禁止。
