# Platform Request P5.2a — Candidate RLS Fix Blueprint

**Date:** 2026-07-05  
**Phase:** P5.2a 設計 **Go** · **P5.2a-Apply Staging 適用 Go**  
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（**のみ** · 適用済み）  
**Prior:** [P5.2 レビュー](./platform-request-p5.2-staging-review.md) · [P5-6 CRUD](./platform-request-p5-6-supabase-crud.md)

---

## 0. スコープ宣言

| 実施 | 未実施 |
| --- | --- |
| S1 リスク整理 · 修正案比較 · 推奨案 | Production 接続 |
| SQL 修正案草案 | JS / HTML / CSS 変更 |
| **Staging 適用（P5.2a-Apply）** | P5-7 実装 |
| 適用後検証 · P5-6 回帰 | Talk / Stripe / 通知 |

**SQL 草案:** `supabase/platform-request-p5.2a-candidate-rls-fix-draft.sql`

---

## 1. 現状整理

### 1.1 `platform_request_matches`（P5.1 · Staging 適用済み）

| 項目 | 内容 |
| --- | --- |
| **役割** | 依頼 × 候補のマッチ行 · スコア · 反応状態 · Talk 接続の正本 |
| **FK** | `request_id` → `platform_requests.id`（CASCADE） |
| **疎結合** | `candidate_id` + `candidate_type` — **FK なし** |
| **UNIQUE** | `(request_id, candidate_id, candidate_type)` |
| **書き込み** | クライアント INSERT/UPDATE ポリシー **なし** → **service_role / Edge** 想定 |

### 1.2 責務マトリクス

| 主体 | 責務 | 現状 RLS |
| --- | --- | --- |
| **request owner** | 依頼投稿 · 自依頼のマッチ一覧閲覧 | `platform_requests.owner_id = auth.uid()` · matches は EXISTS join ✅ |
| **candidate user** | 自分宛マッチの閲覧 · 将来「対応できます」 | `select_candidate` — **一部 type のみ** ⚠️ |
| **candidate_id** | エンティティ識別子（partner/worker/listing/user） | RLS には直接使わない（修正案後） |
| **candidate_type** | エンティティ種別 · マッチロジック分岐 | CHECK 6+1 値 |
| **service_role** | マッチ生成 · status 更新 · 通知 fan-out | RLS バイパス ✅ |

### 1.3 現行 `select_candidate` ポリシー（P5.1 L325–331）

```sql
candidate_id = auth.uid()
and candidate_type in ('user', 'worker', 'freelancer')
```

**暗黙の運用規約:** `candidate_id` に **auth.users.id** を入れる前提 — `worker` / `builder_partner` で entity id を入れると破綻。

---

## 2. S1 リスク整理

### 2.1 問題の本質

| ID | リスク | 深刻度 |
| --- | --- | --- |
| **S1** | `candidate_id` がエンティティ ID のとき、候補担当者が RLS で SELECT できない | **重大** |
| **S2** | `worker` 型で `candidate_id` = entity id か auth.uid() か運用が曖昧 | **重大**（S1 と連動） |

### 2.2 candidate_type 別の現状

| candidate_type | `candidate_id` の想定 | 現 RLS | 判定 |
| --- | --- | --- | --- |
| `user` / `freelancer` | `auth.users.id` | `candidate_id = auth.uid()` | ✅ |
| `worker` | `builder_workers.id` を入れる設計 | `candidate_id = auth.uid()` | ❌ 不一致 |
| `builder_partner` | `builder_partners.id` | ポリシー対象外 | ❌ 担当者 SELECT 不可 |
| `company` | 法人エンティティ ID（未定義） | 対象外 | ❌ |
| `listing` | `listings.id` | 対象外 | ❌ |

### 2.3 Builder 既存スキーマ（参照のみ · 非変更）

| テーブル | エンティティ ID | ログインユーザー紐付け |
| --- | --- | --- |
| `builder_partners` | `id` uuid | `owner_auth_uid` **text**（`auth.uid()::text`） |
| `builder_workers` | `id` uuid | `owner_auth_uid` **text** |
| `builder_contact_reveals` | — | `user_id` **uuid** |

**法人 / 個人:** `builder_partners.partner_type` ∈ `company` | `individual` — いずれも **1 partner 行 = 1 owner_auth_uid**（担当者アカウント）

### 2.4 RLS で安全に SELECT できる条件（目標）

| ロール | 条件 |
| --- | --- |
| 依頼オーナー | `platform_requests.owner_id = auth.uid()`（現状維持） |
| 候補担当者 | **`candidate_user_id = auth.uid()`**（新設 · 正本） |
| 第三者 | 不可（request owner / candidate user 以外） |
| service_role | 全操作（マッチジョブ） |

---

## 3. 修正案比較

### 案 A — `platform_request_matches` に `candidate_user_id` 追加（推奨）

| 観点 | 評価 |
| --- | --- |
| **内容** | `candidate_user_id uuid` nullable · RLS `candidate_user_id = auth.uid()` |
| **メリット** | 最小差分 · Builder 非接触 · type 横断で統一 · P5-7 で INSERT 時に1列セット即可 |
| **デメリット** | マッチジョブが解決ロジックを持つ必要 · 既存行は NULL（要 backfill または再生成） |
| **実装コスト** | **低** — ALTER 1列 + ポリシー1件 + index |
| **RLS 安全性** | **高** — auth.uid() 直接比較 · 他テーブル JOIN 不要 |
| **P5-7 影響** | Edge/RPC が type 別に `candidate_user_id` を解決して INSERT |

---

### 案 B — `candidate_profiles` 統合テーブル新設

| 観点 | 評価 |
| --- | --- |
| **内容** | `(candidate_type, candidate_id) → user_id` の解決テーブル |
| **メリット** | 正規化 · 将来 Platform 横断で再利用可 |
| **デメリット** | 新テーブル + sync + RLS 追加 · P5-7 前のスコープ肥大 |
| **実装コスト** | **高** |
| **RLS 安全性** | 中〜高（設計次第） |
| **P5-7 影響** | マッチ INSERT 前に profile 行が必須 — 運用複雑 |

---

### 案 C — `builder_partners` 等に `user_id` 追加して RLS JOIN

| 観点 | 評価 |
| --- | --- |
| **内容** | 案 B の変形 · EXISTS サブクエリで `owner_auth_uid` 照合 |
| **メリット** | `candidate_id` を entity id のまま RLS 可能（type 別ポリシー） |
| **デメリット** | **Builder テーブル変更** · `owner_auth_uid` text vs uuid 混在 · type ごとに別ポリシー · `company`/`listing` 未定義 |
| **実装コスト** | **中〜高**（Builder 凍結領域に抵触） |
| **RLS 安全性** | 中（JOIN 漏れ・ type 追加時の抜け穴） |
| **P5-7 影響** | ポリシー複雑化 · レビュー負荷増 |

---

### 案 D — P5-7 は service_role 生成 + request owner 閲覧のみ

| 観点 | 評価 |
| --- | --- |
| **内容** | candidate 側クライアント SELECT なし · owner のみ matches 閲覧 |
| **メリット** | DDL 変更不要 · 即 P5-7 着手可 |
| **デメリット** | **候補者が自分のマッチを見られない** · 「対応できます」E2E 不可 · Builder E2E 永久 No-Go |
| **実装コスト** | **最低** |
| **RLS 安全性** | 高（候補者に開かない） |
| **P5-7 影響** | 候補 UI は引き続き P3 demo のみ — **製品価値未達** |

---

### 3.1 比較サマリ

| 案 | コスト | RLS 安全 | Builder 非接触 | P5-7 即応 | 将来拡張 |
| --- | --- | --- | --- | --- | --- |
| **A** `candidate_user_id` | 低 | 高 | ✅ | ✅（amendment 後） | ✅ |
| B profiles テーブル | 高 | 高 | ✅ | △ | ✅✅ |
| C Builder JOIN | 中〜高 | 中 | ❌ | △ | △ |
| D owner のみ | 最低 | 高 | ✅ | ✅ | ❌ |

---

## 4. 推奨案 — **案 A（`candidate_user_id`）**

### 4.1 選定理由

1. **P5-7 の最小安全経路** — matches 単体 CRUD + owner/candidate 双方 SELECT が通る
2. **Builder 非破壊** — `builder_partners` / `builder_workers` に DDL 触れない
3. **S1/S2 同時解消** — `candidate_id` = entity id · `candidate_user_id` = auth user を分離
4. **Staging のみ amendment** — `platform_requests` / 既存 10 ポリシーに影響なし

### 4.2 `candidate_user_id` 解決ルール（マッチジョブ · P5-7）

| candidate_type | `candidate_id` | `candidate_user_id` の決め方 |
| --- | --- | --- |
| `user` / `freelancer` | `auth.users.id` | **同一**（`candidate_id` = `candidate_user_id`） |
| `worker` | `builder_workers.id` | `builder_workers.owner_auth_uid::uuid`（NULL ならマッチ除外） |
| `builder_partner` | `builder_partners.id` | `builder_partners.owner_auth_uid::uuid` |
| `company` | 将来 ID | 当面 P5-7 では **未使用** · 投入時は owner 解決後 |
| `listing` | `listings.id` | P5-8+ · 掲載者 `user_id` 解決後 |

**原則:** INSERT 時に `candidate_user_id` が NULL の行は、候補者 RLS では**見えない**（owner のみ閲覧可）。

### 4.3 案 C の要素（任意 · ポリシーには入れない）

マッチジョブ側で Builder を **読んで** `candidate_user_id` を埋める — RLS は単純な `auth.uid()` 比較のみ。  
→ 案 C の JOIN を **アプリケーション層（service_role）** に閉じ込める。

---

## 5. SQL 草案

**ファイル:** `supabase/platform-request-p5.2a-candidate-rls-fix-draft.sql`

| 変更 | 内容 |
| --- | --- |
| ALTER | `candidate_user_id uuid null` |
| INDEX | `platform_request_matches_candidate_user_id_idx`（部分 index） |
| POLICY | `platform_request_matches_select_candidate` 置換 |
| 非変更 | `platform_requests` · `select_owner` · 他 4 テーブル · Builder テーブル |

**適用:** Staging Dashboard 手動 · P5-4 と同手順 · **Production 禁止**

**適用後ポリシー数:** 10 のまま（matches の candidate ポリシー 1 件を差し替え）

---

## 6. P5-7 接続方針

### 6.1 matches 作成者

| 層 | 責務 |
| --- | --- |
| **service_role Edge / RPC** | マッチアルゴリズム実行 · `platform_request_matches` INSERT |
| **クライアント** | INSERT **禁止**（P5.1 維持） |
| **入力** | `request_id` · `candidate_id` · `candidate_type` · `match_score` · `match_reasons` · **`candidate_user_id`** |

### 6.2 閲覧権限（修正案適用後）

| ユーザー | 見えるもの |
| --- | --- |
| 依頼オーナー | 自依頼の全マッチ行 |
| 候補担当者 | `candidate_user_id = 自分` のマッチ行 |
| その他 authenticated | 不可 |

### 6.3 UI スコープ（P5-7）

| 画面 | P5-7 で出すもの |
| --- | --- |
| 依頼詳細（owner） | Supabase matches 一覧（service_role 生成後）· 候補カードは **P3 demo 併存可** |
| 候補者ダッシュボード | **最小** — 自分宛マッチ一覧（`candidate_user_id` フィルタ） |
| 「対応できます」 | status → `responded` 更新は **service_role RPC**（P5-7 または P5-8） |

### 6.4 延期するもの

| 項目 | 延期先 |
| --- | --- |
| `company` / `listing` 型の本接続 | P5-8+ |
| Builder partner フル E2E（検索→マッチ→閲覧） | P5.2a amendment 適用 + P5-7 実装後 |
| Talk / Stripe / 通知 | P5-8+（変更なし） |
| `candidate_profiles` 統合テーブル | 将来（必要になった時点で案 B 再検討） |

---

## 7. `platform_requests` CRUD への影響

| 項目 | 影響 |
| --- | --- |
| P5-6 Adapter | **なし** — `platform_requests` テーブル無変更 |
| 既存 RLS 10 件 | **なし** — matches の 1 ポリシー差し替えのみ |
| localStorage | **なし** |

---

## 8. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| Production 接続 | なし ✅ |
| JS / HTML / CSS | 変更なし ✅ |
| Talk / Stripe / 通知 | 未着手 ✅ |
| service_role フロント露出 | なし ✅ |

---

## 12. P5.2a-Apply — Staging 適用記録

### 12.1 適用前 SQL 再確認

| 項目 | 確認 |
| --- | --- |
| `candidate_user_id uuid` nullable 追加 | ✅ |
| RLS 正本 = `auth.uid()` 比較（FK なし · 運用で auth user を格納） | ✅ |
| `select_candidate` → `candidate_user_id = auth.uid()` | ✅ |
| `select_owner` 非変更 | ✅ |
| INSERT/UPDATE ポリシー追加なし（service_role 前提維持） | ✅ |
| `platform_requests` / Builder テーブル非接触 | ✅ |

### 12.2 適用実行

| 項目 | 記入 |
| --- | --- |
| 実行日時（JST） | 2026-07-05 |
| 環境 | Staging `ahlxuyvhzqdqaojiywmu` |
| 方法 | Supabase CLI `db query --linked`（ref 確認後） |
| SQL 正本 | `supabase/platform-request-p5.2a-candidate-rls-fix-draft.sql` |
| 実行結果 | **SUCCESS**（DDL 完了 · 0 errors） |

**実行概要:**

1. `ALTER TABLE platform_request_matches ADD COLUMN candidate_user_id uuid NULL`
2. `COMMENT ON COLUMN …`
3. `CREATE INDEX platform_request_matches_candidate_user_id_idx`
4. `DROP POLICY platform_request_matches_select_candidate`
5. `CREATE POLICY … candidate_user_id = auth.uid()`

### 12.3 適用後確認結果

**証跡:** [platform-request-p5-2a-staging-verify-result.json](./platform-request-p5-2a-staging-verify-result.json)

| 検証 | 期待 | 実測 | 判定 |
| --- | --- | --- | --- |
| `candidate_user_id` 列 | uuid · nullable | uuid · YES | ✅ |
| matches RLS | enabled | true | ✅ |
| `select_owner` | 存続 | EXISTS join 式維持 | ✅ |
| `select_candidate` | `candidate_user_id = auth.uid()` | qual 一致 | ✅ |
| matches ポリシー数 | 2 | 2 | ✅ |
| 部分 index | `platform_request_matches_candidate_user_id_idx` | あり | ✅ |
| `platform_requests` ポリシー | 4 | 4 | ✅ |
| 総ポリシー数 | 10 | 10 | ✅ |

**再検証:**

```bash
npx supabase link --project-ref ahlxuyvhzqdqaojiywmu --yes
node scripts/verify-platform-request-p5-2a-staging.mjs
```

### 12.4 P5-6 回帰

```bash
node scripts/test-platform-request-p5-6-supabase-crud.mjs
```

| 項目 | 結果 |
| --- | --- |
| platform_requests CRUD | **ALL PASS** |
| Console Error | **0** |
| HTTP | 200 @ `http://127.0.0.1:8788` |

---

## 9. Go / No-Go 判定（P5.2a-Apply 更新）

### 9.1 P5.2a 設計 + Staging 適用

| 項目 | 判定 |
| --- | --- |
| S1 整理 · 修正案比較 | **Go** ✅ |
| 推奨案（案 A）確定 | **Go** ✅ |
| Staging amendment 適用 | **Go** ✅ |
| P5-6 CRUD 回帰 | **Go** ✅ |

### **判定 A: Go — P5.2a-Apply 完了**

---

### 9.2 P5-7 着手

| 条件 | 判定 |
| --- | --- |
| P5.2a Staging 適用済み | **Go** ✅ |
| matches INSERT + SELECT 実装 | **Go** — P5-7 着手可 |

### **判定 B: Go — P5-7 着手可**

---

### 9.3 Builder candidate E2E

### **判定 C: No-Go — Builder マッチ E2E は P5-7 実装完了まで継続禁止**

（RLS 修正案は反映済みだが、マッチジョブ · UI 接続は未実装）

---

### 9.4 Production

### **判定 D: No-Go — Production 適用禁止（継続）**

---

## 10. 次アクション

| 優先 | タスク | Phase |
| --- | --- | --- |
| 1 | ~~P5.2a SQL Staging 適用~~ | ✅ **P5.2a-Apply Go** |
| 2 | P5-7 matches INSERT（service_role）+ owner/candidate SELECT | **P5-7** |
| 3 | `scripts/test-platform-request-p5-7-matches.mjs` | P5-7 |
| 4 | Builder candidate E2E（P5-7 後） | P5-8 |

---

## 11. 参照

| ドキュメント | 用途 |
| --- | --- |
| [platform-request-p5.1-ddl-rls-draft.sql](../supabase/platform-request-p5.1-ddl-rls-draft.sql) | P5.1 正本 |
| [platform-request-p5.2a-candidate-rls-fix-draft.sql](../supabase/platform-request-p5.2a-candidate-rls-fix-draft.sql) | 修正案 |
| [platform-request-p5.2-staging-review.md](./platform-request-p5.2-staging-review.md) | S1 初出 |
| [docs/supabase-environments.md](../docs/supabase-environments.md) | ref 正本 |

---

*Completed: Platform Request P5.2a · Staging applied · P5-7 Go*
