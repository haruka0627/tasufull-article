# TASFUL 公開前 UI 最終確認

PC **1280px** / SP **390px** / **360px** で主要ページのレイアウト・導線・コンソールを確認します。

## 自動スモーク

```bash
# 開発サーバー起動後（例: 5173）
BASE_URL=http://127.0.0.1:5173 node scripts/test-tasful-ui-final-smoke.mjs

# 既存回帰
BASE_URL=http://127.0.0.1:5173 node scripts/test-platform-all-browser.mjs
BASE_URL=http://127.0.0.1:5173 node scripts/test-listing-detail-link-browser.mjs
BASE_URL=http://127.0.0.1:5173 node scripts/test-favorite-actions-browser.mjs
node scripts/browser-test-gen-ai.mjs
node scripts/verify-gen-ai-voice-ui-smoke.mjs
node scripts/verify-voice-input.mjs
```

レポート: `screenshots/tasful-ui-final-smoke-report.json`

## 対象ページ（20）

| # | ページ |
|---|--------|
| 1 | index-top.html |
| 2 | index.html |
| 3 | post.html |
| 4 | gen-ai-workspace.html?mode=AIキャラ会話 |
| 5 | ai-workspace.html |
| 6 | chat-list.html |
| 7 | chat-detail.html |
| 8 | dashboard.html |
| 9 | my-listings.html |
| 10–17 | detail-general / skill / worker / product / job / shop / shop-product / business-service |
| 18–20 | builder/builder-top, mvp-threads, mvp-project-detail |

## 手動で追加確認（自動では不足）

- **index-top SP**: 軽微な横スクロール（+24px 超）がないか目視
- **post**: 下部「掲載内容を確認」→ 確認画面導線
- **gen-ai**: マイク許可・音声認識・読み上げ → [gen-ai-voice-manual-checklist.md](./gen-ai-voice-manual-checklist.md)
- **detail-general**: 汎用レイアウト・CTA（お気に入りはテンプレートにより無い場合あり）
- **ai-workspace**: Vite で HTML がパースできるか（`meta` 閉じタグ等）

## DevTools チェック項目

1. `document.documentElement.scrollWidth` ≈ `innerWidth`（横スクロール）
2. 主要 CTA が viewport 内またはスクロールで到達可能
3. detail: `h1`、問い合わせ/カート、`data-favorite-button` または `data-biz-detail-favorite`
4. gen-ai: `data-voice-status`、`body[data-ai-speaking]`（`?voice_debug=1` 可）
5. Console: Supabase 400 / favicon 以外の error がないか

## 音声会話 MVP

→ [gen-ai-voice-manual-checklist.md](./gen-ai-voice-manual-checklist.md)
