# Screenshots QA Center — 検証ルール

TASFUL のスクショ検証は **Screenshots QA Center**（`screenshots-viewer.html`）を正とする。  
登録・除外・PASS 報告は `scripts/lib/screenshots-qa.mjs` で管理する。

## 固定ルール

### 1. 重要スクショは IMAGE_META に登録

新しく **レビュー・Gemini 提出・レポート引用** するスクショは、必ず `IMAGE_META` に登録する。

- `title` / `description` / `category` / `qaStatus` / `report` / `sourceUrl` を埋める
- 連続フロー（例: 問い合わせ → 下書き → 入力欄反映）は `INQUIRY_TO_TALK_FLOW` と表示順も同期する

### 2. 一時・古い検証画像は IGNORE_PATTERNS へ

ベンチ用・WIP・ superseded など **canonical にしない** 画像は `IGNORE_PATTERNS` に入れ、未登録 ⚠ から除外する。

- 登録しないまま放置しない（警告が残る）
- 本当に重要になったら `IMAGE_META` へ昇格し、該当 IGNORE ルールを見直す

### 3. PASS 報告時の必須添付

検証 **PASS** を報告するときは、次の 3 点を必ず添える。

| 項目 | 例 |
|------|-----|
| Viewer URL | `screenshots-viewer.html?search=問い合わせ` |
| 検索キーワード | `問い合わせ` |
| 登録枚数 | 検索ヒットの登録済み枚数 + `IMAGE_META` 総登録数 |

ローカルでサーバー起動中ならフル URL でも可:  
`http://127.0.0.1:5500/screenshots-viewer.html?search=問い合わせ`

### 4. Gemini レビュー用画像は search URL で特定

Gemini や人間レビューに出す画像は、ファイルパス直書きではなく **QA Center の search URL** で指す。

```
screenshots-viewer.html?search=問い合わせ
```

フロー検索のエイリアスは `FLOW_SEARCH`（`screenshots-qa.mjs`）を参照。

### 5. 未登録 ⚠ が 1 以上なら完了扱いにしない

`manifest.unregisteredCount >= 1` のときは **作業完了・PASS 完了** とみなさない。

- `IMAGE_META` へ登録するか
- `IGNORE_PATTERNS` でアーカイブするか  
のどちらかで **未登録 ⚠ を 0** にしてから完了とする。

## 運用コマンド

```bash
# manifest 更新 + Viewer 起動
node scripts/open-latest-screenshots.mjs

# 問い合わせフロー検証（PASS 時 QA ブロック付きレポート）
node scripts/capture-ai-workspace-inquiry-to-talk.mjs

# QA ゲート単体（未登録 ⚠ チェック）
node scripts/verify-screenshots-qa-gate.mjs
```

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `scripts/lib/screenshots-qa.mjs` | `IMAGE_META` / `IGNORE_PATTERNS` / 検索ヘルパー / 完了ゲート |
| `scripts/lib/screenshots-manifest.mjs` | `manifest.json` 生成 |
| `screenshots-viewer.html` | QA Center UI |
| `screenshots/manifest.json` | 登録数・未登録数の正 |
