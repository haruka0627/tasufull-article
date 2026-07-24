# Business Directory R1b — public/list.html Supabase Config 読込修正

**実施日:** 2026-07-01  
**種別:** R1b 残課題修正 · 8788 ブラウザ確認  
**Production ref:** `ddojquacsyqesrjhcvmn`（DB 変更なし）

---

## 0. Executive summary

| 項目 | 結果 |
| --- | --- |
| **原因** | `list.html` に `chat-supabase-config.js` の `<script>` が **未記載**（R1 `detail.html` と同型） |
| **修正** | `list.html` に config を **repository より前** で 1 行追加 |
| **8788 確認** | list / config **HTTP 200** · `TASU_CHAT_SUPABASE_CONFIG.url` OK · 一覧 **12 件** · Console Error **なし** |
| **R1b** | ✅ **解消** |

---

## 1. 原因

### 1.1 直接原因

`business-directory/public/list.html` は `business-directory-repository.js` を読み込むが、リポジトリが Edge 呼び出しに使う **`window.TASU_CHAT_SUPABASE_CONFIG` を定義する `chat-supabase-config.js` を読み込んでいなかった**。

`functionsBase()` が空文字を返すため、一覧 API（`getPublicListings`）が live モードで **Edge に到達できない**。mock モード（`?bdPublicMock=1`）では localStorage 依存のため **症状が出にくかった**。

### 1.2 `detail.html` との差分（修正前）

| ページ | `chat-supabase-config.js` | 読込順 |
| --- | --- | --- |
| `public/detail.html` | ✅（R1 修正済） | config → repository |
| `public/list.html` | ❌ **欠落** | repository のみ先頭 |

R1 レポート（[business-directory-public-detail-config-fix.md](./business-directory-public-detail-config-fix.md)）で **R1b として list も同欠落** と記録済み。本タスクで解消。

### 1.3 調査結果

| 確認項目 | 修正前 |
| --- | --- |
| script 読込順 | repository → categories → common → public.js |
| `chat-supabase-config.js` | **なし** |
| config が repository より前 | **否** |
| Owner ページ（`index.html` 等） | 読込済み（変更なし） |

---

## 2. 修正内容

`business-directory/public/list.html` — **repository より前** に 1 行追加（R1 と同一パターン）:

```html
<script src="../../chat-supabase-config.js"></script>
<script src="../../business-directory-repository.js"></script>
```

**意図的に含めなかったもの:**

- `@supabase/supabase-js` / `tasu-supabase-client.js` — public 一覧は Edge `fetch` のみ
- 他 public ページへの横展開 — **list のみ**（スコープ限定）
- UI / 検索 / 一覧ロジック — **変更なし**

---

## 3. 変更ファイル

| ファイル | 操作 |
| --- | --- |
| `business-directory/public/list.html` | config script 1 行追加 |
| `scripts/test-business-directory-page-content-phase2b.mjs` | list config 静的 assert 3 件追加 |
| `deploy/cloudflare/dist/business-directory/public/list.html` | `npm run build:pages` で同期 |

---

## 4. 8788 確認結果

**前提:** `npm run build:pages` 後 `npm run dev` · port **8788 LISTEN**

| 確認 | 結果 |
| --- | --- |
| HTTP `.../business-directory/public/list.html` | **200** |
| HTTP `.../business-directory/public/detail.html` | **200**（R1 回帰なし） |
| HTTP `.../chat-supabase-config.js` | **200** · `TASU_CHAT_SUPABASE_CONFIG` 含む |
| Playwright: `TASU_CHAT_SUPABASE_CONFIG.url` | **OK** |
| Playwright: 一覧カード数（live API） | **12** |
| Console Error | **なし** |
| Toast エラー | **なし** |

**Viewport:** CSS / レイアウト変更なし · 1280 相当（Playwright default）で確認。390/768 専用 capture は未実施。

---

## 5. テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-business-directory-page-content-phase2b.mjs` | **27/0** PASS（list config assert 追加含む） |
| `node scripts/test-business-directory-page-renderer-phase3a.mjs` | **23/0** PASS |
| `node scripts/test-business-directory-phase5-public-ui.mjs` | **27/0** PASS（browser mock 一覧含む） |
| `npm run build:pages` | **PASS** |

---

## 6. 影響有無

| 対象 | 影響 |
| --- | --- |
| **`detail.html`** | **なし**（ファイル未変更 · HTTP 200 · mock detail 表示 OK） |
| **Owner 側**（`index.html` / `edit.html` / `new.html`） | **なし**（変更なし · phase5「owner UI unchanged」PASS） |
| **Admin** | **なし** |
| **BD 以外** | **なし** |

---

## 7. DB / Edge / Stripe / env

| 項目 | 本タスク |
| --- | --- |
| DB / Migration | **変更なし** |
| Edge Functions | **変更なし** |
| Stripe | **変更なし** |
| Cloudflare env / secrets | **変更なし** |

Production DB は **Production Ready** 状態を維持。

---

## 8. 変更サマリー

```diff
 business-directory/public/list.html
+  <script src="../../chat-supabase-config.js"></script>
   <script src="../../business-directory-repository.js"></script>
```

---

*R1b 完了。R1（detail）+ R1b（list）で public ページの Supabase config 読込漏れを解消。*
