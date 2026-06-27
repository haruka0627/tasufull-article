# Business Directory DB / Data Model 設計 — 報告

**日付:** 2026-06-27  
**種別:** docs のみ（migration · コード · UI · 決済変更なし）  
**前提:** AD-013 · Self-Service `8ee30f2`

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `docs/business-directory-data-model-design.md` | **新規** data model 正本 |
| `reports/business-directory-data-model-design.md` | 本報告 |
| `docs/ROADMAP.md` / `TODO.md` / `README.md` | 索引更新 |
| 既存 BD docs | 参照追記 |

---

## エンティティ（10）

| テーブル | 役割 |
| --- | --- |
| `business_directory_listings` | ライフサイクル · プラン · 検索 · hp_mode |
| `business_directory_profiles` | 1:1 詳細 · 連絡先 · 種別固有 |
| `business_directory_categories` | カテゴリマスタ |
| `business_directory_photos` | 写真 |
| `business_directory_business_hours` | 営業時間 |
| `business_directory_social_links` | SNS |
| `business_directory_tlv_videos` | TLV embed |
| `business_directory_plan_features` | プラン × 機能フラグ |
| `business_directory_review_requests` | 運営審査キュー |
| `business_directory_audit_logs` | 監査ログ |

---

## ステータス遷移

```text
draft → review_requested → published
         ↑ 差戻し          ↓ suspended → archived
         └─────────────────┘
published + 主要変更 → review_requested → published
```

正本 status: `draft` · `review_requested` · `published` · `suspended` · `archived`

---

## 確認

| 項目 | 結果 |
| --- | --- |
| docs / reports のみ | ✅ |
| AD-013 整合 | ✅ |
| Self-Service 整合 | ✅ 初回最小 · 公開後子テーブル |
| 運営入力代行なし | ✅ 審査キュー + audit |
| Marketplace / Platform 分離 | ✅ |
| migration なし | ✅ |

---

## 次フェーズ（未着手）

SQL migration · RLS · Edge API · Self-Service UI
