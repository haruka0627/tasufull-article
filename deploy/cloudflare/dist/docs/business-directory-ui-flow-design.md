# Business Directory — Owner / Admin UI Flow 設計

**最終更新:** 2026-06-27  
**前提 AD:** [DECISIONS.md](./DECISIONS.md) **AD-013**  
**関連:** [business-directory-subscription-model.md](./business-directory-subscription-model.md) · [business-directory-mvp-design.md](./business-directory-mvp-design.md) · [business-directory-self-service-design.md](./business-directory-self-service-design.md) · [business-directory-data-model-design.md](./business-directory-data-model-design.md)  
**状態:** **Phase 6 Stripe 連携実装済** — Premium / 予約 / 決済代行 **未着手**

---

## 1. 設計目的

MVP 実装前に **事業者 UI · 運営 UI · 公開フロー** の画面構成 · 状態遷移 · 操作権限 · プラン制限表示を正本化する。

| 原則 | 内容 |
| --- | --- |
| **Self-Service** | 事業者が作成・編集 · 運営は審査のみ（**入力代行しない**） |
| **初回最小** | 専用ウィザード 1 画面 · 1〜2 分 |
| **公開後拡張** | タブ型編集 · プランで機能ゲート |
| **状態同期** | UI は `listings.status` + `review_requests` を正とする |
| **Marketplace / Platform** | 本 UI に商品出品 · 求人フォームを **含めない** |

---

## 2. 画面マップ（全体）

```text
【事業者】
  /business-directory/              … ダッシュボード
  /business-directory/new           … 新規掲載（種別選択 → 最小フォーム）
  /business-directory/listings      … 掲載一覧
  /business-directory/listings/:id  … 編集（タブ）
  /business-directory/listings/:id/preview … プレビュー
  /business-directory/listings/:id/submit    … 公開申請確認
  /business-directory/listings/:id/review-result … 審査結果
  /business-directory/plan          … プラン確認・変更申込（MVP: 申込のみ）

【運営】
  /admin/business-directory/reviews     … 審査キュー
  /admin/business-directory/listings/:id … 掲載詳細（読取中心）
  /admin/business-directory/reports     … 通報（MVP外）
  /admin/business-directory/audit       … 監査ログ

【公開】
  /shop-directory/:slug             … 店舗・販売 公開ページ
  /service-directory/:slug          … 業務サービス 公開ページ
```

URL は実装時に既存 `shop-store.html` 等と整合。本 doc は **論理パス**。

---

## 3. 事業者側 UI

### 3.1 Business Directory ダッシュボード

| 項目 | 内容 |
| --- | --- |
| **目的** | 掲載状況の一覧 · 次アクション提示 |
| **表示** | 掲載カード（名称 · 種別 · status バッジ · プラン · 最終更新） |
| **CTA** | 新規掲載 · 編集 · プレビュー · 公開申請（draft 時） |
| **空状態** | 「掲載を作成」→ `/new` |
| **権限** | `owner_user_id` のみ |
| **MVP** | ✅ |

**status バッジ:** draft · 審査中 · 公開中 · 停止 · 退会

---

### 3.2 新規掲載作成

| ステップ | 画面 | MVP |
| --- | --- | --- |
| 1 | 掲載種別選択（店舗 / 業務） | ✅ |
| 2 | 希望プラン選択（Free / Standard / Pro） | ✅ |
| 3 | 初回最小フォーム（§3.3） | ✅ |
| 4 | 下書き保存 → `draft` | ✅ |

Premium 複数店舗は **MVP 外**。

---

### 3.3 初回最小フォーム

**1 画面 · スクロール可 · 1〜2 分。**

| ブロック | 項目 | テーブル |
| --- | --- | --- |
| 基本 | 名称 · 会社名 · 担当 · メール · 電話 | profiles + listings |
| 所在地 | 都道府県 · 市区 · 番地 · 対応地域 | profiles · listings |
| 分類 | カテゴリ · 種別 +2 | listings · profiles |
| 任意 | 公式 URL · 短文紹介 | listings · profiles |
| メディア | 写真 1 枚 | photos |
| 同意 | 利用規約 | profiles.terms_accepted_at |

**店舗 +2:** 営業時間（テキスト）· 販売ジャンル  
**業務 +2:** サービス内容 · 料金目安

**保存:** 「下書き保存」→ ダッシュボード  
**次:** 「内容を確認」→ プレビュー or 公開申請画面

---

### 3.4 掲載一覧

| 列 | 内容 |
| --- | --- |
| 名称 | display_name |
| 種別 | shop_retail / business_service |
| ステータス | §4 連動バッジ |
| プラン | plan_code |
| 更新日 | updated_at |
| 操作 | 編集 · プレビュー · 公開申請 / 審査結果 |

MVP: 1 owner = **1 掲載** 想定（Premium 複数は将来）。

---

### 3.5 掲載編集画面（タブ型）

ヘッダ: 名称 · status · プラン · 「プレビュー」「公開申請」CTA

タブ詳細 → **§5**

| status | 編集可否 |
| --- | --- |
| `draft` | 全タブ編集可 |
| `review_requested` | **読取のみ** + 審査結果待ち表示 |
| `published` | タブ編集可 · 主要変更で再審査 |
| `suspended` | **読取のみ** + 停止理由表示 |
| `archived` | 読取のみ |

---

### 3.6 プレビュー画面

| 項目 | 内容 |
| --- | --- |
| **表示** | 公開ページと同一レイアウト（未公開 watermark） |
| **hp_mode** | `external_redirect` → 送客 CTA プレビュー · `full_page` → フルページ |
| **遷移** | 編集各タブ · 公開申請画面 |
| **MVP** | ✅ |

---

### 3.7 公開申請画面

| 項目 | 内容 |
| --- | --- |
| **前提** | status = `draft` or 主要変更後 |
| **表示** | 申請サマリー · プラン · チェックリスト（必須項目 OK） |
| **操作** | 「公開を申請する」→ `review_requested` + review_requests |
| **確認文言** | 審査 1〜3 営業日 · 差戻し時は通知 |
| **MVP** | ✅ |

---

### 3.8 審査結果表示

| 結果 | UI |
| --- | --- |
| **承認** | 成功バナー · 公開 URL · 編集タブへ |
| **差戻し** | 理由コード + 自由文 · 「修正して再申請」→ draft 編集 |
| **審査中** | 待機状態 · 編集ロック |

データ: `review_requests.status` · `reject_reason_*`

---

### 3.9 プラン変更導線

| 項目 | MVP | 将来 |
| --- | --- | --- |
| 現在プラン表示 | ✅ | Stripe 連動 |
| アップグレード | ✅ Checkout（Standard / Pro） | Premium |
| Billing Portal | ✅ 解約 · 支払い方法 | — |
| ダウングレード | ✅ 解約後 free 降格 | 自動 proration |
| 機能ロック表示 | ✅ effectivePlanCode | — |

**Phase 6:** Owner 編集画面から Stripe Checkout · Billing Portal。新規作成は Free 固定。

---

## 4. 公開フロー（画面 × 状態）

### 4.1 状態一覧

| status | 事業者が見るラベル | 公開ページ |
| --- | --- | --- |
| `draft` | 下書き | 非表示 |
| `review_requested` | 審査中 | 非表示 |
| `published` | 公開中 | 表示 |
| `suspended` | 停止 | 非表示 |
| `archived` | 退会済 | 非表示 |

### 4.2 画面遷移図

```text
[ダッシュボード]
      │
      ├─ 新規 ─► [種別] ─► [最小フォーム] ─► draft
      │                              │
      │                              ▼
      │                        [プレビュー]
      │                              │
      │                              ▼
      │                      [公開申請確認]
      │                              │
      │                              ▼
      │                    review_requested ◄──┐
      │                              │          │ 主要変更
      │                    ┌─────────┴─────────┤
      │                    ▼                   │
      │              [審査結果待ち]            │
      │                    │                   │
      │         差戻し     │     承認          │
      │            ▼       │       ▼           │
      │         draft      │   published ──────┘
      │                    │
      │              [編集タブ] ──► [プレビュー]
      │
      └─ 停止時: suspended（編集ロック · 理由表示）
                      └─ archived（終了）
```

### 4.3 運営操作との対応

| 運営操作 | listings.status | 事業者 UI |
| --- | --- | --- |
| 承認 | → `published` | 審査結果 · 公開 URL |
| 差戻し | → `draft` | 差戻し理由 · 再編集 |
| 停止 | → `suspended` | 停止バナー |
| 再公開 | → `published` | 復帰通知 |
| 退会処理 | → `archived` | 読取専用 |

---

## 5. 編集タブ UI

凡例: **MVP** = ✅ 対象 · **外** = 将来 · ゲート = プラン不足時アップセル表示

### 5.1 基本情報

| 項目 | 表示 | 編集 | テーブル | Free | Std | Pro | Prem | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 掲載種別 | ✅ | 作成時のみ | listings | ✅ | ✅ | ✅ | ✅ | ✅ |
| 名称 | ✅ | ✅ | listings | ✅ | ✅ | ✅ | ✅ | ✅ |
| 会社名 | ✅ | ✅ | profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| 担当 · 連絡先 | ✅ | ✅ | profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| 住所 | ✅ | ✅ | profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| 対応地域 | ✅ | ✅ | listings | ✅ | ✅ | ✅ | ✅ | ✅ |
| カテゴリ | ✅ | ✅ | listings | ✅ | ✅ | ✅ | ✅ | ✅ |
| 短文紹介 | ✅ | ✅ | profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| 詳細紹介 | ✅ | ✅ | profiles.full_description | 🔒 | ✅ | ✅ | ✅ | ✅ |
| 公式 URL | ✅ | ✅ | listings | ✅ | ✅ | ✅ | ✅ | ✅ |
| hp_mode | ✅ | ✅ | listings | ✅ | ✅ | ✅ | ✅ | ✅ |
| 店舗: 販売ジャンル | ✅ | ✅ | profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| 業務: 料金目安 | ✅ | ✅ | profiles | ✅ | ✅ | ✅ | ✅ | ✅ |

**再審査トリガ（MVP）:** 名称 · カテゴリ · 住所 · 公式 URL 変更

---

### 5.2 写真

| 項目 | テーブル | Free | Std | Pro | Prem | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| 代表写真 1 枚 | photos | ✅ max1 | ✅ | ✅ | ✅ | ✅ |
| ギャラリー追加 | photos | 🔒 | ✅ max10 | ✅ max20 | ✅ | ✅ |
| 並替 · 削除 | photos | 1枚のみ | ✅ | ✅ | ✅ | ✅ |
| 商品/施工サムネ | photos.kind | 🔒 | ✅ | ✅ | ✅ | 外（商品タブと連動） |

---

### 5.3 TLV

| 項目 | テーブル | Free | Std | Pro | Prem | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| TLV 動画選択 | tlv_videos | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| 用途タグ | tlv_videos.purpose | — | — | ✅ | ✅ | ✅ |
| embed プレビュー | — | — | — | ✅ | ✅ | ✅ |

---

### 5.4 SNS

| 項目 | テーブル | Free | Std | Pro | Prem | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| SNS URL 追加 | social_links | 🔒 | ✅ | ✅ | ✅ | ✅ |
| プラットフォーム選択 | social_links | — | ✅ | ✅ | ✅ | ✅ |

---

### 5.5 営業時間

| 項目 | テーブル | Free | Std | Pro | Prem | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| テキスト（初回） | profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| 曜日別入力 | business_hours | 🔒 | ✅ | ✅ | ✅ | ✅ |
| 定休日 | business_hours | 🔒 | ✅ | ✅ | ✅ | ✅ |

---

### 5.6 商品 / サービス

**店舗 → 商品紹介 · 業務 → サービス詳細**（種別でタブラベル切替）

| 項目 | テーブル | Free | Std | Pro | Prem | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| 店舗: 主な商品文 | profiles.shop_main_products | 🔒 | ✅ | ✅ | ✅ | ✅ |
| 店舗: 商品画像 | photos.product | 🔒 | ✅ | ✅ | ✅ | ✅ |
| 業務: サービス詳細 | profiles.full_description | 🔒 | ✅ | ✅ | ✅ | ✅ |
| 業務: スタッフ | profiles.staff_intro_text | 🔒 | ✅ | ✅ | ✅ | 外 |
| 業務: 資格 | profiles.licenses_text | 🔒 | ✅ | ✅ | ✅ | 外 |
| 問い合わせ導線 | profiles.contact_* | 外部URL | 外部 | フォーム | +チャット | Pro=外部/フォーム |

**禁止:** カート · Checkout · 在庫（Marketplace 領域）

---

### 5.7 実績

| 項目 | テーブル | 種別 | Free | Std | Pro | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| 実績テキスト | profiles.achievements_text | 業務 | 🔒 | ✅ | ✅ | ✅ |
| 施工写真 | photos.work_sample | 業務 | 🔒 | ✅ | ✅ | ✅ |

店舗掲載ではタブ非表示 or 「準備中」。

---

### 5.8 プレビュー

| 項目 | MVP |
| --- | --- |
| 公開ページ同等表示 | ✅ |
| デバイス幅切替（390/768/1280） | 外 |
| 未公開 watermark | ✅ |

---

### 5.9 公開設定

| 項目 | 操作 | テーブル | MVP |
| --- | --- | --- | --- |
| 現在ステータス | 表示 | listings | ✅ |
| 公開申請 | draft → review_requested | review_requests | ✅ |
| 再審査申請 | published + 変更 → review_requested | review_requests | ✅ |
| プラン表示 | 表示 · 変更申込 | listings · plan | ✅ |
| 自主退会申請 | → archived 申請 | 外 | 外 |
| 一時非公開 | 事業者申請 → 運営確認 | 外 | 外 |

---

## 6. 運営側 UI

**原則: 入力代行しない。** フォームは **読取 + 判定ボタン** のみ。

### 6.1 審査キュー

| 項目 | 内容 |
| --- | --- |
| **一覧** | 申請日 · 種別 · 名称 · プラン · request_type |
| **フィルタ** | open · initial_publish · content_update |
| **ソート** | 申請日 ASC |
| **操作** | 詳細へ · 一括は MVP 外 |
| **MVP** | ✅ |

---

### 6.2 掲載詳細確認

| ブロック | 内容 |
| --- | --- |
| スナップショット | review_requests.snapshot_json vs 現行 |
| プロフィール | 読取表示（**編集フィールドなし**） |
| 写真 | ギャラリー閲覧 |
| 履歴 | audit_logs 直近 |
| プラン | plan_code · 機能一覧 |

**禁止:** 事業者データの直接編集フォーム（違反時は停止のみ · 将来 force_edit は監査必須）

---

### 6.3 承認

| 操作 | 効果 |
| --- | --- |
| 「公開を承認」 | review_requests.approved · listings → `published` · audit |
| 通知 | 事業者メール / アプリ内 |

---

### 6.4 差戻し

| 操作 | 効果 |
| --- | --- |
| 理由選択 | reject_reason_code テンプレ |
| 自由記述 | reject_reason_note |
| 「差し戻す」 | review_requests.rejected · listings → `draft` |

---

### 6.5 停止 / 再公開

| 操作 | listings.status | 事業者 |
| --- | --- | --- |
| 停止 | `suspended` | 編集ロック + 理由 |
| 再公開 | `published` | 復帰通知 |
| 退会 | `archived` | 終了 |

---

### 6.6 通報確認

| 項目 | MVP |
| --- | --- |
| 通報一覧 | 外 |
| 停止連携 | 外 |

設計余地: `business_directory_reports`（data model §10）

---

### 6.7 監査ログ確認

| 項目 | 内容 |
| --- | --- |
| 一覧 | listing_id · action · actor · 日時 |
| フィルタ | action · 期間 |
| 詳細 | metadata json |
| **MVP** | ✅（一覧のみ） |

---

### 6.8 プラン確認

| 項目 | MVP |
| --- | --- |
| 現在プラン表示 | ✅ |
| 手動変更 | ✅ ops のみ |
| Stripe 状態 | 外 |

---

## 7. 操作権限マトリクス

| 操作 | owner | anon | ops |
| --- | --- | --- | --- |
| ダッシュボード閲覧 | ✅ own | ❌ | ✅ all |
| draft 編集 | ✅ | ❌ | 👁️ |
| 公開申請 | ✅ | ❌ | ❌ |
| 公開ページ閲覧 | ✅ preview | ✅ published | ✅ |
| 審査 approve/reject | ❌ | ❌ | ✅ |
| 停止/再公開 | ❌ | ❌ | ✅ |
| audit 閲覧 | ❌ | ❌ | ✅ |

---

## 8. プラン制限 UI パターン

| パターン | 表示 |
| --- | --- |
| **タブロック** | 🔒 + 「Standard で利用可能」+ アップグレード CTA |
| **上限到達** | 「写真はあと N 枚まで（Pro で 20 枚）」 |
| **機能 tease** | TLV タブ: サムネ placeholder + Pro CTA |
| **MVP** | 静的コピー · Stripe 決済なし |

---

## 9. Marketplace / Platform 境界（UI）

| UI に含めない | 代替 |
| --- | --- |
| 商品出品フォーム | Marketplace へのリンク |
| 求人 · 案件投稿 | Platform へのリンク |
| Checkout · Connect | Premium 将来 · 現 MVP 外 |

---

## 10. MVP スコープサマリー

| 領域 | MVP ✅ | MVP 外 |
| --- | --- | --- |
| 事業者 | ダッシュボード · 新規 · 最小フォーム · 一覧 · タブ編集（§5 主要） · プレビュー · 申請 · 審査結果 · プラン表示 | Premium 複数店 · Stripe · 自主退会 |
| 運営 | 審査キュー · 詳細 · 承認/差戻し · 停止/再公開 · audit · プラン手動 | 通報 · force_edit |
| 公開 | 店舗/業務 公開ページ · hp_mode | アクセス解析 · AI おすすめ |

---

## 参照

- [business-directory-data-model-design.md](./business-directory-data-model-design.md)
- [reports/business-directory-ui-flow-design.md](../reports/business-directory-ui-flow-design.md)
