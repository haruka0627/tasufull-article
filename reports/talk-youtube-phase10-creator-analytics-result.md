# TASFUL LIVE YouTube P1 — Phase 10 投稿者収益・分析ダッシュボード

**実施日:** 2026-06-23  
**検証:** `npm run verify:live-youtube-p10` → **PASS** (28/28)  
**Phase 9 回帰:** `npm run verify:live-youtube-p9` → **PASS**（p10 内で実行）

---

## 目的

投稿者が再生・いいね・登録者・広告表示の成績を確認し、将来の収益化申請・広告分配の土台を整える。Phase 7〜9 の TLV 二重シェルを維持。

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|---------|------|
| `live/creator-dashboard.html` | **新規** — 収益・分析ページ（二重シェル） |
| `live/live-creator-dashboard.js` | **新規** — 集計・UI・収益化申請スタブ |
| `live/live-config.js` | RPM 定数・推定計算・収益化ラベル |
| `live/tlv-nav.js` | PC サイドバー「収益・分析」 |
| `live/my-videos.html` / `live-my-videos.js` | 上部導線バナー |
| `live/live-profile.js` | 自分のチャンネルに「収益・分析」リンク |
| `live/live.css` | ダッシュボード・カード・モバイル最適化 |
| `scripts/verify-live-youtube-p10-creator-analytics.mjs` | **新規** |
| `package.json` | `verify:live-youtube-p10` |
| `deploy/cloudflare/dist/live/*` | 同期 |

**DB / RLS / Edge:** 変更なし（収益化ステータスは localStorage スタブ）

---

## 導線

| 場所 | 内容 |
|------|------|
| PC サイドバー | 「収益・分析」→ `creator-dashboard.html` |
| マイ動画上部 | `tlv-creator-dash-link` バナー |
| 自分のチャンネル | アクションに「収益・分析」 |
| スマホ | MY タブ active + マイ動画/ダッシュボードから遷移 |

`admin-videos.html` は未変更。

---

## サマリーカード

- 総再生数 / 総いいね数 / チャンネル登録者数 / 投稿本数
- 推定広告表示回数 / 推定収益
- 注記: 「広告表示ログに基づく参考値。実際の支払い額ではありません」

### 推定ロジック（定数化）

```text
CREATOR_ESTIMATED_RPM_YEN = 100  # 円 / 1000 表示
広告枠あり: impressions = floor(views × 0.85)
広告枠なし: impressions = floor(views × 0.15)  # スタブ
revenue = impressions / 1000 × RPM
```

`live_video_ads` の active 枠を参照。 impression ログテーブルは未接続（将来差し替え可能な構造）。

---

## 動画別パフォーマンス

各動画: サムネ・タイトル・公開状態・種別（動画）・再生・いいね・広告表示・推定収益・投稿日・視聴/編集/詳細

- PC: 横長カード
- スマホ: 縦カード・大きめ数値

---

## 収益化ステータス（localStorage スタブ）

| 値 | 表示 |
|----|------|
| `none` | 未申請 |
| `pending` | 審査中 |
| `approved` | 承認済み |
| `suspended` | 停止中 |

キー: `tlv-creator-monetization-v1`（userId 単位）

### 申請条件表示

- 投稿 3 本以上
- 総再生 1,000 回以上
- プロフィール自己紹介あり
- 通報: 運営審査スタブ

「収益化を申請する」→ 条件充足時「申請を受け付けました（テスト）」+ `pending`

---

## 注意文言（必須）

ページ上下に `tlv-creator-disclaimer` を配置:

- 表示収益は推定値
- 実際の支払い額を保証しない
- 不正再生・広告操作・規約違反は対象外

---

## 検証結果

| 項目 | 結果 |
|------|------|
| 390 / 768 / 1280 console error 0 | PASS |
| サマリー / 免責 / 収益化 / 申請ボタン | PASS |
| マイ動画導線 | PASS |
| `verify:live-youtube-p9` 回帰 | PASS |

```bash
npm run verify:live-youtube-p10
# PASS 28/28
```

---

## 判定

**GO** — 投稿者が自分の動画成績と推定収益・広告表示状況を確認でき、収益化申請の入口がある。PC/スマホ双方で破綻なく、既存 TLV 機能は回帰なし。
