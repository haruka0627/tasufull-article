# Platform Request — P0 計画・接続調査・ロードマップ

**検証日:** 2026-07-05  
**スコープ:** P0 のみ（設計 · catalog SKU · 導線調査）  
**正本仕様:** [docs/platform-request.md](../docs/platform-request.md)

---

## P0 成果物

| 成果物 | パス | 状態 |
| --- | --- | --- |
| 仕様書 | `docs/platform-request.md` | ✅ 作成 |
| Catalog SKU ×3 | `shared/pricing/tasful-pricing-catalog.json` | ✅ 追加 |
| generated 再生成 | `scripts/generate-pricing-config.mjs` | ✅ 実行予定 |
| 本計画書 | `reports/platform-request-p0-plan.md` | ✅ 本ファイル |

---

## 既存導線との接続候補（調査結果）

### A. 入口（Requester · P1 UI）

| 優先 | 接続先 | 根拠 | 案 |
| --- | --- | --- | --- |
| **高** | `index-top.html` | Platform TOP · hero / search hub | 「短く依頼する」CTA カード（`tas-hero` 行に追加） |
| **高** | `dashboard.html` | 会員のマイページ | 「依頼を投げる」ショートカット |
| 中 | `talk-home.html` | Talk ホーム · モバイルタブ | 依頼投稿への FAB またはクイックアクション |
| 中 | `public-board.html` | 案件・求人ボード | 従来掲載と並ぶ「短い依頼」タブ |
| 低 | `post.html` | 詳細掲載フォーム | 「詳しく掲載する」vs「短く依頼する」分岐リンクのみ |

### B. 検索・マッチ（Receiver · P3）

| 優先 | 接続先 | 根拠 | 案 |
| --- | --- | --- | --- |
| **高** | `listings-db.js` / `listing-renderer.js` | listing メタデータ | category · tags · location をマッチ入力に |
| **高** | `platform-search-hub.js` | 地域 · 半径検索 | Request 投稿時の地域 UI を hub と共通化 |
| 中 | `listings.js` | カテゴリフィルタ | worker/skill/general の `matchesCategoryFilters` 再利用 |
| 中 | `worker-listing-fields.js` / `job-listing-fields.js` | 属性定義 | 受信側プロフィール属性の SSOT |

### C. 通知（P3 · P7）

| 優先 | 接続先 | 根拠 | 案 |
| --- | --- | --- | --- |
| **高** | `talk-notifications-store.js` | 通知 SSOT · fanout | `type: platform_request` 追加 · `enqueueNotification` |
| **高** | `talk-home.html` + `talk-home.js` | 通知 UI · 設定 | フィルタ chip · 詳細パネル · `data-talk-notify-settings` |
| 中 | `talk-category.js` / `TasuTalkCategory` | `VALID_TYPES` | `platform_request` 正規化 |
| 低 | `talk-notify-fanout` 系 | `FANOUT_KEY` パターン | 受信者一括通知のレート制限 |

### D. Talk · 課金（P4）

| 優先 | 接続先 | 根拠 | 案 |
| --- | --- | --- | --- |
| **高** | `platform-chat-fee.js` | Connect なし 550円パターン | Request 用に `platform_request_match_contact` SKU 分岐 |
| **高** | `platform-chat-start-fee-card.js` | チャット内課金カード | Request マッチ後の CTA |
| **高** | `platform-chat-fee-pay.html` | 決済画面 | SKU 表示を catalog 参照 |
| 中 | `talk-inquiry-drafts-store.js` | 問い合わせ下書き | Request 下書きキー分離 |
| 中 | `detail-*.html` チャット導線 | 既存「チャットに進む」 | Request 経由は専用 deep link |

### E. 課金 · Catalog（P4 · P6）

| 優先 | 接続先 | 根拠 | 案 |
| --- | --- | --- | --- |
| **高** | `shared/pricing/pricing-catalog-runtime.js` | Runtime SKU | `PLATFORM_REQUEST_*` 定数追加 |
| 中 | Stripe Checkout（将来） | subscription 2 SKU | `stripePriceEnvKey` を catalog に追加 |
| 低 | `service-fee-pay.html` | 都度課金 UI 参考 | match_contact 専用ページ or 既存流用 |

### F. 触らない（凍結 · AD）

| 対象 | 理由 |
| --- | --- |
| `platform_match_job_contact` / `platform_match_general_contact` | Production Ready · 既存フロー維持 |
| Platform AI 専用ループ | AD-003 — Workspace 入口のみ |
| `platform_urgent_priority_placeholder` | 別商品レーン（掲載者バッジ） |

---

## P1 以降の実装順

| Phase | 内容 | 主な成果物 | 依存 |
| --- | --- | --- | --- |
| **P1** | UI 導線 | `index-top` / `dashboard` CTA · プレースホルダページ `platform-request.html` | P0 |
| **P2** | Request 投稿（ローカル） | `platform-request-store.js`（localStorage）· 投稿フォーム | P1 |
| **P3** | 条件マッチング · 通知候補 | マッチ関数 · `talk-notifications-store` 統合 · fan-out デモ | P2 · listings メタ |
| **P4** | Talk 開始 · ¥550 導線 | `platform_request_match_contact` · fee card / pay 分岐 | P3 · pricing runtime |
| **P5** | Supabase DB 設計 | migration DDL · RLS 草案 · `platform_requests` テーブル | P4 仕様固定 |
| **P6** | 通知サブスク | Stripe subscription · poster/receiver entitlement | P5 · catalog stripePriceEnvKey |
| **P7** | Push / Email / SMS | Web Push · digest email · SMS オプトイン | P6 · Talk 設定 |
| **P8** | Production 準備 | Preview E2E · env guard · runbook · Go/No-Go | P6–P7 |

---

## Go / Conditional Go / No-Go 判定（P0 時点）

| 判定 | 領域 | 理由 |
| --- | --- | --- |
| **Go** | P0 設計完了 | 仕様 · SKU · 導線調査 · ロードマップが揃った |
| **Go** | Catalog verify | generate + `verify:pricing-catalog` PASS 後 |
| **Conditional Go** | P1 着手 | Platform **FROZEN** — UI 追加は **新規ページ・CTA のみ** · 既存 listing/fee フロー無変更 |
| **No-Go** | P5 以前の Production DB | migration 禁止（ユーザー指示） |
| **No-Go** | P6 以前の Stripe 本番 | 価格仮 · SKU draft |
| **No-Go** | 既存 `platform_match_*` の置換 | 別 SKU レーンで並存 |

**P0 総合判定: Go** — P1 へ進行可（Conditional: 凍結領域の最小 diff 厳守）。

---

## リスク・注意

1. **Listing 型との混同** — UI コピーで「短い依頼」と「詳細掲載」を明確に分離する  
2. **通知スパム** — 受信サブスク + 日次上限 + オプトイン必須（仕様 §4）  
3. **550円の二重定義** — `platform_match_general_contact` と `platform_request_match_contact` は用途別 SKU · 統合は P8 以降の検討  
4. **Platform 凍結** — P1–P4 は新規ファイル中心 · frozen HTML のレイアウト変更は避ける  

---

## 検証コマンド（P0）

```bash
node scripts/generate-pricing-config.mjs
npm run verify:pricing-catalog
```

---

*P0 完了報告の補助資料。次フェーズは P1 UI 導線。*
