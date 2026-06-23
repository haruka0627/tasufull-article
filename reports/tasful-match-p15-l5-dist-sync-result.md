# TASFUL MATCH — P15-L5 dist 同期結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 前提 | P15-L4 UI **PASS** · 判定 **`READY_FOR_P15_L5_DIST_SYNC`** |
| prod-parity | **`http://127.0.0.1:8788`**（既存 dev server） |
| linked ref | **`ddojquacsyqesrjhcvmn`** |
| 判定 | **`PASS`** · **`READY_FOR_P15_RELEASE_CANDIDATE_LOCAL`** |
| 本番 URL | **`tasful.jp` 8 月まで保留** |

---

## 1. 実施サマリ

| 区分 | 結果 |
|------|------|
| `match/` → `deploy/cloudflare/dist/match/` 同期 | **25 ファイル** |
| `ai-workspace-links.js` → dist ルート | **同期済** |
| hash match（source = dist） | **PASS**（25 ファイル） |
| HTTP 200（9 + 3 ページ） | **PASS** |
| Visual smoke 390 / 768 / 1280 | **PASS** · console error 0 · 横スクロールなし |
| TASFUL AI CTA（link-only） | **PASS** |
| Linked ref P15 Edge smoke（L3 回帰） | **PASS** |

---

## 2. 同期ファイル一覧

### 2.1 `deploy/cloudflare/dist/match/`（24 + 共通 JS）

| 区分 | ファイル |
|------|----------|
| API / 配線 | `match-api.js` · `match-auth.js` · `match-wiring.js` · `match-mock.js` · `match-p15-wiring.js` · `match-p15-render.js` · `match-ai-cta.js` |
| データ / 描画 | `match-data-stub.js` · `match-data-render.js` |
| スタイル | `match.css` |
| 既存 9 ページ | `match-top.html` · `match-profile-create.html` · `match-swipe.html` · `match-list.html` · `match-talk-bridge.html` · `match-safety.html` · `match-report.html` · `match-block.html` · `match-verify.html` |
| 拡張 / 新規 | `match-mypage.html` · `match-review.html` · **`match-favorites.html`** · **`match-footprints.html`** · **`match-search-saved.html`** |

### 2.2 dist ルート

| ファイル | 変更 |
|----------|------|
| `deploy/cloudflare/dist/ai-workspace-links.js` | `returnTo` · `buildMatchCtaUrl()` 追加 |

### 2.3 補助更新

| ファイル | 内容 |
|----------|------|
| `scripts/verify-match-ui-prod-url-review.mjs` | `DIST_SYNC_FILES` を P15 全量に拡張 |

---

## 3. hash match

**方式:** SHA-256 · `match/{file}` === `deploy/cloudflare/dist/match/{file}` · `ai-workspace-links.js` ルート同士

| タイミング | 結果 |
|------------|------|
| 同期前 | dist に P15 未反映（L4 smoke で確認済） |
| 同期後 | **25 ファイルすべて hash 一致** |

---

## 4. Smoke 結果

```bash
node scripts/smoke-match-p15-l5-dist-sync.mjs
```

| # | チェック | 結果 |
|---|----------|------|
| 1 | dist sync（25 files copied） | **OK** |
| 2 | hash match（25 files source=dist） | **OK** |
| 3 | HTTP 200（12 pages @ 8788/match/） | **OK** |
| 4 | Visual 390px（12 pages · console 0） | **OK** |
| 5 | Visual 768px | **OK** |
| 6 | Visual 1280px | **OK** |
| 7 | TASFUL AI CTA（3 CTAs · link-only · no iframe） | **OK** |
| 8 | Linked ref P15 Edge（`smoke-match-p15-l3-edge.mjs --skip-deploy --skip-grants`） | **OK** |

**Smoke result:** **PASS**（8 checks · 約 54s）

### 4.1 検証項目（再確認）

| 要件 | 状態 |
|------|------|
| raw `last_active_at` / `viewed_at` 非表示 | ✅ body 走査 PASS |
| `activity_label` / `footprint_label` のみ | ✅ L4 render 維持 |
| 「オンライン中」非表示 | ✅ PASS |
| MATCH 内 AI 内蔵なし | ✅ iframe なし · CTA href のみ |
| L9 report/block/verify DOM | ✅ probe 維持 |

---

## 5. prod-parity

| 項目 | 値 |
|------|-----|
| Base URL | `http://127.0.0.1:8788` |
| パス | `/match/match-*.html` |
| サーバー | 既存 Pages dev（dist 配信） |

再実行例:

```bash
node scripts/smoke-match-p15-l5-dist-sync.mjs --skip-sync
node scripts/verify-match-ui-prod-url-review.mjs --base http://127.0.0.1:8788
```

---

## 6. FAIL 記録

**該当なし**

---

## 7. Rollback

| 順 | 操作 |
|----|------|
| 1 | `deploy/cloudflare/dist/match/` の P15 ファイルを直前コミット SHA に戻す |
| 2 | `deploy/cloudflare/dist/ai-workspace-links.js` を revert |
| 3 | Cloudflare Pages 再デプロイ（必要時） |

Edge / DB は L5 スコープ外 — UI のみ dist revert で L4 以前状態に復帰可能。

---

## 8. 次アクション

| 項目 | 状態 |
|------|------|
| P15-L5 dist 同期 | **完了** |
| ローカル release candidate | **`READY_FOR_P15_RELEASE_CANDIDATE_LOCAL`** |
| `tasful.jp` prod URL 確認 | **8 月まで保留** |
| Cloudflare Pages 本番 deploy | **別承認** |

**判定:** **`READY_FOR_P15_RELEASE_CANDIDATE_LOCAL`**

---

## 9. 参照

| 文档 | 路径 |
|------|------|
| L4 実装結果 | `reports/tasful-match-p15-l4-ui-implement-result.md` |
| L5 smoke | `scripts/smoke-match-p15-l5-dist-sync.mjs` |
| L3 Edge smoke | `scripts/smoke-match-p15-l3-edge.mjs` |
| prod-parity review | `scripts/verify-match-ui-prod-url-review.mjs` |
