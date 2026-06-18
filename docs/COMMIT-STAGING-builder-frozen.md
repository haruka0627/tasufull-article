# コミット整理（Builder最終フロー固定後）

Builder通知・スレッド・完了報告・承認フローは **保護対象（変更禁止）** です。  
以下は現状の作業ツリーを論理単位に分割したステージング案です。コミットはユーザー指示後に実施してください。

## 保護対象（触らない / 単独コミットで固定）

```
builder/builder.js
builder/builder.css
builder/builder-board-feed.js
builder/board-projects.html
builder/board-project-detail.html
builder/board-thread.html
builder/board-threads.html
builder/mvp-thread.html
builder/mvp-calendar.html
builder/mvp-project-detail.html
builder/builder-top.html
builder/index.html
talk-platform-notify.js          # Builder notify ルーティング含む
talk-builder-notify-master-v1.js
scripts/audit-builder-notify-routing.mjs
scripts/test-builder-final-flow-inspection.mjs
scripts/test-builder-thread-completion-approval-flow.mjs
scripts/test-builder-board-unified-feed.mjs
scripts/test-board-apply-hire-flow.mjs
scripts/test-worker-request-accept-flow.mjs
scripts/test-calendar-request-accept-flow.mjs
scripts/test-job-apply-hire-flow.mjs
scripts/capture-builder-final-flow-screenshots.mjs
screenshots/builder-final-flow-verify/
```

## 推奨コミット分割

### C1 — 安否（anpi）UI・通知導線
- `anpi-dashboard.html` / `.css` / `.js`
- `anpi-notifications.html` / `.css` / `.js`
- `anpi-register.html` / `.css` / `.js`
- `anpi-notify-cards.js`（新規）
- `scripts/test-talk-anpi-notify.mjs` 他 anpi 検証スクリプト

### C2 — TALK 通知（Builder/Platform 整理・戻り復元）※Builder保護ファイルは C3 と分離可
- `talk-home.js` / `talk-home-data.js`
- `talk-notify-actions.js`
- `talk-platform-notify-master-v1.js`
- `scripts/test-talk-notify-unified.mjs`

### C3 — Builder 最終フロー（保護・固定）
- 上記「保護対象」一式

### C4 — 公開 board（public-board）
- `public-board.html` / `public-board-detail.html`
- `public-board-demo-data.js` / `public-board-detail-page.js`
- `job-top-page.js` / `job-top-renderer.js`（public-board モード）
- `scripts/test-public-board-pages.mjs`
- `scripts/capture-public-board-screenshots.mjs`
- `screenshots/public-board-review/`

### C5 — プラットフォーム求人応募（detail-job）
- `job-applications-store.js` / `job-detail-applications.js`
- `detail-job.html` / `detail-job.js` / `detail-job.css`
- `contact-actions.js` / `chat-thread-store.js`（job_hire 部分）
- `scripts/test-job-apply-hire-flow.mjs`

### C6 — プラットフォームワーカー依頼（detail-worker）※次着手
- `worker-requests-store.js` / `detail-worker-requests.js`
- `detail-worker.html` / `detail-worker.css`
- `contact-actions.js` / `chat-thread-store.js`（worker_request 部分）
- `talk-platform-notify.js`（worker 通知のみ・Builder 分岐に注意）
- `scripts/test-worker-request-platform-flow.mjs`

### C7 — その他（AI Workspace 停止中・運営 OPS 等）
- `ai-workspace*` / `talk-ops-room*` / `admin-operations*` 等は別ブランチまたは後続

## 除外（コミットしない）

- `.tmp.driveupload/` / `.tmp.drivedownload/`
- `dist/`（ビルド成果物）
- 一時スクリプト `scripts/_tmp-*.mjs`

## 回帰確認（Builder 保護後）

```bash
node scripts/audit-builder-notify-routing.mjs
node scripts/test-builder-final-flow-inspection.mjs
node scripts/test-builder-thread-completion-approval-flow.mjs
```

いずれも exit 0 を維持すること。
