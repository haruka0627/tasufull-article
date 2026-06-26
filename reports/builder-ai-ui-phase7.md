# Builder AI UI Phase 7 — AD-012 Chat-First

**日付:** 2026-06-27  
**状態:** 実装済 · **未コミット**  
**方針:** AD-012（高機能は AI · UI はシンプル）· AD-002 維持 · Store 読取のみ · mock/local 回答

---

## 概要

Builder AI 画面を **チャット中心 UI** に整理。テキスト入力で会話でき、クイック相談と案件機能への導線を配置。Gateway / Gemini への新規接続は行わず `UI_LOCAL_ONLY` で mock · local のみ。

---

## 変更ファイル

| 種別 | パス |
| --- | --- |
| Source HTML | `builder/builder-ai.html` |
| Source JS | `builder/builder-ai-ui.js` |
| Source CSS | `builder/builder-ai-ui.css` |
| Dist | `deploy/cloudflare/dist/builder/builder-ai.html` |
| Dist | `deploy/cloudflare/dist/builder/builder-ai-ui.js` |
| Dist | `deploy/cloudflare/dist/builder/builder-ai-ui.css` |
| Test | `scripts/test-builder-ai-ui-phase7.mjs` |
| Test (更新) | `scripts/test-builder-ai-ui-phase1.mjs` |
| Capture | `scripts/capture-builder-ai-ui-phase7.mjs` |
| Report | `reports/builder-ai-ui-phase7.md` |
| Screenshot | `reports/builder-ai-ui-phase7-1280.png` |

---

## 実装内容

1. **チャット中心レイアウト** — `builder-ai-ui-chat-shell` に capability · messages · quick · composer を集約
2. **Capability ヘッダ** — 何ができる AI かを 4 項目で明示 + 免責
3. **入力欄** — ラベル付き composer を下部 sticky 配置
4. **クイック相談（6）** — 現場写真 / 見積 / 工程 / 未入金 / 書類 / 通知
5. **Hub 導線（7）** — Dashboard · Hub · Calendar · Vision · Finance · Documents · Notifications
6. **Store 読取** — `buildLocalStoreConsultReply()` で Finance / Document / Notification / Schedule サマリー
7. **local-only** — `UI_LOCAL_ONLY=true` · Vision `preferRemote: false` · 新規 Gateway 接続なし
8. **メディア折りたたみ** — 写真 · カメラ · 音声は `<details>` 内（次フェーズ拡張）

---

## テスト結果

| テスト | 結果 |
| --- | --- |
| `npm run build:pages` | PASS |
| `test-builder-ai-ui-phase7.mjs` | **18/18 PASS** |
| `test-builder-ai-ui-phase1.mjs` | **15/15 PASS** |
| `test-builder-dashboard-phase6h.mjs` | **32/32 PASS** |
| `test-builder-notification-center-phase6g.mjs` | **47/47 PASS** |

---

## スクリーンショット

`reports/builder-ai-ui-phase7-1280.png`

---

## コミット対象（予定）

```
builder/builder-ai.html
builder/builder-ai-ui.js
builder/builder-ai-ui.css
deploy/cloudflare/dist/builder/builder-ai.html
deploy/cloudflare/dist/builder/builder-ai-ui.js
deploy/cloudflare/dist/builder/builder-ai-ui.css
scripts/test-builder-ai-ui-phase7.mjs
scripts/test-builder-ai-ui-phase1.mjs
scripts/capture-builder-ai-ui-phase7.mjs
reports/builder-ai-ui-phase7.md
reports/builder-ai-ui-phase7-1280.png
```

push / deploy は未実施。
