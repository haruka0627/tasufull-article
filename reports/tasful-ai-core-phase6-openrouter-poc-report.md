# TASFUL AI Core — Phase 6 完了レポート（OpenRouter Limited Evaluation）

**日付:** 2026-07-26  
**スコープ:** OpenRouter 限定 PoC · Identity / Edge / Guard / Usage Log / Cost Ledger 整合  
**環境:** コード · mock · unit/static · Staging live **未検証** · Production / deploy / push **なし**  
**料金:** 未確定 · Stripe / 従量 / 販売導線 **なし** · OpenRouter 公式単価 **未 seed**

---

## 判定

**CONDITIONAL PASS** — Staging paused により live JWT / OpenRouter secret / migration apply / Provider 実測は未実施。

---

## 監査結果

| 項目 | 結果 |
| --- | --- |
| 既存 OpenRouter 実装 | **なし**（docs / Cost Ledger provider allowlist のみ先行） |
| secret 名 | 新規 `OPENROUTER_API_KEY` · `OPENROUTER_POC_*`（`.env.example` コメント） |
| Identity | direct 3 モデルのみ · OpenRouter 枠コメントのみ → PoC 2 エントリ追加 |
| Gateway | Workspace Gateway は OpenRouter 非接続のまま（AD-005） |
| Usage Log | provider allowlist に openrouter が欠落 → 追加 |
| DB ingest | provider check に openrouter 欠落 → migration 追加（未 apply） |
| Plan Policy | openrouter 欄なし → edge map のみ · plan 付与なし |

---

## PoC 対象

| 項目 | 値 |
| --- | --- |
| Models | `google/gemini-2.5-flash`（`or-gemini-flash`）· `openai/gpt-4o-mini`（`or-gpt`） |
| Route | `openrouter-chat` Edge · `route_type=openrouter` |
| Internal gate | `OPENROUTER_POC_ENABLED` + harness header + JWT（+ 任意 allowlist） |
| Production | **無効**（env 既定 false · Gateway/UI 非接続 · plan feature 未付与） |

---

## 採用判断

**限定用途のみ候補**

理由（コード根拠）:

- Identity / Guard / Usage Log / Cost Ledger へ安全に載せる骨格は成立
- 一方で追加 SPOF · lock-in · 原価差の live 比較未了 · Privacy（OpenRouter 側保持）は外部依存で断定不可
- Workspace Gateway / Auto / 一般 UI への標準組み込みは今回の証拠では不要

**不採用ではない** · **全面採用でもない**。

---

## Direct 比較（mock/static vs 実測）

| 観点 | mock/static | live（未実施） |
| --- | --- | --- |
| 成功率 / latency | 分類・timeout 経路 PASS | 未測 |
| usage 取得 | provider_tokens または unavailable（推定非保存） | 未測 |
| model ID 安定性 | allowlist 固定 2 slug | OpenRouter 側変更は監視要 |
| Cost Ledger | provider 分離 · unknown_rate / provisional test-only | 公式 rate 未確定 |
| fallback | Production 無効 | — |
| 実装複雑性 | Edge + gate 追加で中程度 | — |
| SPOF / lock-in | OpenRouter 経由は追加依存 | — |

---

## Privacy / Security

| 区分 | 内容 |
| --- | --- |
| 確認済み（コード） | secret 非露出 · endpoint 固定 · slug allowlist · prompt/response 非保存 · error body 非転送 · harness 必須 · client flag 拒否 |
| 未確認 | OpenRouter 側 retention / 学習方針 · live header 実測 |
| 外部依存 | 送信先は OpenRouter（upstream へ再配送）· 「安全」と断定しない |

---

## Staging / Production

- Staging 変更: **なし**（migration ファイルのみ · apply 禁止）
- Production 変更: **なし**
- secret 変更: **なし**
- deploy / push: **なし**

---

## 残課題（Phase 6 範囲）

- Staging 再開後: migration apply · JWT · harness · OpenRouter secret での 2 モデル実測
- 公式 OpenRouter rate の provisional 登録手順（本 PoC では未 seed）
- Privacy 外部方針の文書確認（断定しない）

---

## 次 Phase

**Phase 7: Guard 対象拡張**
