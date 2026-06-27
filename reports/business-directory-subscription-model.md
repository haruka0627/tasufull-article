# Business Directory — サブスク掲載モデル方針変更

**日付:** 2026-06-27  
**種別:** docs のみ（コード · DB · 決済変更なし）  
**Decision:** **AD-013**（AD-012 は UI/UX 原則で使用中のため AD-013 を新設）

---

## 背景

TASFUL の **店舗・販売** と **業務サービス** を、成約手数料中心から **月額サブスク掲載モデル** へ整理。Marketplace / Platform とは収益モデルを分離する。

---

## 反映内容

| 項目 | 内容 |
| --- | --- |
| **店舗・販売** | 月額サブスク → 専用掲載ページ（店舗情報 · 写真 · TLV · 問い合わせ等） |
| **業務サービス** | 月額サブスク → 専用掲載ページ（サービス情報 · 実績 · TLV · 問い合わせ等） |
| **既存 HP** | URL 登録のみ送客 · HP なしは TASFUL ページを簡易 HP として利用 |
| **Marketplace** | **成約手数料 — 維持** |
| **Platform / 案件** | **成約手数料 — 維持** |
| **広告枠** | スポンサー · 上位表示 · PR（将来） |

### サブスクプラン案

Free · Standard · Pro · Premium/Future — 正本は `docs/business-directory-subscription-model.md`

### 成約手数料（店舗/業務）

初期は主軸にしない。TASFUL 内予約/見積/チャット/決済利用時のみ **月額 + 成果報酬** オプション（将来）。

### UI / IA

```text
TASFUL市場
├ 商品マーケット
├ 店舗・販売
├ 業務サービス
└ 案件・仕事
```

目的別に検索結果を分離（混在させない）。

---

## 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `docs/DECISIONS.md` | AD-013 追加 |
| `docs/business-directory-subscription-model.md` | **新規** 正本 |
| `docs/ROADMAP.md` | Business Directory セクション追加 |
| `docs/TODO.md` | 方針セクション追加 |
| `docs/README.md` | サービス一覧 · 索引更新 |
| `reports/business-directory-subscription-model.md` | 本報告 |

---

## 確認チェックリスト

| 項目 | 結果 |
| --- | --- |
| 変更対象が docs / reports のみ | ✅ |
| Decision 番号重複なし（AD-013 新設） | ✅ |
| Marketplace 成約手数料方針維持 | ✅ |
| Platform 成約手数料方針維持 | ✅ |
| 店舗/業務 = サブスク掲載モデル | ✅ |
| コード変更なし | ✅ |

---

## 参照

- `reports/revenue-production-readiness-review.md` — Marketplace GMV · Connect 手数料（変更なし）
- `docs/platform-notify-unified.md` — Platform Connect 通知（変更なし）
