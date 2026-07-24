# Builder Provider Listing / Sponsored Visibility — 設計レポート

**日付:** 2026-06-28  
**種別:** 設計のみ（**未実装**）  
**正本:** [docs/AI/BUILDER_PROVIDER_LISTING.md](../docs/AI/BUILDER_PROVIDER_LISTING.md)

---

## サマリー

業者 · ワーカーの **無料プロフィール掲載**と、**検索優先 / Sponsored 露出**の掲載者向け課金を設計した。  
[Contact Reveal](../docs/AI/BUILDER_MONETIZATION.md) · [Builder AI サブスク](../docs/AI/BUILDER_MONETIZATION.md) · [AI Membership](../docs/AI/AI_MEMBERSHIP_PRICING.md) とは **すべて分離**。

| 主体 | 無料 | 有料 |
| --- | --- | --- |
| **掲載者** | プロフィール作成 · 掲載 · 編集 | Provider Boost · Sponsored TOP · Business 特典 |
| **顧客** | 検索 · フィルタ · 閲覧 · お気に入り | Contact Reveal（連絡先のみ） |

---

## 設計判断

### 3 レーンの関係

```text
Free Listing ──→ 検索に organic 掲載（無料）
Provider Boost ─→ deterministic スコア + sponsored_boost 加点
Contact Reveal ─→ 直接連絡先開示（顧客都度 · 別テーブル）
Builder AI ─────→ 業務ツール月額（別契約）
```

### ランキング

- **基本:** deterministic（エリア · 職種 · 実績 · 評価 · 確認 · 更新日）
- **有料:** 加点のみ · **金払い順固定禁止**
- **Sponsored:** UI 明示必須
- **AI:** おすすめ理由の説明のみ · **LLM ランキング禁止**

---

## 推奨価格（Draft）

| SKU | 価格 |
| --- | --- |
| Free Listing | ¥0 |
| Provider Boost | ¥980〜¥1,980/月 |
| Builder Business | ¥4,980/月 |
| Sponsored TOP（地域） | ¥3,000〜¥10,000/月 |
| Enterprise | 個別見積 |

---

## データモデル（想定）

| テーブル | 用途 |
| --- | --- |
| `provider_profiles` | 公開プロフィール · contact 分離 |
| `provider_listing_plans` | Free / Boost / Business / TOP |
| `provider_boosts` | 有効期間 · 地域 · boost_points |
| `provider_profile_media` | 写真 · 施工事例 |
| `provider_stats_daily` | PV · imp · お気に入り |
| `search_result_impressions` | 検索表示ログ |
| `contact_reveal_events` | Reveal 集計（課金は contact_reveals） |

---

## 禁止事項

- 有料のみ上位固定 ❌
- Sponsored 非表示 ❌
- LLM ランキング ❌
- 連絡先無料公開 ❌
- Reveal / Boost / AI Membership 混同 ❌

---

## Backlog

| Phase | 内容 |
| --- | --- |
| L0 | 設計 · SKU · Sponsored UI ガイド |
| L1 | provider_profiles + RLS |
| L2 | 掲載者 CRUD UI |
| L3 | Boost サブスク |
| L4 | 検索 boost merge + Sponsored ラベル |
| L5 | 統計ダッシュボード |
| L6 | TOP 枠 · Enterprise |

---

## 成果物

| ファイル | 状態 |
| --- | --- |
| `docs/AI/BUILDER_PROVIDER_LISTING.md` | ✅ |
| `docs/AI/BUILDER_AI.md` | ✅ 参照 |
| `docs/TODO.md` | ✅ Backlog |
| `docs/AI/README.md` | ✅ 索引 |
| 本レポート | ✅ |

**未実施:** migration · UI · Payment · Gateway/LLM

---

*Design only · 2026-06-28*
