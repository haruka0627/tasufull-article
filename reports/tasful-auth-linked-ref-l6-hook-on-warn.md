# TASFUL — Auth Hook linked ref L6 Dashboard Hook ON + WARN 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l5-hook-create-off.md` · L5 判定 `READY_FOR_LINKED_REF_L6_HOOK_ON_WARN` |
| Dashboard Auth Hook | **ON**（Custom Access Token · `public.custom_access_token_hook`） |
| 監視モード | **WARN**（missing `talk_user_id` は token 発行継続 · T2 で確認） |

---

## 1. 実施サマリ

| # | L6 完了条件 | 結果 |
|---|-------------|------|
| 1 | 事前: PITR / backup 状態記録 | **PASS**（§2） |
| 2 | 事前: L1 baseline 存在 | **PASS** |
| 3 | 事前: L5 rollback SQL 存在 | **PASS** |
| 4 | 事前: Hook OFF 最終確認 | **PASS**（§4） |
| 5 | Dashboard Hook ON | **PASS**（§5） |
| 6 | T1 login / refresh JWT | **PASS**（§6） |
| 7 | TasuAuthCurrentUser 一致 | **PASS**（§7） |
| 8 | T2 login（WARN 経路） | **PASS**（§8） |
| 9 | DB / metadata 不変 | **PASS**（§9） |
| 10 | エラー監視 · API smoke | **PASS**（§10） |

**実行**

```bash
node scripts/verify-auth-hook-l6-hook-on-warn.mjs
```

**自動検証:** `L6 result: PASS (15 checks)` · 判定 **`READY_FOR_LINKED_REF_L7_BACKFILL_EXPAND`**

---

## 2. 事前必須 — PITR / backup 状態

**取得:** `npx supabase backups list --project-ref ddojquacsyqesrjhcvmn -o json`

| 項目 | 値 |
|------|-----|
| `pitr_enabled` | **`false`** |
| `walg_enabled` | **`true`** |
| `backups` 件数 | **0**（CLI 一覧 · 実施時点） |
| `region` | `ap-northeast-1` |

**所見**

- PITR は **未有効**。L1 §7 チェックリストどおり、完全 DB 巻き戻しは Dashboard PITR 非依存。
- **論理 baseline**（L1 §3 metadata スナップショット）+ L5 **hook DROP rollback** が主要復旧手段。
- L6 実施前に L1/L5 成果物の存在を script で確認済み。

---

## 3. 事前必須 — L1 baseline · L5 rollback

| 確認 | 結果 |
|------|------|
| `reports/tasful-auth-linked-ref-l1-backup-baseline.md` | **存在** · スナップショット ID `L1-BASELINE-2026-06-21` |
| `reports/tasful-auth-linked-ref-l5-hook-create-off.md` §9 rollback | **`DROP FUNCTION public.custom_access_token_hook(jsonb)` 記載あり** |

---

## 4. 事前必須 — Hook OFF 最終確認

**方法:** Hook ON **前**の T1 password grant · JWT decode（token 非掲載）

| 信号 | Hook OFF 時 | 実測（pre-enable） |
|------|-------------|-------------------|
| `app_metadata.platform_role` | **無** | **無** |
| `app_metadata.role`（app_metadata 内） | **無** | **無** |
| `app_metadata.is_ops` | **無** | **無** |
| `talk_user_id` / `member_id` | `t1` / `t1` | **一致** |
| `provider` / `providers` | 維持 | **維持** |

**判定:** Hook **OFF** 状態を確認してから ON 操作へ進行。

---

## 5. Dashboard Hook ON 操作

### 5.1 実施内容

| 項目 | 値 |
|------|-----|
| 操作 | Supabase Dashboard 相当 · **`npx supabase config push --project-ref ddojquacsyqesrjhcvmn --yes`** |
| Hook 種別 | **Custom Access Token** |
| 関数 | **`public.custom_access_token_hook`** |
| URI | **`pg-functions://postgres/public/custom_access_token_hook`** |
| 設定源 | `supabase/config.toml` `[auth.hook.custom_access_token]` |
| 他 Auth 設定 | **変更なし**（hook ブロックのみ push） |

### 5.2 確認メモ（Dashboard 相当）

```
Authentication > Hooks > Custom Access Token
  Status: ENABLED
  Type: Postgres function
  Function: public.custom_access_token_hook
  URI: pg-functions://postgres/public/custom_access_token_hook
```

**注:** CLI `config push` は Dashboard **Authentication → Hooks** と同一 Auth 設定 API 経路。本セッションではブラウザスクショ未取得 · 上記メモ + Hook ON 後 JWT 信号で実効確認。

### 5.3 Hook ON 信号（post-enable · T1 JWT）

Hook 関数 merge フィールドが **JWT に載る**ことを ON 確認に使用:

| claim | 値 |
|-------|-----|
| `app_metadata.role` | `authenticated` |
| `app_metadata.platform_role` | `member` |
| `app_metadata.is_ops` | `false` |

（Hook OFF 時は上記 3 キーは **app_metadata に無**）

---

## 6. T1 login / refresh JWT（Hook ON）

### 6.1 Login

| 項目 | 値 |
|------|-----|
| HTTP | **200** |
| `app_metadata.talk_user_id` | **`t1`** |
| `app_metadata.member_id` | **`t1`** |
| `app_metadata.provider` | `email` |
| `app_metadata.providers` | `["email"]` |
| hook merge | `role` · `platform_role` · `is_ops` 追加（§5.3） |

### 6.2 Refresh

| 項目 | 値 |
|------|-----|
| HTTP | **200** |
| login との app_metadata | **完全一致** |

---

## 7. TasuAuthCurrentUser · auth.jwt() 一致

| 系統 | 結果 |
|------|------|
| RPC `talk_current_user_id` | **`t1`**（login / refresh 両方） |
| `talkUserId` | **`t1`** |
| `memberId` | **`t1`** |
| `authUserId` | `2d537fc9-ee67-4da8-97d3-bafe824ba466` |
| `source` | **`jwt`** |

**判定:** **PASS**（L4/L5 と同型 · hook merge フィールド追加のみ）

---

## 8. T2 login（WARN 経路 · 実施）

**実施理由:** allowlist T2 は legacy demo ではなく、missing `talk_user_id` の **WARN 継続発行**を L6 で確認する最小追加テスト。

| 項目 | 結果 |
|------|------|
| HTTP | **200**（ログイン失敗なし） |
| `app_metadata.talk_user_id` | **null** |
| `app_metadata.member_id` | **null** |
| `provider` / `providers` | **維持** |
| hook merge フィールド | **無**（DB missing → event 不変 · L5 関数仕様どおり） |

**WARN 監視:** 本 hook 実装は missing 時 **例外なし** · token 発行継続。Dashboard Auth ログの hook error **なし**（login 200 で間接確認）。

---

## 9. DB 不変確認

| 確認 | 結果 |
|------|------|
| `custom_access_token_hook` 関数 | **1 件**（L5 CREATE · **関数本体未変更**） |
| T1 DB `talk_user_id` / `member_id` | **`t1` / `t1`** |
| T2–T5 talk/member | **NULL** |
| 既存 7 件 `@tasful-dev.test` | **7 件** · L1 baseline **diff なし**（READ） |
| `match_*` テーブル | **0** |
| metadata UPDATE | **なし** |

**SQL:** `sql/auth-hook-l6-verify-readonly.sql` · gates: `sql/auth-hook-l6-verify-gates.sql`

---

## 10. エラー監視 · API smoke

| 監視 | 結果 |
|------|------|
| T1/T2 Auth login | **200** · レスポンスに hook error **無** |
| `GET /auth/v1/health` | **200** |
| `GET /rest/v1/`（anon） | **401**（gateway 正常 · 5xx 無） |
| 異常時 rollback 方針 | Dashboard Hook **即 OFF**（§11） |

**本セッション:** 異常 **無** · rollback **未実施**。

---

## 11. Rollback 手順

### 11.1 第一選択 — Dashboard Hook OFF

1. Dashboard → **Authentication → Hooks → Custom Access Token → OFF**  
   または `supabase/config.toml` で `enabled = false` に変更後:

```bash
npx supabase config push --project-ref ddojquacsyqesrjhcvmn --yes
```

2. T1 login で §4 の Hook OFF 信号（`platform_role` 等 **無**）に戻ることを確認。

### 11.2 第二選択 — 関数 DROP（L5 rollback · 通常は L6 では不要）

```sql
revoke all on function public.custom_access_token_hook(jsonb) from supabase_auth_admin;
drop function if exists public.custom_access_token_hook(jsonb);
```

---

## 12. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| 既存 7 / T1–T5 metadata 変更 | ✓ |
| Hook 関数追加修正 | ✓ |
| T2–T5 backfill | ✓ |
| legacy demo JWT 刷新テスト | ✓（READ のみ · login 未実施） |
| RLS / MATCH / UI 変更 | ✓ |

---

## 13. 成果物

| ファイル | 用途 |
|----------|------|
| `supabase/config.toml` | Hook ON 設定（`[auth.hook.custom_access_token]`） |
| `scripts/verify-auth-hook-l6-hook-on-warn.mjs` | L6 自動検証（事前確認 · enable · post-check） |
| `sql/auth-hook-l6-verify-readonly.sql` | READ 監査 |
| `sql/auth-hook-l6-verify-gates.sql` | CLI gates（単一 result set） |

---

## 14. 判定

| 判定 | 理由 |
|------|------|
| **`READY_FOR_LINKED_REF_L7_BACKFILL_EXPAND`** | Hook ON · T1 JWT/refresh/TasuAuth 正常 · T2 WARN 継続 · metadata/MATCH/RLS 不変 · smoke PASS |

---

## 15. 次ステップ（L7）

| 順 | 作業 |
|----|------|
| 1 | T2–T5 計画どおり **backfill 拡張**（T1 以外 · 1 件ずつ） |
| 2 | 各 backfill 後 login/refresh JWT 確認 |
| 3 | Hook ON 維持 · WARN 監視継続 |
| 4 | legacy 7 件は引き続き **非接触** |
