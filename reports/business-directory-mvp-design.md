# Business Directory MVP 設計 — 報告

**日付:** 2026-06-27  
**種別:** docs のみ（コード · DB · UI · 決済変更なし）  
**前提:** AD-013 · `docs/business-directory-subscription-model.md`

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `docs/business-directory-mvp-design.md` | **新規** MVP 設計正本 |
| `reports/business-directory-mvp-design.md` | 本報告 |
| `docs/ROADMAP.md` | MVP 設計完了追記 |
| `docs/TODO.md` | 次フェーズ参照追記 |
| `docs/README.md` | 索引更新 |
| `docs/DECISIONS.md` | AD-013 根拠リンク追記のみ |

---

## 設計サマリー

### 1. 全体構造

TASFUL 市場を **商品 / 店舗 / 業務 / 案件** の 4 区分に整理。検索結果は目的別に分離。

### 2. 掲載ページ

- **店舗・販売:** 17 項目（プラン別表示制御）
- **業務サービス:** 15 項目（同上）
- 既存 HP → URL 送客 · HP なし → TASFUL ページを簡易 HP

### 3. 登録フォーム

- **共通 14 項目** + 種別専用（店舗 +4 / 業務 +5）
- **1 ステップ** · 必須最小化

### 4. プラン

Free · Standard · Pro · Premium/Future — 機能マトリクス定義。MVP は申込のみ（課金なし）。

### 5. 管理画面

申請一覧 · 審査 · 公開/非公開 · プラン変更 · 編集 · 写真 · 通報 · 契約ステータス（Stripe 列は将来予約）。

### 6. DB 案（設計のみ）

6 テーブル + status 5 種（`draft` · `pending_review` · `published` · `suspended` · `archived`）。

### 7. 検索

MVP: キーワード · カテゴリ · 地域 · 掲載種別 · プラン。

### 8. TLV

Pro+ で embed（店舗紹介 · 施工事例 · 商品紹介）。TLV 実装は別 Epic。

### 9. 境界

| 領域 | 役割 | 収益 |
| --- | --- | --- |
| Business Directory | 掲載・発見 | サブスク |
| Marketplace | 商品売買 | **成約手数料 維持** |
| Platform | 案件・求人 | **成約手数料 維持** |

---

## 確認チェックリスト

| 項目 | 結果 |
| --- | --- |
| 変更が docs / reports のみ | ✅ |
| AD-013 と矛盾なし | ✅ |
| Marketplace 成約手数料維持 | ✅ |
| Platform 成約手数料維持 | ✅ |
| フォームシンプル化 | ✅ 1 ステップ · 共通+種別追加 |
| サブスク掲載モデル | ✅ |
| コード変更なし | ✅ |
| 新 Decision なし | ✅ AD-013 参照追記のみ |

---

## 次フェーズ（未着手）

MVP-1 実装: 登録 · 審査 · 公開ページ · 検索 — DB migration · UI は別 Epic。
