# TASFUL AI Core — Phase 5 完了レポート（Plan Enforcement）

**日付:** 2026-07-26  
**スコープ:** Plan Policy SSOT · サーバー enforcement · Auto/Manual/Gauge/Guard 接続  
**環境:** コード · mock · unit/static · Playwright · Staging live **未検証** · Production / deploy / push **なし**  
**料金:** 未確定（Draft）· Stripe / 従量 / 販売導線 **なし**

---

## 判定

**CONDITIONAL PASS** — Staging paused により live JWT / quota / subscription 未検証。

---

## 監査結果（採用正本）

重複していた定義: catalog SKU · `genai_basic_300` · `basic_300` · UI `lite` · model tier `light` · Free 5回の複数ハードコード · Workspace 全モデル bypass · URL/`tasu_ai_user_plan` override。

**採用正本:** `ai-plan-policy`（canonical `anonymous|free|lite|pro|max` + alias）。料金は含めない。

---

## Plan Policy（料金なし）

| ID | 表示名 | daily text | models | features | limit action |
| --- | --- | --- | --- | --- | --- |
| anonymous | 未ログイン | 5 | gemini-flash | workspace_chat, gemini_chat | deny |
| free | 無料枠 | 5 | gemini-flash | + ocr | deny |
| lite | Lite | 30 | gemini-flash | chat + ocr | deny |
| pro | Pro | 100 | gemini/gpt/claude | + openai/claude chat | deny |
| max | Max（準備中） | inactive → free 最小 | — | — | deny |

near_limit (≥90%): `warn` · 100%: `deny`（既存 Guard）

---

## claimed-only

**廃止。** quota status/check/consume と chat/OCR Guard は JWT 必須（`auth_required`）。body `user_id` は帰属に使わない。mismatch は 403。

未ログイン: 端末目安のみ · サーバー枠は取得しない。

---

## 未接続機能

voice · image · media · search 専用 feature 制限は policy 欄のみ（inactive）。

---

## 次 Phase

**Phase 6: OpenRouter 限定検証**
