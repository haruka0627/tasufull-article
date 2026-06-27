# TASFUL Business Directory — サブスク掲載モデル

**最終更新:** 2026-06-27  
**正本 AD:** [DECISIONS.md](./DECISIONS.md) **AD-013**  
**Self-Service:** [business-directory-self-service-design.md](./business-directory-self-service-design.md)  
**状態:** 方針確定 · **実装・決済・DB 変更は未着手**

---

## 目的

TASFUL の **店舗・販売** と **業務サービス** を、成約手数料中心ではなく **月額サブスクで専用掲載ページを持てるモデル** として整理する。

**Marketplace / Platform（案件）** とは収益モデルを分ける。

---

## 収益モデル整理

| 領域 | 主軸 | 備考 |
| --- | --- | --- |
| **店舗・販売** | 月額サブスク掲載料 | 本ドキュメントの対象 |
| **業務サービス** | 月額サブスク掲載料 | 本ドキュメントの対象 |
| **Marketplace（商品マーケット）** | **成約手数料** | **既存方針維持** — Checkout · Connect · GMV |
| **Platform / 案件・仕事** | **成約手数料** | **既存方針維持** — Connect · deal · 手数料ゲート |
| **広告枠** | スポンサー掲載 · 上位表示 · PR 枠 | 将来 |

---

## 店舗・販売

月額サブスクにより TASFUL 内に **専用掲載ページ** を持てる。

### 掲載内容（metadata）

| 項目 |
| --- |
| 店舗名 · 会社名 · 住所 · 営業時間 · 電話番号 |
| 公式サイト URL · SNS · 写真 · 商品紹介 · 店舗紹介 |
| 地図 · TLV 動画埋め込み · 問い合わせ導線 |

### 運用（Self-Service）

事業者が **自分で** 掲載を作成・編集。初回は **最小フォーム（1〜2 分）** · 詳細は公開後に追加。運営は **入力代行しない**（審査 · 通報 · 停止のみ）。

詳細: [business-directory-self-service-design.md](./business-directory-self-service-design.md)

### 既存ホームページ

| パターン | 対応 |
| --- | --- |
| **既存 HP あり** | URL 登録のみで送客（TASFUL 内ページは任意） |
| **HP なし** | TASFUL 掲載ページを **簡易ホームページ** として利用 · 公開後 Self-Service で充実 |

---

## 業務サービス

月額サブスクにより TASFUL 内に **専用掲載ページ** を持てる。

### 掲載内容（metadata）

| 項目 |
| --- |
| 会社名 · サービス名 · 対応地域 · 料金目安 · 実績 |
| 施工写真 · スタッフ紹介 · 公式サイト URL · SNS |
| TLV 動画埋め込み · 問い合わせ導線 |

### 既存ホームページ

店舗・販売と同様 — **URL 登録送客** と **TASFUL 内専用ページ** の両対応。

---

## サブスクプラン案（docs 正本）

| プラン | 内容 |
| --- | --- |
| **Free** | 基本情報のみ · 検索露出は低め |
| **Standard** | 専用掲載ページ · 写真 · 公式サイトリンク · 営業時間 · SNS · 口コミ |
| **Pro** | 上位表示 · TLV 動画掲載 · 問い合わせ導線 · アクセス解析 · AI 紹介対象 |
| **Premium / Future** | 複数店舗管理 · 広告枠 · Stripe Connect / 予約 / 決済連携 · 成果報酬オプション |

---

## 成約手数料の扱い

店舗・販売 / 業務サービスでは **初期は成約手数料を主軸にしない**。

将来、以下を TASFUL 内で利用する事業者のみ **月額 + 成果報酬** に拡張可能:

- TASFUL 内で予約
- TASFUL 内で見積
- TASFUL 内でチャット
- TASFUL 内で決済

**Marketplace / Platform の成約手数料方針は変更しない。**

---

## UI / IA 方針

### 市場トップ構造

```text
TASFUL市場
├ 商品マーケット
├ 店舗・販売
├ 業務サービス
└ 案件・仕事
```

### 目的別分離（検索結果は混ぜすぎない）

| ユーザー目的 | 行き先 |
| --- | --- |
| 商品を買いたい | 商品マーケット |
| 会社・店舗を探したい | 店舗・販売 |
| 依頼先を探したい | 業務サービス |
| 仕事・人材を探したい | 案件・仕事 |

---

## 関連コード（参照のみ · 今回変更なし）

| ファイル | 備考 |
| --- | --- |
| `shop-store.html` / `detail-shop.html` | 店舗・販売 UI |
| `business.html` / `detail-business-service.html` | 業務サービス UI |
| `sales-fees.html` | Platform Connect 手数料（**維持**） |
| `shop-checkout.js` | Marketplace Checkout（**維持**） |

---

## 実装スコープ外（本フェーズ）

- DB migration · Stripe サブスク課金 · Connect 実装
- UI / コード変更
- Builder AI · TASFUL AI · AI 秘書

---

## 参照

- [DECISIONS.md](./DECISIONS.md) AD-013
- [ROADMAP.md](./ROADMAP.md) §Business Directory
- [business-directory-mvp-design.md](./business-directory-mvp-design.md) — MVP 設計正本
- [business-directory-self-service-design.md](./business-directory-self-service-design.md) — Self-Service 正本
- [reports/business-directory-subscription-model.md](../reports/business-directory-subscription-model.md)
