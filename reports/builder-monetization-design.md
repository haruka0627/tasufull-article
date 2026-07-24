# Builder Monetization / Contact Reveal — 設計レポート

**日付:** 2026-06-28  
**種別:** 設計のみ（**未実装**）  
**正本:** [docs/AI/BUILDER_MONETIZATION.md](../docs/AI/BUILDER_MONETIZATION.md)

---

## サマリー

Builder の課金を **2 レーン**に分離して正本化した。

| レーン | モデル | 一言 |
| --- | --- | --- |
| **Builder AI** | 月額サブスク | 現場業務 AI（見積 · Vision · PDF · 報告書） |
| **Contact Reveal** | 都度買い切り | 直接連絡先の開示のみ（¥300/件 初期案） |
| **検索 / プロフィール** | 無料 | 条件検索 · 比較 · お気に入り |

**AI Membership（TASFUL AI Workspace）とは統合しない。**

---

## 設計判断

### なぜ分離するか

1. **検索漏斗** — 有料壁を検索に置くとマッチング成立率が下がる
2. **価値の明確化** — AI ツール価値と「連絡先という成果物」を別 SKU にできる
3. **AD-002 整合** — Builder AI · TASFUL AI · マッチング課金の混線を防ぐ
4. **柔軟な課金** — サブスク未加入でも都度開示で取引可能

### Contact Reveal の単位

- **1 target = 1 課金**（worker / partner / job_owner）
- **再閲覧無料** — `UNIQUE(user_id, target_type, target_id)` + `status=active`
- **TALK 内メッセージ** — 1 通課金しない（プラットフォーム内連絡は無料）

---

## 推奨価格（Draft）

| SKU | 価格 |
| --- | --- |
| 連絡先開示 単品 | ¥300/件 |
| 5 件パック | ¥1,200 |
| 10 件パック | ¥2,000 |
| Builder Pro | ¥1,480/月 |
| Builder Business | ¥4,980/月 |

Pro への毎月開示枠付与は **未確定**。初期は都度課金優先。

---

## データモデル（想定）

**テーブル:** `contact_reveals`

```
user_id, target_type, target_id, payment_id,
revealed_at, expires_at (nullable), status
UNIQUE(user_id, target_type, target_id)
```

`target_type`: `worker` | `partner` | `job_owner`  
`status`: `active` | `refunded` | `revoked`

---

## 禁止事項（正本 §6）

- 検索有料化 ❌
- プロフィール閲覧有料化 ❌
- メッセージ 1 通課金 ❌
- サブスク必須 ❌
- AI Membership 統合 ❌

---

## 既存実装との関係

| 既存 | 本設計での位置 |
| --- | --- |
| `builder-search-repository.js` (P1) | 検索 — **無料** |
| `builder-ai-live-gate.js` | Builder AI entitlements — **別商品** |
| `AI_MEMBERSHIP_PRICING.md` | TASFUL AI — **非統合** |
| TLV Payment Engine | 決済パターン参考 · Builder 専用 Product |

---

## Backlog（実装順）

1. **M0** — SKU / Stripe Product 定義
2. **M1** — `contact_reveals` migration + RLS
3. **M2** — Checkout + webhook
4. **M3** — プロフィール reveal UI
5. **M4** — Builder Pro / Business サブスク
6. **M5** — パック残数 · 運営 revoke

---

## 成果物

| ファイル | 状態 |
| --- | --- |
| `docs/AI/BUILDER_MONETIZATION.md` | ✅ 正本 |
| `docs/AI/BUILDER_AI.md` | ✅ 参照追加 |
| `docs/TODO.md` | ✅ Backlog 追加 |
| `docs/AI/README.md` | ✅ 索引 |
| 本レポート | ✅ |

**未実施:** DB migration · Payment · UI · Gateway

---

*Design only · 2026-06-28*
