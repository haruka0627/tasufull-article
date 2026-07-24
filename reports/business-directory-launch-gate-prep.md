# Business Directory — Launch Gate Preparation

**日付:** 2026-06-28  
**前提:** Step 5 **Go** · Commercial Launch **No-Go 維持** · MVP-2 **No-Go 維持**  
**正本:** [operational readiness](./business-directory-operational-readiness.md) · [Step 4 production](./business-directory-production-step4-production.md)  
**種別:** Blocker 整理のみ — **実装 · Launch · DB · Access · Stripe Live 変更なし**

---

## Executive summary

MVP-1 技術実装は完了済。Commercial Launch 前に残る **OB1–OB8** はすべて **運用 / 判断 / 設定** 系。  
**Cursor 単独で完結できるのは Docs/Runbook 草案の拡充のみ。** Access 方針 · 法務 · Launch 承認 · Stripe Live · 監視設定は **人間作業必須**。

| 判断 | 結果 |
| --- | --- |
| **Launch Gate Preparation（本タスク）** | **Complete** |
| **Commercial Launch** | **No-Go**（OB8 明示承認まで） |
| **MVP-2** | **No-Go**（仕様承認まで） |

---

## OB1–OB8 分類表

| ID | 内容 | 種別 | 必要作業 | Cursor 対応可否 | 人間作業 | Go 条件 |
| --- | --- | --- | --- | --- | --- | --- |
| **OB1** | Cloudflare Access / 公開 URL 方針 | **Human Decision** · Ops Setting | A/B/C/D いずれかを選定（Access 維持 / Public パス除外 / 別ドメイン / 内部のみ）· セキュリティレビュー · Zero Trust ポリシー設計 | **不可**（方針決定・ダッシュボード操作） | プロダクトオーナー + インフラ · Cloudflare Zero Trust でポリシー変更（**Launch 承認後**） | 公開対象 URL が一般 Owner/Public から到達可能 · Step 4 smoke が **本番公開 URL** で PASS · 方針文書化 |
| **OB2** | Stripe Live 切替 | **Human Decision** · Ops Setting | Live Product/Price 作成 · Supabase secrets（Live keys）· Live Webhook endpoint · 小額実課金テスト · 返金手順 | **不可**（secrets · Dashboard · 実課金） | Stripe Dashboard · Supabase secrets 設定 · 運営による Live テスト決済 | Live checkout 成功 · webhook/sync で plan 反映 · Phase 6 / Step 4 smoke を **Live** で再 PASS · **OB8 Go 後** |
| **OB3** | Owner オンボーディング | **Docs / Runbook** · Human Decision | FAQ · 初回掲載ガイド · 審査 SLA 説明 · オンボーディングメール文案 · ダッシュボード内ヘルプ文案 | **可**（文案・Runbook 草案 · docs 整備） | 審査 SLA 数値決定 · サポート体制 · 招待先 Owner 選定 · 文案最終承認 | Owner が Self-Service で draft→申請まで完走 · 運営が審査手順どおり処理 · FAQ 公開 |
| **OB4** | 監視・アラート | **Monitoring** · Ops Setting | Edge smoke 定期実行 · Stripe webhook 失敗監視 · 審査キュー深度アラート · Supabase log/metrics 確認手順 | **Docs 完了**（[ob4-monitoring.md](./business-directory-ob4-monitoring.md) · 2026-07-04）· **設定は人間** | 監視ツール選定 · アラート閾値設定 · オンコール担当 · Cloudflare/Supabase/Stripe アラート有効化 · テスト通知 | SLO 定義 · アラートがテスト通知成功 · 日次 smoke 運用 · 障害時 Runbook で初動可能 |
| **OB5** | Migration history repair | **DB / Migration** · Human Decision | `migration repair` 3 本（BD Phase 1×2 + Phase 6）· 履歴ドリフト影響評価 · 将来 `db push` 整合 | **不可**（本番/staging DB 操作禁止中） | DBA/運営が staging で repair 実行 · 結果を Step 1 スクリプトで再検証 | `schema_migrations` に 20260711* / 20260712100000 記録 · remote 検証 PASS · drift 整理方針文書化 |
| **OB6** | 法務文案 | **Legal** · Docs / Runbook | 掲載規約 · 特定商取引法 · プライバシー · サブスク課金表記 · 返金/解約ポリシー | **可**（既存 docs との差分リスト · ドラフト骨子 · チェックリスト） | 法務/運営による文案作成 · レビュー · サイトへの掲載承認 | BD 専用または既存規約への追記が **公開済** · Owner 登録フローからリンク可能 |
| **OB7** | サポート窓口 | **Human Decision** · Docs / Runbook | 問い合わせチャネル（メール / フォーム / TALK）· 受付時間 · エスカレーション · Owner 向け SLA | **可**（Runbook · テンプレート · docs 索引） | 窓口開設 · 担当割当 · 連絡先公開判断 | 公開ページ/Owner UI から **到達可能な** サポート導線 · 初回問い合わせ対応手順確定 |
| **OB8** | Commercial Launch 明示承認 | **Human Decision** | Launch Gate レビュー · OB1–OB7 達成確認 · Go/No-Go 議事録 | **不可** | ステークホルダー署名/承認（プロダクト · 運営 · 法務 · インフラ） | **書面/議事で Commercial Launch Go** · 全 Launch 必須 OB が ✅ |

---

## 種別別サマリー

| 種別 | 該当 OB |
| --- | --- |
| Human Decision | OB1 · OB2 · OB3 · OB7 · OB8 |
| Ops Setting | OB1 · OB2 · OB4 |
| Docs / Runbook | OB3 · OB6 · OB7 |
| Code | —（Launch Gate 時点で **新規コード不要**） |
| DB / Migration | OB5 |
| Legal | OB6 |
| Monitoring | OB4 |

---

## Cursor だけで進められる項目

| 優先 | 項目 | 成果物例 |
| --- | --- | --- |
| 1 | OB3 Owner FAQ / オンボーディング文案草案 | `docs/business-directory-owner-onboarding.md`（**承認後作成可**） |
| 2 | OB6 法務チェックリスト · 既存規約との差分表 | レポート or docs 追記 |
| 3 | OB7 サポート Runbook · テンプレート返信 | operational readiness § 拡張 |
| 4 | OB4 監視チェックリスト · smoke 手順 | ✅ [ob4-monitoring.md](./business-directory-ob4-monitoring.md) |
| 5 | OB1 選択肢 A–D 比較表（決定は人間） | 本レポート § OB1 詳細 |

**不可:** OB1 ポリシー変更 · OB2 Stripe Live · OB5 migration repair 実行 · OB8 承認 · Commercial Launch 実施

---

## 人間判断が必要な項目

| OB | 判断内容 | 推奨決定者 |
| --- | --- | --- |
| **OB1** | Public を誰がどの URL で見るか（Access / 別ドメイン） | PO + インフラ |
| **OB2** | 実課金開始タイミング · Live Price 金額確定 | PO + 経理 |
| **OB3** | 審査 SLA（例: 48h）· オンボーディング範囲 | PO + Ops |
| **OB6** | 規約文案 · 表記 · 返金条件 | 法務 + PO |
| **OB7** | サポートチャネル · 公開連絡先 | PO + Ops |
| **OB8** | Commercial Launch Go/No-Go | 全ステークホルダー |
| **OB5** | repair 実施タイミング · drift 整理方針 | DBA + PO |

---

## 実装が必要な項目

Launch Gate 時点では **新規機能実装（MVP-2 含む）は不要**。

| 区分 | 内容 | 備考 |
| --- | --- | --- |
| **必須コード変更** | **なし** | MVP-1 + Step 4 で足りる |
| **設定のみ（コード外）** | OB1 Access · OB2 Stripe secrets · OB4 アラート | Ops Setting |
| **DB 操作のみ** | OB5 migration repair | SQL apply 済 · history 記録のみ |
| **将来（MVP-2 · Launch 後）** | タブ編集 · Pro TLV · 問い合わせ UI | **No-Go 維持** |

---

## Launch Gate までの最短順序

```text
Phase 0  ✅ Step 5 Go（完了）

Phase 1  Human Decision（並行可）
  1a. OB8 前提: Launch Gate レビュー日程設定
  1b. OB1 公開 URL / Access 方針決定（A/B/C/D）
  1c. OB6 法務レビュー着手
  1d. OB3/OB7 オンボーディング + サポート方針決定

Phase 2  Docs / Runbook（Cursor 支援可）
  2a. OB3 FAQ · ガイド文案確定
  2b. OB6 規約掲載
  2c. OB7 サポート窓口公開

Phase 3  Ops Setting（人間 · Launch 直前）
  3a. OB5 migration repair（staging · 承認後）
  3b. OB4 監視・アラート有効化
  3c. OB1 Access/ DNS 反映（方針に応じて · **OB8 前に dry-run smoke**）
  3d. OB2 Stripe Live（**OB8 Go の後** · 実課金開始直前）

Phase 4  Launch Gate
  4a. OB1–OB7 チェックリスト ✅ 確認
  4b. Step 4 smoke @ **本番公開 URL** 再実行
  4c. OB8 Commercial Launch **明示 Go**

Phase 5  Commercial Launch（OB8 Go 後のみ · 本タスク範囲外）
  一般公開 · マーケ告知 · Owner 招待
```

**クリティカルパス:** OB1（URL方針）→ OB6（法務）→ OB8（承認）→ OB2（Live · 課金開始時）

---

## OB1 詳細（Human Decision · 参考）

| 選択肢 | Public 到達 | Owner 到達 | セキュリティ | Launch 適性 |
| --- | --- | --- | --- | --- |
| **A** Access 維持 · 招待のみ | ❌ 一般不可 | △ 招待者のみ | 高 | クローズド β のみ |
| **B** BD Public パスのみ Access 除外 | ✅ | △/✅ | 要レビュー | 条件付き Launch 可 |
| **C** 別ドメイン + Public | ✅ | ✅ | 中（設計次第） | **推奨検討** |
| **D** 現状維持（内部検証） | ❌ | △ 8788/preview | 高 | **現状 No-Go** |

---

## Commercial Launch Go / No-Go

| 判断 | 結果 |
| --- | --- |
| **Commercial Launch** | **No-Go** |
| **根拠** | OB1–OB8 未解消 · OB8 明示承認なし · ユーザー指示 |
| **Launch Gate Preparation** | **Complete**（本レポート） |
| **次アクション** | Phase 1 Human Decision（OB1 · OB6 · OB3/OB7）の日程設定 |

---

## MVP-2 開始可否

| 判断 | 結果 |
| --- | --- |
| **MVP-2 実装** | **No-Go** |
| **根拠** | 仕様承認待ち · Commercial Launch 前はスコープ外 · ユーザー指示 |

---

## 参照

- [business-directory-operational-readiness.md](./business-directory-operational-readiness.md) — Step 5 Runbook · OB 一覧
- [business-directory-production-step4-production.md](./business-directory-production-step4-production.md)
- [business-directory-production-step1-migration.md](./business-directory-production-step1-migration.md) — OB5 repair 手順
- [docs/business-directory-mvp-design.md](../docs/business-directory-mvp-design.md) — MVP-1/2 境界
