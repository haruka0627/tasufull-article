# Business Directory MVP 設計

**最終更新:** 2026-06-27（Self-Service 投稿/編集設計）  
**前提 AD:** [DECISIONS.md](./DECISIONS.md) **AD-013**  
**方針正本:** [business-directory-subscription-model.md](./business-directory-subscription-model.md)  
**Self-Service:** [business-directory-self-service-design.md](./business-directory-self-service-design.md)  
**状態:** **Phase 4 Admin UI 実装済** — 公開検索 · Stripe 決済は **未着手**

---

## 1. 全体構造

### TASFUL 市場 TOP（4 区分）

```text
TASFUL市場
├ 商品マーケット   … 商品を買いたい
├ 店舗・販売       … 会社・店舗を探したい
├ 業務サービス     … 依頼先を探したい
└ 案件・仕事       … 仕事・人材を探したい
```

### 検索・一覧の原則

| 原則 | 内容 |
| --- | --- |
| **目的別分離** | 横断検索結果に商品 · 店舗 · 業務 · 案件を **混在させない** |
| **入口固定** | ユーザーは最初に **目的に合った区分** を選ぶ |
| **既存 HP 対応** | 公式サイト URL 登録のみで送客可 · HP なしは TASFUL 掲載ページを簡易 HP として利用 |

### Business Directory の位置づけ

**店舗・販売** と **業務サービス** の **掲載・発見** を担う。商品売買 · 案件マッチングは **含まない**（§9 参照）。

---

## 2. 掲載ページ仕様

公開ページは **metadata のみ** 掲載。決済 · 在庫 · 契約本文は MVP スコープ外。

### 2.1 店舗・販売ページ

| 項目 | MVP | プラン依存 |
| --- | --- | --- |
| 店舗名 | ✅ 必須 | — |
| 会社名 | ✅ 必須 | — |
| カテゴリ | ✅ 必須 | — |
| 住所 | ✅ 必須 | — |
| 対応地域 | ✅ | — |
| 営業時間 | Standard+ | Free は省略可 |
| 定休日 | Standard+ | Free は省略可 |
| 電話番号 | ✅ | — |
| 公式サイト URL | ✅ | Free 可 |
| SNS | Standard+ | — |
| 紹介文 | ✅ | 文字数上限 |
| 写真 | ✅ | Free: 少数 · Standard+: 複数 |
| 商品紹介 | Standard+ | テキスト + 画像（カート・Checkout なし） |
| 地図 | Standard+ | 住所から embed |
| TLV 動画 | Pro+ | 埋め込みのみ |
| 問い合わせ導線 | Pro+ | フォーム / TALK 導線（MVP は mailto / 外部 HP） |
| プラン種別 | 内部表示 | バッジは Pro で検討 |
| 掲載ステータス | 内部 | 公開時のみ一覧表示 |

**既存 HP あり:** 掲載ページは **最小情報 + 公式サイトへ送客** モードを選べる（TASFUL 内フルページは任意）。

### 2.2 業務サービスページ

| 項目 | MVP | プラン依存 |
| --- | --- | --- |
| 会社名 | ✅ 必須 | — |
| サービス名 | ✅ 必須 | — |
| カテゴリ | ✅ 必須 | — |
| 対応地域 | ✅ 必須 | — |
| 料金目安 | ✅ | テキスト（見積フォームは Premium/Future） |
| 実績 | Standard+ | テキスト |
| 施工写真 | Standard+ | — |
| スタッフ紹介 | Standard+ | 任意 |
| 公式サイト URL | ✅ | — |
| SNS | Standard+ | — |
| 紹介文 | ✅ | — |
| TLV 動画 | Pro+ | 施工事例 · 紹介動画 |
| 問い合わせ導線 | Pro+ | 同上 |
| プラン種別 | 内部 | — |
| 掲載ステータス | 内部 | — |

---

## 3. 登録フォーム · Self-Service

**正本:** [business-directory-self-service-design.md](./business-directory-self-service-design.md)

事業者が **自分で** 掲載を作成。運営は **入力代行しない**。

### 3.1 初回公開申請（最小 · 1〜2 分）

| 区分 | 項目数 |
| --- | --- |
| **共通** | 13（写真 **1 枚** · 紹介文 **短文** · SNS/TLV は含めない） |
| **店舗・販売 +2** | 営業時間 · 主な販売ジャンル |
| **業務サービス +2** | 主なサービス内容 · 料金目安 |

```text
会員登録 → サブスク選択 → 最小フォーム → 公開申請 → 運営審査 → 公開
```

### 3.2 公開後編集（事業者マイページ）

詳細項目は **公開後** に段階追加: 写真 · TLV · SNS · 商品/サービス · 実績 · スタッフ · 資格 · 問い合わせ等（プラン連動 · §4）。

### 3.3 旧・詳細フォーム項目（参考）

初回に含めない項目の一覧は Self-Service 正本 §公開後編集 を参照。DB `type_specific` jsonb に格納想定。

---

## 4. プラン別機能

| 機能 | Free | Standard | Pro | Premium / Future |
| --- | --- | --- | --- | --- |
| 基本情報掲載 | ✅ | ✅ | ✅ | ✅ |
| 写真 | 少数（≤3） | 複数 | 複数 | 複数 |
| 検索露出 | 低 | 通常 | **上位表示** | 広告枠 |
| 専用掲載ページ | 簡易 | ✅ フル | ✅ | ✅ |
| 営業時間 · 定休日 | — | ✅ | ✅ | ✅ |
| SNS | — | ✅ | ✅ | ✅ |
| 口コミ | — | ✅ 閲覧 | ✅ | ✅ |
| 公式サイト URL | ✅ | ✅ | ✅ | ✅ |
| TLV 動画 | — | — | ✅ | ✅ |
| 問い合わせ導線 | 外部 URL のみ | 外部 | TASFUL 内 | TASFUL 内 + チャット |
| アクセス解析 | — | — | ✅ | ✅ |
| AI 紹介対象 | — | — | ✅ | ✅ |
| 複数店舗管理 | — | — | — | ✅ |
| 広告枠 | — | — | — | ✅ |
| 予約 · 見積 · チャット · Connect | — | — | — | ✅ |
| 成果報酬オプション | — | — | — | ✅（月額 + 成果報酬） |

**MVP:** プランは **申込・表示のみ**。Stripe サブスク課金は **別 Epic**。

---

## 5. 管理画面設計（運営）

**対象:** 運営（AI 秘書 OPS とは独立 · 将来連携可）  
**Self-Service 原則:** 運営は **掲載内容の入力代行をしない**（[business-directory-self-service-design.md](./business-directory-self-service-design.md) §運営の役割）

| 機能 | MVP | 備考 |
| --- | --- | --- |
| 掲載申請一覧 | ✅ | `pending_review` フィルタ |
| 審査（承認 / 差戻し） | ✅ | 差戻し理由テンプレ · 事業者が修正 |
| 公開 / 非公開 | ✅ | `published` ↔ `suspended` |
| プラン確認 | ✅ 手動 | 将来 Stripe 連動 |
| 通報 / 不正確認 | ✅ | `business_directory_reports` |
| 規約違反 · 凍結 / 停止 | ✅ | 強制非公開 · 監査ログ（将来） |
| 契約ステータス確認 | 📋 表示のみ | MVP は決済なし |

**運営が行わないこと:** 文案代筆 · 写真代アップロード · フォーム入力代行（規約違反時の強制対応を除く）。

**運営による掲載情報の代行編集:** 原則禁止 · 例外は規約違反対応のみ。

### 将来 Stripe 接続（設計のみ）

```text
business_directory_profiles.stripe_customer_id     (nullable)
business_directory_profiles.stripe_subscription_id (nullable)
business_directory_plans.stripe_price_id           (nullable)
```

MVP では **NULL 許容 · UI 非表示** でスキーマ余地のみ。

---

## 6. DB 設計案（migration 禁止 · 設計のみ）

**正本:** [business-directory-data-model-design.md](./business-directory-data-model-design.md)

MVP 段階の概要テーブルは data model 正本に統合。以下は **参照用サマリー**。

### 6.1 テーブル（10）

`listings` · `profiles` · `categories` · `photos` · `business_hours` · `social_links` · `tlv_videos` · `plan_features` · `review_requests` · `audit_logs`

### 6.2 掲載ステータス

| status | 意味 |
| --- | --- |
| `draft` | 下書き |
| `review_requested` | 審査待ち（旧称 `pending_review`） |
| `published` | 公開中 |
| `suspended` | 停止 |
| `archived` | 退会 |

詳細遷移図 · RLS · プラン制御 → data model 正本 §4–§8。

### 6.3 既存テーブルとの関係

| 既存 | 関係 |
| --- | --- |
| `listings` / `business_listings` | **別系統** — MVP は新テーブル群。移行は別 Epic |
| `shop-store-page.js` 等 | 将来 Business Directory へ段階置換 |

---

## 7. 検索 / フィルター

### MVP

| 条件 | 適用 |
| --- | --- |
| キーワード | 店舗名 · 会社名 · 紹介文 · サービス内容 |
| カテゴリ | ツリー 1 選択 |
| 地域 | 都道府県 · 市区町村 |
| 掲載種別 | `shop_retail` / `business_service` **必須スコープ** |
| プラン | Pro 優先表示（同一条件内） |

**混在禁止:** 商品マーケット · 案件検索 API とは **別エンドポイント**。

### 将来

口コミ順 · おすすめ順 · 動画あり · 営業中 · AI おすすめ

---

## 8. TLV 連携（設計のみ）

| 用途 | 掲載先 | MVP |
| --- | --- | --- |
| 店舗紹介動画 | 店舗・販売ページ | Pro+ · embed |
| 施工事例動画 | 業務サービスページ | Pro+ · embed |
| 商品紹介動画 | 店舗・販売（商品紹介セクション） | Pro+ · embed |

**方式:** `tlv_video_ids` → 既存 TLV プレイヤー embed URL（**TLV 側の新 API は今回不要**）。

**禁止:** TLV から Marketplace Checkout や Platform 案件へ直リンク混在。

---

## 9. Marketplace / Platform との境界

| 領域 | 役割 | 収益 | Business Directory との関係 |
| --- | --- | --- | --- |
| **Business Directory** | 店舗 · 会社 · 業務サービスの **掲載・発見** | 月額サブスク掲載料 | **本設計の対象** |
| **Marketplace** | **商品売買** | **成約手数料** | 商品出品フォーム · Checkout · 在庫は **含めない** |
| **Platform** | **案件 · 求人 · ワーカー · スキル** | **成約手数料** | 求人 · 応募 · Connect deal は **含めない** |

### 混在禁止（MVP）

- Business Directory 登録フォームに **商品販売フォーム** を置かない
- Business Directory 登録フォームに **求人 / 案件フォーム** を置かない
- 店舗ページから商品購入は **公式 HP 送客** または **別途 Marketplace 出品**（リンクのみ）

**Marketplace / Platform の成約手数料方針は AD-013 どおり変更しない。**

---

## 10. MVP スコープ外

| 項目 | 扱い |
| --- | --- |
| コード変更 | ❌ 本フェーズ |
| DB migration | ❌ 設計案のみ |
| UI 実装 | ❌ |
| Stripe / 決済 | ❌ 列余地のみ |
| Builder AI / TASFUL AI / AI 秘書 | ❌ 変更なし |

---

## 11. 実装フェーズ案（参考 · 未確定）

| Phase | 内容 |
| --- | --- |
| **MVP-1** | Self-Service 初回申請 · 審査 · 公開ページ · 検索（Free/Standard） |
| **MVP-2** | 公開後編集マイページ · Pro（TLV · 問い合わせ） |
| **MVP-3** | Stripe サブスク · プラン自動反映 |
| **Future** | Premium · Connect · 成果報酬 |

---

## 参照

- [DECISIONS.md](./DECISIONS.md) AD-013
- [business-directory-self-service-design.md](./business-directory-self-service-design.md)
- [business-directory-data-model-design.md](./business-directory-data-model-design.md)
- [business-directory-ui-flow-design.md](./business-directory-ui-flow-design.md)
- [reports/business-directory-mvp-design.md](../reports/business-directory-mvp-design.md)
- [reports/business-directory-self-service-design.md](../reports/business-directory-self-service-design.md)
