# TASFUL MATCH — 未ログイン UX

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 判定 | **LOGIN_REQUIRED_UX_READY** |

---

## 1. 目的

実 JWT がないユーザーに汎用エラーを出さず、**ログイン導線**を明示する。  
403 `match_beta_not_allowed`（招待制β）とは **別パネル**で出し分け。

---

## 2. 実装

| ファイル | 役割 |
|----------|------|
| `match/match-login-gate.js` | 未ログインパネル · API 401 ハンドラ |
| `match/match-beta-gate.js` | 403 招待制βパネル（既存） |
| `match/match-bootstrap.js` | 保護ページ初期表示時 `maybeShowForPage()` |
| `match/match-api.js` | Edge 401 → login gate |
| `match/match-wiring.js` | `apiErrorMessage` 優先順: login → beta |

---

## 3. 表示文言

**未ログイン（login gate）**

```
TASFUL MATCH を利用するにはログインが必要です。
ログイン後、招待制βの参加条件を確認できます。
```

CTA:

- **ログインする** → `../dashboard.html`
- **TASFULトップへ戻る** → `match-top.html`

**招待制β（beta gate · 既存）**

```
TASFUL MATCH は現在、招待制βです。
参加を希望する場合は、運営からの案内をお待ちください。
```

---

## 4. 保護ページ（`data-match-requires-login="1"`）

| ページ | 用途 |
|--------|------|
| match-profile-create.html | プロフィール作成 |
| match-mypage.html | プロフィール編集 |
| match-swipe.html | 候補フィード |
| match-list.html | マッチ一覧 |
| match-verify.html | 本人確認 |
| match-block.html | ブロック |
| match-report.html | 通報 |
| match-safety.html | 安全 |
| match-talk-bridge.html | TALK 導線 |
| match-search*.html | 検索 |
| match-favorites / footprints | P15 |

**除外:** match-top · match-admin · match-review · match-ai-*

---

## 5. バイパス条件（ローカル demo 維持）

| 条件 | 挙動 |
|------|------|
| `?client_stub=1` | login gate 非表示 |
| localhost demo + stub token | 従来デモ動作 |
| 実 JWT あり | 通常 MATCH フロー |

---

## 6. エラー出し分け

| HTTP / code | UI |
|-------------|-----|
| 401 / `unauthorized` | **login gate** |
| 403 / `match_beta_not_allowed` | **beta gate** |
| その他 | 従来 toast / メッセージ |

---

## 7. 判定

**LOGIN_REQUIRED_UX_READY**
