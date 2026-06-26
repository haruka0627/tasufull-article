# Builder AI — 現場診断 Backlog（Gemini Vision → Gemini Live）

**最終更新:** 2026-06-26  
**Vision（静止画）:** ✅ **接続済**（Vision Phase 2 · `4aff9ec`）  
**Live / Voice:** 📋 未着手  
**参照:** [BUILDER_AI.md](./AI/BUILDER_AI.md) · `reports/builder-ai-vision-phase2.md`

---

## 目的

Builder AI に **現場写真・映像をもとにした診断支援** を追加し、補修 · 施工 · 材料 · 見積の判断を **下書き** として支援する。

TASFUL AI 共通入口には混ぜず、**Builder AI 専用**（`surface: builder_ai`）として実装する（[DECISIONS.md](./DECISIONS.md) AD-002）。

---

## スコープ境界

| 観点 | 方針 |
| --- | --- |
| **対象** | **Builder AI のみ**（`builder/builder-ai.html` · `surface: builder_ai`） |
| **非対象** | AI 秘書 · Platform · TLV · TASFUL AI Workspace · Site Assistant |
| **Gateway** | 既存 `TasuAiModelGateway` · **`attachments` 流用**（契約変更なし） |
| **Edge** | 既存 `gemini-chat` + `ai-attachments.ts` |
| **新規 CF Function** | **禁止**（Secretary DeepSeek パターンは Builder に適用しない） |

---

## ✅ Gemini Vision（静止画）— 実装済

**UI Phase 1:** `5d28acc` — 現場診断 UI シェル  
**Vision Phase 2:** Gateway 接続 · `builder-ai-vision.js` · `runFieldVision`

| 機能 | 状態 |
| --- | --- |
| jpg / png / webp · 4MB 制限 | ✅ |
| 画像 + 相談文 → Gemini Vision | ✅ |
| 診断系 + 画像なし → 写真追加案内 | ✅ |
| 回答 8 項目 + 必須免責 | ✅ |
| 案件スレッドからの写真投入 | 📋 将来 |
| Free / Pro 課金 enforcement | 📋 将来 |

**経路:**

```
builder-ai-ui.js → builder-ai-vision.js → builder-ai-core.runFieldVision
  → Gateway.completeTurn(attachments) → gemini-chat → Gemini Vision
```

---

## 📋 Gemini Live（リアルタイム）— 未着手

**着手条件:** Vision 本番 deploy · Gemini Live API · 帯域 · 課金調査後

| 機能 | 内容 |
| --- | --- |
| **Gemini Live** | リアルタイムセッション |
| **リアルタイムカメラ** | 現場カメラ映像のライブ解析 |
| **音声会話** | 現場での音声 Q&A |
| **ライブ現場診断** | 映像を見ながらの相談 · チェックリスト · 現場レポート |

UI の「カメラ診断」「音声で相談」ボタンは **Phase 2 Live まで stub**。

---

## 注意事項（必須）

- AI は **補助ツール**
- **最終判断**は現地確認 · 有資格者 · 専門業者
- **AI の診断結果のみで施工判断をしない**
- 必須免責: *画像だけでは確定判断できません。最終判断は現地確認・専門業者判断を優先してください。*

---

## 関連

- [BUILDER_AI.md](./AI/BUILDER_AI.md)
- [TODO.md](./TODO.md)
- [ROADMAP.md](./ROADMAP.md)
