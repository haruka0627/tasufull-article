# TASFUL LIVE YouTube P1 — Phase 11 運営広告・収益化審査

**実施日:** 2026-06-23  
**検証:** `npm run verify:live-youtube-p11` → **PASS** (26/26)  
**Phase 10 回帰:** `npm run verify:live-youtube-p10` → **PASS**（p11 内で実行）

---

## 目的

Phase 10 の投稿者向け収益化申請の受け皿を運営画面に追加し、広告枠管理・推定収益・通報リスクを審査判断に使える土台を整える。

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|---------|------|
| `live/live-monetization-service.js` | **新規** — 収益化 / RPM / リスク判定 service 層 |
| `live/live-admin-videos.js` | タブ UI + 通報 / 広告 / 収益化審査 |
| `live/admin-videos.html` | monetization service 読み込み |
| `live/live-config.js` | `rejected` ステータス・キー定数 |
| `live/live-creator-dashboard.js` | service 層へ移行 |
| `live/live.css` | 管理タブ・審査パネル・広告一覧 |
| `scripts/verify-live-youtube-p11-admin-monetization.mjs` | **新規** |
| `package.json` | `verify:live-youtube-p11` |
| `deploy/cloudflare/dist/live/*` | 同期 |

**DB / Edge / migration:** 変更なし（localStorage スタブ + 既存 RLS）

---

## 管理画面タブ（`admin-videos.html`）

| タブ | 内容 |
|------|------|
| 動画管理 | 既存 Edge 一覧 + hide / restore / remove |
| 通報 | `live_video_reports` 一覧（管理者 RLS） |
| 広告 | `live_video_ads` 一覧・active 切替・RPM 仮変更・枠追加スタブ |
| 収益化審査 | 申請一覧・詳細パネル・審査アクション |

---

## 収益化 service 層（`TasuLiveMonetizationService`）

### ストレージ（Phase 10 互換 + 将来 DB 化用キー）

- メイン: `tlv-creator-monetization-v1` → `{ [userId]: { status, appliedAt, adminNote, ... } }`
- ミラー: `creator_monetization_status:{user_id}`
- ミラー: `creator_monetization_note:{user_id}`
- 広告 RPM 仮設定: `tlv-admin-ad-rpm-v1`
- 広告停止日スタブ: `tlv-admin-ad-ended-v1`

### ステータス

未申請 / 審査中 / 承認済み / 停止中 / **却下**

### 審査アクション（スタブ）

承認 · 却下 · 停止 · 再開 · メモ保存 → service `setRecord` 経由で localStorage 更新（creator-dashboard と連携）

---

## 収益化申請一覧

投稿者名 / @handle / 投稿本数 / 総再生 / 総いいね / 登録者 / 通報件数 / ステータス / 申請日 / 詳細

## 審査詳細パネル

- チャンネル情報（プロフィール bio）
- 動画一覧（再生・ステータス）
- 推定広告表示・推定収益
- 違反リスクフラグ（簡易判定）
- 運営メモ textarea

### リスク判定例

| 条件 | フラグ |
|------|--------|
| 通報 ≥ 3 | 注意 |
| 通報 ≥ 10 | 高リスク |
| 非表示動画あり | 注意 |
| いいね率極端に低い | 要確認 |
| 広告表示 > 再生×1.2 | 広告表示過多 |

---

## 広告管理タブ

- 広告 ID / 対象動画 / 名称 / active / 推定表示 / RPM(仮) / 推定収益 / 開始日 / 停止日
- active / inactive 切替（Supabase `live_video_ads` 更新・管理者 RLS）
- RPM 仮変更（localStorage）
- video_id + ラベルで枠追加スタブ

---

## 権限

- 既存どおり `live-video-admin` Edge + `talk_is_admin()` RLS
- 一般ユーザーは 403 / エラー表示（verify 確認済み）

---

## 検証結果

| 項目 | 結果 |
|------|------|
| 390 / 768 / 1280 admin console 0 | PASS |
| 一般ユーザー不可 | PASS |
| 4タブ / 収益化一覧 / 詳細 / 承認 | PASS |
| 広告 RPM / toggle（枠なし時 skip） | PASS |
| `verify:live-youtube-p10` 回帰 | PASS |

```bash
npm run verify:live-youtube-p11
# PASS 26/26
```

---

## 判定

**GO** — 運営側で収益化申請の確認・承認/却下/停止/再開が可能。広告枠と推定収益の管理入口あり。既存 TLV 機能（動画管理・通報・creator-dashboard・チャンネル・シェル）は回帰なし。
