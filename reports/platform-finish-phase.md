# Platform 仕上げ Phase — 実装レポート

実施日: 2026-06-26  
方針: **Platform Next Phase の UI 接続** — Platform 専用 AI なし · TASFUL AI 入口 · Builder / Gateway / AI Core / TLV / AI 秘書は**変更なし**

---

## 1. 実装内容

| 領域 | 内容 |
| --- | --- |
| **掲載カードバッジ** | `listing-renderer.js` / `business-board-renderer.js` に Platform バッジを組込（最大5） |
| **AIおすすめ理由** | 🏅 バッジ押下で短い理由ポップオーバー + 契約非確定の注意書き |
| **お気に入りフォルダ** | 6フォルダ UI · 切替 · 件数 · localStorage · DB 移行用 export/import |
| **AI検索 / AI比較** | 検索ハブから TASFUL AI Workspace へ遷移（`source=platform`） |
| **Google OAuth** | コード確認のみ（本番前チェックリストを §6 に記載） |

---

## 2. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `listing-renderer.js` | `data-listing-id` · バッジ HTML · `renderPlatformBadgesHtml` · `syncPlatformListingBadges` |
| `business-board-renderer.js` | 業務サービスモバイルカードにバッジ · `data-listing-id` |
| `business-board-page.js` | 描画後 `syncPlatformListingBadges` |
| `listing-category-page.js` | カテゴリ一覧描画後 sync |
| `listing-feed.js` | フィード描画後 sync（将来利用） |
| `platform-badges.js` / `.css` | ポップオーバー注意書き · カード内余白 |
| `platform-favorites-folders.js` | `readAll` 対応 · 6フォルダ · export/import |
| `favorites-list.html` / `.js` / `.css` | フォルダタブ · フォルダ変更 select · 件数 |
| `platform-search-hub.js` | AI比較 → TASFUL AI 遷移 · `source=platform` |
| `ai-workspace-links.js` | search/compare URL に `source=platform` デフォルト |
| `ai-workspace-chat.js` | `compare=` クエリから比較シード |
| `product.html` / `skill.html` / `worker.html` / `business.html` | Platform バッジ script/CSS |
| `scripts/test-platform-finish-phase.mjs` | **新規** |
| `scripts/test-platform-next-phase.mjs` | folders / source テスト更新 |

**未変更:** `ai-model-gateway.js` · `builder-ai-core.js` · `admin-ai-secretary-*` · `live/tlv-tasful-ai-entry.js`

---

## 3. 掲載カードバッジ組込状況

| カード種別 | 接続 |
| --- | --- |
| 商品 / スキル / 求人 / ワーカー（`buildUnifiedListCardElement`） | ✅ タイトル下に最大5バッジ |
| 業務サービスモバイルカード | ✅ 会社名下にバッジ |
| カテゴリ一覧（product/skill/worker） | ✅ script 読込 + sync |
| 業務ボード（business.html） | ✅ script 読込 + sync |

**バッジ種別**

- 商品: ベストセラー / 人気 / 高評価 / 新着
- サービス: 🏅 AIおすすめ / 本人確認 / 資格確認 / 法人認証 / 即対応 / 近く

---

## 4. AIおすすめ理由表示

- 🏅 **AIおすすめ** バッジ押下 → ポップオーバー（最大5行）
- 理由例: ご希望地域 · ご予算内 · 高評価 · 本人確認済 · 返信速度が速い
- フッター注意: 「※ AIは契約・購入・依頼を決定しません。参考情報としてご利用ください。」
- 掲載プールは `syncPlatformListingBadges` / `TasuPlatformSearchHub.setListingPool` で供給

---

## 5. お気に入りフォルダ UI

| フォルダ | ID |
| --- | --- |
| 気になる | `interested`（デフォルト） |
| 比較中 | `comparing` |
| 仕事 | `work` |
| 商品 | `products` |
| あとで依頼 | `later` |
| その他 | `other` |

**機能:** タブ切替 · 件数表示 · 各カードのフォルダ変更 select · `tasful_favorite_folders_meta`（localStorage） · `exportMeta`/`importMeta`（将来 DB）

**ページ:** `favorites-list.html`

---

## 6. Google OAuth 本番前チェック

| 項目 | 状態 |
| --- | --- |
| Supabase OAuth Google provider 前提 | ✅ コード上 `TasuPlatformGoogleAuth` + `signInWithOAuth` |
| `returnTo` 維持 | ✅ `login.html?oauth=google&return=...` |
| LINE ログイン導線 | ✅ ボタン押下時「Google またはメール」を案内（LINE 非対応） |
| secret / client id 出力 | ✅ レポート・コードに secret 値なし |

### 本番前に人間がやること（Supabase Dashboard）

1. **Authentication → Providers → Google** を有効化
2. **Redirect URLs** に以下を登録（staging / production それぞれ）  
   - `https://{your-domain}/login.html`  
   - `https://{your-domain}/login.html?oauth=google`  
   - ローカル開発用: `http://localhost:8788/login.html` 等
3. Google Cloud Console で OAuth クライアント作成 · Authorized redirect URI を Supabase 指定 URL に合わせる
4. Supabase に Client ID / Client Secret を設定（**値はリポジトリにコミットしない**）
5. staging で Google ログイン E2E · return 先（dashboard / index-top 等）確認
6. production デプロイ後に同様 E2E

---

## 7. AI検索 / AI比較導線

| 導線 | 遷移先 |
| --- | --- |
| 検索ハブ「TASFUL AI検索」 | `ai-workspace.html?mode=cross-matching&q=...&send=1&source=platform` |
| 検索ハブ「AI比較」 | 上位候補2–3件 → `compare=id1,id2` + `source=platform` |
| Workspace 受信 | `applyLocationSeed` が `q` / `compare` / `send=1` を処理 |

Platform 専用 AI エンジンは**呼ばない**（deterministic assist + TASFUL AI 入口のみ）。

---

## 8. テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-platform-finish-phase.mjs` | **37/37 PASS** |
| `node scripts/test-platform-next-phase.mjs` | **37/37 PASS** |
| `npm run build:pages` | **PASS** |
| `node scripts/test-builder-ai-tools-adaptation.mjs` | **85/85 PASS**（24 action 回帰） |

---

## 9. 残タスク

| 項目 | 内容 |
| --- | --- |
| index.html ホーム featured カード | カスタム HTML のためバッジ未組込（一覧カードは対応済） |
| お気に入り DB 同期 | Supabase favorites + folder meta のサーバー保存 |
| 検索ハブ listing pool | TOP 初回ロード時にデモ/公開掲載を `setListingPool`（任意） |
| バッジ非 AI の押下説明 | 現状 AIおすすめのみインタラクティブ |
| Google OAuth E2E | Dashboard 設定後の実機確認 |

---

## 10. 完了条件

- [x] 掲載カードでバッジが見える（listing-renderer / 業務モバイル）
- [x] AIおすすめ理由が短く表示される（ポップオーバー + 注意書き）
- [x] お気に入りフォルダが一覧で使える
- [x] Google ログインの本番前設定項目が明確
- [x] AI検索/比較が TASFUL AI 入口に接続
- [x] 本レポート作成
