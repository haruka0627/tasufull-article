# Business Directory — オンコール・問い合わせ先（仮）

**最終更新:** 2026-07-04  
**状態:** 仮（運営承認前 · 実連絡先未設定）
**正本:** [OB4 P0 最小実装案](../../reports/business-directory-ob4-minimum-p0-plan.md)

---

## 1. オンコール（障害時）

| 深刻度 | 定義 | 初動連絡先（仮） | 目標応答時間 |
|--------|------|-----------------|-------------|
| **S1** | Edge 全停止 · DB 不可 | [TBD: Dev Lead] + [TBD: Ops Lead] | 15 分以内 |
| **S2** | Webhook 停止 · 課金反映不可 | [TBD: Dev Lead] | 1 時間以内 |
| **S3** | 審査 UI のみ障害 | [TBD: Ops Lead] | 4 時間以内 |
| **S4** | 表示崩れ · 軽微 | [TBD: Ops Lead] | 翌営業日 |

## 2. エスカレーション（仮）

```
S1/S2 発生
  → [TBD: 一次担当者名 · 連絡先]
  → 15 分で応答なし → [TBD: 二次担当者名 · 連絡先]
  → 30 分で復旧目処なし → [TBD: プロダクトオーナー名 · 連絡先]
```

## 3. 定期確認（日次 · 仮）

| 時刻 | 担当（仮） | 項目 |
|------|-----------|------|
| 09:00 | Ops | `npm run smoke:business-directory` 実行 · PASS 確認 |
| 09:00 | Ops | Stripe Dashboard webhook 失敗イベント確認 |
| 09:00 | Ops | Admin reviews 審査キュー確認 |
| 18:00 | Ops | 新規登録 · 課金成立件数確認 |

## 4. 問い合わせ先（仮）

| 種別 | 連絡先（仮） | 備考 |
|------|-------------|------|
| Owner 向けサポート | [TBD: メールアドレス] | OB7 サポート窓口と共通 |
| 運営内部連絡 | [TBD: チャットツール · チャンネル名] | — |
| Stripe 緊急 | Stripe Dashboard → Support | 24h · 英語 |
| Supabase 緊急 | Supabase Dashboard → Support | Pro Plan |

## 5. 障害時初動チェックリスト（仮）

1. `npm run smoke:business-directory` 実行
2. Cloudflare Pages Deployments — 最新 deploy の状態確認
3. Supabase Dashboard — DB status · Edge Functions status
4. Stripe Dashboard — webhook 失敗イベント有無
5. 本番 URL browser smoke（`node scripts/capture-business-directory-ob4-smoke.mjs --prod`）
6. 原因特定 → S1–S4 分類 → エスカレーション
7. Post-incident: `business_directory_audit_logs` 保全 · smoke 再実行 · 記録

## 6. Rollback（参照）

- **Pages:** Cloudflare Pages → Deployments → 直前の known-good deploy を Promote → smoke 再実行
- **Edge Functions:** 前 revision の `business-directory` / `stripe-webhook` を checkout → `supabase functions deploy`
- **DB:** migration は additive · rollback はデータ修正 / feature flag 優先 · 本番 DROP 禁止

詳細: [operational-readiness.md](../../reports/business-directory-operational-readiness.md) §8–10

---

*仮 Runbook — 運営承認後、実連絡先に差し替え。*