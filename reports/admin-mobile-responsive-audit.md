# TASFUL 管理者向け画面 — モバイル監査

- **Base URL:** http://127.0.0.1:8788
- **Widths:** 390 / 430 / 768 / 1280px
- **Date:** 2026-06-20
- **Pages:** 16（利用者・市場・TALK・AI利用者・IWASHO は除外）
- **Note:** コード修正なし

## 完了条件: スマホ未対応ページ一覧

| 優先 | URL | 状態 | HIGH(390/430) | MID(390/430) |
|------|-----|------|---------------|-------------|
| P1 | `/builder-admin/admin-index.html` | スマホ未対応 | 2 | 2 |
| P1 | `/builder/admin-dispatch.html` | スマホ未対応 | 2 | 2 |
| P1 | `/admin-operations-dashboard.html` | スマホ未対応 | 4 | 0 |
| P1 | `/admin-ai-operations-center.html` | スマホ未対応 | 2 | 2 |
| P1 | `/talk-ops-room.html` | スマホ未対応 | 2 | 0 |
| P1 | `/support-trouble-center.html` | スマホ未対応 | 2 | 0 |
| P1 | `/anpi-dashboard.html` | スマホ未対応 | 2 | 0 |
| P1 | `/anpi-line-admin.html` | スマホ未対応 | 2 | 0 |
| P1 | `/anpi-notifications.html` | スマホ未対応 | 4 | 0 |

### 部分対応（要改善）

| URL | 状態 | MID(390/430) |
|-----|------|-------------|
| `/builder/admin-applications.html` | 概ね対応（MID残） | 2 |
| `/builder/admin-partners.html` | 概ね対応（MID残） | 2 |
| `/builder/admin-calendar.html` | 部分対応（要改善） | 4 |
| `/builder/admin-reviews.html` | 概ね対応（MID残） | 2 |

## Summary

| Severity | Count |
|----------|-------|
| HIGH | 22 |
| MID | 16 |
| LOW | 6 |

## Issue List（重要度順）

| 優先 | 重要度 | ページ | 幅 | 問題 | 詳細 | 修正方針 |
|------|--------|--------|-----|------|------|----------|
| P1 | **HIGH** | Builder Admin ダッシュボード | 390px | ボタン/リンク | 極小タップ 1 件 — [{"text":"利用者Builderへ","w":91,"h":17,"cls":"builder-admin-back"}] | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | Builder 案件手配 | 390px | ボタン/リンク | 極小タップ 3 件 — [{"text":"案件詳細 ›","w":55,"h":17,"cls":"builder-admin-notification-link"},{"tex | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | AI運営司令塔 | 390px | サイドバー | sidebar full-screen 390px — no backdrop? | 768px以下で off-canvas + ハンバーガー、デフォルト非表示 |
| P1 | **HIGH** | AI運営司令塔 | 390px | ボタン/リンク | 極小タップ 4 件 — [{"text":"✉\n          問い合わせ\n      ","w":103,"h":35,"cls":"ops-ai-nav__item"} | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | AI運営センター (API) | 390px | ボタン/リンク | 極小タップ 6 件 — [{"text":"← Builder Admin","w":110,"h":20,"cls":"ai-ops-back"},{"text":"問い合わせ" | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 運営TALKルーム (旧) | 390px | ボタン/リンク | 極小タップ 1 件 — [{"text":"AI運営司令塔","w":78,"h":19,"cls":""}] | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 重要問い合わせセンター | 390px | ボタン/リンク | 極小タップ 2 件 — [{"text":"TASFUL Admin","w":85,"h":17,"cls":"support-trouble-crumb__link"},{"t | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 安否ダッシュボード | 390px | ボタン/リンク | 極小タップ 3 件 — [{"text":"詳細を見る ›","w":95,"h":34,"cls":"anpi-stat-card__action"},{"text":"詳細を見 | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 安否通知センター | 390px | ボタン/リンク | 極小タップ 1 件 — [{"text":"更新","w":50,"h":32,"cls":"anpi-notifications-refresh"}] | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | Builder Admin ダッシュボード | 430px | ボタン/リンク | 極小タップ 1 件 — [{"text":"利用者Builderへ","w":91,"h":17,"cls":"builder-admin-back"}] | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | Builder 案件手配 | 430px | ボタン/リンク | 極小タップ 3 件 — [{"text":"案件詳細 ›","w":55,"h":17,"cls":"builder-admin-notification-link"},{"tex | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | AI運営司令塔 | 430px | サイドバー | sidebar full-screen 430px — no backdrop? | 768px以下で off-canvas + ハンバーガー、デフォルト非表示 |
| P1 | **HIGH** | AI運営司令塔 | 430px | ボタン/リンク | 極小タップ 4 件 — [{"text":"✉\n          問い合わせ\n      ","w":103,"h":35,"cls":"ops-ai-nav__item"} | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | AI運営センター (API) | 430px | ボタン/リンク | 極小タップ 6 件 — [{"text":"← Builder Admin","w":110,"h":20,"cls":"ai-ops-back"},{"text":"問い合わせ" | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 運営TALKルーム (旧) | 430px | ボタン/リンク | 極小タップ 1 件 — [{"text":"AI運営司令塔","w":78,"h":19,"cls":""}] | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 重要問い合わせセンター | 430px | ボタン/リンク | 極小タップ 2 件 — [{"text":"TASFUL Admin","w":85,"h":17,"cls":"support-trouble-crumb__link"},{"t | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 安否ダッシュボード | 430px | ボタン/リンク | 極小タップ 3 件 — [{"text":"詳細を見る ›","w":95,"h":34,"cls":"anpi-stat-card__action"},{"text":"詳細を見 | インライン link を block 化、min-height:44px |
| P1 | **HIGH** | 安否通知センター | 430px | ボタン/リンク | 極小タップ 1 件 — [{"text":"更新","w":50,"h":32,"cls":"anpi-notifications-refresh"}] | インライン link を block 化、min-height:44px |
| P2 | **HIGH** | LINE運用 (管理者) | 390px | 固定ヘッダー/CTA | fixed header+CTA gap ~-61px | main に padding-bottom、sticky CTA の高さ分確保 |
| P2 | **HIGH** | 安否通知センター | 390px | 固定ヘッダー/CTA | fixed header+CTA gap ~-61px | main に padding-bottom、sticky CTA の高さ分確保 |
| P2 | **HIGH** | LINE運用 (管理者) | 430px | 固定ヘッダー/CTA | fixed header+CTA gap ~-61px | main に padding-bottom、sticky CTA の高さ分確保 |
| P2 | **HIGH** | 安否通知センター | 430px | 固定ヘッダー/CTA | fixed header+CTA gap ~-61px | main に padding-bottom、sticky CTA の高さ分確保 |
| P3 | **MID** | Builder Admin ダッシュボード | 390px | 数値カード | stat/KPI grid が 2 列（390px） | 640px以下で grid-template-columns:1fr |
| P3 | **MID** | Builder 応募管理 | 390px | 数値カード | stat/KPI grid が 2 列（390px） | 640px以下で grid-template-columns:1fr |
| P3 | **MID** | Builder 案件手配 | 390px | 数値カード | stat/KPI grid が 2 列（390px） | 640px以下で grid-template-columns:1fr |
| P3 | **MID** | Builder 審査管理 | 390px | 数値カード | stat/KPI grid が 2 列（390px） | 640px以下で grid-template-columns:1fr |
| P3 | **MID** | Builder Admin ダッシュボード | 430px | 数値カード | stat/KPI grid が 2 列（430px） | 640px以下で grid-template-columns:1fr |
| P3 | **MID** | Builder 応募管理 | 430px | 数値カード | stat/KPI grid が 2 列（430px） | 640px以下で grid-template-columns:1fr |
| P3 | **MID** | Builder 案件手配 | 430px | 数値カード | stat/KPI grid が 2 列（430px） | 640px以下で grid-template-columns:1fr |
| P3 | **MID** | Builder 審査管理 | 430px | 数値カード | stat/KPI grid が 2 列（430px） | 640px以下で grid-template-columns:1fr |
| P4 | **MID** | Builder パートナー検索 | 390px | ボタン | 44px未満 8 件 | 主要CTA・戻る・検索に min-height:44px |
| P4 | **MID** | Builder 案件カレンダー | 390px | ボタン | 44px未満 8 件 | 主要CTA・戻る・検索に min-height:44px |
| P4 | **MID** | Builder 案件カレンダー | 390px | タブ/フィルター | 高さ40px未満 3 件 | min-height:44px、横スクロール tablist |
| P4 | **MID** | AI運営センター (API) | 390px | タブ/フィルター | 高さ40px未満 8 件 | min-height:44px、横スクロール tablist |
| P4 | **MID** | Builder パートナー検索 | 430px | ボタン | 44px未満 8 件 | 主要CTA・戻る・検索に min-height:44px |
| P4 | **MID** | Builder 案件カレンダー | 430px | ボタン | 44px未満 8 件 | 主要CTA・戻る・検索に min-height:44px |
| P4 | **MID** | Builder 案件カレンダー | 430px | タブ/フィルター | 高さ40px未満 3 件 | min-height:44px、横スクロール tablist |
| P4 | **MID** | AI運営センター (API) | 430px | タブ/フィルター | 高さ40px未満 8 件 | min-height:44px、横スクロール tablist |
| P5 | **LOW** | Builder Admin スレッド管理 | 390px | ボタン | 44px未満 1 件 | 主要操作のみ 44px 確保 |
| P5 | **LOW** | Builder 応募管理 | 390px | ボタン | 44px未満 3 件 | 主要操作のみ 44px 確保 |
| P5 | **LOW** | Builder 通知送信 | 390px | ボタン | 44px未満 3 件 | 主要操作のみ 44px 確保 |
| P5 | **LOW** | Builder 審査管理 | 390px | ボタン | 44px未満 3 件 | 主要操作のみ 44px 確保 |
| P5 | **LOW** | Builder パートナー評価 | 390px | ボタン | 44px未満 3 件 | 主要操作のみ 44px 確保 |
| P5 | **LOW** | LINE運用 (管理者) | 390px | ボタン | 44px未満 3 件 | 主要操作のみ 44px 確保 |

---

## By Page

### Builder Admin ダッシュボード — スマホ未対応

URL: `/builder-admin/admin-index.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/builder-admin-dash-390.png` |
| 430px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/builder-admin-dash-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/builder-admin-dash-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/admin-mobile-audit/builder-admin-dash-1280.png` |

### Builder Admin スレッド管理 — 対応済み（軽微のみ）

URL: `/builder-admin/threads.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/builder-admin-threads-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/builder-admin-threads-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/builder-admin-threads-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/builder-admin-threads-1280.png` |

### Builder 応募管理 — 概ね対応（MID残）

URL: `/builder/admin-applications.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-applications-390.png` |
| 430px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-applications-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-applications-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/admin-mobile-audit/admin-applications-1280.png` |

### Builder パートナー検索 — 概ね対応（MID残）

URL: `/builder/admin-partners.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partners-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partners-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partners-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partners-1280.png` |

### Builder 案件手配 — スマホ未対応

URL: `/builder/admin-dispatch.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-dispatch-390.png` |
| 430px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-dispatch-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-dispatch-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/admin-mobile-audit/admin-dispatch-1280.png` |

### Builder 案件カレンダー — 部分対応（要改善）

URL: `/builder/admin-calendar.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-calendar-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-calendar-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-calendar-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-calendar-1280.png` |

### Builder 通知送信 — 対応済み（軽微のみ）

URL: `/builder/admin-notifications.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-notifications-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-notifications-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-notifications-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-notifications-1280.png` |

### Builder 審査管理 — 概ね対応（MID残）

URL: `/builder/admin-reviews.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-reviews-390.png` |
| 430px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-reviews-430.png` |
| 768px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/admin-reviews-768.png` |
| 1280px | 200 | no | 4 | `reports/screenshots/admin-mobile-audit/admin-reviews-1280.png` |

### Builder パートナー評価 — 対応済み（軽微のみ）

URL: `/builder/admin-partner-evaluations.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partner-evaluations-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partner-evaluations-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partner-evaluations-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/admin-partner-evaluations-1280.png` |

### AI運営司令塔 — スマホ未対応

URL: `/admin-operations-dashboard.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/ops-dashboard-390.png` |
| 430px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/ops-dashboard-430.png` |
| 768px | 200 | no | 3 | `reports/screenshots/admin-mobile-audit/ops-dashboard-768.png` |
| 1280px | 200 | no | 5 | `reports/screenshots/admin-mobile-audit/ops-dashboard-1280.png` |

### AI運営センター (API) — スマホ未対応

URL: `/admin-ai-operations-center.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/ai-ops-center-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/ai-ops-center-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/ai-ops-center-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/ai-ops-center-1280.png` |

### 運営TALKルーム (旧) — スマホ未対応

URL: `/talk-ops-room.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/talk-ops-room-390.png` |
| 430px | 200 | no | 2 | `reports/screenshots/admin-mobile-audit/talk-ops-room-430.png` |
| 768px | 200 | no | 3 | `reports/screenshots/admin-mobile-audit/talk-ops-room-768.png` |
| 1280px | 200 | no | 5 | `reports/screenshots/admin-mobile-audit/talk-ops-room-1280.png` |

### 重要問い合わせセンター — スマホ未対応

URL: `/support-trouble-center.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/support-trouble-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/support-trouble-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/support-trouble-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/support-trouble-1280.png` |

### 安否ダッシュボード — スマホ未対応

URL: `/anpi-dashboard.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-dashboard-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-dashboard-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-dashboard-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-dashboard-1280.png` |

### LINE運用 (管理者) — スマホ未対応

URL: `/anpi-line-admin.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-line-admin-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-line-admin-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-line-admin-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-line-admin-1280.png` |

### 安否通知センター — スマホ未対応

URL: `/anpi-notifications.html`

| 幅 | HTTP | 横スクロール | stat列 | SS |
|-----|------|-------------|--------|-----|
| 390px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-notifications-390.png` |
| 430px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-notifications-430.png` |
| 768px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-notifications-768.png` |
| 1280px | 200 | no | 0 | `reports/screenshots/admin-mobile-audit/anpi-notifications-1280.png` |

