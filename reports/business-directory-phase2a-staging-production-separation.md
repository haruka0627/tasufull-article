# Business Directory Phase 2a — Staging / Production 分離調査

**日付:** 2026-07-01  
**種別:** 調査 · 方針整理 · **DB 変更なし**  
**状態:** **Phase 2a migration — STOP（ブロック中）**  
**Project ref（調査対象）:** `ddojquacsyqesrjhcvmn`  
**禁止（本調査）:** `supabase link` · `db push` · migration 適用 · remote SQL · Production 変更

---

## Executive summary

| 項目 | 結論 |
| --- | --- |
| **Supabase project ref の数** | リポジトリ内は **`ddojquacsyqesrjhcvmn` のみ**（別 Staging ref なし） |
| **`ddojquacsyqesrjhcvmn` の実態** | **本番運用 DB**（Pages · Edge · Auth · 既存 BD/TLV スキーマが接続済） |
| **ドキュメント上の「Staging」** | 多くは **別プロジェクトではなく** linked DB 上の検証フェーズを指す **用語のずれ** |
| **Phase 2a を「Staging apply」すると** | **実質 Production DB への DDL** になる |
| **Phase 2a migration** | **Option B 採用** — [Production controlled runbook](./business-directory-phase2a-production-controlled-migration.md) · apply **未実施** |
| **Staging 構築計画** | ✅ [tasful-supabase-staging-project-plan.md](./tasful-supabase-staging-project-plan.md) — Staging ref **`ahlxuyvhzqdqaojiywmu`** · [docs/supabase-environments.md](../docs/supabase-environments.md) |
| **推奨方向（履歴）** | Option A（別 Staging）または Option B — **Phase 2a は Option B で進行** |

---

## 1. 調査背景

Phase 2a 準備中に、Staging Project Ref を特定したところ **ref が 1 つのみ** であり、  
「Staging migration」ラベル付き作業（BD Step 1 等）も **同一 ref** に対して実施されていた。

この状態では:

- `supabase link` → 本番 DB
- `db push` / `db query -f` → 本番 DB
- `--remote` readiness script → 本番 DB（SELECT のみでも接続先は本番）

**Staging 専用 DB が存在しない限り、Phase 2a の安全なリハーサルは不可能。**

---

## 2. 根拠 — `ddojquacsyqesrjhcvmn` は何か

### 2.1 本番接続の証跡

| レイヤ | 接続先 | 根拠 |
| --- | --- | --- |
| **ブラウザ（静的 Pages）** | 同 ref | `chat-supabase-config.js` → `https://ddojquacsyqesrjhcvmn.supabase.co` |
| **Cloudflare Pages Production** | 同 ref | [business-directory-production-step4-production.md](./business-directory-production-step4-production.md) — `tasufull-article.pages.dev` deploy Go · smoke 48/48 |
| **Supabase Edge Functions** | 同 ref | `scripts/test-business-directory-production-step2-edge.mjs` · TLV · Secretary 等 |
| **ビルド注入** | 同 ref | `deploy/cloudflare/stage-cloudflare-pages.mjs` · `.env` `TASFUL_SUPABASE_URL` |
| **MCP / CLI link** | 同 ref | `.cursor/mcp.json` · `supabase/.temp/project-ref`（ローカル） |
| **Project 名** | `tasful-ai` | `docs/production-release-checklist.md` · TLV reports |

→ **クライアント · Edge · Pages がすべて同一 Supabase プロジェクトを正本としている = 本番 DB。**

### 2.2 「Staging」と書かれていた作業の実態

| レポート / doc | 表記 | 実際の ref |
| --- | --- | --- |
| BD Production Step 1 | 「staging migration apply」 | `ddojquacsyqesrjhcvmn` |
| TLV payment RLS staging test | 「staging linked · production 未適用」 | `ddojquacsyqesrjhcvmn` |
| TLV drift analysis | Runbook「未適用」と DB 実態矛盾 | 同一 linked DB に **既適用** |
| `docs/TLV_PAYMENT_ENGINE.md` | staging 適用済 · production 未適用 | **同一 ref 上の論理区分**（物理分離なし） |

**根因（既存分析）:** [tlv-payment-production-drift-analysis.md](./tlv-payment-production-drift-analysis.md) §2.1

> Staging 検証が **production link**（`ddojquacsyqesrjhcvmn`）上で実施され、ドキュメントの「staging / production 分離」仮定と乖離。

### 2.3 設計上の意図 vs 運用

| ソース | 意図 |
| --- | --- |
| `docs/supabase-migration-plan.md` §17.2 | 本番 DB は **リンク済み Staging とは別プロジェクト** |
| リポジトリ実装 | **別プロジェクト ref が未登録** · 全スクリプトが `ddojquacsyqesrjhcvmn` 固定 |
| `BD_PRODUCTION_PROJECT_REF` ガード | ✅ 有効 — manifest + [scripts/lib/supabase-env.mjs](../scripts/lib/supabase-env.mjs) · Staging `ahlxuyvhzqdqaojiywmu` |

**判定:** `ddojquacsyqesrjhcvmn` = **本番 DB（検証専用 DB ではない）**。  
「Staging」は **環境ラベルの誤用** または **本番前チェックリスト上のフェーズ名** に近い。

### 2.4 Business Directory の現状

| 項目 | 状態 |
| --- | --- |
| BD Phase 1–6 migration | **同一 ref に apply 済**（Step 1 証跡 · 2026-06-27） |
| BD Pages Production deploy | **Go**（Step 4 · 2026-06-27） |
| Commercial Launch（一般公開） | **No-Go**（`docs/business-directory-mvp-design.md`） |
| Phase 2a migration | **未 apply**（ADD COLUMN + view 更新） |
| Phase 2a Edge / UI | リポジトリ上は Phase 2 フィールド対応済 · **DB 列なし** |

→ Phase 2a apply は **本番 BD スキーマ変更**。Commercial Launch 前でも **運用 DB を直接変更** する。

---

## 3. Staging / Production 分離方針の整理

### 3.1 用語の正本（今後）

| 用語 | 定義（推奨） |
| --- | --- |
| **Production Supabase** | ユーザー / Pages / Edge が接続する DB · **`ddojquacsyqesrjhcvmn`（現状）** |
| **Staging Supabase** | Production と **別 project ref** · migration リハーサル · 破壊的テスト専用 |
| **Preview / branch** | Supabase Branching または Pages preview URL — DB は Staging または branch |
| **「linked DB」** | CLI `supabase link` 先 — **Staging か Production かを ref で明示**（現状は Production） |

### 3.2 現状アーキテクチャ（実態）

```text
Cloudflare Pages (Production: tasufull-article.pages.dev)
        │
        ├─► chat-supabase-config.js ──► ddojquacsyqesrjhcvmn (Auth + PostgREST)
        │
        └─► Edge Functions ────────────► ddojquacsyqesrjhcvmn/functions/v1

Supabase CLI link (local) ───────────► ddojquacsyqesrjhcvmn

別 Staging Supabase project ──────────► （リポジトリ未登録 · 未作成）
```

### 3.3 分離レベル（Cloudflare は分離 · Supabase は未分離）

| 層 | Staging / Production 分離 |
| --- | --- |
| **Cloudflare Pages** | Production branch + preview deploys **分離あり** |
| **Supabase** | **分離なし**（ref 1 つ） |
| **Stripe** | Test mode（BD MVP-3）— DB 分離とは独立 |

Pages preview を Staging URL にしても、**Supabase 接続先が同 ref なら DB 変更は本番に入る。**

---

## 4. 別 Staging Project は必要か

### 4.1 必要と判断する理由

1. **Phase 2a は DDL**（`ALTER TABLE` · view `CREATE OR REPLACE`）— ロールバックは手動
2. **既存 runbook**（Go/No-Go G1–G10）は **Staging E2E 後に Production** を前提
3. **TLV / BD 既存データ** が本番 DB に存在 — テスト migration の失敗が本番影響
4. **設計 doc**（`supabase-migration-plan.md`）が **別プロジェクト** を要求
5. **`BD_PRODUCTION_PROJECT_REF` ガード** が機能するには **2 ref 必須**

### 4.2 不要と言える条件（Option B 向け）

- Commercial Launch 前で **BD 利用者が限定的**（テストアカウントのみ）
- Phase 2a が **additive + idempotent**（`IF NOT EXISTS` · default 付き NOT NULL）
- **PITR / backup** · メンテナンス窓 · rollback runbook が運用可能
- 「Staging E2E」は **8788 mock + 本番 apply 前のコード review** で代替可

### 4.3 推奨

| 優先 | 判断 |
| --- | --- |
| **推奨** | **別 Staging Project を新規作成**（Option A）— Phase 2a 以降の全 migration 正本 |
| **次善** | 単一 DB を認め、Phase 2a を **Production migration** として正式手順化（Option B） |
| **非推奨** | 現ラベル「Staging apply」のまま **同一 ref に apply**（Option C — 実質本番変更の隠蔽） |

---

## 5. Phase 2a を安全に進める運用案

### Option A — 別 Staging Project 新規（推奨）

**概要:** Supabase で新 project（例: `tasful-staging`）を作成し、Phase 2a 以前の BD migration chain を Staging に再現 → Phase 2a リハーサル → Production は Staging Go 後。

| Step | 内容 | DB 触る？ |
| --- | --- | --- |
| A1 | Dashboard で Staging project 作成 · ref を `docs/` + `.env.staging.example` に **正本登録** | 新 project のみ |
| A2 | Staging に Auth seed（L7 slots 相当）· Edge deploy（staging secrets） | Staging |
| A3 | BD migration 1–6 + 2a を **Staging ref** に apply | Staging |
| A4 | `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn` · link Staging · `--remote` + E2E | Staging |
| A5 | Production Go 判定 · メンテナンス窓 · **Production ref** に 2a apply · Edge deploy | Production |

**メリット:** runbook / Go-No-Go と整合 · 本番無変更で E2E  
**デメリット:** 新 project コスト · seed / Edge / Stripe test 再設定 · migration chain 再適用工数

**Phase 2a 再開条件:** A4 完了 · G1–G10 Staging で PASS · 署名付き Go

---

### Option B — 単一 DB · Production migration として実施

**概要:** Staging 分離を諦め、Phase 2a を **Production DB migration** と明記。メンテナンス窓 + PITR + rollback でリスク管理。

| Step | 内容 |
| --- | --- |
| B1 | ドキュメント改称: 「Staging apply」→ **「Production migration（BD Phase 2a）」** |
| B2 | PITR / backup 確認 · rollback SQL レビュー（verification §6） |
| B3 | Edge **未デプロイ** または migration と **同一リリース窓**（列未存在 Edge 禁止） |
| B4 | メンテナンス通知 · apply `20260717120000` · `--remote` · smoke |
| B5 | 8788 / Pages smoke · Commercial Launch 判断は別途 |

**メリット:** 追加 project 不要 · 既存 Step 1 と同パターン  
**デメリット:** 本番 DB 直接変更 · 「Staging E2E 後 Production」フローと矛盾 · 障害時影響大

**Phase 2a 再開条件:** B1–B3 文書化 · Ops 署名 · **Commercial Launch / BD 利用方針の明示承認**

---

### Option C — 現状ラベルのまま apply（非推奨 · 禁止）

「Staging migration」名目で `ddojquacsyqesrjhcvmn` に apply。

| リスク |
| --- |
| 本番 DB 変更を Staging と誤認 |
| Go/No-Go チェックリストが形骸化 |
| `BD_PRODUCTION_PROJECT_REF` ガード無効 |
| 監査 · ロールバック判断の混乱 |

**判定: No-Go — 実施しない。**

---

### Option D — Supabase Branching（条件付き）

Pro plan + branching 利用可能な場合、production project の **preview branch** で migration 試験。

| 条件 | 確認事項 |
| --- | --- |
| プラン | Dashboard · org billing |
| Edge / Auth | branch URL と Functions の接続方式 |
| 再現性 | BD migration chain が branch に載るか |

**分岐:** branching 不可なら **Option A** へ。

---

## 6. 即時アクション（DB 変更なし）

| # | アクション | 担当 |
| --- | --- | --- |
| 1 | **Phase 2a migration STOP 維持** | 全員 |
| 2 | 本レポートを BD P0 正本に追加 | Engineering |
| 3 | `business-directory-phase2a-*` ドキュメントの verdict を **Blocked** に更新 | Engineering |
| 4 | Dashboard で `ddojquacsyqesrjhcvmn` の **Project 名 · 用途 · PITR** を人手確認 | Ops |
| 5 | **Option A vs B** を Product / Ops で決定 | Product + Ops |
| 6 | 決定後: Staging ref を repo に登録（A）または Production migration runbook 改訂（B） | Engineering |

**禁止（継続）:** link · push · migration · remote SQL · Production Edge/Pages 変更

---

## 7. Phase 2a 関連ドキュメントの status 更新

| ドキュメント | 旧 verdict | 新 status |
| --- | --- | --- |
| [phase2a-migration-readiness.md](./business-directory-phase2a-migration-readiness.md) | Staging apply **Go** | **STOP — 分離未確定** |
| [phase2a-staging-operator-runbook.md](./business-directory-phase2a-staging-operator-runbook.md) | Phase B ready | **Phase B 禁止** |
| [phase2a-staging-verification.md](./business-directory-phase2a-staging-verification.md) | Post-apply checklist | **apply 前ブロック** |

---

## 8. 結論

### 8.1 調査結論

1. **`ddojquacsyqesrjhcvmn` は本番 Supabase DB** — Pages · Edge · Auth · 既存 BD/TLV データが接続されている。
2. リポジトリに **別 Staging project ref は存在しない**。
3. 過去の「Staging migration / staging apply」は **同一本番 DB 上の作業** だった可能性が高い。
4. **Phase 2a を今 apply すると Production DB が変わる** — STOP は正当。
5. 設計 doc（`supabase-migration-plan.md`）の **Staging / Production 分離** は **未達**。

### 8.2 選択肢サマリー

| Option | 内容 | Phase 2a 適合 | 推奨 |
| --- | --- | --- | --- |
| **A** | 別 Staging Project 新規 | ◎ runbook と整合 | **推奨** |
| **B** | 単一 DB · Production migration として実施 | △ 可能だが改称・承認必須 | 次善（コスト優先時） |
| **C** | 同一 ref に「Staging」名目で apply | ✗ | **禁止** |
| **D** | Supabase Branching | ○ プラン次第 | A の代替調査 |

### 8.3 推奨決定

**Product / Ops の判断待ち:**

- **一般公開前 · migration リハーサル重視** → **Option A**（Staging project 新規）
- **BD 利用限定 · 工数最小 · PITR 確保** → **Option B**（Production migration として正式化）

**いずれも決定するまで Phase 2a migration は実施しない。**

---

## Related

| File | Role |
| --- | --- |
| [business-directory-phase2a-migration-readiness.md](./business-directory-phase2a-migration-readiness.md) | Pre-apply audit（STOP 更新） |
| [business-directory-phase2a-staging-operator-runbook.md](./business-directory-phase2a-staging-operator-runbook.md) | Operator commands（Phase B 停止） |
| [tlv-payment-production-drift-analysis.md](./tlv-payment-production-drift-analysis.md) | 同一 ref 問題の先行分析 |
| [docs/supabase-migration-plan.md](../docs/supabase-migration-plan.md) §17 | 設計上の分離方針 |
| [docs/production-release-checklist.md](../docs/production-release-checklist.md) | Production ref 正本 |

---

*Phase 2a migration: **STOP**. Resume only after Option A or B is chosen and documented.*
