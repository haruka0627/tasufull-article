# 生成AI 音声会話 MVP — 手動確認チェックリスト

Gemini Edge Function・静的検証・`browser-test-gen-ai.mjs` が通過したあと、**実ブラウザ**でマイク・読み上げ・キャラ連動を確認する手順です。

## 事前準備

- [ ] 開発サーバー起動: `npm run dev`（または Vite **5173**）
- [ ] 開く URL:  
  `http://localhost:5173/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1`  
  （表示名: **AIキャラ会話**）
- [ ] マイク付き PC ブラウザ（推奨: **Chrome / Edge** 最新）
- [ ] iPhone Safari は音声認識非対応 → 案内 `data-gen-ai-voice-unsupported` のみ確認
- [ ] （任意）デバッグ表示: URL に `&voice_debug=1` を付与

### 自動スモーク（手動の前）

```bash
node scripts/verify-voice-input.mjs
node scripts/verify-gen-ai-voice-ui-smoke.mjs
node scripts/browser-test-gen-ai.mjs
```

## A. UI・表示（マイク不要）

| # | 確認項目 | OK |
|---|----------|-----|
| A1 | 右パネルにキャラステージ（2D 画像）が表示される | ☐ |
| A2 | ステージ下に「音声読み上げ」トグル `data-ai-voice-toggle` がある | ☐ |
| A3 | マイクボタン **2箇所**（入力欄横・パネル内）に「🎙 話す」 | ☐ |
| A4 | 「認識後に自動送信」チェック `data-gen-ai-auto-send-voice` がある | ☐ |
| A5 | 音声状態表示（パネル / フォーム）が空または「待機中」系 | ☐ |
| A6 | 2D / 画像アニメ / 3D 切替ボタンでステージが壊れない（画像が消えない） | ☐ |
| A7 | テキスト入力 → **送信** で assistant メッセージが増える（Gemini 応答） | ☐ |

## B. 音声読み上げ（マイク不要）

| # | 確認項目 | OK |
|---|----------|-----|
| B1 | 「音声読み上げ」ON のまま短い文をテキスト送信 | ☐ |
| B2 | assistant 応答がチャットに表示される | ☐ |
| B3 | 読み上げ中: `body[data-ai-speaking="true"]`（DevTools → Elements） | ☐ |
| B4 | 読み上げ中: 口 `#character-mouth` またはステージに `is-speaking` | ☐ |
| B5 | 読み上げ終了後: `data-ai-speaking` 解除、`is-speaking` 解除 | ☐ |
| B6 | 状態ラベルが「読み上げ中…」→ 待機に戻る（`data-voice-status`） | ☐ |

`voice_debug=1` 時はパネル下に `voice-status=…` 等の一行デバッグが表示されます（本番では非表示）。

## C. 音声入力（マイク必須）

| # | 確認項目 | OK |
|---|----------|-----|
| C1 | パネルまたはフォームの **🎙 話す** をクリック | ☐ |
| C2 | ブラウザがマイク許可を求める → **許可** | ☐ |
| C3 | ボタンが「聞き取り中…」または「停止」に変わる | ☐ |
| C4 | 状態が「待機中（話しかけてください）」などになる | ☐ |
| C5 | 日本語で 1〜2 文発話（例:「こんにちは、元気？」） | ☐ |
| C6 | 認識テキストが **入力欄** に入る | ☐ |
| C7 | 「認識後に自動送信」ON → 自動で送信される | ☐ |
| C8 | user メッセージが履歴に追加される | ☐ |
| C9 | assistant 応答（Gemini）が表示される | ☐ |
| C10 | 応答の読み上げが始まる（B3〜B5 と同様の speaking） | ☐ |
| C11 | 読み上げ終了後、マイク待機に戻れる（ハンズフリー ON 時） | ☐ |

### 自動送信 OFF の場合

| # | 確認項目 | OK |
|---|----------|-----|
| C12 | 認識後、入力欄にテキストのみ → **送信** で C8〜C10 | ☐ |

## D. エラー・非対応

| # | 確認項目 | OK |
|---|----------|-----|
| D1 | マイク拒否 → エラー表示（「マイクの使用が許可されていません」等） | ☐ |
| D2 | 無音 → 「聞き取れませんでした」等、チャットは継続可能 | ☐ |
| D3 | iOS Safari → マイク非表示・`data-gen-ai-voice-unsupported` 表示 | ☐ |

## E. 回帰（既存機能）

| # | 確認項目 | OK |
|---|----------|-----|
| E1 | 音声 OFF + テキストのみ送信が問題ない | ☐ |
| E2 | マイキャラ選択・保存済みキャラの 2D 表示が維持 | ☐ |
| E3 | 3D タブに切替してもページが落ちない（モデル未設定でも可） | ☐ |

## 実機で見るべきポイント（DevTools）

| 対象 | 見方 |
|------|------|
| 音声状態キー | `[data-voice-status]` の値: `idle` / `listening` / `sending` / `responding` / `speaking` / `standby` |
| 読み上げ | `<body data-ai-speaking="true">` の有無 |
| 口パク | `[data-character-mouth].is-speaking`、 `[data-ai-character-stage].is-speaking` |
| JS 状態 | Console: `TasuGenAiWorkspace.getVoiceInputState()` |
| Gemini | Console: `[GenAi] Gemini Request` / `Gemini Response`（API キーは出ない） |

## トラブル時

- 応答が「※本番では…」「デモ」系 → Gemini 未接続のフォールバック。`node scripts/verify-gemini-deploy.mjs` を再実行。
- マイクが出ない → HTTPS / localhost 以外では Recognition が無効なことがある。
- 読み上げだけ動かない → `data-ai-voice-toggle` が ON か確認。

## 関連ファイル

- `gen-ai-workspace.html` / `gen-ai-workspace.js` / `ai-concierge.js`
- `scripts/verify-voice-input.mjs` — 静的音声入力
- `scripts/verify-gen-ai-voice-ui-smoke.mjs` — UI スモーク
- `scripts/browser-test-gen-ai.mjs` — Gemini + TTS（マイクなし）
