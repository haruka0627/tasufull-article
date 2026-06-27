# Business Directory Phase 1 — DB / Migration / Seed

**日付:** 2026-06-27  
**種別:** migration + seed + static test（UI/API なし）

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `supabase/migrations/20260711100000_business_directory_phase1_schema.sql` | 10 テーブル · RLS · public view |
| `supabase/migrations/20260711100001_business_directory_phase1_seed.sql` | plan_features 4 · categories 8 |
| `scripts/test-business-directory-phase1-schema.mjs` | 静的検証 37/37 |
| `docs/business-directory-data-model-design.md` | status 7 値追記 |

---

## テーブル（10）

listings · profiles · categories · photos · business_hours · social_links · tlv_videos · plan_features · review_requests · audit_logs

---

## listings.status（DB CHECK）

`draft` · `review_requested` · `published` · `rejected` · `suspended` · `unpublished` · `archived`

---

## テスト

```bash
node scripts/test-business-directory-phase1-schema.mjs
```

**37/37 PASS**

---

## 未着手

- Supabase apply（staging 手動）
- UI / API / Edge
- Stripe

---

## 境界

`public.listings`（Marketplace）変更なし
