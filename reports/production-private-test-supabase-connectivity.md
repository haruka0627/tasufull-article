# 本番非公開テスト — Supabase / RLS / Edge / Storage 疎通確認

| 項目 | 内容 |
|------|------|
| 実施日 | **2026-06-23** |
| 前提 | Gate-C **GO with note** · Pages Production デプロイ済 · Access 有効 |
| フロント | `https://tasufull-article.pages.dev`（Cloudflare Access） |
| バックエンド | Supabase **`ddojquacsyqesrjhcvmn`**（staging · Pages Production env と同一） |
| 制約 | UI / DB スキーマ変更なし · Stripe 本番化なし · Access 設定変更なし |

---

## 総合判定

# 疎通確認: **GO**

| 層 | 判定 | 根拠 |
|----|------|------|
| **Supabase DB / RLS** | **PASS** | LIVE schema · TALK RLS · Marketplace RLS |
| **Storage** | **PASS** | 4 LIVE buckets 到達 · archives 未作成確認 |
| **Edge Functions** | **PASS** | `live-short-signed-url` · `live-notify`（verify p4/p7） |
| **フロント→Supabase 設定** | **PASS**（dist）/ **要 OTP**（live URL） | `chat-supabase-config.js` に staging URL |
| **ブラウザ E2E（Access 経由）** | **次工程** | Gate-D §6.2 手動 smoke |

---

## 1. 接続構成

| 項目 | 値 |
|------|-----|
| Pages プロジェクト | `tasufull-article` |
| Production URL | `https://tasufull-article.pages.dev` |
| Supabase URL（ビルド注入） | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| Anon key | Pages env `TASFUL_SUPABASE_ANON_KEY`（dist に注入 · **service_role なし**） |
| 本番専用 Supabase プロジェクト | **未分離** — 非公開テストは staging プロジェクトを使用 |

---

## 2. 実施した検証

### 2.1 LIVE P0 — Schema / RLS / Storage

```bash
node --env-file=.env scripts/verify-live-p0-schema.mjs
```

| 結果 | PASS **68** / FAIL **0** / SKIP 38 |
|------|-------------------------------------|

| 区分 | 要点 |
|------|------|
| **Tables** | `live_*` 9 テーブル存在 |
| **RLS 挙動** | tips 更新拒否 · moderation admin のみ · JWT テスト PASS |
| **Storage** | `short-videos` · `short-video-thumbnails`（private）· `live-avatars` · `live-thumbnails`（public） |
| **既存テーブル** | `talk_notifications` · `match_profiles` · `listings` 到達 · LIVE migration 無影響 |
| **SKIP** | `information_schema` / `pg_policies` REST 非公開（STATIC 検証で補完） |

### 2.2 LIVE Phase 1〜7（DB + Edge + UI smoke）

| スクリプト | 結果 | FAIL |
|------------|------|------|
| `npm run verify:live-p1` | PASS | 0 |
| `npm run verify:live-p2` | PASS | 0 |
| `npm run verify:live-p3` | PASS | 0 |
| `npm run verify:live-p4` | PASS | 0 |
| `npm run verify:live-p6` | PASS | 0 |
| `npm run verify:live-p5` | PASS | 0 |
| `npm run verify:live-p7` | PASS | 0 |

**Edge Functions（疎通確認済み）:**

| 関数 | Phase | 内容 |
|------|-------|------|
| `live-short-signed-url` | P4 | published short の signed URL 発行 |
| `live-notify` | P7 | follow / tip / broadcast / like → `talk_notifications` |

### 2.3 TALK / MATCH

| スクリプト | 結果 |
|------------|------|
| `node scripts/smoke-match-talk-room.mjs` | **PASS**（16 checks） |
| `node scripts/verify-talk-chat-unify-p1.mjs` | **PASS**（22/22） |
| `node scripts/verify-talk-rls-staging.mjs` | **PASS** |

### 2.4 Marketplace RLS

| スクリプト | 結果 |
|------------|------|
| `node scripts/verify-marketplace-rls.mjs` | **PASS**（P1 + P2 + P3） |

---

## 3. Production URL（Access 経由）の確認

| 項目 | 未認証 curl | 判定 |
|------|-------------|------|
| `/chat-supabase-config.js` | **302** Access | **想定どおり**（OTP 後に取得） |
| HTML 全般 | **302** | Gate-B/C と整合 |

**OTP ログイン後（運営者 · Gate-C で確認済みのセッション想定）:**

- ブラウザから `chat-supabase-config.js` が **200** で読み込まれ、Supabase REST / Auth が動作すること
- Gate-D §6.2 で LIVE / TALK / MATCH の代表画面を追加 smoke 推奨

---

## 4. 未実施・次工程

| 項目 | 理由 | 次アクション |
|------|------|--------------|
| Access 経由ブラウザ E2E | 自動スクリプトは OTP / Service Token 未設定 | Gate-D 手動 smoke |
| 本番専用 Supabase 分離 | 現計画は staging 共用 | 一般公開前に別途判断 |
| `tasful.jp` DNS | 未到達 | DNS 後に同一 dist + Supabase で再確認 |
| Supabase Auth Site URL = `tasful.jp` | Gate-A 要人手 | Access 後 Dashboard 確認（[`nb1d-custom-domain-auth-precheck.md`](nb1d-custom-domain-auth-precheck.md)） |
| ANPI RLS | スコープ外（今回未実行） | 必要時 `verify-anpi-rls-real-db.mjs` |

---

## 5. 残リスク

| 優先度 | リスク | 緩和 |
|--------|--------|------|
| P1 | staging Supabase を本番フロントが参照 | 非公開テスト期間は意図的 · データはテスト用 |
| P1 | Access 下の自動 smoke 未整備 | Service Token または手動 Gate-D |
| P2 | Stream / Stripe 本接続なし | P0 設計どおり stub |

---

## 6. Gate 状態（参考）

| Gate | 状態 |
|------|------|
| Gate-A | Go |
| Gate-B | （運営者手動 Access 有効化済みと想定） |
| Gate-C | **GO with note** |
| **本疎通** | **Go** |
| Gate-D | 次 — Access 内ブラウザ smoke |

---

## 7. 再実行コマンド

```bash
node --env-file=.env scripts/verify-live-p0-schema.mjs
npm run verify:live-p7
node --env-file=.env scripts/smoke-match-talk-room.mjs
node --env-file=.env scripts/verify-talk-rls-staging.mjs
node --env-file=.env scripts/verify-marketplace-rls.mjs
```

---

**署名:** Supabase / RLS / Edge / Storage 疎通 — 2026-06-23 · **GO**
