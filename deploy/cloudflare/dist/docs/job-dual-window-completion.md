# 求人 2窓 — やりとり完了フロー確認

プラット求人（`review=job-full`）のみ。一般案件は対象外です。

## 起動 URL（ランチャー）

```
http://localhost:5173/job-dual-window-completion.html?talkDev=1&review=job-full
```

LAN 実機の例:

```
http://192.168.3.3:5173/job-dual-window-completion.html?talkDev=1&review=job-full
```

## 2窓用 URL 一覧

| 役割 | 用途 | URL |
|------|------|-----|
| 掲載者 | リセット＋チャット開始 | `chat-detail.html?thread=chat-demo-job-full-001&userId=u_job_demo_full&talkDev=1&review=job-full&jobFullReset=1` |
| 掲載者 | チャット（通常） | `chat-detail.html?thread=chat-demo-job-full-001&userId=u_job_demo_full&talkDev=1&review=job-full` |
| 掲載者 | 通知タブ | `talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1&review=job-full` |
| 応募者 | 通知タブ | `talk-home.html?tab=notify&userId=u_hiro&talkDev=1&review=job-full` |
| 応募者 | チャット | `chat-detail.html?thread=chat-demo-job-full-001&userId=u_hiro&talkDev=1&review=job-full` |

## 操作手順（実操作必須）

1. **ランチャー**を開く（下記 URL）
2. **状態をリセット** → 掲載者チャットが `active` で開く（`jobFullReset=1` は1回だけ。URLから自動削除されます）
3. **別ウィンドウ**で **応募者 通知タブ**を開く（同じブラウザ推奨 = `localStorage` 共有）
4. **掲載者** — **やりとり完了** → **申請する**
5. **応募者** — 通知タブに申請通知が増える（未反映ならタブを再表示）
6. **応募者** — 通知 **確認する** → チャットで **やりとり完了を承認**
7. **掲載者** — 通知タブに **やりとりが完了しました**
8. **両者** — チャット入力欄非表示 + 下部 **レビューする** → **やりとり評価**

> 完了申請・完了・レビュー通知は、スレッド状態に応じて表示されます（最初から完了済みにはなりません）。

## 自動スクショ（Playwright・2 Page 同一コンテキスト）

```bash
npm run dev
node scripts/capture-job-dual-window-completion-390.mjs
```

### 掲載者側 (`screenshots/platform-job-dual-window-completion/poster/`)

| ファイル | 状態 |
|----------|------|
| `01-chat-active-390.png` | やりとり中（申請前） |
| `02-complete-modal-390.png` | やりとり完了モーダル |
| `03-pending-request-390.png` | 完了申請中 |
| `04-chat-completed-390.png` | 閲覧専用 + レビューバー |
| `05-notify-complete-390.png` | 通知タブ「やりとりが完了しました」 |
| `06-review-modal-390.png` | やりとり評価モーダル |

### 応募者側 (`screenshots/platform-job-dual-window-completion/applicant/`)

| ファイル | 状態 |
|----------|------|
| `01-notify-before-390.png` | 申請前の通知タブ |
| `02-notify-request-390.png` | 完了申請通知 |
| `03-chat-approve-390.png` | 承認ボタン表示 |
| `04-chat-completed-390.png` | 閲覧専用 + レビューバー |
| `05-review-modal-390.png` | やりとり評価モーダル |

## 検証スクリプト

```bash
node scripts/verify-job-dual-window-completion.mjs
```
