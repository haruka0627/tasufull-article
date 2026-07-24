# Business Directory — Production Safe Smoke（cleanup 付き）設計

**日付:** 2026-07-04  
**状態:** 設計 · スクリプト準備済 · **本番実行禁止（本レポート時点）**  
**実装:** `scripts/test-business-directory-production-safe-smoke.mjs`

---

## 1. 既存スクリプト調査結果

**対象:** `scripts/test-business-directory-production-step4-production.mjs`

| 段階 | 関数 / 箇所 | action / 処理 |
| --- | --- | --- |
| Owner 作成 | `runApiSmoke` ~L472 | `create_draft_listing`（表示名 `BD Prod Step4 ${stamp}`） |
| Owner 更新 | ~L494 | `update_draft_listing` |
| Owner 一覧 | ~L502 | `get_owner_listings` |
| Stripe（任意） | ~L507–536 | `create_subscription_checkout` · Playwright 4242 · `sync_subscription_status` |
| Owner 申請 | ~L541 | `submit_listing_for_review` |
| Admin キュー | ~L548 | `get_review_queue` |
| Admin 詳細 | ~L554 | `get_ops_listing_detail` |
| Admin 承認 | ~L559 | `approve_listing` → **published** |
| Reject パス | ~L568–608 | 別 listing を create → submit → `reject_listing` |
| Public 詳細 | ~L611 | `get_public_listing_detail`（approved slug） |
| Public 一覧 | ~L619 | `get_public_listings` · id 含有確認 |
| Public 検索 | ~L631 | `q=Step4 ${stamp}` |
| DB 確認 | ~L641 | REST `business_directory_listings` status |
| Browser | `runBrowserSmoke` | Pages URL · Access 検知あり |

### 問題点

1. **cleanup なし** — 承認 listing が **published のまま残る**
2. Reject パス listing も **rejected のまま残る**（Public 非表示だが DB に残存）
3. タイトル prefix はあるが、失敗時の **listing_id レポート義務**が弱い
4. Stripe / deploy / Access ブラウザが同梱され、横断 E2E の最小スコープより広い

---

## 2. cleanup 方針（採用）

| 優先 | 方式 | API（既存 · 変更なし） | 効果 |
| --- | --- | --- | --- |
| **1** | **published → unpublished** | Ops `unpublish_listing` | Public 一覧・詳細から消える |
| **2** | **review_requested → rejected** | Ops `reject_listing` | キューから外れ Public 非表示 |
| **3** | **draft** | 何もしない（または記録のみ） | もともと Public 非表示 |
| **不採用** | 物理 DELETE | — | 危険 · Edge/API 変更が必要になり得る |
| **不採用** | archived | 遷移元が限定的 · 不可逆寄り | unpublished で十分 |

### 対象特定

- 表示名 prefix: **`[BD-SAFE-SMOKE]`**
- 実行ごとに `stamp`（Date.now）を付与
- 追跡配列 `trackedListings: { id, slug, role, statusHint }[]`
- **cleanup 失敗時は必ず `listing_id` / `slug` / 最終 status / エラーを report.json に出力**

### finally 保証

```text
try { flow } finally { cleanup all tracked }
cleanup 失敗 ≠ プロセスが listing_id を隠すこと
exit code: flow fail または cleanup fail で非 0
```

---

## 3. 新規スクリプト

**パス:** `scripts/test-business-directory-production-safe-smoke.mjs`

| フラグ | 意味 |
| --- | --- |
| （なし） | **preflight のみ**（secrets 有無 · cleanup 方針表示 · **API 呼び出しなし**） |
| `--execute` | 本番 API 実行（**明示オプトイン**） |
| `--skip-stripe` | 既定で Stripe スキップ（安全 smoke は課金フロー対象外） |

**フロー（`--execute` 時）:**

1. Owner `create_draft_listing`（prefix `[BD-SAFE-SMOKE]`）
2. `submit_listing_for_review`
3. Ops `get_review_queue` 含有確認
4. Ops `approve_listing`
5. Anon `get_public_listings` / `get_public_listing_detail` 反映確認
6. **finally:** Ops `unpublish_listing`（reason: `bd-safe-smoke cleanup`）
7. Public 再確認（detail 404 or not published）

Reject パスは **任意・既定オフ**（listing 増殖を避ける）。必要なら将来 `--include-reject-path`。

**出力:** `reports/business-directory-production-safe-smoke/report.json`（listing_id 必須フィールド）

---

## 4. 既存スクリプトとの関係

| スクリプト | 役割 |
| --- | --- |
| `test-business-directory-production-step4-production.mjs` | 従来の広い Production smoke（**cleanup なし · 実行注意**） |
| `test-business-directory-production-safe-smoke.mjs` | **横断 E2E + cleanup**（本設計） |

既存 step4 は変更しない（後方互換 · 誤実行リスクを増やさない）。

---

## 5. 実行前に必要な .env（値は出さない）

| 変数 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Auth / Edge / REST |
| `SUPABASE_ANON_KEY` | Public / client |
| `SUPABASE_SERVICE_ROLE_KEY` | L7 role ensure · 任意の status 確認 |
| `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` | T2 Owner / T4 Ops ログイン |

L7 スロット: Owner **T2** · Ops **T4**（`scripts/lib/auth-hook-l7-slots.mjs`）

---

## 6. 実行前に必要な人間判断

1. **本番 API への書き込みを許可するか**（cleanup 付きでも一瞬 published になる）
2. service role / allowlist パスワードを `.env` に揃えるか
3. cleanup 失敗時の手動対応担当（report の listing_id で Ops unpublish）
4. Access / ブラウザ確認は本スクリプト対象外（API のみ）でよいか

---

## 7. 実行コマンド案（**今回は実行しない**）

```bash
# 事前チェックのみ（推奨・安全）
node scripts/test-business-directory-production-safe-smoke.mjs

# 人間承認後のみ
node scripts/test-business-directory-production-safe-smoke.mjs --execute
```

---

## 8. 禁止事項（スクリプト側のガード）

- 既定で `--execute` なし → API 書き込みなし
- Stripe Live / Checkout を呼ばない
- secrets をログに出さない
- Migration / Edge / DB DDL なし
