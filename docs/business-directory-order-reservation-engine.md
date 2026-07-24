# Order / Reservation Engine（Future 仕様）

**最終更新:** 2026-07-04  
**状態:** **Future · 設計のみ** — 実装 · DB · Migration · API · Edge · Stripe · Supabase 変更 **禁止（本条目時点）**  
**TODO:** [TODO.md](./TODO.md) **REL-F-14** / **CAND-ORDER-RESERVATION-01**  
**ロードマップ:** [ROADMAP.md](./ROADMAP.md) §Order / Reservation Engine

---

## 1. 目的

Business Directory の **掲載料は無料** とし、TASFUL 経由で発生した **注文 · 予約 · 決済** のみ手数料をいただく **成果報酬モデル** を将来導入する。

| 区分 | 扱い |
| --- | --- |
| **掲載** | **無料**（基本掲載料なし） |
| **収益対象** | TASFUL 経由の注文 · 予約 · 決済のみ |
| **対象外** | 店頭決済 · 電話注文 · 他サービス経由の取引 |

**現行 AD-013（月額サブスク掲載）との関係:** 本仕様は **Future 収益モデルの拡張候補**。現行 MVP（Free / Standard / Pro サブスク）を即時廃止するものではない。着手時は **ADR（AD-013 追補または後継）** で現行プランとの移行方針を確定する。

---

## 2. Business Model（Future）

### 2.1 掲載料

| 項目 | 方針 |
| --- | --- |
| **掲載料** | **無料** |

### 2.2 収益

| 収益源 | 説明 |
| --- | --- |
| **TASFUL 経由注文手数料** | Order Engine 経由の商品 · サービス注文のみ |
| **TASFUL 経由予約手数料** | Reservation Engine 経由の予約のみ |
| **Premium（月額）** | 追加露出 · 機能パック等（詳細は着手時 Draft） |
| **スポンサー掲載** | 共通スポンサー広告システム（[SPONSOR_ADS.md](./SPONSOR_ADS.md) · REL-F-13）と整合 |

### 2.3 対象外（手数料対象にしない）

| 経路 | 扱い |
| --- | --- |
| **店頭決済** | 対象外 |
| **電話注文** | 対象外 |
| **他サービス経由** | 対象外（外部 HP · 外部予約台 · 外部 EC 等） |

**原則:** **TASFUL 経由のみ** が成果報酬の対象。計測不能なオフプラットフォーム取引は課金しない。

---

## 3. 対象業種

掲載・注文・予約の利用想定業種（例示 · カテゴリマスタは着手時に確定）:

| 業種 |
| --- |
| 飲食店 |
| 美容室 |
| 整体 |
| サロン |
| 小売 |
| 便利屋 |
| 工事 |
| 修理 |
| 代行 |
| 士業 |
| その他サービス |

店舗・販売（`shop_retail`）と業務サービス（`business_service`）の両方を想定する。

---

## 4. Future 機能フェーズ

**実装禁止。** 以下は着手順の設計メモのみ。

### Phase 1 — 予約

| 機能 | 内容 |
| --- | --- |
| 予約 | 掲載ページからの予約受付 |
| 日時選択 | カレンダー / スロット選択 |
| 予約履歴 | 事業者 · 利用者双方の履歴閲覧 |

### Phase 2 — 注文

| 機能 | 内容 |
| --- | --- |
| 商品注文 | 小売 · 飲食等の商品ライン |
| サービス注文 | 工事 · 修理 · 代行 · 士業等のサービスライン |
| カート | 複数明細の一時保持 · 確定前編集 |

### Phase 3 — 決済 · 注文管理

| 機能 | 内容 |
| --- | --- |
| Stripe 決済 | TASFUL 経由決済のみ（店頭・電話は対象外） |
| 注文管理 | 事業者向け注文一覧 · 詳細 |
| 注文ステータス | 受付 · 準備中 · 完了 · キャンセル等（着手時に確定） |

### Phase 4 — 手数料 · 売上 · 支払

| 機能 | 内容 |
| --- | --- |
| 自動手数料計算 | TASFUL 経由取引のみ自動計算 |
| 店舗売上 | 事業者向け売上サマリー |
| 支払管理 | 店舗への支払（payout）運用 |

---

## 5. DB 構想（Future · 仕様のみ）

**Migration 作成禁止 · テーブル作成禁止。** 論理エンティティのメモのみ。

| 論理テーブル | 役割（構想） |
| --- | --- |
| **orders** | 注文ヘッダ（掲載 · 利用者 · ステータス · 経路フラグ `source=tasful` 等） |
| **order_items** | 注文明細（商品 / サービス · 数量 · 単価） |
| **reservations** | 予約（日時 · 枠 · ステータス · 掲載紐付け） |
| **payments** | 決済記録（Stripe 等 · TASFUL 経由のみ） |
| **vendor_payouts** | 店舗への支払・精算 |

### 設計メモ（着手時）

- **経路必須:** 手数料対象は `source = tasful`（名称は着手時確定）のみ。店頭・電話・外部は記録しても課金対象外、または記録しない。
- **掲載紐付け:** Business Directory listing（および将来の Builder / Platform 主体）への FK 方針は共通エンジン設計で確定。
- **既存 BD スキーマ:** 現行 `business_directory_*` 表とは **別レーン**。着手時に schema 名・RLS・idempotency を設計する。
- **Payment Engine:** [payment-engine-architecture.md](./architecture/payment-engine-architecture.md) との境界（Wallet / Ledger / Stripe）は着手時に reconcile。TLV 決済レーンとは混在禁止。

---

## 6. 共通化前提（必須）

本 **Order / Reservation Engine** は、将来 **複数製品で共通利用** する前提とする。

| 製品 | 利用イメージ |
| --- | --- |
| **Business Directory** | 店舗 · 業務サービスの予約 · 注文 · TASFUL 経由決済 |
| **Builder** | 建設・業者まわりの予約 · サービス注文（着手時にスコープ確定） |
| **Platform** | 案件・サービス導線からの注文 · 予約（着手時にスコープ確定） |

### 共通化ルール（設計方針）

| 方針 | 内容 |
| --- | --- |
| **単一エンジン** | 注文 · 予約 · 決済 · 手数料 · payout のコアは製品横断で共有 |
| **製品アダプタ** | 掲載主体・UI・カテゴリは製品別。コア契約は共通 |
| **収益レーン分離** | Marketplace 成約手数料 · Platform 案件手数料 · TLV Wallet とは **混在禁止**（既存方針維持） |
| **計測境界** | 手数料は **TASFUL 経由トランザクションのみ** |

製品固有の UI やカテゴリを理由に、エンジンを製品ごとに複製しない。

---

## 7. 境界 · 禁止事項（現時点）

| 禁止 | 理由 |
| --- | --- |
| DB / Migration / テーブル作成 | Future 仕様のみ |
| API / Edge / Stripe 実装 | Future 仕様のみ |
| Supabase 変更 | Future 仕様のみ |
| コード実装（UI · JS · Functions） | Future 仕様のみ |
| 店頭 · 電話 · 他サービス経由への課金 | ビジネスモデル上対象外 |
| Marketplace Checkout / Platform deal / TLV Wallet との統合実装 | 別レーン · 着手時に境界 ADR |

---

## 8. 関連ドキュメント

| ドキュメント | 関係 |
| --- | --- |
| [business-directory-subscription-model.md](./business-directory-subscription-model.md) | 現行 AD-013 サブスク · Future 収益追記 |
| [business-directory-mvp-design.md](./business-directory-mvp-design.md) | MVP 境界 · Future 予約/注文は本仕様へ |
| [architecture/business-directory-architecture.md](./architecture/business-directory-architecture.md) | BD 製品境界 |
| [architecture/payment-engine-architecture.md](./architecture/payment-engine-architecture.md) | 決済レーン全体 |
| [SPONSOR_ADS.md](./SPONSOR_ADS.md) | スポンサー掲載（別収益レーン · REL-F-13） |
| [DECISIONS.md](./DECISIONS.md) **AD-013** | 現行掲載サブスク方針 |
| [future/tasful-safety.md](./future/tasful-safety.md) | **独立 Future** · TASFUL Safety（本 Engine とは統合しない） |

---

## 9. 着手条件（メモ）

1. Business Directory Commercial Launch 安定後（または明示的な Priority 変更）
2. AD-013 との移行方針を ADR で確定（掲載無料化 · Premium · 既存プラン）
3. Payment Engine / Stripe Connect（または同等）方針の reconcile
4. Builder / Platform 共通契約の最小インターフェース合意

**それまでは docs 更新のみ。実装タスクを Release P0 / P1 に昇格しない。**

---

## Future: TASFUL Safety

TASFUL Safety は、Business Directory / Order Reservation Engine とは **独立した将来構想サービス**です。

電話ではなく、利用者がスマホでワンタップするだけで家族・支援者へ安否状態を通知する見守り補助サービスとして設計します。

**詳細仕様:** [docs/future/tasful-safety.md](./future/tasful-safety.md)

**注意:** この仕様は Business Directory の注文・予約・決済 Engine には **統合しない**。独立サービスとして管理する。  
実装・DB・Edge・UI・決済には着手しない（Future のみ）。
