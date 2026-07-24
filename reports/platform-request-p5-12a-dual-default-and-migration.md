# Platform Request P5-12a — Dual Default & localStorage Migration

**Date:** 2026-07-05
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（のみ）
**判定:** **Go**

---

## 実装概要

| 項目 | 内容 |
| --- | --- |
| 未ログイン | `local` デフォルト（従来通り） |
| ログイン済み（query なし） | `dual` デフォルト（`Adapter.mode` ラベルは `local`） |
| query 優先 | `?prq_store=local|supabase|dual` |
| 同期 UI | 一覧の同期バナー · 任意実行 |
| 重複防止 | `legacy_local_id` 照合 |
| local 保持 | 同期成功/失敗とも削除しない |
| Production | `isConfigured()` false で禁止 |

---

## 検証結果

| 項目 | 結果 |
| --- | --- |
| 未ログイン → local | PASS |
| ログイン → dual | PASS |
| query 優先 | PASS |
| 同期成功 | PASS |
| 重複同期防止 | PASS |
| local 保持 | PASS |
| 同期 UI 表示 | PASS |
| Console Error | **0** |

### 回帰

| スクリプト | 結果 |
| --- | --- |
| P5-10（Stripe · Contact Reveal · Talk） | PASS |

**検証コマンド:** `node scripts/test-platform-request-p5-12a-dual-default-and-migration.mjs`  
**検証 URL:** `http://127.0.0.1:8788` · HTTP 200

---

## 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `platform-request.js` | `_explicitStoreMode` · `getEffectiveMode` dual デフォルト · 同期 API · 同期 UI |
| `platform-request.html` | 同期バナー HTML |
| `platform-request.css` | 同期バナースタイル |
| `scripts/test-platform-request-p5-12a-dual-default-and-migration.mjs` | **新規** |
| `docs/platform-request-p5-integration.md` | P5-12a Go 追記 |

---

## Go / No-Go

| 環境 | 判定 |
| --- | --- |
| **Staging P5-12a** | **Go** |
| **Production** | **No-Go** 継続 |

---

## 残課題

- 同期 UI は一覧ページのみ（作成/詳細ページには未配置）
- dual デフォルト時の新規投稿は Supabase 正本 + local mirror（P5-6 互換の `mode` ラベルは `local`）
- 商用硬化（Webhook · Talk Home 通知）は P5-12b / P5-13

## 次フェーズ

**P5-12b** — 商用硬化（Stripe Webhook 本番相当 · Talk 決済ゲート強化 · Talk Home 通知）
