# Platform Request — 仕様（P0 設計正本）

**Status:** P0 仕様正本 · **P4.6 UI/導線完了** · P5 接続設計は [platform-request-p5-integration.md](./platform-request-p5-integration.md)  
**最終更新:** 2026-07-05  
**種別:** Platform 新機能 — 短い依頼投稿 + 条件マッチ通知  
**関連:** [pricing-catalog.md](./pricing-catalog.md) · [DECISIONS.md §AD-003/012](./DECISIONS.md) · [platform-request-p0-plan.md](../reports/platform-request-p0-plan.md)

---

## 1. コンセプト

### 従来（Listing 型）

利用者が **案件を細かく作成** し、公開して **応募・問い合わせを待つ**（`post.html` → `detail-*.html` → 検索一覧）。

### 新方式（Platform Request）

利用者が **短い一文** で「これできる人いますか？」を投げ、**条件に合う登録業者・ワーカーへ通知**する。

| 例（投稿文） | 想定マッチ対象 |
| --- | --- |
| ここからここまで送迎してほしい | ドライバー · ワーカー |
| HP作れる人いますか？ | Web制作 · スキル出品者 |
| 今日草刈りできる人いますか？ | 造園 · 一般業務ワーカー |
| 荷物を運べる人いますか？ | 軽貨物 · ワーカー |
| 動画編集できる人いますか？ | 動画編集スキル |

**急ぎ案件バッジ（`platform_urgent_priority_placeholder`）とは別レーン。**  
Listing の organic 順位を課金で歪めない（AD-012 · SPONSOR_ADS 方針と同様）。

---

## 2. 利用者フロー（Requester）

```text
① 入口（index-top / dashboard / Talk）
② 短い依頼を入力（本文 · 任意で地域 · カテゴリ · 希望日時）
③ 投稿サブスク確認（platform_request_user_subscription · 未契約なら案内）
④ 投稿 → 状態: open
⑤ 受信側からの反応を Talk / 通知で受け取る
⑥ マッチした相手と Talk 開始（platform_request_match_contact · 550円仮）
⑦ 完了 → 状態: closed / expired
```

**P0 時点:** フローは設計のみ。課金 SKU は catalog に **draft / enabled:false** で登録。

---

## 3. 受信側フロー（Receiver）

対象: **登録済み業者 · ワーカー · スキル出品者**（既存 listing / profile を正とする）

```text
① 通知受信サブスク（platform_request_receiver_subscription）
② プロフィール / listing に登録したカテゴリ・地域・タグをマッチ条件とする
③ 条件合致の Request 投稿時に通知（Talk 通知タブ · 将来 Push/Email）
④ 通知から依頼詳細を確認
⑤ 興味あり → Talk 返信 or 連絡先開示導線へ
⑥ Talk 開始時に initiator 側が match_contact 課金（既存 platform-chat-fee パターン踏襲）
```

**受信オプトイン必須。** サブスク未契約・オプトアウト時は通知しない。

---

## 4. 通知条件（マッチング · P0 設計）

| 次元 | 説明 | データソース（将来） |
| --- | --- | --- |
| **カテゴリ** | skill / worker / business / general 等 | listing `category` · `tags` |
| **地域** | 都道府県 · 半径 km | listing / profile `location` |
| **キーワード** | 投稿本文の簡易トークン | Request `body` · 禁止語フィルタ |
| **時間** | 今日 · 今週 · 指定日 | Request `desired_at` |
| **受信設定** | サブスク有効 · カテゴリ許可リスト | receiver `notify_prefs` |

**マッチアルゴリズム（P3 以降）:**

1. Receiver のサブスク + オプトイン確認
2. カテゴリ / 地域のハードフィルタ
3. キーワード・タグのスコアリング（organic · 金額順ソート禁止）
4. 上位 N 件へ fan-out（`talk-notifications-store` · `FANOUT_KEY` パターン）

**通知上限（案）:** 1 Request あたり最大 50 受信者 · 1 Receiver あたり日次 20 件（catalog limits で将来定義可）

---

## 5. 課金モデル（仮 · Pricing Catalog SSOT）

すべて **`provisional: true`** · **`enabled: false`** · **`status: draft`**（P0）。

| SKU | 用途 | billingType | 仮価格 |
| --- | --- | --- | --- |
| `platform_request_user_subscription` | 依頼投稿し放題（月額） | subscription | ¥330/月 |
| `platform_request_receiver_subscription` | マッチ通知受信（月額） | subscription | ¥550/月 |
| `platform_request_match_contact` | Talk 開始 / 連絡先開示 | fixed | ¥550/件 |

**既存 SKU との関係:**

| 既存 | 関係 |
| --- | --- |
| `platform_match_general_contact` | 一般 listing からのチャット開始 — **別レーン**（Request 専用は `platform_request_match_contact`） |
| `platform_match_job_contact` | 求人 — Request 対象外 |
| `platform_urgent_priority_placeholder` | 掲載者向け急ぎバッジ — Request とは別商品 |

価格変更は **JSON のみ** → `generate-pricing-config`（[pricing-catalog.md](./pricing-catalog.md)）。

---

## 6. 状態遷移

```text
draft ──publish──► open ──match──► matched ──talk_started──► in_talk
  │                  │                │
  │                  ├──expire────────► expired
  │                  ├──cancel────────► cancelled
  │                  └──close─────────► closed
```

| 状態 | 説明 |
| --- | --- |
| `draft` | 下書き（未公開） |
| `open` | 公開中 · マッチ・通知対象 |
| `matched` | 1 件以上の受信者が反応 |
| `in_talk` | Talk ルーム接続済み |
| `closed` | 依頼者が完了 |
| `cancelled` | 依頼者が取消 |
| `expired` | 有効期限切れ（例: 7 日） |

---

## 7. Talk 連携

| 項目 | 方針 |
| --- | --- |
| 通知表示 | `talk-home.html` 通知タブ · `talk-notifications-store.js` |
| 通知 type | 将来 `platform_request` を `VALID_TYPES` に追加 |
| Talk 開始 | `platform-chat-start-fee-card.js` · `platform-chat-fee-pay.html` パターン再利用 |
| 課金 SKU | `platform_request_match_contact`（`TasuPricingRuntime` 経由 · P4） |
| 公式ルーム | `TasuTalkOfficialRooms` — Request 用 system 通知からの deep link |
| 下書き | `talk-inquiry-drafts-store.js` — 長文問い合わせとは別キーで Request 下書き可 |

**AD-003:** Platform 専用 AI ループは作らない。依頼文の整形案内は TASFUL AI Workspace 入口（`source=platform`）のみ。

---

## 8. Pricing Catalog 連携

- 正本: `shared/pricing/tasful-pricing-catalog.json`
- P0: SKU 3 件追加済み（draft）
- P4: `platform-chat-fee.js` または専用 adapter が `platform_request_match_contact` を参照
- P6: Stripe Subscription Price は `stripePriceEnvKey` を catalog に追加（本番接続時）

---

## 9. 将来 DB 設計案（P5 · migration 禁止まで設計のみ）

### `platform_requests`

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | 投稿者 |
| `body` | text | 短い依頼文（例: 500 字上限） |
| `category_hints` | text[] | カテゴリヒント |
| `prefecture` | text | 都道府県 |
| `radius_km` | int | 希望半径 |
| `desired_at` | timestamptz | 希望日時（nullable） |
| `status` | text | §6 状態 |
| `expires_at` | timestamptz | 有効期限 |
| `created_at` | timestamptz | 作成 |

### `platform_request_matches`

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | PK |
| `request_id` | uuid | FK |
| `receiver_user_id` | uuid | 受信者 |
| `receiver_listing_id` | uuid | マッチ元 listing（nullable） |
| `score` | numeric | マッチスコア |
| `notified_at` | timestamptz | 通知送信時刻 |
| `responded_at` | timestamptz | 反応時刻 |

### `platform_request_subscriptions`

| カラム | 型 | 説明 |
| --- | --- | --- |
| `user_id` | uuid | PK |
| `role` | text | `poster` / `receiver` |
| `catalog_sku` | text | subscription SKU |
| `stripe_subscription_id` | text | Stripe 参照 |
| `status` | text | active / cancelled |

**RLS:** 投稿者は自分の request のみ · 受信者は match 経由のみ閲覧。

---

## 10. 将来 Push / Email / SMS 通知案（P7）

| チャネル | 用途 | 既存資産 |
| --- | --- | --- |
| **In-app（Talk）** | 第一チャネル | `talk-notifications-store.js` · Supabase `talk_notifications` |
| **Web Push** | 受信者リアルタイム | Talk 通知設定 UI（`talk-home.html` data-talk-notify-settings） |
| **Email** | ダイジェスト · 重要のみ | 将来 Edge / Supabase Auth email |
| **SMS** | 緊急・当日依頼（オプトイン） | 未実装 · コスト管理要 |

**優先順:** In-app → Push → Email → SMS

---

## 11. スコープ外（P0）

- UI 本実装 · DB migration · Stripe 商品作成 · Edge deploy
- 既存 `platform_match_*` フローの変更
- Production / Supabase / Cloudflare 反映

---

*Platform Request P0 — 設計正本。実装フェーズは [platform-request-p0-plan.md](../reports/platform-request-p0-plan.md) を参照。*
