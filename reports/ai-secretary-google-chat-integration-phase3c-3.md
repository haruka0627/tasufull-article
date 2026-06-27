# AI秘書 — Google Chat Integration Phase 3c-3 完了報告

**実施日:** 2026-06-28  
**前提 commit:** `b9ed3b8` (Phase 3c-2)  
**種別:** 実装 · テスト · dist 同期

**Secret / Token / UUID / messageId / bodyText 生データは記載しない**

---

## 1. 目的

Read-only を維持したまま Google Chat の follow-up 会話を強化する。

| 領域 | 内容 |
| --- | --- |
| Context triage | 重要度・急ぎ・返信必要など LLM 判定 |
| Cross Calendar | Gmail focus × Calendar list 照合 |
| 代名詞解決 | それ / このメール / あのメール → focus |
| Refine 強化 | 丁寧 / カジュアル / 箇条書き / 3行 / 1文 / 件名案 |
| Context 優先順位 | focus → list → lastTurn → history → fresh search |

---

## 2. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `admin-ai-secretary-google-chat-router.js` | triage / cross-calendar / refine 拡張 / 代名詞 / 優先順位 |
| `deploy/cloudflare/dist/admin-ai-secretary-google-chat-router.js` | build 同期 |
| `scripts/test-secretary-google-chat-integration-phase3c-3.mjs` | **新規** |
| `scripts/test-secretary-google-chat-integration-phase3b.mjs` | context 前提 unit 更新 |
| `scripts/test-secretary-google-chat-integration-phase3c-2.mjs` | refine unit 前提更新 |

**変更なし:** Edge · OAuth · phase2 · context v2 モジュール · Dashboard HTML

---

## 3. 新規 Intent

| intent | トリガー例 | API | LLM |
| --- | --- | --- | --- |
| `context_triage` | このメール重要？ / 急ぎ？ / 返信必要？ | 0（focus bodyPreview） | 重要度・理由・推奨 |
| `context_cross_calendar` | 今日の予定と照らして / 返信するならいつがいい？ | 0〜1（cal snapshot 無時のみ today） | Gmail×Calendar 所見 |
| `context_refine_polite` | もっと丁寧 | 0 | 返信案加工 |
| `context_refine_casual` | もっとカジュアル | 0 | 返信案加工 |
| `context_refine_bullets` | 箇条書き | 0 | 返信案加工 |
| `context_refine_lines3` | 3行で | 0 | 返信案加工 |
| `context_refine_one_line` | 1文で | 0 | 返信案加工 |
| `context_refine_subject` | 件名案も | 0 | 返信案+件名 |

**Refine ゲート:** `lastTurn` が返信案（`context_reply_draft` または `context_refine_*`）のときのみ。要約・triage 出力への refine は不可。

---

## 4. Context 優先順位（resolve）

```
pickIndex（明示番号）
  ↓
gmail.focus（bodyPreview あれば getMessage スキップ）
  ↓
gmail.list[0]
  ↓
lastTurn + history（gmail 系 googleIntent）
  ↓
fresh search / list API
```

`matchIntent(text, { history })` — phase2 から渡される history を利用。

---

## 5. セキュリティ

- write / send / draft save / calendar write — 従来どおり block
- messageId / threadId — DOM・console 非露出
- triage / cross-calendar LLM 入力 — bodyPreview cap + sanitize
- report に Secret/Token/UUID なし

---

## 6. 検証（8788）

| スクリプト | 結果 |
| --- | --- |
| `phase3c-3.mjs` | **56/56 PASS**（unit 14 + browser 1280/768/390 各 14） |
| `phase3c-2.mjs` | **28/28 PASS** |
| `phase3c-1.mjs` | **16/16 PASS** |
| `phase3b.mjs` | **68/68 PASS** |

**Browser フロー（3c-3）:** 未読 → 2件目 → triage → 返信案 → 箇条書き → 今日の予定 → 照合 → それ詳しく → write block

**API 削減確認:** triage / pronoun detail で `messages.get` 0 件（focus bodyPreview 利用）

**Viewport:** 1280 · 768 · 390 — HTTP 200 · Console fatal 0

---

## 7. 未実装（Phase 3c-4 以降）

- Calendar 番号指定 pick
- Attachment 本文解析
- Human Gate / send 実行（Phase 4）

---

## 8. commit 候補（未実施）

```
feat(secretary): add google chat triage cross-calendar and refine phase 3c-3
```

**Stage 候補:** router.js · dist ミラー · phase3c-3.mjs · phase3b/3c-2 test tweaks · 本 report

**除外:** dist/docs · dist/live · design plan md · browser profile · tmp
