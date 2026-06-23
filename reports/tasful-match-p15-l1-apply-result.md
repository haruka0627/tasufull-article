# TASFUL MATCH — P15-L1 linked ref 適用結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（linked ref） |
| 前提 | pre-gates **PASS**（[`tasful-match-p15-l1-pre-gates-result.md`](tasful-match-p15-l1-pre-gates-result.md)） |
| 判定 | **`PASS`**（schema + RLS 適用成功） |
| 本番 URL | **`tasful.jp` 確認は 8 月まで保留** |

---

## 1. 実行順序と結果

| 順 | ファイル | exit code | 結果 |
|----|----------|-----------|------|
| 1 | `supabase/migrations/20260622190000_match_p15_l1_schema.sql` | **0** | **PASS** |
| 2 | `supabase/migrations/20260622191000_match_p15_l1_rls.sql` | **0** | **PASS** |

**CLI:** Supabase CLI v2.101.0 · `npx supabase db query --linked --yes -f …`

schema が FAIL した場合 RLS は実行しない方針 — 本 run では schema **成功** のため RLS を続行。

RLS FAIL 時は rollback しない方針 — 本 run では RLS **成功**。

---

## 2. 適用内容サマリ

| 区分 | 内容 |
|------|------|
| 新規テーブル（P15 6） | `match_favorites` · `match_profile_views` · `match_saved_searches` · `match_user_settings` · `match_hobby_tags` · `match_profile_hobby_tags` |
| `match_profiles` ALTER | `purpose` · `relationship_view` · `weekend_style` · `completeness_cached`（**4 列**） |
| `last_active_at` | **ADD なし**（L10 既存列維持） |
| 関数 | 6（ban stub + activity/footprint/completeness/compatibility/prefecture） |
| VIEW | `match_profiles_public`（`activity_label` のみ · raw timestamp 非公開） |
| RLS | 新規 6 表 enable · **14 policies** |
| 既存 core | 8 表 · RLS 8 · **policies 20 不変** |
| auth.users / Hook | **未変更** |

---

## 3. FAIL 記録

**該当なし** — schema · RLS ともにエラーなし。

---

## 4. 適用後検証

post-gates 実行済み → [`tasful-match-p15-l1-post-gates-result.md`](tasful-match-p15-l1-post-gates-result.md)

```bash
npx supabase db query --linked --yes -f sql/match-p15-l1-post-gates.sql
```

**post-gates 判定:** **PASS**

---

## 5. Rollback 参照（未実施）

失敗時は適用せず停止。本 run は成功のため rollback **不要**。

| 順 | 操作 |
|----|------|
| 1 | `20260622191000_match_p15_l1_rls.sql` 末尾 ROLLBACK ブロック |
| 2 | `20260622190000_match_p15_l1_schema.sql` 末尾 ROLLBACK ブロック |

---

## 6. 次アクション

| 項目 | 状態 |
|------|------|
| P15-L1 DB 適用 | **完了** |
| Edge 実装（P15-L3） | **未着手**（今回スコープ外） |
| UI 実装（P15-L4/L5） | **未着手** |
| `tasful.jp` prod URL | **8 月まで保留** |
| 次フェーズ候補 | P15-L3 Edge functions 設計/実装 |

**判定:** **`READY_FOR_P15_L3_EDGE`**（DB/RLS 土台適用済み · Edge/UI は別承認）

---

## 7. 参照

| 文件 | 路径 |
|------|------|
| Schema migration | `supabase/migrations/20260622190000_match_p15_l1_schema.sql` |
| RLS migration | `supabase/migrations/20260622191000_match_p15_l1_rls.sql` |
| Post-gates SQL | `sql/match-p15-l1-post-gates.sql` |
| Pre-gates 結果 | `reports/tasful-match-p15-l1-pre-gates-result.md` |
