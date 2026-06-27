# Business Directory Self-Service 設計 — 報告

**日付:** 2026-06-27  
**種別:** docs のみ（コード · DB · UI · 決済変更なし）  
**前提:** AD-013 · MVP 設計 `3dc81c6`

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `docs/business-directory-self-service-design.md` | **新規** Self-Service 正本 |
| `docs/business-directory-mvp-design.md` | §3 · §5 更新 · Self-Service 参照 |
| `docs/business-directory-subscription-model.md` | Self-Service 参照追記 |
| `docs/ROADMAP.md` / `TODO.md` / `README.md` | 索引更新 |
| `reports/business-directory-self-service-design.md` | 本報告 |

---

## 反映内容

### フロー

```text
会員登録 → サブスク選択 → 最小フォーム → 公開申請 → 運営審査 → 公開 → 公開後詳細編集
```

### 初回フォーム（最小）

- **共通 13 項目** + 種別 **+2**（店舗: 営業時間 · 販売ジャンル / 業務: サービス内容 · 料金目安）
- 写真 **1 枚** · 紹介文 **短文** · SNS/TLV/詳細は **初回に含めない**
- 目標 **1〜2 分** 完了

### 公開後編集

事業者マイページ · タブ型 UI（設計のみ）— 基本情報 · 写真 · TLV · SNS · 営業時間 · 商品/サービス · 実績 · プレビュー · 公開設定

### 運営

**入力代行しない。** 審査 · 公開/非公開 · 通報 · 規約 · プラン確認 · 凍結のみ。

### 公式 HP

- **あり:** 最小掲載 + URL 送客
- **なし:** TASFUL ページを簡易 HP · 公開後 Self-Service で充実

---

## 確認チェックリスト

| 項目 | 結果 |
| --- | --- |
| docs / reports のみ | ✅ |
| AD-013 矛盾なし | ✅ |
| 初回フォーム最小化 | ✅ 写真1 · 短文 · +2 のみ |
| 公開後編集方針 | ✅ |
| 運営入力代行なし | ✅ 明記 |
| Marketplace / Platform 境界 | ✅ 維持 |
| コード変更なし | ✅ |

---

## 次フェーズ（未着手）

Self-Service UI · 事業者マイページ · 審査キュー — 実装は別 Epic。
