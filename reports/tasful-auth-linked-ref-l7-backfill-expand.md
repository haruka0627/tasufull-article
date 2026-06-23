# TASFUL — Auth Hook linked ref L7 backfill expand 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l6-hook-on-warn.md` · L6 判定 `READY_FOR_LINKED_REF_L7_BACKFILL_EXPAND` |
| Hook | **ON**（Dashboard 変更なし · L6 設定維持） |
| 方式 | Admin API `PUT /auth/v1/admin/users/{id}` · **app_metadata merge のみ** · **T2→T3→T4→T5 段階** |

---

## 1. 実施サマリ

| # | L7 完了条件 | 結果 |
|---|-------------|------|
| 1 | T2 backfill + gate | **PASS**（§3） |
| 2 | T3 backfill + gate | **PASS**（§4） |
| 3 | T4 backfill + gate | **PASS**（§5） |
| 4 | T5 backfill + gate | **PASS**（§6） |
| 5 | 全 slot JWT / TasuAuth | **PASS**（§7） |
| 6 | 既存 7 件 / MATCH / Hook 関数 | **PASS**（§8） |
| 7 | 異常 · rollback 実施 | **なし** |

**実行**

```bash
node scripts/backfill-auth-hook-l7-allowlist-expand.mjs --from T2
node scripts/verify-auth-hook-l7-backfill-expand.mjs --through T5
```

**自動検証:** `L7 backfill: PASS (8 gate steps)` · `L7 verify: PASS (5 checks)`

**判定:** **`READY_FOR_LINKED_REF_L8_EDGE_PREP`**

---

## 2. ロールバック前提（PITR 無 · 変更なし）

| 項目 | 状態 |
|------|------|
| PITR | **無効**（L6 記録どおり） |
| 第一 rollback | Dashboard **Hook OFF**（L6 §11） |
| 論理復旧 | **L1 baseline**（既存 7 件） |
| 関数 rollback | L5 **`DROP FUNCTION public.custom_access_token_hook(jsonb)`** |

**本セッション:** 異常 **無** · Hook OFF rollback **未実施**

---

## 3. Slot T2 — `t2@tasful.invalid`

| 項目 | 値 |
|------|-----|
| auth_user_id | `d9f57cfa-61f9-4426-ad6a-78ebbd1b7723` |
| merge | `talk_user_id=t2` · `member_id=t2` |
| provider / providers | **維持**（`email` / `["email"]`） |
| user_metadata | **不変**（`email_verified` のみ） |

### 3.1 Gate 結果

| チェック | 結果 |
|----------|------|
| Admin merge | **PASS** |
| SQL gates（through=T2） | **PASS** |
| login / refresh HTTP | **200** |
| JWT talk/member | **`t2` / `t2`** |
| Hook merge claims | `role=authenticated` · `platform_role=member` · `is_ops=false` |
| TasuAuthCurrentUser | `talk=t2` · `member=t2` · `source=jwt` |

**注:** 初回実行時 SQL gates クエリ修正前に merge 済 · 修正後 `--from T2` で post-gate **PASS**。

---

## 4. Slot T3 — `t3@tasful.invalid`

| 項目 | 値 |
|------|-----|
| auth_user_id | `fbd8fdf3-d789-43eb-be9b-3a03b2df90d3` |
| merge | `talk_user_id=t3` · `member_id=t3` |

### 4.1 Gate 結果

| チェック | 結果 |
|----------|------|
| Admin merge | **PASS** |
| SQL gates（through=T3） | **PASS** · T2 維持 · T4/T5 NULL |
| login / refresh | **PASS** |
| TasuAuthCurrentUser | `talk=t3` · `member=t3` · `source=jwt` |

---

## 5. Slot T4 — `t4@tasful.invalid`

| 項目 | 値 |
|------|-----|
| auth_user_id | `6b13b77f-1de1-47f1-97cd-3c401ce81c0c` |
| merge | `talk_user_id=t4` · `member_id=t4` |

### 5.1 Gate 結果

| チェック | 結果 |
|----------|------|
| Admin merge | **PASS** |
| SQL gates（through=T4） | **PASS** |
| login / refresh | **PASS** |
| TasuAuthCurrentUser | `talk=t4` · `member=t4` · `source=jwt` |

---

## 6. Slot T5 — `t5@tasful.invalid`

| 項目 | 値 |
|------|-----|
| auth_user_id | `147ebffb-6504-4df5-ac31-072e1c6531b4` |
| merge | `talk_user_id=t5` · `member_id=t5` |

**注:** L2 計画上の slot 名 `missing_talk_user_id` は **L7 で意図的に backfill**（Hook ON 下の expand 検証）。

### 6.1 Gate 結果

| チェック | 結果 |
|----------|------|
| Admin merge | **PASS** |
| SQL gates（through=T5） | **PASS** |
| login / refresh | **PASS** |
| TasuAuthCurrentUser | `talk=t5` · `member=t5` · `source=jwt` |

---

## 7. 最終 JWT / TasuAuth（Hook ON · token 非掲載）

| Slot | login | refresh | talkUserId | memberId | source | hook merge |
|------|-------|---------|------------|----------|--------|------------|
| T2 | 200 | 200 | `t2` | `t2` | `jwt` | ✓ |
| T3 | 200 | 200 | `t3` | `t3` | `jwt` | ✓ |
| T4 | 200 | 200 | `t4` | `t4` | `jwt` | ✓ |
| T5 | 200 | 200 | `t5` | `t5` | `jwt` | ✓ |

**T1:** L3 済 · **本 L7 では再 backfill なし** · DB `t1/t1` 維持。

---

## 8. DB 最終状態

| 確認 | 結果 |
|------|------|
| T1–T5 talk/member | **`t1`–`t5` 各 slot ID と一致** |
| allowlist user_metadata talk keys | **0** |
| provider drift | **0** |
| 既存 7 件 `@tasful-dev.test` | **7 件** · L1 baseline **diff なし** |
| `custom_access_token_hook` | **1 件**（**未変更**） |
| `match_*` | **0** |
| Dashboard / RLS / UI | **変更なし** |

### 8.1 Allowlist app_metadata（最終 · READ）

| email | talk_user_id | member_id |
|-------|--------------|-----------|
| t1@tasful.invalid | `t1` | `t1` |
| t2@tasful.invalid | `t2` | `t2` |
| t3@tasful.invalid | `t3` | `t3` |
| t4@tasful.invalid | `t4` | `t4` |
| t5@tasful.invalid | `t5` | `t5` |

---

## 9. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| 既存 7 metadata 変更 | ✓ |
| user_metadata 変更 | ✓ |
| Hook 関数変更 | ✓ |
| Dashboard 追加変更 | ✓ |
| RLS / MATCH / UI | ✓ |
| legacy demo JWT 刷新 | ✓ |

---

## 10. 成果物

| ファイル | 用途 |
|----------|------|
| `scripts/backfill-auth-hook-l7-allowlist-expand.mjs` | 段階 backfill + slot gate |
| `scripts/verify-auth-hook-l7-backfill-expand.mjs` | DB/JWT 検証 |
| `scripts/lib/auth-hook-l7-slots.mjs` | slot 定義 · 期待状態 |
| `sql/auth-hook-l7-verify-readonly.sql` | READ 監査 |
| `sql/auth-hook-l7-verify-gates.sql` | CLI gates |

---

## 11. 判定

| 判定 | 理由 |
|------|------|
| **`READY_FOR_LINKED_REF_L8_EDGE_PREP`** | T2–T5 段階 backfill 完了 · 各 slot gate PASS · Hook ON 維持 · legacy/MATCH 不変 |

---

## 12. 次ステップ（L8）

| 順 | 作業 |
|----|------|
| 1 | Edge 署名 JWT smoke 準備（allowlist T1–T5 全 slot ID 利用可能） |
| 2 | Hook ON 維持 · WARN 監視継続 |
| 3 | legacy 7 件は引き続き **非接触** |
