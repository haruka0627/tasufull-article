# TASFUL MATCH — Profile Live Integration Report

**Date:** 2026-06-22  
**Ref:** `ddojquacsyqesrjhcvmn`  
**Verdict:** **PASS** (19/19 checks)  
**Scope:** T1 / T2 test users · `client_stub` 回帰維持

## Summary

新規ユーザーが実 JWT で MATCH プロフィールを **作成・更新**し、**写真登録**まで linked ref 上で動作することを確認しました。`edge_stub` 時のみ live Edge を呼び、デフォルト `client_stub` は変更していません。

## Hobby tag 方針（調査結果）

| 項目 | 判断 |
|------|------|
| マスタ | `match_hobby_tags`（slug + label_ja） |
| ユーザー入力 | **既存 slug のみ**（最大5件）· 自由追加不可 |
| 理由 | FK `on delete restrict` · RLS がマスタ参照前提 · スパム/不適切タグ防止 |
| UI 対応 | `data-hobby-slug` でチップとマスタを対応 |
| 追加 migration | `cafe` / `reading` を seed（UI 6 チップ完備） |

## Architecture

```
match-profile-create.html
  └─ edge_stub: MatchProfileWiring.submitWizard()
       ├─ match-upsert-profile (JWT → match_profiles + hobby_tags)
       └─ match-upload-photo (Storage + match_profile_photos)
            └─ publish=true → match_profiles_public（T2 から閲覧可）
```

## Edge Functions

| Function | 役割 |
|----------|------|
| `match-upsert-profile` | insert/update · validation · hobby sync · completion_score |
| `match-upload-photo` | Storage upload · photo row · main_photo_id（1枚） |

## Security

- anon → **401**
- `user_id` / `profile_id` なりすまし → **403**
- Storage path: `{talk_user_id}/{uuid}.ext` のみ（JWT 本人確認後 service_role upload）
- RLS: `match_profiles` / `match_profile_photos` / `match_profile_hobby_tags` は本人のみ書込

## Migration

`supabase/migrations/20260624100000_match_profile_storage.sql`

- Storage bucket `match-profile-photos`（private · 2MB · jpeg/png/webp）
- Hobby seed: `cafe`, `reading`

## Commands

```bash
npx supabase db query --linked --yes -f supabase/migrations/20260624100000_match_profile_storage.sql

npx supabase functions deploy match-upsert-profile match-upload-photo \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes

node scripts/verify-match-profile-live.mjs
node scripts/verify-match-profile-live.mjs --skip-deploy
```

## Verification results

| Section | Step | Result |
|---------|------|--------|
| Migration | storage bucket | PASS |
| JWT | T1/T2/T3 login | PASS |
| Profile | upsert + idempotent | PASS |
| Profile | single row per user | PASS |
| Photo | main_photo_id 1枚 | PASS |
| Photo | match_profile_photos | PASS |
| Public | T2 sees T1 in VIEW | PASS |
| Negative | anon 401 | PASS |
| Negative | foreign user_id 403 | PASS |
| Negative | foreign photo 403 | PASS |
| UI | 390/667/852/768/1280 console 0 | PASS |
| Smoke | client_stub default | PASS |
| Smoke | test-match-api-client-stub | PASS |

## Files changed

| Path | Role |
|------|------|
| `supabase/functions/_shared/match-profile.ts` | Shared upsert/upload logic |
| `supabase/functions/match-upsert-profile/index.ts` | Profile Edge |
| `supabase/functions/match-upload-photo/index.ts` | Photo Edge |
| `supabase/migrations/20260624100000_match_profile_storage.sql` | Bucket + hobby seed |
| `match/match-profile-wiring.js` | edge_stub UI wiring |
| `match/match-profile-create.html` | data-* fields + hobby slugs |
| `match/match-api.js` | `upsertProfile` / `uploadPhoto` |
| `match/match-mock.js` | wizard → wiring on final step |
| `scripts/verify-match-profile-live.mjs` | linked ref verification |

## Notes

- 写真 `moderation_status` は MVP で `approved` 自動（本番モデレーションは別フェーズ）
- `match-delete-photo` は未実装（最小スコープ）· 差し替えは新 main upload で対応
- コア E2E（swipe / pairs / TALK）は既存 Edge を変更せず維持
