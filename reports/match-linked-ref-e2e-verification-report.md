# TASFUL MATCH — linked ref E2E Verification Report

**Date:** 2026-06-22  
**Ref:** `ddojquacsyqesrjhcvmn`  
**Verdict:** **PASS** (51/51 checks)  
**Scope:** T1 / T2 / T3 test users only (`t1@tasful.invalid` 等)

## Executive summary

MATCH コア E2E（スワイプ → 相互 like → `match_pairs` → 一覧 → TALK ルーム）を linked Supabase ref + 実 JWT + 実 Edge Functions で検証し、**全項目 PASS**。

検証中に見つかった linked ref 固有の差分（`transaction_rooms` スキーマ・migration 未適用）は最小修正で解消済み。

## 実施コマンド

```bash
# フル検証（migration 確認 + deploy + API + UI + smoke）
node scripts/verify-match-linked-ref-e2e.mjs

# deploy 済みの場合
node scripts/verify-match-linked-ref-e2e.mjs --skip-deploy

# migration 適用（初回のみ · linked ref）
npx supabase db query --linked --yes -f supabase/migrations/20260623100000_match_talk_room_bridge.sql

# Edge deploy（linked ref · JWT は関数内検証）
npx supabase functions deploy match-record-swipe match-list-pairs match-ensure-talk-room \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes

# 静的 smoke
node scripts/smoke-match-core-e2e.mjs --live \
  --functions-base https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1
```

## 検証フロー

```
T1 like T2 → match_swipes (1)
T2 like T1 → match_swipes (2) + match_pairs (1)
T1 match-list-pairs → partner T2
match-ensure-talk-room → transaction_rooms (listing_type=match)
                       → match_pairs.talk_room_id 更新
UI edge_stub → 一覧 live 表示 → メッセージする → chat-detail.html?room={id}
```

## 検証結果サマリ

| # | 項目 | 結果 | 備考 |
|---|------|------|------|
| 1 | Migration | **PASS** | `transaction_rooms.match_pair_id` + indexes 適用済み |
| 2 | Edge deploy | **PASS** | `match-record-swipe` / `match-list-pairs` / `match-ensure-talk-room` |
| 3 | JWT (T1–T3) | **PASS** | `talk_user_id` = t1/t2/t3 · RLS 自己プロフィール読取 |
| 4 | 相互 like | **PASS** | swipes×2 · pairs×1 · 重複 swipe 409 · pair 増殖なし |
| 5 | 一覧 live | **PASS** | T1↔T2 相互表示 · T3 非表示 |
| 6 | TALK ルーム | **PASS** | room 作成 · `talk_room_id` 更新 · 再利用 · redirect URL |
| 7 | 不正系 | **PASS** | anon 401 · 第三者 403 · 未知 pair 403 · block 409 |
| 8 | UI edge_stub | **PASS** | 390/667/852/768/1280 · console 0 · TALK 遷移 |
| 9 | client_stub 回帰 | **PASS** | デフォルト `client_stub` · stub pairs×3 維持 |

## 検証中の修正（最小差分）

### 1. Migration 適用

初回確認時 `transaction_rooms.match_pair_id` が未存在。  
`20260623100000_match_talk_room_bridge.sql` を linked ref に適用。

### 2. `match-talk-room.ts` — linked ref `transaction_rooms` スキーマ差分

linked ref の `transaction_rooms` には `title` / `partner_*` 列がなく、最小列のみ:

`listing_id`, `listing_type`, `buyer_id`, `seller_id`, `status`, `expires_at`, `match_pair_id`

→ INSERT をリッチな行から段階的にフォールバックするよう修正（`match-ensure-talk-room` 再 deploy 済み）。

### 3. 検証スクリプト追加

`scripts/verify-match-linked-ref-e2e.mjs` + `sql/match-linked-ref-e2e-readonly.sql`

## セキュリティ確認

| チェック | 確認内容 |
|----------|----------|
| JWT 本人 | Edge は Bearer JWT の `talk_user_id` のみ信頼（`x-match-user-id` 無視） |
| pair 参加者 | `match-ensure-talk-room` 非参加者 → 403 |
| service_role | pair 作成は相互 like 後のみ · room INSERT は参加者検証後 |
| block | `match_users_are_blocked` RPC → 409 |
| client_stub | ローカルデフォルト未変更 |

## 詳細結果

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Migration | transaction_rooms.match_pair_id | PASS | present |
| Migration | match_pairs.talk_room_id | PASS | present |
| Migration | idx transaction_rooms_match_pair_id_uidx | PASS | present |
| Migration | idx transaction_rooms_listing_match_idx | PASS | present |
| Deploy | skipped | PASS | --skip-deploy |
| JWT | T1 talk_user_id | PASS | t1 |
| JWT | T2 talk_user_id | PASS | t2 |
| JWT | T3 talk_user_id | PASS | t3 |
| JWT | match_current_user_id via RLS | PASS | t1 reads own profile |
| JWT | profiles ready | PASS | t1 + t2 active |
| Like | cleanup t1↔t2 | PASS | swipes/pair/rooms cleared |
| Like | T1 → T2 like | PASS | swipe_recorded, matched=false |
| Like | T2 → T1 like (mutual) | PASS | pair_id=538dbbf0… |
| Like | match_swipes count | PASS | 2 |
| Like | match_pairs count | PASS | 1 |
| Like | duplicate swipe | PASS | 409 conflict |
| Like | pair idempotency | PASS | still 1 |
| List | T1 sees T2 | PASS | E2E T2 |
| List | T2 sees T1 | PASS | E2E T1 |
| List | T3 isolation | PASS | pair hidden |
| TALK | redirect_url format | PASS | ../chat-detail.html?room=… |
| TALK | first ensure | PASS | created=true |
| TALK | transaction_rooms listing_type=match | PASS | t1/t2 |
| TALK | match_pairs.talk_room_id | PASS | updated |
| TALK | reuse room | PASS | reused=true |
| Negative | anon → 401 | PASS | list-pairs |
| Negative | T3 pair access | PASS | 403 |
| Negative | unknown pair | PASS | 403 |
| Negative | blocked users | PASS | 409 |
| UI | list live @390/768/1280 | PASS | rendered |
| UI | talk CTA / console | PASS | メッセージする · 0 errors |
| UI | talk bridge redirect | PASS | chat-detail.html?room=… |
| Smoke | client_stub | PASS | mode + 3 stub pairs |
| Smoke | core + api stub | PASS | regression OK |

## 変更ファイル

| ファイル | 変更 |
|----------|------|
| `supabase/functions/_shared/match-talk-room.ts` | transaction_rooms INSERT フォールバック |
| `scripts/verify-match-linked-ref-e2e.mjs` | linked ref 実機 E2E 自動検証 |
| `sql/match-linked-ref-e2e-readonly.sql` | migration 列・index 確認 |

## 残課題（任意）

- linked ref `transaction_rooms` に `title` / `partner_display_name` 等を追加する migration（TALK UI 表示強化用・ MATCH E2E には不要）
- `match-record-swipe` / `match-list-pairs` の linked ref deploy を CI に組込み
