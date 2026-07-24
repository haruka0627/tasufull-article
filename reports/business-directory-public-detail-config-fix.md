# Business Directory R1 — public/detail.html Supabase Config 読込修正

**実施日:** 2026-07-01  
**種別:** R1 残課題修正 · ブラウザ表示確認  
**Production ref:** `ddojquacsyqesrjhcvmn`（DB 変更なし）

---

## 0. Executive summary

| 項目 | 結果 |
| --- | --- |
| **原因** | `detail.html` に `chat-supabase-config.js` の `<script>` が **未記載** |
| **修正** | `detail.html` に config を **repository より前** で 1 行追加 |
| **8788 確認** | detail / config **HTTP 200** · Free 公開詳細 **表示 PASS** |
| **R1** | ✅ **解消** |
| **R2 Stripe E2E** | 未着手（別 Epic） |

---

## 1. 原因

### 1.1 直接原因

`business-directory/public/detail.html` は `business-directory-repository.js` を読み込むが、リポジトリが参照する **`window.TASU_CHAT_SUPABASE_CONFIG` を定義する `chat-supabase-config.js` を読み込んでいなかった**。

```javascript
// business-directory-repository.js
function functionsBase() {
  const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
  const url = String(cfg.url || ...).replace(/\/$/, "");
  if (!url) return "";  // → invoke 不可
}
```

`functionsBase()` が空文字を返すため `TasuBusinessDirectoryRepository` は存在するが **Edge API 呼び出し不可**。  
`business-directory-public.js` の `initDetailPage()` では `getRepository()` は non-null だが fetch が失敗し、トーストにエラー表示（または空詳細）。

### 1.2 他ページとの差分

| ページ | `chat-supabase-config.js` |
| --- | --- |
| `business-directory/index.html` | ✅ `../chat-supabase-config.js` |
| `business-directory/edit.html` | ✅ |
| `business-directory/new.html` | ✅ |
| `business-directory/public/detail.html` | ❌ **欠落（修正前）** |
| `business-directory/public/list.html` | ❌ **欠落（本 R1 スコープ外）** |

Owner / Admin は読込済み。**Public detail のみ漏れ**（list も同型だが R1 正本は detail）。

### 1.3 ビルド / 環境

| 環境 | config の供給 |
| --- | --- |
| **8788 local dev** | リポジトリ直下 `chat-supabase-config.js`（`../../` 相対パス） |
| **Cloudflare Pages build** | `stage-cloudflare-pages.mjs` が `TASFUL_SUPABASE_*` または local config から **dist ルート** に生成 |
| **Production DB** | 変更なし |

パス `../../chat-supabase-config.js` は `business-directory/public/` から dist ルートの config に正しく到達する（Owner の `../` と public 階層差 1 段）。

---

## 2. 修正ファイル

| ファイル | 操作 |
| --- | --- |
| `business-directory/public/detail.html` | config script 追加 |
| `scripts/test-business-directory-page-content-phase2b.mjs` | 静的 assert 1 件追加 |
| `deploy/cloudflare/dist/business-directory/public/detail.html` | `npm run build:pages` で同期 |

---

## 3. 修正内容

`business-directory/public/detail.html` — **repository より前** に 1 行追加:

```html
<script src="../../chat-supabase-config.js"></script>
<script src="../../business-directory-repository.js"></script>
```

**意図的に含めなかったもの:**

- `@supabase/supabase-js` — public detail は Edge `fetch` のみ（repository 経由）で anon JWT 不要の直接 DB 接続なし
- `tasu-supabase-client.js` — Owner ログイン用 · public anon 詳細には不要
- `list.html` — R1 スコープは detail のみ（list も同欠落 · 別タスク可）

---

## 4. ローカル確認結果（8788）

**前提:** `npm run build:pages` 後 `npm run dev` · port **8788 LISTEN**

| 確認 | 結果 |
| --- | --- |
| HTTP `.../business-directory/public/detail.html` | **200** |
| HTTP `.../chat-supabase-config.js` | **200** · `TASU_CHAT_SUPABASE_CONFIG` 含む |
| Supabase config error（console） | **なし**（browser smoke 経由） |
| Free listing `short_description` 表示 | ✅ PASS |
| Free planGate（FAQ / full 非表示） | ✅ PASS |
| Phase 2a API（smoke · Edge） | ✅ 16/16 API 系 PASS |

**Browser smoke（Production API + 8788 UI）:**

```text
PASS: Free public short_description visible
PASS: Free planGate hides FAQ/full
NOTE/FAIL: Standard+ rich — --skip-stripe のため plan=free 扱い（既知 · R2 前）
```

Standard+ リッチ表示 FAIL は **Stripe 未連携で listing が free プランのまま** のため planGate が FAQ/full を隠す **想定内**（smoke NOTE 記載どおり）。**R1 とは無関係**。

**Viewport:** smoke は Playwright default（1280 相当）· 390/768 専用 capture は未実施（CSS 変更なし）。

---

## 5. テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-business-directory-page-content-phase2b.mjs` | **24/0** PASS（config assert 追加含む） |
| `node scripts/test-business-directory-page-renderer-phase3a.mjs` | **23/0** PASS |
| `node scripts/test-business-directory-phase5-public-ui.mjs` | **27/0** PASS |
| `node scripts/test-business-directory-phase2a-production-smoke.mjs --skip-stripe` | **19 pass / 1 fail**（Standard+ browser · skip-stripe 既知） |
| `npm run build:pages` | **PASS** |

**Owner preview / edit:** 変更なし · phase3a owner preview テスト PASS。

---

## 6. 残課題

| ID | 項目 | 備考 |
| --- | --- | --- |
| **R1** | public/detail config | ✅ **本修正で解消** |
| **R1b** | `public/list.html` も config 未読込 | ✅ **R1b 完了**（[list config fix](./business-directory-public-list-config-fix.md)） |
| **R2** | Production Stripe E2E | 別 Epic |
| **R5** | CLI Production link | Staging 作業前 re-link |
| **Q1** | URL クエリ `type` vs smoke の `listing_type` | detail API は `type` 正本 · smoke browser URL は `listing_type` — slug 一意時は動作するが **統一推奨** |

---

## 7. Production 反映時の注意

1. **ソース + dist 同時デプロイ** — `business-directory/public/detail.html` と `deploy/cloudflare/dist/.../detail.html` を Pages に含める（`npm run build:pages` 済み dist）。
2. **Cloudflare build env** — `TASFUL_SUPABASE_URL` · `TASFUL_SUPABASE_ANON_KEY` が CI/Pages で設定されていること（未設定時は local `chat-supabase-config.js` フォールバック · **Production ビルドでは env 必須**）。
3. **`chat-supabase-config.js` は gitignore 可** — Production ビルドは **env 注入** が正本（[supabase-environments.md](../docs/supabase-environments.md)）。
4. **DB / Edge / Stripe** — 本タスクでは **変更なし** · controlled apply 済み状態を維持。
5. **list.html** — Production 一覧も live API を使う場合は **R1b 同様の config 追加** が必要。

---

## 8. 変更サマリー

```diff
 business-directory/public/detail.html
+  <script src="../../chat-supabase-config.js"></script>
   <script src="../../business-directory-repository.js"></script>
```

---

*R1 完了。Commercial Launch 判定は R2（Stripe E2E）等が残存。*
