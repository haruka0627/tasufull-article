# Business Directory Production Step 3 — Pages Preview / Mock-free E2E

**日付:** 2026-06-27  
**種別:** Pages preview deploy · mock なし E2E（**Production 本番公開は未実施**）  
**Project ref:** `ddojquacsyqesrjhcvmn`

---

## 結論

| 項目 | 結果 |
| --- | --- |
| **build:pages** | ✅ PASS |
| **Pages preview deploy** | ✅ branch `business-directory-step3-preview` |
| **Preview static** | ✅ 4/4 PASS |
| **Mock-free E2E** | ✅ **15/15 PASS** |

**検証した実導線:**

```text
Owner 新規掲載 (create_draft_listing)
  → Checkout (Stripe Test 4242)
  → Webhook / sync (plan=standard)
  → 公開申請 (submit_listing_for_review)
  → Admin 承認 (approve_listing · T4 tasu_admin)
  → Public 表示 (get_public_listing_detail · get_public_listings · DB published)
```

---

## Preview URL

| 種別 | URL |
| --- | --- |
| **Deployment** | `https://4b18246f.tasufull-article.pages.dev` |
| **Branch alias** | `https://business-directory-step3-pre.tasufull-article.pages.dev` |

```bash
npm run build:pages
npx wrangler pages deploy deploy/cloudflare/dist \
  --project-name=tasufull-article \
  --branch=business-directory-step3-preview \
  --commit-dirty=true
```

---

## E2E 実行

```bash
node scripts/test-business-directory-production-step3-preview-e2e.mjs --e2e \
  --preview-url https://business-directory-step3-pre.tasufull-article.pages.dev
```

**前提:** `.env` に `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` · `SUPABASE_SERVICE_ROLE_KEY`

| チェック | 結果 |
| --- | --- |
| preview static（BD pages + chat-supabase-config ref） | 4/4 PASS |
| owner login `t2@tasful.invalid` | PASS |
| ops login `t4@tasful.invalid`（`tasu_admin` JWT 確認） | PASS |
| `create_draft_listing` | PASS |
| `create_subscription_checkout` → Stripe Hosted | PASS |
| Stripe Playwright 4242 → success redirect | PASS |
| `sync_subscription_status` plan=standard | PASS |
| `submit_listing_for_review` | PASS |
| `approve_listing` → published | PASS |
| `get_public_listing_detail` | PASS |
| `get_public_listings` contains listing | PASS |
| DB `status=published` · `plan_code=standard` | PASS |

**最終 run 例:** listing `d7678ccc…` · slug `bd-step3-e2e-1782576551196-2eb71f09`

---

## 実装メモ（スクリプト）

- **Stripe Checkout UI:** `#cardNumber` 等の出現まで `waitForSelector`（ロード遅延対策）
- **Ops ロール:** E2E 前に service role で T4 `app_metadata.role=tasu_admin` を ensure（JWT 403 回避）
- **Webhook 待ち:** checkout 後 `pollSyncPlan`（最大 ~60s）で plan 反映を確認

---

## 次ステップ（Step 4 · 未着手）

1. **Pages production deploy**（別指示 · 本 Step では未実施）
2. Production 同一手順の最終 smoke
3. Stripe Live 切替 · webhook 本番 endpoint 確認

---

## 参照

- [business-directory-production-step1-migration.md](./business-directory-production-step1-migration.md)
- [business-directory-production-step2-edge.md](./business-directory-production-step2-edge.md)
- [business-directory-phase7-deploy-preflight.md](./business-directory-phase7-deploy-preflight.md)
