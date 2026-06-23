# TASFUL MATCH → TASFUL TALK 連携 実装レポート

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日 | **2026-06-23** |
| 判定 | **実装完了（live Edge + UI 導線）** · linked ref への deploy / migration 適用は別途 |
| 方針 | MATCH 内チャットは作らず `transaction_rooms` を再利用 |

---

## 1. 調査結果（TALK 既存基盤）

| 区分 | 結果 |
|------|------|
| `talk_rooms` 等の専用テーブル | **なし** |
| 1対1 DM 基盤 | **`transaction_rooms`**（`buyer_id` / `seller_id`）+ `transaction_messages` + `transaction_reads` |
| メンバー中間テーブル | **なし**（参加者は buyer/seller 列） |
| MATCH 紐付け列 | **`match_pairs.talk_room_id`**（L10 migration 済 · FK 未適用） |
| RLS | MATCH: `supabase/migrations/` · TALK: `sql/auth-step8-legacy-chat-rls-proposal.sql` 等（proposal） |
| 既存 Edge | `talk-call-push-notify` のみ（通話）· ルーム作成 Edge は **MATCH 側で新規 live 化** |

**結論:** 基盤あり → **gap report ではなく live 実装**を実施。

---

## 2. 実装差分

### 2.1 Edge Function（live）

| ファイル | 内容 |
|----------|------|
| `supabase/functions/_shared/match-talk-room.ts` | **新規** — ペア検証・ブロック確認・ルーム再利用/作成・`match_pairs.talk_room_id` 更新 |
| `supabase/functions/_shared/match-db.ts` | `createMatchServiceClient()` 追加 |
| `supabase/functions/match-ensure-talk-room/index.ts` | stub → **live**（env 未設定 or stub token 時は従来 stub 応答） |

**live フロー:**

1. JWT → `talk_user_id`（`requireUser`）
2. `pair_id` 検証
3. **user client + RLS** で `match_pairs` SELECT（非参加者は行なし → **403**）
4. `status !== active` / `unmatched` / `blocked` / `archived` → **409**
5. `match_users_are_blocked` RPC → **409**（`blocked`）
6. 既存 `talk_room_id` または `listing_type=match` + `listing_id=pair.id` を再利用
7. なければ `transaction_rooms` INSERT（`listing_type=match`, buyer/seller = pair ids）
8. `match_pairs.talk_room_id` UPDATE
9. `{ room_id, redirect_url, created, reused }` 返却

**redirect_url:** `../chat-detail.html?room={uuid}`（MATCH `/match/` から TALK 詳細へ）

### 2.2 Migration

| ファイル | 内容 |
|----------|------|
| `supabase/migrations/20260623100000_match_talk_room_bridge.sql` | `transaction_rooms.match_pair_id`（optional）· `(listing_type, listing_id)` 索引 |

`match_pair_id` 列が未適用の環境では INSERT を **match_pair_id なしでリトライ**（後方互換）。

### 2.3 MATCH UI

| ファイル | 変更 |
|----------|------|
| `match/match-wiring.js` | `ensureTalkRoom` 成功時 **edge/live は redirect** · stub は toast のみ · ユーザー向けエラーメッセージ |
| `match/match-data-render.js` | 新規マッチ CTA ラベル **「メッセージする」** |
| `match/match-talk-bridge.html` | CTA **「メッセージする」** · `href="#"` + wiring 経由 |

`client_stub` デフォルトは **維持**（`match-api.js` 変更なし）。

---

## 3. セキュリティ

| 要件 | 対応 |
|------|------|
| JWT 必須 | `requireUser` · anon 直叩き **401** |
| 参加者チェック | user client RLS + コード二重確認 · 第三者 **403** |
| service_role | `transaction_rooms` INSERT / `match_pairs` UPDATE のみ · **事前に参加者検証済み** |
| ブロック | `match_users_are_blocked` → **409** |
| unmatched / blocked pair | **409** |
| MATCH 内チャット新規実装 | **なし** |

---

## 4. 検証

### 4.1 自動 smoke

```bash
node scripts/smoke-match-talk-room.mjs
node scripts/smoke-match-talk-room.mjs --base http://127.0.0.1:8788
```

| チェック | 結果 |
|----------|------|
| `client_stub` + wiring 維持 | **PASS** |
| UI「メッセージする」ラベル | **PASS** |
| console error 0（390 / 768 / 1280 相当） | **PASS** |

### 4.2 live モード（linked ref 向け · 手動 / CI）

deploy + migration 適用後:

```bash
node scripts/smoke-match-talk-room.mjs --live --functions-base https://<ref>.supabase.co/functions/v1
```

| ケース | 期待 |
|--------|------|
| a. A/B active pair → room 作成 | **200** · `mode:live` · `created:true` |
| b. 再実行 | **200** · 同一 `room_id` · `reused:true` |
| c. 第三者 pair_id | **403** |
| d. ブロック済み | **409** · `blocked` |
| e. unmatched | **409** · `conflict` |

（linked ref 上の DB シードが必要 — T1–T5 smoke ユーザー + `match_pairs` 行）

---

## 5. デプロイ手順（運用）

1. `supabase db push` または migration `20260623100000_match_talk_room_bridge.sql` 適用
2. `npx supabase functions deploy match-ensure-talk-room --project-ref <ref> --no-verify-jwt`
3. MATCH UI: `deploy/cloudflare/dist/match/*` 同期済みファイルを Pages deploy
4. 本番 UI で `edge_stub` 有効化（実 JWT + `__MATCH_FUNCTIONS_BASE__`）

---

## 6. 未着手 / 将来

| 項目 | 備考 |
|------|------|
| `match_pairs.talk_room_id` FK | migration 内コメント · TALK 環境安定後 |
| ブロック時 `transaction_rooms.status=cancelled` | `match-block-user` live 化時に連動 |
| TALK UI バッジ `listing_type=match` | Phase 2 · `chat-detail.js` 分岐 |
| `match-record-swipe` live + 自動マッチ | 別タスク |

---

## 7. 参照

| 文档 | 路径 |
|------|------|
| Edge 設計 | `reports/match-edge-functions-design.md` §2 |
| DB 設計 | `reports/match-db-api-design-review.md` §6 |
| TALK schema | `supabase/transaction_chat.sql` |
| Smoke | `scripts/smoke-match-talk-room.mjs` |

**判定:** MATCH は **TALK ルーム作成・遷移の入口**として live 実装完了。本番有効化は migration + Edge deploy + `edge_stub` 配線がゲート。
