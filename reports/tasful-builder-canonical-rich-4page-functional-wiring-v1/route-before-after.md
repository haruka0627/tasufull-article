# Route before / after

Base: `origin/cf-pages-deploy` @ `b1e1d93`.

| Action / entry | Before | After | Class |
|---|---|---|---|
| TOP 案件を投稿する / 案件を掲載する | `mvp-project-new.html` | `new-project.html` (`data-builder-top-action=post_job`) | CANONICAL |
| TOP 協力パートナー登録 | `/partner-register.html?source=builder` | 同じ（IWASHO） | KEEP |
| TOP 職人・協力会社プロフィール登録 | （無し） | `provider-profile.html` (`register_worker`) | CANONICAL |
| TOP 案件を探す | `../public-board.html` | 同じ | KEEP |
| TOP 職人を探す | `find-workers.html` | 同じ | KEEP |
| Job create submit | `board-project-detail.html?id=` | `project-detail.html?id=` | CANONICAL |
| Provider save | `mvp-partner-register.html` 自己遷移 | `provider-detail.html?id=` | CANONICAL |
| find-workers 詳細 | coming-soon スクロール | `provider-detail.html?id=` | CANONICAL |
| partners 詳細 | `partner.html?partner_id=` | `provider-detail.html?id=`（bridge 書換） | CANONICAL |
| TOP 最新案件カード | `board-project-detail.html?id=` | `project-detail.html?id=`（bridge） | CANONICAL |
| `mvp-post.html` | 残置 | 残置（コア接続 + canonical 遷移） | LEGACY_COMPAT |
| `mvp-project-new.html` | 残置 | 残置 | LEGACY_COMPAT |
| `mvp-partner-register.html` | 残置 | 残置 | LEGACY_COMPAT |
| `mvp-project-detail.html` | 残置 | 残置 | LEGACY_COMPAT |

削除した MVP ルートは無い。
