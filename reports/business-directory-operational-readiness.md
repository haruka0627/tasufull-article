# Business Directory — Step 5 Operational Readiness

**日付:** 2026-06-28  
**Git HEAD:** `aebf23c`  
**Priority:** P3 Business Directory  
**種別:** 運用準備（docs 同期 · 8788 回帰 · Runbook）— **実装変更なし · Commercial Launch 未実施**

**前提:** [implementation readiness](./business-directory-implementation-readiness.md) · Production Step 4 [Go](./business-directory-production-step4-production.md)（2026-06-27 · HEAD `10a77dc`）

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| **Step 5a ドキュメント同期** | **Complete** |
| **Step 5b 8788 回帰** | **Go**（Phase 1–7 + Step 4 smoke **48/48** @8788） |
| **Step 5c Runbook** | **本レポート §5–§13** |
| **Commercial Launch** | **No-Go**（blocker 解消前 · ユーザー指示） |
| **MVP-2 開始** | **No-Go**（Step 5 完了後も仕様承認待ち） |

---

## 1. 更新ファイル一覧

| パス | 内容 |
| --- | --- |
| `reports/business-directory-operational-readiness.md` | **本レポート（新規）** |
| `docs/README.md` | BD 行 → Step 5 · Step 4 Go · Commercial Launch 未実施 |
| `docs/ROADMAP.md` | P2 Core Complete · P3 Step 5 · BD テーブル更新 |
| `docs/PROJECT_STATUS.md` | BD 行追加 · HEAD · 開発優先 P3 |
| `docs/TODO.md` | P3 Step 5 セクション · REL-P1-07 更新 |
| `docs/business-directory-mvp-design.md` | §10 実装状態 · §11 フェーズ状態 |

---

## 2. ドキュメント同期結果（Step 5a）

| ドキュメント | 修正前（問題） | 修正後 |
| --- | --- | --- |
| `docs/README.md` | Production Step 2 · Pages prod 未着手 | **Step 5 Operational Readiness** · MVP-1 完了 · Step 4 Go · Launch 未実施 |
| `docs/ROADMAP.md` §優先 | P2 実装待ち · P3 待機後 | P2 **Core Complete** · P3 **Step 5 運用準備** |
| `docs/ROADMAP.md` §BD | Phase 6 接続済のみ | MVP-1 Complete · Step 5 行追加 |
| `docs/PROJECT_STATUS.md` | BD 行なし · HEAD `bce78cc` | BD 行追加 · HEAD **`aebf23c`** |
| `docs/TODO.md` | REL-P1-07 Step 4 のみ | **P3 Step 5** セクション · REL-P1-07 更新 |
| `docs/business-directory-mvp-design.md` | §10「コード未着手」 | **§10 実装状態表** · §11 フェーズ完了表 |

**リンク:** Step 4 · operational readiness レポートへのリンクを追加。**リンク切れなし**（相対パス確認済）。

**意図的に未変更:** `docs/DECISIONS.md`（AD 変更禁止）· `reports/business-directory-mvp-design.md`（設計報告スナップショット）

---

## 3. 8788 回帰結果（Step 5b）

**環境:** `npm run build:pages` → `npm run dev` → `http://127.0.0.1:8788`  
**HEAD:** `aebf23c`（Step 4 時点 `10a77dc` からの差分あり · Live Platform Phase F 等）

### 3.1 スイート別

| スイート | 結果 | Step 4 時（参考） | 差分 |
| --- | --- | --- | --- |
| Phase 1 schema | **37/37 PASS** | 37/37 | なし |
| Phase 2 API | **67/68** · deno check FAIL | 68/68 | **環境のみ**（下記 NOTE） |
| Phase 3 Owner | **55/55 PASS** | 53/53 | +2（テスト拡張 · 機能退行なし） |
| Phase 4 Admin | **35/35 PASS** | 35/35 | なし |
| Phase 5 Public | **27/27 PASS** | 27/27 | なし |
| Phase 6 Stripe | **52/52 PASS** | 52/52 | なし |
| Phase 7 Preflight | **74/74 PASS** | 74/74 | なし |
| **Step 4 smoke @8788** | **48/48 PASS · Go** | 48/48 @preview | **退行なし** |

**NOTE（Phase 2 deno check）:** ローカル `deno check` が `npm:@types/node` 未解決で FAIL。Phase 7 preflight でも既知 NOTE。**Edge deploy / ランタイム影響なし**。CI/Supabase 側は Step 2/4 で PASS 済。

### 3.2 Step 4 smoke @8788 カバレッジ

| 領域 | 検証内容 | 結果 |
| --- | --- | --- |
| **Owner** | login · create_draft · update · submit · browser dashboard/new/edit | PASS |
| **Admin** | login · review queue · approve · reject · browser reviews/listing | PASS |
| **Public** | list · detail · search · published-only | PASS |
| **Stripe Test** | checkout 4242 · webhook/sync · plan=standard | PASS |
| **Approval / Publish** | approve → published · reject 非表示 | PASS |
| **Regression** | index-top · business · shop-store · post · shop-checkout 非耦合 | PASS |
| **Console** | browser smoke console 0 | PASS |

**8788 HTTP:** Step 4 static checks — BD 主要 HTML/JS **200 OK**（`127.0.0.1:8788`）

### 3.3 Step 4 時点との総合判定

**機能退行なし。** HEAD 差分（Live Platform monitoring 等）は BD smoke / Marketplace 副作用チェックで **影響確認済**。

---

## 4. Launch Checklist（Commercial Launch 前）

**正本（R2 更新）:** [business-directory-commercial-launch-checklist.md](./business-directory-commercial-launch-checklist.md) — Stripe · BD · Production · Browser · Human Go/No-Go

Commercial Launch 実施前に **すべて ✅** が必要（現状 **Conditional · 未達**）。

### 4.1 技術（要約 · 詳細は正本）

| # | 項目 | 状態 |
| --- | --- | --- |
| L1 | MVP-1 実装 · Phase 1–7 テスト | ✅ |
| L2 | Production Step 4 smoke（機能） | ✅（2026-06-27 + 8788 再確認 2026-06-28） |
| L3 | `npm run build:pages` dist 同期 | ✅ |
| L4 | Edge `business-directory` + `stripe-webhook` deploy | ✅（staging ref · Step 2） |
| L5 | Supabase BD migration apply | ✅（staging · Step 1） |
| L6 | Migration history repair | ❌ 未実施 |
| L7 | 8788 / preview 回帰 PASS | ✅（本 Step 5） |
| L8 | Stripe **Live** mode + Live Price | ❌ Test mode のみ |
| L9 | 監視・アラート設定 | 🔄 Runbook 済 · 運用設定未 — [ob4-monitoring](./business-directory-ob4-monitoring.md) |
| L10 | Runbook 承認（運営） | 🔄 R2 Runbook 追加 · [commercial-launch-checklist](./business-directory-commercial-launch-checklist.md) |

### 4.2 運用 · 法務 · 公開

| # | 項目 | 状態 |
| --- | --- | --- |
| L11 | Owner オンボーディング手順 | ❌ 草案のみ（§6） |
| L12 | Admin 審査 SLA · エスカレーション | ❌ 草案のみ（§7） |
| L13 | Cloudflare Access / 公開 URL 方針 | ❌ 未決（§12） |
| L14 | 利用規約 · 特定商取引法 · プライバシー | ❌ BD 専用確認未 |
| L15 | サポート窓口 · 問い合わせ導線 | ❌ 未整備 |
| L16 | マーケット TOP 一般公開判断 | ❌ 未実施 |
| L17 | Commercial Launch 明示 Go 承認 | ❌ **No-Go 維持** |

---

## 5. Owner Onboarding（Runbook 草案）

### 5.1 対象ユーザー

- TASFUL 会員（`t2@tasful.invalid` 等 L7 スロット — 本番は一般 Owner アカウント）

### 5.2 オンボーディングフロー

```text
1. 会員登録 / ログイン
2. /business-directory/ ダッシュボード
3. 新規掲載 → 種別（店舗 / 業務）→ プラン選択
4. 最小フォーム入力（Self-Service · 運営代行なし）
5. 下書き保存（draft）
6. Standard/Pro 選択時: Stripe Test checkout（本番は Live 切替後）
7. 公開申請（review_requested）
8. 運営審査待ち → 承認（published）/ 差戻し（rejected）
9. Public 一覧・詳細に表示
```

### 5.3 Owner 向けサポート境界

| 対応する | 対応しない |
| --- | --- |
| 審査ステータス · 差戻し理由の説明 | 文案代筆 · 写真代アップロード |
| プラン · 課金に関する案内 | フォーム入力代行 |
| 不具合 · ログイン障害 | Marketplace / Platform 案件 |

### 5.4 事前準備（Launch 前 TODO）

- [ ] Owner 向け FAQ（審査 · プラン · 写真要件）
- [ ] オンボーディングメール / ダッシュボード内ガイド文案
- [ ] テストアカウント以外の本番 Owner 招待手順

---

## 6. Admin 運用（Runbook 草案）

### 6.1 ロール

- **Ops Admin:** `tasu_admin` JWT（`t4@tasful.invalid` · E2E 参照）
- **画面:** `/business-directory/admin/reviews.html` · `listing.html`

### 6.2 日常オペレーション

| タスク | 手順 | 頻度 |
| --- | --- | --- |
| 審査キュー確認 | `get_review_queue` · pending 一覧 | 日次 |
| 承認 | 内容確認 → approve → `published` | 随時 |
| 差戻し | 理由必須 → reject → Owner 修正待ち | 随時 |
| 停止 | 規約違反 → suspend | 随時 |
| 監査 | `business_directory_audit_logs` 参照 | 随時 |

### 6.3 原則（AD-013 / Self-Service）

- **掲載内容の入力代行禁止**（規約違反時の強制対応除く）
- Admin UI は **理由入力のみ** · 掲載フィールド直接編集なし

### 6.4 エスカレーション（草案）

| 事象 | 一次 | 二次 |
| --- | --- | --- |
| 審査滞留 > 48h | Ops リード | プロダクトオーナー |
| 不正掲載・通報 | suspend + audit | 法務判断 |
| Stripe 課金不整合 | Ops + Stripe Dashboard | Dev（Edge webhook） |

---

## 7. Monitoring（OB4）

**正本（2026-07-04）:** [business-directory-ob4-monitoring.md](./business-directory-ob4-monitoring.md)

### 7.1 監視対象（要約）

| コンポーネント | チェック | 手段 |
| --- | --- | --- |
| Edge `business-directory` | `get_public_listings` 200 | `smoke-business-directory-ob4.mjs` |
| Edge `stripe-webhook` | Failed deliveries · Logs | Stripe Dashboard · Supabase Logs |
| Pages 静的 | Owner / Admin / Public HTML 200 | smoke · 8788 / 本番 URL（OB1 後） |
| Public データ | published のみ | API 読取 |
| 審査キュー深度 | `review_requested` 件数 | Admin UI · `get_review_queue` |
| Stripe plan 反映（Test） | webhook / sync | Dashboard · 障害時 sync |

### 7.2 アラート閾値（提案 · **運用設定は人間**）

- Edge 5xx 連続 3 回（S1）
- Webhook Failed 連続 3 回（S1）
- 審査 pending > 10 件 / 最古 24h 超（S3）
- 日次 smoke FAIL（S2）

詳細: [ob4-monitoring §3](./business-directory-ob4-monitoring.md)

### 7.3 現状

| 項目 | 状態 |
| --- | --- |
| Runbook · smoke 手順 · 障害初動 | ✅ 文書化済（OB4） |
| 監視ツール有効化 · 通知テスト · オンコール | ❌ 人間作業（Launch blocker 残） |

---

## 8. Backup（Runbook 草案）

| 対象 | 方法 | 頻度 |
| --- | --- | --- |
| Supabase Postgres | Supabase 自動バックアップ（プロジェクト設定確認） | 日次 |
| `business_directory_*` テーブル | PITR / manual dump（運営判断） | Launch 前に手順化 |
| Stripe 顧客/subscription | Stripe Dashboard export | 月次 |
| Pages dist | Git 正本 + `npm run build:pages` 再生成 | 随時 |

**Launch 前 TODO:** Supabase backup 保持期間 · リストア手順の文書化 · リストアドリル（年 1 回）。

---

## 9. Rollback（Runbook 草案）

### 9.1 Pages（Cloudflare）

```text
1. Cloudflare Pages → Deployments → 直前の known-good deploy を Promote
2. Step 4 smoke subset で確認
3. 問題が BD のみなら BD 静的パスのみ差分確認
```

### 9.2 Edge Functions

```text
1. git から前 revision の functions を checkout
2. supabase functions deploy business-directory stripe-webhook（運営承認後）
3. Step 2 remote smoke 15 項目
```

### 9.3 DB

- **原則:** BD migration は additive · `public.listings` 非変更 — rollback は **データ修正 / feature flag** 優先
- **禁止:** 本番 DROP  без 運営・DB 承認

### 9.4 Stripe

- Test mode: Price/Customer は再 bootstrap 可（`scripts/bootstrap-business-directory-stripe-prices.mjs`）
- Live mode: **切替前に rollback 手順を Live 用に別途定義**

---

## 10. Incident 対応（Runbook 草案）

| Severity | 例 | 初動 | 連絡 |
| --- | --- | --- | --- |
| **S1** | Edge 全停止 · DB 不可 | Pages ロールバック検討 · Supabase status 確認 | 即時 Dev + Ops |
| **S2** | Webhook 停止 · 課金反映不可 | Stripe webhook ログ · secrets 確認 | 4h 以内 |
| **S3** | 審査 UI のみ障害 | Owner/Admin 別 URL 確認 · 8788 再現 | 翌営業日 |
| **S4** | 表示崩れ · コピー | 次 deploy 修正 · hotfix branch | 計画対応 |

**Post-incident:** `business_directory_audit_logs` 保全 · Step 4 smoke 再実行 · 本レポート §3 形式で記録。

---

## 11. Stripe 運用（Runbook 草案）

### 11.1 現状（Test mode）

| 項目 | 値 / 手順 |
| --- | --- |
| Standard Price | `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD`（Step 2 証跡） |
| Pro Price | `BUSINESS_DIRECTORY_STRIPE_PRICE_PRO` |
| Bootstrap | `node scripts/bootstrap-business-directory-stripe-prices.mjs` |
| Webhook イベント | checkout.session.completed · subscription.* · invoice.payment_* |
| 検証 | Phase 6 テスト · Step 4 checkout 4242 |

### 11.2 Live 切替前チェック（未実施 · 禁止中）

- [ ] Stripe Live API keys を Supabase secrets に設定
- [ ] Live Product/Price 作成 · secrets 更新
- [ ] Live Webhook endpoint + signing secret
- [ ] 小額実課金テスト · 返金手順
- [ ] **Commercial Launch Go 承認**

### 11.3 障害時

- Webhook 再送: Stripe Dashboard
- 手動 sync: Edge `sync_subscription_status`（Owner JWT · Edge 経由）
- Owner 問い合わせ: billing portal / サポート窓口（未整備）

### 11.4 R2 Runbook（2026-07-01）

| ドキュメント | 用途 |
| --- | --- |
| [r2-production-test-stripe-e2e-runbook.md](./business-directory-r2-production-test-stripe-e2e-runbook.md) | Production Test E2E（4242） |
| [r2-portal-cancel-runbook.md](./business-directory-r2-portal-cancel-runbook.md) | Portal 解約 |
| [commercial-launch-checklist.md](./business-directory-commercial-launch-checklist.md) | Launch 前一覧 |

---

## 12. Cloudflare Access 運用（Runbook 草案）

### 12.1 現状

- **Canonical URL:** `https://tasufull-article.pages.dev` — **Cloudflare Access 保護**
- 未認証 HTTP → Access ログイン HTML
- Step 4 / 本 Step 5: 静的・browser smoke は **`http://127.0.0.1:8788`** または deploy preview URL で実施

### 12.2 Launch 前の決定事項

| 選択肢 | 影響 |
| --- | --- |
| A. Access 維持 + Owner/Admin 招待のみ | 一般 Public 不可 — BD Public Launch 不可 |
| B. BD Public パスのみ Access 除外 | セキュリティレビュー必須 |
| C. 別ドメイン（例: directory.tasful.jp）で Public | DNS + Pages カスタムドメイン |
| D. 現状維持（内部検証のみ） | **Commercial Launch No-Go** |

**現状方針:** **D（No-Go 維持）** — 一般公開は Access 方針決定まで実施しない。

### 12.3 運用手順

- Access ポリシー変更: Cloudflare Zero Trust ダッシュボード · **変更前に Step 4 smoke**
- 8788 ローカル検証: `npm run dev` · `netstat 8788` · wrangler Ready 確認（プロジェクト共通ルール）

---

## 13. Operational Blocker 一覧

| ID | Blocker | 深刻度 | Launch 必須 |
| --- | --- | --- | --- |
| OB1 | Cloudflare Access · 公開 URL 方針未決 | High | ✅ |
| OB2 | Stripe Live 未切替 | High | ✅（実課金開始時） |
| OB3 | Owner オンボーディング未整備 | High | ✅ |
| OB4 | 監視・アラート — Runbook 済 · **運用設定未** | Medium | ✅（設定完了まで） |
| OB5 | Migration history repair 未実施 | Medium | 推奨 |
| OB6 | 法務文案（利用規約等）未確認 | High | ✅ |
| OB7 | サポート窓口未整備 | Medium | ✅ |
| OB8 | Commercial Launch 明示承認なし | High | ✅ |

**技術 MVP blocker なし** — OB1–OB8 は **運用 / 公開判断** 系。

---

## 14. Commercial Launch Go / No-Go

| 判断 | 結果 |
| --- | --- |
| **Commercial Launch** | **No-Go** |
| **根拠** | §4 Launch Checklist 未達 · §13 Operational Blockers · ユーザー指示 |
| **Step 5 Operational Readiness** | **Go** |
| **8788 機能回帰** | **Go** |

---

## 15. MVP-2 開始可否

| 判断 | 結果 |
| --- | --- |
| **MVP-2 実装開始** | **No-Go** |
| **根拠** | Commercial Launch 前 · 仕様変更禁止 · MVP-2（タブ編集 · Pro TLV · 問い合わせ）は **別承認** が必要 |
| **次に可能な作業** | Runbook 正式化 · 監視設定 · Migration repair · Launch Gate 承認会議 |

---

## 参照

- [business-directory-implementation-readiness.md](./business-directory-implementation-readiness.md)
- [business-directory-production-step4-production.md](./business-directory-production-step4-production.md)
- [business-directory-production-step3-preview-e2e.md](./business-directory-production-step3-preview-e2e.md)
- [business-directory-phase7-deploy-preflight.md](./business-directory-phase7-deploy-preflight.md)
- [docs/business-directory-mvp-design.md](../docs/business-directory-mvp-design.md)
