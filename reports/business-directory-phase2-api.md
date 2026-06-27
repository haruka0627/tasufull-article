# Business Directory Phase 2 — API / Repository / Edge

**日付:** 2026-06-27  
**種別:** repository / service / Edge（UI なし）

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `supabase/functions/_shared/business-directory.ts` | Service 層 · 状態遷移 · audit |
| `supabase/functions/business-directory/index.ts` | Edge POST `{ action }` ルータ |
| `business-directory-repository.js` | ブラウザ用 fetch ラッパ（UI 未接続） |
| `scripts/test-business-directory-phase2-api.mjs` | 静的 + transition + deno check |
| `supabase/config.toml` | `[functions.business-directory] verify_jwt = false` |

---

## Edge actions

| action | 認可 |
| --- | --- |
| `health` | なし |
| `get_public_listings` / `get_public_listing_detail` | なし |
| `create_draft_listing` … `unpublish_listing` | JWT / dev header |
| `get_review_queue` … `restore_listing` | ops |

Dev header（`BUSINESS_DIRECTORY_ALLOW_DEV_HEADER=1`）:
`X-Business-Directory-User-Id` · `X-Business-Directory-Ops=1`

---

## 状態遷移（service 厳守）

```text
draft → review_requested
review_requested → published | rejected
published → suspended | unpublished
suspended → review_requested | published   (published = restoreListing)
unpublished → review_requested | published
rejected → draft                           (updateDraftListing)
```

---

## テスト

```bash
node scripts/test-business-directory-phase2-api.mjs
```

---

## 未着手

- Supabase migration apply + Edge deploy
- UI / HTML / CSS
- Stripe 課金連携

---

## 境界

Phase 1 DB スキーマ変更なし · Marketplace `public.listings` 変更なし
