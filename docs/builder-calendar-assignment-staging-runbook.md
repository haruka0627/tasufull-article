# CAL-MAIN-14：Staging assignment jsonb 手動 Migration + partner RPC 設計

**作成日:** 2026-07-04  
**種別:** 手動適用用 SQL · 検証手順 · RPC/RLS **設計**（自動適用・RPC 実装・RLS 変更はしない）

| 成果物 | パス |
| --- | --- |
| Forward SQL | [supabase/manual/staging_builder_projects_assignment_jsonb.sql](../supabase/manual/staging_builder_projects_assignment_jsonb.sql) |
| Rollback SQL | [supabase/manual/staging_builder_projects_assignment_jsonb_rollback.sql](../supabase/manual/staging_builder_projects_assignment_jsonb_rollback.sql) |
| 設計正本 | [builder-calendar-assignment-jsonb-design.md](./builder-calendar-assignment-jsonb-design.md) |
| 列検出スクリプト | `node scripts/verify-builder-assignment-jsonb-staging.mjs` |

**対象:** Staging `ahlxuyvhzqdqaojiywmu` のみ  
**禁止:** Production `ddojquacsyqesrjhcvmn` · `supabase db push` · MCP での DDL · CI 自動 migrate

---

## 1. Staging 用 assignment jsonb SQL

ファイル: `supabase/manual/staging_builder_projects_assignment_jsonb.sql`

内容要約:

1. `assignment jsonb null` カラム追加
2. `builder_projects_assignment_status_chk`（`pending|accepted|declined`）
3. expression index `(assignment->>'partner_id')`
4. 存在確認 SELECT

---

## 2. Rollback SQL

ファイル: `supabase/manual/staging_builder_projects_assignment_jsonb_rollback.sql`

1. drop constraint
2. drop index
3. drop column `assignment`
4. 存在確認（0 行期待）

---

## 3. 手動適用手順

### 3.1 事前確認

1. Supabase Dashboard で **Staging** プロジェクト（`ahlxuyvhzqdqaojiywmu`）を開いていること
2. Production プロジェクトを開いていないこと
3. `builder_projects` テーブルが既に存在すること（P3.6 系 migration 適用済み想定）

### 3.2 Forward 適用

1. Dashboard → **SQL Editor** → New query
2. `supabase/manual/staging_builder_projects_assignment_jsonb.sql` の全文を貼り付け
3. **Run**
4. 結果ペインで `column_name = assignment` / `data_type = jsonb` を確認

### 3.3 適用後の簡易 SQL 確認

```sql
-- 列
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'builder_projects'
  and column_name = 'assignment';

-- constraint
select conname
from pg_constraint
where conname = 'builder_projects_assignment_status_chk';

-- index
select indexname
from pg_indexes
where tablename = 'builder_projects'
  and indexname = 'builder_projects_assignment_partner_id_idx';
```

### 3.4 Rollback（必要な場合のみ）

1. Staging であることを再確認
2. `staging_builder_projects_assignment_jsonb_rollback.sql` を Run
3. assignment 列が 0 件であることを確認

---

## 4. 手動適用後の検証手順

ローカルは `npm run build:pages`（または dist 同期）後、`npm run dev` → `http://127.0.0.1:8788`。  
`chat-supabase-config.js` が **Staging** を指していること。

### 4.1 列の存在（アプリ側）

```bash
node scripts/verify-builder-assignment-jsonb-staging.mjs
```

期待:

- `assignment_column: true`（Staging 適用済みかつクライアント接続可）
- 未適用 / 未接続時は `SKIP`（失敗扱いにしない）

### 4.2 pending 作成 → DB assignment

1. ブラウザで `http://127.0.0.1:8788/builder/admin-calendar.html?role=owner`
2. **Staging にログイン**（owner JWT · Write Adapter が `dataSourceMode=supabase` になること）
3. 運営案件を 1 件作成（または DevTools で）:

```js
// Console on admin-calendar (logged in)
const r = window.TasuBuilderBenchBridge.createAdminCalendarProject({
  title: "CAL-MAIN-14 verify pending",
  partnerId: "demo-partner-001",
  partnerName: "デモパートナー",
  start: "2027-04-01",
  end: "2027-04-02",
  location: "東京都",
  instructions: "staging verify",
  skipNotification: true,
});
console.log(r);
// expect: primary === "hub", hub_project_id present
```

4. Dashboard SQL:

```sql
select id, title, assignment
from public.builder_projects
where id = '<hub_project_id>'
   or assignment->>'legacy_project_id' = '<project_id>';
```

期待: `assignment->>'status' = 'pending'`

> **注意:** 現行 RLS は **owner のみ UPDATE**。未ログイン / owner 不一致だと Adapter は skip し local のみ更新される。その場合 DB 行は空のまま — **ログイン済み owner で再試行**。

### 4.3 受諾 → accepted

```js
const accept = window.TasuBuilderBenchBridge.acceptCalendarAssignment(r.project_id);
console.log(accept);
// expect: ok === true, hub_assignment_ok === true
```

SQL:

```sql
select assignment->>'status' as status, assignment->>'accepted_at' as accepted_at
from public.builder_projects
where id = '<hub_project_id>';
```

期待: `status = accepted` · `accepted_at` 非空

### 4.4 辞退 → declined

別案件を作成して:

```js
const d = window.TasuBuilderBenchBridge.createAdminCalendarProject({ /* ... */ skipNotification: true });
window.TasuBuilderBenchBridge.declineCalendarAssignment(d.project_id);
```

SQL: `assignment->>'status' = 'declined'`

### 4.5 hydrate 後も残る

1. `builder/project-calendar.html` をリロード（`hydrateFromSupabase`）
2. Console:

```js
const id = "<hub_project_id>";
await window.TasuBuilderProjectStore.hydrateFromSupabase();
window.TasuBuilderProjectStore.getProject(id)?.assignment;
```

期待: DB と同じ `status`

### 4.6 local + MVP fallback 維持

1. DevTools → Application → 一時的にオフライン、または Staging からログアウト
2. 案件作成・受諾が **成功**すること（`ok: true`）
3. MVP `assignment_status` / local `assignment` が更新されること
4. Console Error が増えないこと

### 4.7 回帰テスト

```bash
node scripts/test-builder-calendar-cal-main-13-assignment-adapter.mjs
node scripts/test-builder-calendar-cal-main-10-assignment-dual-write.mjs
node scripts/test-builder-calendar-cal-main-11-hub-primary.mjs
```

期待: すべて PASS · Console Error 0（列の有無に依存しないモック/ローカル経路）

---

## 5. partner RPC 設計案（実装しない）

### 5.1 目的

Partner が **自分に割当られた案件**の `assignment.status` だけを `accepted` / `declined` に更新できるようにする。  
現行 RLS（owner-only UPDATE）では partner は DB に書けない。

### 5.2 RPC 名

`public.builder_set_assignment_status`

### 5.3 引数

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `p_project_id` | `uuid` | `builder_projects.id`（Hub ID） |
| `p_status` | `text` | `'accepted'` または `'declined'` のみ |
| `p_partner_id` | `text` default null | レガシー partner ID（デモ互換）。Auth 紐付け後は省略可 |

戻り値: `jsonb`  
例: `{ "ok": true, "assignment": { ... } }` / `{ "ok": false, "error": "forbidden" }`

### 5.4 更新許可条件（すべて満たす）

1. `auth.uid()` が非 null（authenticated）
2. 対象行が存在する
3. 現在の `assignment->>'status'` が `pending`（再受諾・二重辞退を拒否）
4. 呼び出し元が割当 partner である:
   - `assignment->>'partner_user_id' = auth.uid()::text` **または**
   - `assignment->>'partner_id' = p_partner_id` **かつ** `p_partner_id` が caller の許可リストに含まれる（マッピング表）
5. `p_status in ('accepted','declined')` のみ（`pending` への戻しは owner 経路）

### 5.5 `partner_user_id` と legacy `partner_id`

| フィールド | 役割 |
| --- | --- |
| `partner_id` | MVP/デモ互換 text（`demo-partner-001`）。表示・map 用 |
| `partner_user_id` | Supabase Auth UUID。**RLS/RPC の正** |

移行:

1. 運営作成時は当面 `partner_id` のみ（現状どおり）
2. partner が初回ログインしたとき、profiles / `builder_partner_links` で `partner_id ↔ user_id` を登録
3. RPC は **まず `partner_user_id` 一致**を試し、無ければリンク表経由で `partner_id` を検証

推奨リンク表（将来・本チケットでは作らない）:

```text
builder_partner_identities (
  partner_id text primary key,
  user_id uuid unique references auth.users,
  ...
)
```

### 5.6 SECURITY DEFINER

**使用する。**

- 理由: jsonb の部分更新と partner 検証を一箇所に閉じる。行全体 UPDATE policy を partner に開けると他カラム改ざんリスクがある
- 関数 owner: `postgres` / supabase admin
- `search_path = public` 固定
- `grant execute to authenticated` のみ（anon 不可）

### 5.7 擬似 SQL（ドラフト · 適用禁止）

```sql
-- DRAFT — do not apply in CAL-MAIN-14
create or replace function public.builder_set_assignment_status(
  p_project_id uuid,
  p_status text,
  p_partner_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_row public.builder_projects%rowtype;
  v_assignment jsonb;
  v_now timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_status not in ('accepted', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  select * into v_row from public.builder_projects where id = p_project_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_assignment := coalesce(v_row.assignment, '{}'::jsonb);
  if coalesce(v_assignment->>'status', '') <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  -- partner authorization (partner_user_id first, then partner_id match)
  if coalesce(v_assignment->>'partner_user_id', '') <> v_uid
     and not (
       p_partner_id is not null
       and coalesce(v_assignment->>'partner_id', '') = p_partner_id
       -- TODO: and exists (select 1 from builder_partner_identities i
       --        where i.partner_id = p_partner_id and i.user_id = auth.uid())
     )
  then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_assignment := v_assignment
    || jsonb_build_object(
         'status', p_status,
         'updated_at', v_now,
         'source', 'partner_rpc'
       );
  if p_status = 'accepted' then
    v_assignment := v_assignment || jsonb_build_object('accepted_at', v_now);
  else
    v_assignment := v_assignment || jsonb_build_object('declined_at', v_now);
  end if;

  update public.builder_projects
  set assignment = v_assignment, updated_at = v_now
  where id = p_project_id;

  return jsonb_build_object('ok', true, 'assignment', v_assignment);
end;
$$;

revoke all on function public.builder_set_assignment_status(uuid, text, text) from public;
grant execute on function public.builder_set_assignment_status(uuid, text, text) to authenticated;
```

### 5.8 監査ログ

| 方針 | 内容 |
| --- | --- |
| **最小** | `assignment.source = 'partner_rpc'` · `updated_at` / `accepted_at` / `declined_at` |
| **推奨（後続）** | `builder_assignment_events` テーブル（project_id, actor_uid, from_status, to_status, at） |
| CAL-MAIN-14 | テーブルは作らない。RPC 実装時に最小フィールドで足りる |

### 5.9 RLS policy 追加要否

| Policy | 要否 | 内容 |
| --- | --- | --- |
| Partner 行 UPDATE（全カラム） | **不要**（RPC で代替） | 改ざん面が広い |
| Partner SELECT を割当のみに制限 | **Production 前に必須** | 下記 §6 |
| RPC EXECUTE | **必須**（RPC 実装時） | authenticated のみ |
| Owner UPDATE | 維持 | 運営が pending を書く |

クライアント変更（RPC 実装後）:

- `writeAssignment` が partner セッションのとき RPC を呼ぶ
- owner セッションは現行の `update({ assignment })` のままで可

---

## 6. Production 前 RLS 方針

### 6.1 anon SELECT

| 許可 | 禁止 |
| --- | --- |
| `visibility = 'public'` の案件のみ | `partner_only` / `private` / `team_only` |
| | assignment 付き運営案件の anon 露出 |

現行 Staging policy（`builder_projects_select_anon`）は概ねこの方針。**運営作成は `partner_only` を維持**すること。

### 6.2 partner_only SELECT（要締め）

現行 authenticated policy は:

```text
visibility in ('partner_only', 'team_only')  — 割当不問で広い
```

**Production 前の必須変更案:**

```text
partner_only は以下のいずれかのみ SELECT 可:
  - owner_id = auth.uid()
  - assignment->>'partner_user_id' = auth.uid()::text
  - assignment->>'partner_id' が caller の partner_id（リンク表経由）
```

### 6.3 owner / admin / service_role

| ロール | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| owner（auth） | 自案件 + 許可された visibility | 自案件 | 自案件（行全体） | 自案件（論理削除推奨） |
| partner（auth） | 割当案件のみ | 不可 | **RPC 経由のみ status** | 不可 |
| admin | 運用ポリシー次第（別 claim） | 運用 | 運用 | 運用 |
| service_role | 全件 | 全件 | 全件 | 全件（Edge / backfill） |

### 6.4 public と非公開の分離

| visibility | 用途 |
| --- | --- |
| `public` | 公開掲示板系（anon 可） |
| `partner_only` | 運営手配案件（デフォルト推奨） |
| `private` / `team_only` | 将来の社内・チーム |

Hub-primary 作成（CAL-MAIN-11）はクライアント上 `visibility: partner_only`（MVP ミラー）。Write Adapter の `toDdlRow` が visibility を送っていない場合は **INSERT 時 default / 明示追加を CAL-MAIN-15 前に確認**。

### 6.5 Production 投入前の必須条件（チェックリスト）

- [ ] Staging で assignment 列・受諾/辞退 DB 反映を確認済み
- [ ] partner RPC + identity マッピングの実装とテスト済み
- [ ] authenticated SELECT が割当 partner に限定されている
- [ ] anon が partner_only を読めないことを確認
- [ ] 運営作成行の visibility が public になっていない
- [ ] Production への DDL は **手動・レビュー付き**（MCP / 自動 push 禁止）
- [ ] ロールバック手順が文書化されている
- [ ] CAL-MAIN-10〜13 回帰 PASS

---

## 7. CAL-MAIN-15（完了）

**MVP 通知縮小（calendar_assignment 系）** — Talk 成功時に MVP ベルを no-op。

- `notifyCalendarAssignment` / `notifyCalendarAccepted` / `notifyCalendarDeclined`
- Talk 不可時は MVP ベル fallback
- テスト: `scripts/test-builder-calendar-cal-main-15-mvp-bell-shrink.mjs`

**CAL-MAIN-16（2026-07-04）:** ✅ **Go**（P5-5 Auth · owner_id 揃え後）

**CAL-MAIN-17（2026-07-04）:** ✅ MVP `assignment_status` 条件付き停止

- Flag: `TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK`（default `true`）
- DB write 成功 + hydrate `source=supabase` で status 一致 → MVP `assignment_status` no-op
- 失敗時は従来どおり MVP write · Hub local は常に維持
- 回帰: `node scripts/test-builder-calendar-cal-main-17-mvp-assignment-status-stop.mjs`

**CAL-MAIN-18〜19（2026-07-04）:** ✅ Hub Read 優先 · **Hub Primary 完了（Go）**

- 完了レポート: [builder-calendar-hub-primary-completion.md](./builder-calendar-hub-primary-completion.md)
- 監査: `node scripts/test-builder-calendar-cal-main-19-hub-primary-close.mjs`

### CAL-MAIN-16 検証（P5-5 Auth）

| 項目 | 値 |
| --- | --- |
| Auth ユーザー | P5-5 `e2e-test@example.com` |
| UID | `bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40` |
| 対象行 | `a0000000-0000-0000-0000-000000000001` |
| 意味 | Builder Admin の `role=owner` **ではない**。Supabase Auth セッション（`auth.uid()`） |

**人間が先に Staging SQL Editor で実行:**

`supabase/manual/staging_builder_projects_assignment_owner_align.sql`

```sql
update public.builder_projects
set owner_id = 'bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40'
where id = 'a0000000-0000-0000-0000-000000000001';
```

**その後（ヘッドレスが signInWithPassword する · 手動 login.html 不要）:**

```bash
node scripts/verify-builder-assignment-jsonb-staging.mjs
node scripts/verify-builder-assignment-db-roundtrip.mjs
```

スクリプトは P5-5 と同じパスワードで `signInWithPassword` → 対象行へ pending / accepted / declined を書き、hydrate で DB 優先を確認する。

Go 条件: `columnOk` · `authOk` · `ownerAligned` · `pendingOk` · `acceptedOk` · `declinedOk` · `hydrateOk` · `fallbackOk`

---

## 8. 参照

- `builder/builder-project-write-adapter.js`（`writeAssignment` · `detectAssignmentColumn`）
- `builder/builder-project-calendar-supabase.js`（`mapRowToProject`）
- `supabase/migrations/20260718000000_builder_calendar_rls.sql`（現行 RLS）
