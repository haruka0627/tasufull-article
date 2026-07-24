# Builder 一般案件 — Production 凍結メモ（2026年10月リリース）

**最終更新:** 2026-07-05  
**方針変更日:** 2026-07-05  
**対象:** Builder General Jobs（一般案件 · dual-write · board 系）

---

## 1. 方針（正本）

| 項目 | 判定 |
| --- | --- |
| **Staging 開発・検証** | **継続可** — Critical / Security / spec 追従のみ（既存 P0〜P3 契約維持） |
| **Production SQL（RL-05）** | **実行禁止** — **2026年10月リリース直前まで保留** |
| **Cloudflare Production deploy（RL-04）** | **実行禁止** — **2026年10月リリース直前まで保留** |
| **Builder Production Ready（商用本番）** | **No-Go** — **10月リリース予定のため、本番適用は保留** |

**理由（No-Go 明記）:** 一般案件の商用本番投入は **2026年10月リリース** に合わせる。それまで Production Dashboard SQL 適用・Cloudflare Production へのフラグ付き deploy は行わない。

---

## 2. 凍結範囲（禁止）

| # | 作業 | 禁止理由 |
| --- | --- | --- |
| F1 | Production `ddojquacsyqesrjhcvmn` への SQL 適用（`supabase/manual/production_*`） | 10月リリース直前まで保留 |
| F2 | Supabase MCP による Production 操作 | 常時禁止（変更なし） |
| F3 | Cloudflare **Production** 環境への `TASU_BUILDER_*` 有効化 deploy | 10月リリース直前まで保留 |
| F4 | `tasful.jp` での本番 JWT / RLS 実地検証（Phase 3） | F1・F2 完了前は意味がないため保留 |
| F5 | demo-partner seed の Production 投入 | 常時禁止（変更なし） |

---

## 3. 継続可（Staging · コード）

| # | 作業 | 備考 |
| --- | --- | --- |
| S1 | Staging `ahlxuyvhzqdqaojiywmu` での検証 | `launch-smoke` · RL-02 等 |
| S2 | Production 専用 SQL の**レビュー・差分更新**（ファイル編集のみ） | Dashboard **実行はしない** |
| S3 | `TASU_BUILDER_*` ビルド注入コードの保守 | Phase 2 実装済み · deploy は10月まで保留 |
| S4 | Critical / Security / spec 追従のコード修正 | Builder v1.0 FROZEN 方針に従う |
| S5 | ローカル 8788 · Preview ビルド検証 | Production Supabase URL 接続はビルドガードで拒否 |

---

## 4. ステータス正本

| ゲート | 判定 | 備考 |
| --- | --- | --- |
| Release Launch（コード・Staging） | **Go** | RL-01〜10 · Launch Smoke 10/10 |
| Production SQL 準備（ファイル） | **Go** | `supabase/manual/production_*` 作成済み |
| RL-04 フラグコード | **Go** | 実装済み · deploy 未了 |
| **Builder Production Ready** | **No-Go** | **10月リリース予定のため、本番適用は保留** |

---

## 5. 10月リリース時の参照

実行手順・チェックリストは次を正本とする（**10月直前に実施**）:

| ドキュメント | 内容 |
| --- | --- |
| [builder-general-jobs-october-release-checklist.md](../reports/builder-general-jobs-october-release-checklist.md) | 10月リリース用チェックリスト · 実行順 |
| [builder-general-jobs-production-migration-runbook.md](./builder-general-jobs-production-migration-runbook.md) | RL-05 Production SQL 手順 |
| [builder-general-jobs-production-flags.md](./builder-general-jobs-production-flags.md) | RL-04 Cloudflare フラグ手順 |
| [builder-general-jobs-jwt-actor.md](./builder-general-jobs-jwt-actor.md) | RL-03 JWT 実地 |
| [builder-general-jobs-production-ready-final.md](../reports/builder-general-jobs-production-ready-final.md) | 総合チェックリスト |

---

## 6. 解除条件（Production Ready Go へ）

以下を **10月リリースウィンドウ内** ですべて満たしたときのみ Go:

1. Product / DB / DevOps の **Production Go 承認**（10月リリースチケット）
2. RL-05 Production SQL 適用完了（専用 SQL · demo seed なし）
3. RL-04 Production deploy 完了（`TASU_BUILDER_*` + Production Supabase）
4. RL-03 `tasful.jp` JWT / RLS 実地 PASS
5. `launch-smoke` 10/10 · 手動フロー記録
6. `docs/PROJECT_STATUS.md` · `docs/TODO.md` 正本更新

---

## 7. 関連

- `reports/builder-general-jobs-release-launch.md` — Release Launch 証跡
- `reports/builder-general-jobs-ops-guide.md` — Staging 運用
- `docs/supabase-environments.md` — Staging / Production 分離

---

*本ドキュメントが Builder 一般案件の Production 凍結正本。10月リリース直前まで F1・F3 は人間作業でも実行しないこと。*
