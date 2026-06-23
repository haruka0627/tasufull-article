# Builder Mobile Responsive Audit

- **Base URL:** http://127.0.0.1:8788
- **Widths:** 390 / 430 / 768 / 1280px
- **Date:** 2026-06-20
- **Pages audited:** 23
- **Note:** コード修正なし・監査のみ

## Summary

| Severity | Count |
|----------|-------|
| HIGH | 0 |
| MID | 14 |
| LOW | 5 |

## Issue List

| 重要度 | ページ | 幅 | 問題箇所 | 詳細 | 修正方針 |
|--------|--------|-----|----------|------|----------|
| **MID** | Builder TOP | 390px | ヘッダー | ヘッダーが横はみ出し | ヘッダーグリッドを1列化、長いタイトルを truncate |
| **MID** | 案件新規作成 | 390px | タップ領域 | 44px未満 8 件 — [{"text":"×","w":22,"h":22,"cls":"mvp-chip__x"},{"text":"×","w":22,"h":22,"cls":"mvp-chip__x"},{"text":"×", | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | 投稿作成 | 390px | タップ領域 | 44px未満 6 件 — [{"text":"B","w":25,"h":29,"cls":"mvp-dark-textarea__tool"},{"text":"I","w":21,"h":29,"cls":"mvp-dark-texta | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | 掲示板一覧 | 390px | タップ領域 | 44px未満 5 件 — [{"text":"Builder\n              掲示板","w":358,"h":43,"cls":"builder-brand"},{"text":"即日対応できる動画編集者","w":213, | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | MVP案件一覧 | 390px | タップ領域 | 44px未満 6 件 — [{"text":"OFF","w":98,"h":40,"cls":"mvp-toggle"},{"text":"ON","w":92,"h":40,"cls":"mvp-toggle is-on"},{"tex | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | Admin カレンダー | 390px | タップ領域 | 44px未満 8 件 — [{"text":"‹","w":34,"h":44,"cls":"builder-btn builder-btn--ghost"},{"text":"›","w":34,"h":44,"cls":"builder | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | Builder TOP | 430px | ヘッダー | ヘッダーが横はみ出し | ヘッダーグリッドを1列化、長いタイトルを truncate |
| **MID** | 案件新規作成 | 430px | タップ領域 | 44px未満 8 件 — [{"text":"×","w":22,"h":22,"cls":"mvp-chip__x"},{"text":"×","w":22,"h":22,"cls":"mvp-chip__x"},{"text":"×", | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | 投稿作成 | 430px | タップ領域 | 44px未満 6 件 — [{"text":"B","w":25,"h":29,"cls":"mvp-dark-textarea__tool"},{"text":"I","w":21,"h":29,"cls":"mvp-dark-texta | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | 掲示板一覧 | 430px | タップ領域 | 44px未満 6 件 — [{"text":"Builder\n              掲示板","w":398,"h":43,"cls":"builder-brand"},{"text":"即日対応できる動画編集者","w":213, | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | MVP案件一覧 | 430px | タップ領域 | 44px未満 7 件 — [{"text":"OFF","w":98,"h":40,"cls":"mvp-toggle"},{"text":"ON","w":92,"h":40,"cls":"mvp-toggle is-on"},{"tex | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | Admin カレンダー | 430px | タップ領域 | 44px未満 8 件 — [{"text":"‹","w":34,"h":44,"cls":"builder-btn builder-btn--ghost"},{"text":"›","w":34,"h":44,"cls":"builder | min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域 |
| **MID** | Builder TOP | 768px | ヘッダー | ヘッダーが横はみ出し | ヘッダーグリッドを1列化、長いタイトルを truncate |
| **MID** | Builder TOP | 1280px | ヘッダー | ヘッダーが横はみ出し | ヘッダーグリッドを1列化、長いタイトルを truncate |
| **LOW** | パートナーダッシュボード | 390px | タップ領域 | 44px未満 1 件 | 主要CTAのみ 44px 確保 |
| **LOW** | 一般ダッシュボード | 390px | タップ領域 | 44px未満 1 件 | 主要CTAのみ 44px 確保 |
| **LOW** | 掲示板詳細 | 390px | タップ領域 | 44px未満 1 件 | 主要CTAのみ 44px 確保 |
| **LOW** | 掲示板スレッド | 390px | タップ領域 | 44px未満 2 件 | 主要CTAのみ 44px 確保 |
| **LOW** | Admin 評価 | 390px | タップ領域 | 44px未満 1 件 | 主要CTAのみ 44px 確保 |

---

## By Page

### Builder TOP

URL: `/builder/builder-top.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/builder-top-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/builder-top-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/builder-top-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/builder-top-1280.png` |

### パートナーダッシュボード

URL: `/builder/index.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/partner-dash-390.png` |
| 430px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/partner-dash-430.png` |
| 768px | 200 | no | 3 | `reports/screenshots/builder-mobile-audit/partner-dash-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/builder-mobile-audit/partner-dash-1280.png` |

### 一般ダッシュボード

URL: `/builder/user-dashboard.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/user-dash-390.png` |
| 430px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/user-dash-430.png` |
| 768px | 200 | no | 3 | `reports/screenshots/builder-mobile-audit/user-dash-768.png` |
| 1280px | 200 | no | 5 | `reports/screenshots/builder-mobile-audit/user-dash-1280.png` |

### 運営Adminダッシュボード

URL: `/builder-admin/admin-index.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-dash-390.png` |
| 430px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-dash-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/builder-mobile-audit/admin-dash-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/builder-mobile-audit/admin-dash-1280.png` |

### 案件新規作成

URL: `/builder/mvp-project-new.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-new-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-new-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-new-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-new-1280.png` |

### テンプレート編集

URL: `/builder/template-edit.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/template-edit-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/template-edit-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/template-edit-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/template-edit-1280.png` |

### 投稿作成

URL: `/builder/mvp-post.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-post-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-post-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-post-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-post-1280.png` |

### 掲示板一覧

URL: `/builder/board-projects.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-projects-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-projects-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-projects-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-projects-1280.png` |

### 掲示板詳細

URL: `/builder/board-project-detail.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-project-detail-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-project-detail-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-project-detail-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-project-detail-1280.png` |

### MVP案件一覧

URL: `/builder/mvp-projects.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-projects-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-projects-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-projects-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-projects-1280.png` |

### MVP案件詳細

URL: `/builder/mvp-project-detail.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-detail-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-detail-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-detail-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-project-detail-1280.png` |

### テンプレート一覧

URL: `/builder/templates.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/templates-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/templates-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/templates-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/templates-1280.png` |

### 掲示板スレッド

URL: `/builder/board-threads.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-threads-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-threads-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-threads-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/board-threads-1280.png` |

### やりとり一覧

URL: `/builder/mvp-threads.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-threads-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-threads-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-threads-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/mvp-threads-1280.png` |

### 設定

URL: `/builder/settings.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/settings-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/settings-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/settings-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/settings-1280.png` |

### パートナー

URL: `/builder/partners.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/partners-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/partners-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/partners-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/partners-1280.png` |

### Admin 応募管理

URL: `/builder/admin-applications.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-applications-390.png` |
| 430px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-applications-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/builder-mobile-audit/admin-applications-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/builder-mobile-audit/admin-applications-1280.png` |

### Admin パートナー

URL: `/builder/admin-partners.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partners-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partners-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partners-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partners-1280.png` |

### Admin 配信

URL: `/builder/admin-dispatch.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-dispatch-390.png` |
| 430px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-dispatch-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/builder-mobile-audit/admin-dispatch-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/builder-mobile-audit/admin-dispatch-1280.png` |

### Admin カレンダー

URL: `/builder/admin-calendar.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-calendar-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-calendar-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-calendar-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-calendar-1280.png` |

### Admin 通知

URL: `/builder/admin-notifications.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-notifications-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-notifications-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-notifications-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-notifications-1280.png` |

### Admin レビュー

URL: `/builder/admin-reviews.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-reviews-390.png` |
| 430px | 200 | no | 1 | `reports/screenshots/builder-mobile-audit/admin-reviews-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/builder-mobile-audit/admin-reviews-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/builder-mobile-audit/admin-reviews-1280.png` |

### Admin 評価

URL: `/builder/admin-partner-evaluations.html`

| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |
|-----|------|-------------|--------|-------------------|
| 390px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partner-evaluations-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partner-evaluations-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partner-evaluations-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/builder-mobile-audit/admin-partner-evaluations-1280.png` |

