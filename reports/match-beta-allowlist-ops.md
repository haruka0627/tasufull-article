# TASFUL MATCH — β Allowlist 運用 SQL

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 対象 ref | `ddojquacsyqesrjhcvmn`（linked） |
| テーブル | `public.match_beta_allowlist` |
| 判定 RPC | `public.match_is_beta_allowed()` |

---

## 1. ステータス

| status | 意味 | Edge ゲート |
|--------|------|-------------|
| `invited` | 招待済み（未アクティベート可） | **許可** |
| `active` | 利用中 | **許可** |
| `revoked` | 停止 | **拒否 (403)** |

---

## 2. β参加者を追加（invite）

```sql
-- add beta user (invited)
insert into public.match_beta_allowlist (
  talk_user_id,
  email,
  status,
  invited_at
)
values (
  'member_id_here',           -- JWT app_metadata.talk_user_id
  'user@example.com',
  'invited',
  timezone('utc', now())
)
on conflict (talk_user_id) do update
set
  email = excluded.email,
  status = 'invited',
  invited_at = timezone('utc', now()),
  updated_at = timezone('utc', now());
```

---

## 3. 参加を有効化（active）

```sql
-- activate beta user
update public.match_beta_allowlist
set
  status = 'active',
  accepted_at = timezone('utc', now()),
  updated_at = timezone('utc', now())
where talk_user_id = 'member_id_here';
```

---

## 4. 参加を停止（revoke）

```sql
-- revoke beta user
update public.match_beta_allowlist
set
  status = 'revoked',
  updated_at = timezone('utc', now())
where talk_user_id = 'member_id_here';
```

---

## 5. 再開（revoked → active）

```sql
-- reactivate beta user
update public.match_beta_allowlist
set
  status = 'active',
  accepted_at = coalesce(accepted_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
where talk_user_id = 'member_id_here';
```

---

## 6. 一覧確認

```sql
select
  talk_user_id,
  email,
  status,
  invited_at,
  accepted_at,
  updated_at
from public.match_beta_allowlist
order by created_at desc;
```

---

## 7. 許可判定の手動確認（JWT コンテキスト）

サービスロールでは `match_current_user_id()` が NULL のため、Edge 経由または impersonation で確認する。

```sql
-- service_role: talk_user_id 直参照
select exists (
  select 1
  from public.match_beta_allowlist b
  where b.talk_user_id = 't1'
    and b.status in ('invited', 'active')
) as allowed;
```

---

## 8. シード（E2E テスト用 · migration 同梱）

migration `20260627100000_match_beta_allowlist.sql` で **t1, t2, t4, t5 = active**。**t3 は意図的に未登録**（ゲート検証用）。

---

## 9. ゲート無効化（緊急・ローカルのみ）

Edge Function 環境変数:

```text
MATCH_BETA_GATE_DISABLED=1
```

**本番では使用しないこと。** stub token (`stub-match-token`) もローカルデモ用にスキップされる。

---

## 10. 運用メモ

- 直接の authenticated RLS は **deny all**。運用は Dashboard SQL / service_role / 将来の管理 UI。
- 招待コード UI（P3 β1）は未実装。現フェーズは **手動 allowlist 追加**。
- 停止は `revoked` を推奨（行削除より監査しやすい）。
