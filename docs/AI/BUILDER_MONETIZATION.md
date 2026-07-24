# Builder Monetization — 課金設計（Draft）

**Status:** Draft（**設計 + demo UI 一部実装**）  
**最終更新:** 2026-07-03  
**正本:** [BUILDER_ARCHITECTURE.md](./BUILDER_ARCHITECTURE.md) · 本ファイル · [BUILDER_AI.md](./BUILDER_AI.md) · [BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md)

> **商品方針（2026-07）:** Contact Reveal（連絡先開示料）は **¥550/件（税込）**。運営案件は情報開示料対象外。定数: `builder/builder-billing-policy.js`  
**分離:** [AI Membership Pricing](./AI_MEMBERSHIP_PRICING.md)（TASFUL AI Workspace）· TLV Payment Engine · [BUILDER_CREDITS.md](./BUILDER_CREDITS.md)（Future · 非統合）· **統合しない**

---

## 目的

Builder AI（業務 AI サブスク）と、ワーカー / 業者 / 案件マッチングの課金を **明確に分離**する。

> **検索無料 · 連絡先開示は都度課金 · Builder AI はサブスク**

ユーザーは **検索・比較・プロフィール閲覧を無料**で行い、**直接連絡に進む瞬間**にのみ Contact Reveal 課金が発生する。Builder AI ツール利用は **別レーンの月額課金**。

---

## 1. 課金レーン概要

| レーン | 課金モデル | 対象 | 備考 |
| --- | --- | --- | --- |
| **Builder AI** | 月額サブスク | 見積 · 工程 · 写真診断 · PDF · 報告書 · AI 業務支援 | マッチング連絡先とは **別請求** |
| **Contact Reveal** | 都度買い切り（1 件） | 電話 · メール · LINE · 担当者名 · 詳細住所 · 会社 HP 等 | 一度開示した相手は **再閲覧無料** |
| **検索 / マッチング UI** | **無料** | 条件検索 · フィルタ · プロフィール · お気に入り | 有料壁 **禁止**（§6） |
| **Provider Listing Boost** | 月額（掲載者） | 検索優先 · Sponsored · メディア上限 UP | [BUILDER_PROVIDER_LISTING.md](./BUILDER_PROVIDER_LISTING.md) · Contact Reveal **別** |
| **Builder Credits（Future）** | 購入型ポイント | 複数有料機能の共通消費 | [BUILDER_CREDITS.md](./BUILDER_CREDITS.md) · サブスク **補助** · 他 Wallet **非統合** |

```text
┌─────────────────────────────────────────────────────────┐
│  無料: 検索 · フィルタ · プロフィール · お気に入り      │
└──────────────────────────┬──────────────────────────────┘
                           │ 「連絡先を見る」
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Contact Reveal（都度 ¥550/件 · パック可）              │
│  既開示 → 再課金なし                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Builder AI（月額 Pro / Business）— 別契約               │
│  見積 · Vision · PDF · 報告書 · 業務 AI                  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Builder AI（サブスク）

### 位置づけ

**建設・リフォーム現場の業務 AI ツール**として月額課金。マッチングの「連絡先開示」とは **商品・請求・ entitlements すべて独立**（[DECISIONS.md](../DECISIONS.md) AD-002 · TASFUL AI 非統合と同趣旨）。

### 対象機能（例）

| カテゴリ | 内容 |
| --- | --- |
| 見積 · 計算 | Tool Orchestrator · 外壁 · 材料 · 利益 · 税務 assist |
| 現場 AI | Gemini Vision 写真診断 · Live 風 MVP |
| ドキュメント | PDF 生成 · 報告書 · 工程表 · 契約/発注下書き |
| 業務支援 | 24 actions · 候補推薦（**deterministic · 連絡先開示不含**） |

### 非対象（Contact Reveal 側）

- ワーカー / 業者 / 案件発注者の **電話・メール・LINE 等の直接連絡情報**
- 条件検索そのもの（[BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md) — FREE コア）

---

## 3. Contact Reveal（都度課金）

### 思想

| 主体 | 適用 |
| --- | --- |
| **ワーカー** | 発注者が Worker の直接連絡先を開示 |
| **業者（partner）** | 発注者が協力会社の直接連絡先を開示 |
| **案件発注者（job_owner）** | 受注側が発注者の直接連絡先を開示 |

**三者とも同一ルール:** プロフィールは無料 · 直接連絡情報のみ有料 · 1 回開示で恒久再閲覧（同一 user × target）。

### 無料で見せる（公開プロフィール）

- 表示名 · 屋号 / 会社名（マスク可の公開名）
- 職種 · カテゴリ · 対応エリア（都道府県レベルまで）
- 稼働状況 · 評価 · 実績タグ · 概要文
- 条件検索 · フィルタ · お気に入り · カード一覧
- TASFUL TALK / 掲示板経由の **プラットフォーム内メッセージ**（1 通ごと課金 **しない**）

### 開示課金対象（Contact Reveal 後）

| 種別 | 例 |
| --- | --- |
| 電話 | 携帯 · 固定 · FAX（直接 dial 可能な番号） |
| メール | 個人 / 担当者メール |
| LINE | LINE ID · 公式アカウント URL（直接友だち/外部誘導） |
| 担当者 | フルネーム · 役職付き連絡窓口 |
| 住所 | 詳細住所（番地 · ビル名 · 現場住所） |
| Web | 会社 HP · 問い合わせフォーム URL（外部直接） |

### 再閲覧

- **同一 `user_id` × `target_type` × `target_id` で一度 `active` 開示済み → 再課金不要**
- `refunded` / `revoked` 時は再開示ポリシーを運用ルールで定義（初期: revoked 後は再購入必要）

---

## 4. 推奨価格（Draft）

**表示:** UI には **「Draft Pricing」** と明記（[AI_MEMBERSHIP_PRICING.md](./AI_MEMBERSHIP_PRICING.md) と同様）。

### Contact Reveal

| SKU | 価格（税込想定） | 備考 |
| --- | --- | --- |
| 単品 | **¥550 / 件** | 商品方針（2026-07）· `builder-billing-policy.js` |
| 5 件パック | **¥1,200** | ¥240/件相当 |
| 10 件パック | **¥2,000** | ¥200/件相当 |

### Builder AI サブスク

| プラン | 価格（税込想定） | 想定ユーザー |
| --- | --- | --- |
| **Builder Pro** | **¥1,480 / 月** | 個人事業主 · 現場監督 |
| **Builder Business** | **¥4,980 / 月** | 小規模工務店 · 複数現場 |

### サブスク特典（未確定）

| 案 | 状態 |
| --- | --- |
| Builder Pro に毎月 N 件の Contact Reveal 枠 | **未確定** |
| 初期リリース | **都度課金単体を優先** |
| 方針 | **長期サブスク前提にしない**（AI ツール価値と Contact Reveal を混ぜない） |

---

## 5. 実装方針（将来）

### データモデル（想定）

**テーブル:** `contact_reveals`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | 開示を購入したユーザー |
| `target_type` | enum | `worker` \| `partner` \| `job_owner` |
| `target_id` | text/uuid | 対象エンティティ ID |
| `payment_id` | text | Stripe PaymentIntent / Checkout Session 等 |
| `revealed_at` | timestamptz | 初回開示日時 |
| `expires_at` | timestamptz nullable | 将来の期限付き開示用（**初期は null = 無期限**） |
| `status` | enum | `active` \| `refunded` \| `revoked` |

**制約:**

```sql
UNIQUE (user_id, target_type, target_id)
```

**判定フロー:**

```text
開示リクエスト
  → contact_reveals に active 行あり? → 無料再表示
  → なし → Checkout（単品 or パック残数）→ INSERT active
  → 監査ログ · 返金は status=refunded
```

### API / フロント（Backlog）

| 層 | 内容 |
| --- | --- |
| Edge / RPC | `check_contact_reveal` · `record_contact_reveal` |
| RLS | 本人の reveal 行のみ read · service role で insert |
| UI | プロフィールに「連絡先を開示する（¥550）」CTA · 既開示バッジ · `builder-contact-reveal.js` |
| Payment | Stripe Checkout（TLV Payment Engine パターン流用可 · **Builder 専用 Product**） |

### 既存資産との関係

| 既存 | 本設計 |
| --- | --- |
| [BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md) P1 | 検索 Repository — **常に無料** |
| `builder-ai-live-gate.js` 等 | Builder AI entitlements — **Contact Reveal とは別 gate** |
| [AI_MEMBERSHIP_PRICING.md](./AI_MEMBERSHIP_PRICING.md) | TASFUL AI — **統合禁止** |
| TLV Payment Engine | 決済基盤参考可 · **商品定義は Builder 専用** |

---

## 6. 禁止事項

| # | 禁止 | 理由 |
| --- | --- | --- |
| 1 | **検索自体**を有料壁にしない | マッチング漏斗の入口を塞がない |
| 2 | **プロフィール閲覧**を有料壁にしない | 比較検討は無料 |
| 3 | **メッセージ 1 通ごと**の課金 | プラットフォーム内連絡は TALK 無料方針 |
| 4 | **サブスク加入必須**にしない | Contact Reveal は都度購入可能 |
| 5 | **AI Membership と統合**しない | AD-002 · レーン分離 |
| 6 | Builder AI 未加入で **検索不可**にしない | AI とマッチング課金の混線防止 |

---

## 7. 実装フェーズ（Backlog）

| Phase | 内容 | 依存 |
| --- | --- | --- |
| **M0** | 本設計確定 · Stripe Product SKU 定義 | — |
| **M1** | `contact_reveals` migration · RLS · RPC | Supabase |
| **M2** | Checkout + webhook · `payment_id` 紐付け | Stripe |
| **M3** | プロフィール UI · reveal CTA · 既開示表示 | Builder HTML（最小） |
| **M4** | Builder Pro / Business サブスク（AI entitlements） | 別 Product ライン |
| **M5** | パック残数 · 運営返金 / revoke ツール | admin |

**今回スコープ外:** DB migration · Payment 実装 · UI · Gateway — **設計のみ**

---

## 8. 関連ドキュメント

| ファイル | 内容 |
| --- | --- |
| [BUILDER_AI.md](./BUILDER_AI.md) | Builder AI 機能正本 |
| [BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md) | 条件検索（無料コア） |
| [AI_MEMBERSHIP_PRICING.md](./AI_MEMBERSHIP_PRICING.md) | TASFUL AI 料金（非統合） |
| [TLV_PAYMENT_ENGINE.md](../TLV_PAYMENT_ENGINE.md) | TLV 決済（参考 · 別レーン） |
| [reports/builder-monetization-design.md](../reports/builder-monetization-design.md) | 設計サマリレポート |

---

*Draft · Builder v1.0 RELEASE FROZEN — 実装は Backlog 承認後*
