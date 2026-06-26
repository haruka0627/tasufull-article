# Platform Next Phase — 実装レポート

実施日: 2026-06-26  
方針: **Platform専用AIは作らない** · 入口は TASFUL AI（`ai-workspace.html` · `cross-matching`）  
Builder AI / AI秘書 / TLV / Gateway 本体 / AI Core 契約 — **変更なし**

---

## 責務分離（維持）

| 領域 | 役割 |
| --- | --- |
| **Builder AI** | 業務支援（見積・KY・候補整理など） |
| **Platform** | 探す · 比較する · おすすめを見る（AI入口 + deterministic 整理） |
| **TASFUL AI** | 共通AI（自然文相談 · 候補案内 · 比較説明） |
| **AI秘書** | 運営支援 |

---

## Phase 1 — Googleログイン

**対応:** Supabase OAuth（Google のみ）· `returnTo` / `return` クエリ · staging/本番は `location.origin` ベース redirect

| ファイル | 内容 |
| --- | --- |
| `platform-google-auth.js` | **新規** — `signInWithOAuth({ provider: 'google' })` · callback · redirect |
| `login.js` / `login.html` | Google ボタン配線 · OAuth 戻り処理 |
| `signup.js` / `signup.html` | Google 登録（同一 OAuth）· Supabase script 追加 |
| LINE | **未実装のまま**（明示メッセージで Google/メールを案内） |

**競合確認:** 既存メール + localStorage ログインは維持。OAuth 成功時のみ `TasuMemberAuth.establishSupabaseSession`。

---

## Phase 2 — AIおすすめ

**モジュール:** `platform-ai-recommend.js`

- 評価: 評価 · 返信速度 · 本人確認 · 資格 · エリア · 実績 · 人気 · 価格 · AIスコア
- バッジ: 🏅 AIおすすめ（`platform-badges.js`）
- クリック: 短い理由（✓ ご希望地域 · ✓ ご予算内 · ✓ 高評価 等 · **長文禁止**）

---

## Phase 3 — 共通バッジ

**モジュール:** `platform-badges.js` · `platform-badges.css`

| 種別 | バッジ |
| --- | --- |
| 商品 | ベストセラー · 人気 · 高評価 · 新着 |
| サービス | AIおすすめ · 本人確認 · 資格確認 · 法人認証 · 即対応 · 近く |

**ルール:** 最大5個 · 共通デザイン · `renderBadgesHtml()` / `collectBadges()`

---

## Phase 4 — AI比較（compare_assist）

**モジュール:** `platform-compare-assist.js`

- 比較表 · 良い点 · 注意点 · AIおすすめ理由 · 比較ポイント · 判断材料
- **契約決定しない** 明記
- TASFUL AI 続行: `TasuAiWorkspaceLinks.buildCompareAssistUrl()`
- セッション basket: `tasu_platform_compare_basket`

---

## Phase 5 — AI条件検索（search_assist）

**モジュール:** `platform-search-assist.js`

- 自然文 → 条件整理（エリア · 予算 · カテゴリ · 即対応 · 資格 等）
- 候補一覧 · AIおすすめ · 注意点
- TASFUL AI 続行: `TasuAiWorkspaceLinks.buildSearchAssistUrl()`

---

## Phase 6 — 人気検索

**変更:** `search.js` — `POPULAR_SEARCH_WORDS` を Platform 指定語に更新

- 外壁塗装 · AI · ハウスクリーニング · エアコン · 水道修理 等
- TOP UI: `platform-search-hub.js` の人気チップ

---

## Phase 7 — サジェスト検索

**変更:** `search.js` — `SUGGEST_PREFIX_EXPANSIONS`（例: 動画 → 動画編集/制作/撮影）

- リアルタイム候補: `platform-search-hub.js` · `getSearchSuggestions()`

---

## Phase 8 — 位置検索

**モジュール:** `platform-location-search.js`

- 現在地（Geolocation API）
- 都道府県 · 市区町村フィルタ
- 半径 km · 近い順（Haversine · 都道府県座標フォールバック）

---

## Phase 9 — お気に入りフォルダ

**モジュール:** `platform-favorites-folders.js`

| フォルダ | ID |
| --- | --- |
| デフォルト | `default` |
| 気になる | `interested` |
| 比較中 | `comparing` |
| 仕事 | `work` |
| 商品 | `products` |
| あとで依頼 | `later` |

既存 `TasuFavoriteStore` とメタデータ `tasful_favorite_folders_meta` で連携。

---

## Phase 10 — カテゴリ別 KYC

**モジュール:** `platform-category-kyc.js`

| カテゴリ | KYC | 資格 | 高額閾値 |
| --- | --- | --- | --- |
| 建設 | ON | ON | 50万 |
| タクシー・運送 | ON | ON | — |
| 資格業 | ON | ON | — |
| 高額案件 | ON | — | 30万 |
| 一般 | OFF | OFF | — |

`checkListing()` で警告生成（localStorage で ON/OFF 上書き可）。

---

## UI 入口

**`index-top.html`** — 検索ハブセクション追加

- 自然文入力 · 都道府県 · 半径 · 現在地
- 人気検索 · サジェスト · AI検索 · AI比較
- 結果プレビュー（deterministic · TASFUL AI URL 付き）

**`ai-workspace-links.js`** — `buildSearchAssistUrl` · `buildCompareAssistUrl` 追加（既存 `cross-matching` モード利用）

---

## 変更ファイル一覧

| ファイル | Phase |
| --- | --- |
| `platform-google-auth.js` | 1 |
| `platform-ai-recommend.js` | 2 |
| `platform-badges.js` · `platform-badges.css` | 2–3 |
| `platform-search-assist.js` | 5 |
| `platform-compare-assist.js` | 4 |
| `platform-location-search.js` | 8 |
| `platform-favorites-folders.js` | 9 |
| `platform-category-kyc.js` | 10 |
| `platform-search-hub.js` · `platform-search-hub.css` | 6–8 UI |
| `search.js` | 6–7 |
| `ai-workspace-links.js` | 4–5 入口 |
| `login.js` · `login.html` | 1 |
| `signup.js` · `signup.html` | 1 |
| `index-top.html` | UI |
| `scripts/test-platform-next-phase.mjs` | テスト |

**触っていない:** `ai-model-gateway.js` · `builder/builder-ai-*` · `admin-ai-secretary-*` · `live/tlv-*`

---

## テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-platform-next-phase.mjs` | **36/36 PASS** |
| `npm run build:pages` | **PASS** |
| `node scripts/test-builder-ai-tools-adaptation.mjs` | **85/85 PASS**（Builder 影響なし） |

**カバー:** Google OAuth 設定 · AIおすすめ · 比較 · 検索 · バッジ · 人気/サジェスト · 位置 · フォルダ · KYC · 隔離 · HTML 配線

---

## 残タスク

| 項目 | 内容 |
| --- | --- |
| Supabase Dashboard | Google OAuth プロバイダ有効化 · redirect URL 登録（`/login.html?oauth=google`） |
| 本番 OAuth E2E | 実 Supabase プロジェクトでの Google ログイン手動確認 |
| 掲載カード統合 | `listing-renderer.js` / `index-home.js` へ `TasuPlatformBadges.renderBadgesHtml` 組込 |
| お気に入り UI | `favorites-list.html` にフォルダ切替 UI |
| compare basket | `ai-workspace.html` 側で `compare=` クエリ読取（任意 · Gateway 変更なしで client 側のみ） |
| Worker/Partner DB | Platform 候補の Supabase 検索 API 接続（将来） |
| KYC 管理 UI | 運営向けカテゴリ KYC ON/OFF 画面（任意） |

---

## 完了条件

- Platform は **探す · 比較する · おすすめを見る** に特化した AI 入口を持つ
- AI 処理本体は **TASFUL AI**（Platform 専用 AI なし）
- Builder AI · AI秘書 · TLV · Gateway との責務分離を維持
