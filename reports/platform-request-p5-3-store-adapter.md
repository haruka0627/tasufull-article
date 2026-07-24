# Platform Request P5-3 — Store Adapter Foundation Report

**Date:** 2026-07-05  
**Phase:** P5-3（Store Adapter 土台 · local 実動作のみ）  
**Prior:** P5.2 `reports/platform-request-p5.2-staging-review.md`

---

## 1. 目的

localStorage 実装を壊さず、将来 Supabase / dual mode に切り替え可能な **Store Adapter** の土台を追加する。  
**今回 Supabase 未接続** — `local` のみ実動作、`supabase` / `dual` は stub + local fallback。

---

## 2. 変更ファイル

| File | Change |
| --- | --- |
| `platform-request.js` | `LocalRequestStore` + `Adapter` · UI を Adapter 経由に |
| `scripts/test-platform-request-p5-3-store-adapter.mjs` | P5-3 新規テスト |
| `reports/platform-request-p5-3-store-adapter.md` | 本報告書 |
| `docs/platform-request-p5-integration.md` | SSOT 追記 |
| `deploy/cloudflare/dist/platform-request.js` | `ensure-pages-dist` 同期 |

**未変更:** HTML / CSS · Supabase · SQL · Stripe · Talk

---

## 3. アーキテクチャ

```text
UI (list / create / detail / candidates)
        ↓
TasuPlatformRequestAdapter  (= TasuPlatformRequestStore 後方互換)
        ↓
  mode: local | supabase | dual
        ↓
  effective: local（P5-3 常に local fallback）
        ↓
LocalRequestStore → tasful_platform_requests_v1
CandidateStore    → tasful_platform_request_candidates_v1 + DEMO
```

### 3.1 モード解決（優先順）

1. `window.TasuPlatformRequestConfig.storeMode`
2. URL `?prq_store=` または `?storeMode=`
3. デフォルト `local`

| mode | 動作（P5-3） |
| --- | --- |
| `local` | LocalRequestStore のみ |
| `supabase` | `console.warn` + toast（1回）→ local fallback |
| `dual` | 同上 |

### 3.2 Adapter API

| メソッド | 責務 |
| --- | --- |
| `listRequests()` | 一覧（local + demo マージ） |
| `getRequest(id)` | 詳細取得 |
| `createRequest(payload)` | 投稿保存 |
| `updateRequestStatus(id, status)` | ステータス更新 → list item |
| `listCandidates()` | 候補一覧 |
| `matchCandidates(request)` | マッチング |
| `getEffectiveMode()` | 常に `"local"`（P5-3） |
| `isLocalRequest(id)` | ステータス UI 制御 |

**後方互換（`TasuPlatformRequestStore`）:** `save` · `findById` · `listAllForDisplay` · `readRaw` · `key` 等を維持。

---

## 4. localStorage 互換

| 項目 | 状態 |
| --- | --- |
| キー `tasful_platform_requests_v1` | **変更なし** |
| 保存フィールド構造 | **変更なし** |
| `legacy_local_id` | **未追加**（P5-8 予定） |
| 内部実装名 | `Store` → `LocalRequestStore`（外部 API 不変） |

---

## 5. テスト結果（8788）

```bash
node scripts/test-platform-request-p5-3-store-adapter.mjs  # ALL PASS
node scripts/test-platform-request-p2.mjs                  # ALL PASS
node scripts/test-platform-request-p3.mjs                  # ALL PASS
node scripts/test-platform-request-p4.mjs                  # ALL PASS
```

| Case | Result |
| --- | --- |
| デフォルト `local` · Adapter API 存在 | PASS |
| 投稿→詳細→一覧（local） | PASS |
| LS キー・スキーマ不変 | PASS |
| 候補抽出（demo-1） | PASS |
| `?prq_store=supabase` warn + local fallback + 投稿 | PASS |
| `?prq_store=dual` warn + local fallback | PASS |
| P2 / P3 / P4 回帰 | PASS |
| Console Error | **0** |

---

## 6. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| Supabase 接続 | なし ✅ |
| DB / SQL 適用 | なし ✅ |
| localStorage schema 破壊 | なし ✅ |
| P2〜P4.6 挙動 | 維持 ✅ |

---

## 7. Go / No-Go 判定

| 項目 | 結果 |
| --- | --- |
| Store Adapter 土台（local 実動作） | ✅ |
| supabase / dual stub + fallback | ✅ |
| 後方互換 `TasuPlatformRequestStore` | ✅ |
| P2 + P3 + P4 + P5-3 PASS | ✅ |
| Console Error 0 | ✅ |

### **判定: Go（P5-4 Supabase CRUD / Staging 適用後の adapter 拡張へ進行可）**

**継続 No-Go:**

- Production Supabase / Stripe Live（10月まで）
- `supabase` / `dual` での実 DB 読み書き（次フェーズまで）

---

## 8. 次アクション

| 優先 | タスク |
| --- | --- |
| 1 | Staging DDL 手動適用（P5.2 チェックリスト） |
| 2 | Adapter `supabase` / `dual` 実装（認証 + Supabase client） |
| 3 | `test-platform-request-p5-staging.mjs` |

---

*Generated: Platform Request P5-3 · Store Adapter foundation · local only*
