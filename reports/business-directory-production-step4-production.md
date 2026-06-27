# Business Directory Production Step 4 — Production Deploy / Smoke

**日付:** 2026-06-27  
**種別:** Cloudflare Pages **Production** deploy · 最終 smoke  
**Project ref:** `ddojquacsyqesrjhcvmn`

---

## 最終判定: **Go**

| 項目 | 結果 |
| --- | --- |
| **build:pages** | ✅ PASS |
| **Production deploy** | ✅ branch `main` · Active |
| **Production smoke** | ✅ **48/48 PASS** |
| **Marketplace / Platform 副作用** | ✅ なし |
| **仕様 / UI 変更** | ✅ なし（deploy + 検証のみ） |

---

## Production URL

| 種別 | URL |
| --- | --- |
| **Canonical（Production）** | https://tasufull-article.pages.dev |
| **Deploy preview（検証用）** | https://27b9ba2c.tasufull-article.pages.dev |

### Cloudflare Pages Deployment

| 項目 | 値 |
| --- | --- |
| **Deploy ID** | `27b9ba2c-fb39-42b7-8b76-98312b0e60ad` |
| **Environment** | Production |
| **Branch** | `main` |
| **Source commit** | `10a77dc`（Step 3 証跡 HEAD · BD dist 含む build） |
| **Deployed** | 2026-06-27 |

```bash
npm run build:pages
npx wrangler pages deploy deploy/cloudflare/dist \
  --project-name=tasufull-article \
  --branch=main \
  --commit-dirty=true
```

**NOTE:** 正本 URL `tasufull-article.pages.dev` は **Cloudflare Access** 保護のため、未認証 HTTP では Access ログイン HTML が返る。静的 / ブラウザ smoke は同一 Production ビルドの **deploy preview URL** で実施（Edge API smoke は canonical origin でも PASS）。

---

## Smoke 実行

```bash
node scripts/test-business-directory-production-step4-production.mjs --all
node scripts/test-business-directory-production-step4-production.mjs --smoke \
  --deploy-url https://27b9ba2c.tasufull-article.pages.dev
```

### Owner

| チェック | 結果 |
| --- | --- |
| login `t2@tasful.invalid` | PASS |
| create_draft_listing | PASS |
| update_draft_listing（編集） | PASS |
| get_owner_listings | PASS |
| submit_listing_for_review | PASS |
| browser dashboard / new / edit | PASS · console 0 |

### Admin

| チェック | 結果 |
| --- | --- |
| login `t4@tasful.invalid` (tasu_admin) | PASS |
| get_review_queue | PASS |
| get_ops_listing_detail | PASS |
| approve_listing → published | PASS |
| reject_listing（差戻し） | PASS |
| browser reviews / listing detail | PASS · console 0 |

### Public

| チェック | 結果 |
| --- | --- |
| get_public_listings | PASS |
| get_public_listing_detail | PASS |
| search `q=Step4` | PASS |
| published-only（reject 非表示） | PASS |
| browser list / detail | PASS · console 0 |

### Stripe (Test)

| チェック | 結果 |
| --- | --- |
| create_subscription_checkout | PASS |
| Playwright 4242 checkout | PASS |
| webhook / sync plan=standard | PASS |

### Marketplace / Platform / Edge（副作用なし）

| チェック | 結果 |
| --- | --- |
| index-top · business.html · shop-store.html · post.html | PASS |
| shop-checkout.js BD stripe 非耦合 | PASS |
| edge business-directory | PASS |
| edge stripe-webhook | PASS |

---

## Production Rollout 完了

```text
Step 1 Migration  → Step 2 Edge/Secrets → Step 3 Preview E2E → Step 4 Production Go
```

Business Directory サブスク掲載 MVP は **Production Pages + Staging Edge/DB** で mock なし導線確認済み。

---

## 参照

- [business-directory-production-step1-migration.md](./business-directory-production-step1-migration.md)
- [business-directory-production-step2-edge.md](./business-directory-production-step2-edge.md)
- [business-directory-production-step3-preview-e2e.md](./business-directory-production-step3-preview-e2e.md)
