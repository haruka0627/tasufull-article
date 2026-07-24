# Platform Request P5-6 — Supabase Adapter CRUD Report

**Date:** 2026-07-05  
**Phase:** P5-6（`platform_requests` 単体 CRUD · Staging のみ）  
**Staging ref:** `ahlxuyvhzqdqaojiywmu`  
**Prior:** [P5-5 適用検証](./platform-request-p5-5-staging-ddl-apply.md)

---

## 0. エグゼクティブサマリ

| 項目 | 結果 |
| --- | --- |
| `platform_requests` CRUD（Staging） | **Go** ✅ |
| local mode 回帰 | **Go** ✅ |
| localStorage スキーマ維持 | **Go** ✅ |
| Production 未接触 | **Go** ✅ |
| matches / Talk / Stripe / 通知 | **未接続**（意図どおり） |

---

## 1. 実装範囲

### 1.1 新規・変更ファイル

| ファイル | 内容 |
| --- | --- |
| `platform-request-supabase-store.js` | Staging 専用 Supabase CRUD 層（read-only ガード · snake_case ↔ camelCase） |
| `platform-request.js` | Adapter `supabase` / `dual` 実装 · 非同期 UI · `canEditRequest` |
| `platform-request.html` / `create` / `detail` | Supabase スクリプト読込（既存 UI 非破壊） |
| `scripts/test-platform-request-p5-6-supabase-crud.mjs` | Staging CRUD E2E |
| `scripts/ensure-pages-dist.mjs` | dev 時 `chat-supabase-config.js` 正本同期（`anonKey: test` 置換） |

### 1.2 Adapter API（`platform_requests` のみ）

| メソッド | supabase mode | local mode |
| --- | --- | --- |
| `listRequests` / `listRequestsAsync` | RLS 経由 SELECT + demo マージ | 従来どおり LS + demo |
| `getRequest` / `getRequestAsync` | UUID / `legacy_local_id` 検索 | 従来どおり |
| `createRequest` / `createRequestAsync` | INSERT（`owner_id = auth.uid()`） | LS save |
| `updateRequestStatus` / `…Async` | UPDATE status（owner のみ） | LS update |

**未実装（今回スコープ外）:** matches · notifications · payments · subscriptions · Talk · Stripe

---

## 2. モード方針

| mode | read | write |
| --- | --- | --- |
| **local** | LS + demo | LS のみ |
| **supabase** | Supabase（認証時）· 未認証は LS + demo fallback | Supabase（認証時）· 失敗/未認証は LS fallback + toast |
| **dual** | Supabase 優先 + LS（`legacy_local_id` 未重複）+ demo | Supabase 成功時のみ LS mirror（`legacy_local_id` = `prq-*`） |

**破壊的同期:** 禁止 · Supabase 失敗時に LS を上書きしない

**切替:** `?prq_store=supabase|dual|local` または `window.TasuPlatformRequestConfig.storeMode`

---

## 3. 認証 · RLS

| 条件 | 挙動 |
| --- | --- |
| 未ログイン + supabase/dual | `getEffectiveMode()` → `local` · toast 案内 · クラッシュなし |
| ログイン + Staging ref | `getEffectiveMode()` → 設定 mode · `_useRemote = true` |
| RLS 拒否 | toast · empty/fallback · Console Error 0 |
| Production ref `ddojquacsyqesrjhcvmn` | `isConfigured()` = false · 接続拒否 |
| service_role | **フロントに出さない** |

**テストユーザー:** `e2e-test@example.com` · uid `bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40`

---

## 4. データ変換

| local (camelCase) | DB (snake_case) |
| --- | --- |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `photos` | `photos` (jsonb array) |
| `id` (prq-*) | `legacy_local_id`（create 時のみ DB 側に保存） |

**localStorage `tasful_platform_requests_v1`:** キー・フィールドスキーマ **変更なし**（`legacy_local_id` 列は LS に追加しない）

---

## 5. Supabase CRUD 検証結果（P5-6 テスト）

```bash
node scripts/test-platform-request-p5-6-supabase-crud.mjs
```

| チェック | 結果 |
| --- | --- |
| P5-5 schema verify | PASS |
| local mode create + LS schema | PASS |
| supabase 未認証 fallback | PASS |
| Staging ref guard | PASS |
| auth signIn | PASS |
| create → UUID redirect | PASS |
| `platform_requests` row（owner_id · legacy_local_id） | PASS |
| list 表示 | PASS |
| status `open` → `closed` UPDATE | PASS |
| dual mode list merge | PASS |
| Console Error | **0** |

**検証 URL:** `http://127.0.0.1:8788` · HTTP 200

---

## 6. 回帰テスト

| スクリプト | 結果 |
| --- | --- |
| `test-platform-request-p2.mjs` | **ALL PASS** |
| `test-platform-request-p3.mjs` | **ALL PASS** |
| `test-platform-request-p4.mjs` | **ALL PASS** |
| `test-platform-request-p5-3-store-adapter.mjs` | **ALL PASS** |
| `test-platform-request-p5-6-supabase-crud.mjs` | **ALL PASS** |

---

## 7. RLS / 認証で詰まった点（解決済み）

| 課題 | 対応 |
| --- | --- |
| dist `chat-supabase-config.js` が `anonKey: "test"` | `ensure-pages-dist` で repo 正本（eyJ…）を dev 同期 |
| 初回 bootstrap が未認証でキャッシュ | テストで `signIn` 後 `_readyPromise` リセット · UI は `ensureReady` 先行 |
| 詳細ページ async 読込 | `getRequestAsync` + ロード待ち（テスト修正） |

**未解決（次フェーズ）:** P5.2a S1 — `builder_partner` / `company` candidate RLS（matches 接続時）

---

## 8. local 互換維持

- デフォルト mode = `local`（変更なし）
- `tasful_platform_requests_v1` スキーマ不変
- demo 依頼・P3 候補マッチは LS/demo のまま
- 「自分の投稿」バッジ · ステータス操作は `canEditRequest`（local + supabase owned）

---

## 9. 未接続領域

| 領域 | 状態 |
| --- | --- |
| `platform_request_matches` | 未接続 |
| `platform_request_notifications` | 未接続 |
| `platform_request_payments` | 未接続 |
| `platform_request_subscriptions` | 未接続 |
| Talk スレッド | 未接続 |
| Stripe Checkout | 未接続 |
| Production Supabase | **禁止** |
| localStorage 一括移行 | 未実施 |

---

## 10. Go / No-Go 判定

### 10.1 P5-6 実装

| 項目 | 判定 |
| --- | --- |
| `platform_requests` Staging CRUD | **Go** ✅ |
| local / dual 安全 fallback | **Go** ✅ |
| P2–P5-3 回帰 | **Go** ✅ |
| Console Error 0 | **Go** ✅ |
| Production 未接触 | **Go** ✅ |

### **判定 A: Go — P5-6 完了**

---

### 10.2 次フェーズ

| 項目 | 判定 |
| --- | --- |
| P5-7 matches サーバー接続 | **Conditional Go**（P5.2a 後） |
| Builder candidate E2E | **No-Go**（S1 未修正） |

---

### 10.3 Production

### **判定 B: No-Go — Production 接続禁止（継続）**

---

## 11. 次アクション

| 優先 | タスク |
| --- | --- |
| 1 | P5-7 `platform_request_matches` 接続設計 |
| 2 | P5.2a candidate RLS 修正案 |
| 3 | localStorage → `legacy_local_id` 移行ツール |

---

## 12. 参照

| ドキュメント | 用途 |
| --- | --- |
| [platform-request-p5-integration.md](../docs/platform-request-p5-integration.md) | P5 SSOT |
| [platform-request-p5-5-staging-ddl-apply.md](./platform-request-p5-5-staging-ddl-apply.md) | DDL 検証 |
| [docs/supabase-environments.md](../docs/supabase-environments.md) | ref 正本 |

---

*Completed: Platform Request P5-6 · Staging platform_requests CRUD Go*
