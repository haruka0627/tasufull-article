# AI音声選択 — Phase1 実装レポート

**実装日:** 2026-06-17  
**Epic:** AI Voice Selection Phase1（新規 Epic — 凍結領域非接触）

---

## 1. 概要

Web Speech API の範囲で **AI読み上げの声選択・試聴・設定保存** を追加した。外部 TTS / Supabase / Stripe は未接続。TALK / WebRTC / admin-ai / 安否には **変更なし**。

---

## 2. 変更ファイル

### 新規

| ファイル | 責務 |
|----------|------|
| [`voice-settings.html`](../voice-settings.html) | 声の設定ページ |
| [`voice-settings.js`](../voice-settings.js) | UI・保存・試聴 |
| [`voice-settings.css`](../voice-settings.css) | 設定ページスタイル |
| [`scripts/tasu-voice-catalog.js`](../scripts/tasu-voice-catalog.js) | 標準/有料音声カタログ |
| [`scripts/tasu-voice-preferences.js`](../scripts/tasu-voice-preferences.js) | localStorage CRUD・voice 解決 |
| [`scripts/test-voice-settings-browser.mjs`](../scripts/test-voice-settings-browser.mjs) | E2E smoke |

### 既存（最小変更）

| ファイル | 変更 |
|----------|------|
| [`profile-settings.html`](../profile-settings.html) | 「声の設定」リンク（モバイル + PC） |
| [`gen-ai-workspace.html`](../gen-ai-workspace.html) | catalog/prefs script + 「⚙ 声の設定」リンク |
| [`ai-concierge.js`](../ai-concierge.js) | `speak()` が prefs 参照 / `syncVoiceToggleUi` export |

### 変更していない

TALK コア、`talk-call-*`、admin-ai、安否、Builder、Connect、Stripe、Supabase SQL

---

## 3. 仕様

### 3.1 音声カタログ

| tier | 件数 | 選択 | 試聴 |
|------|------|------|------|
| 標準（無料） | 4 | ✅ | ✅ |
| プレミアム | 3 | ❌ Coming soon | ❌ disabled |

標準音声 ID: `std_neutral`, `std_friendly_f`, `std_clear_m`, `std_bright_f`  
プレミアム ID: `prem_warm_f`, `prem_narrator`, `prem_character`（表示のみ）

ブラウザ voice は `browserMatch.nameHints` で日本語 voice を解決。未一致時は先頭 `ja` voice（従来同等）。

### 3.2 ユーザー設定

| 項目 | 範囲 | 保存先 |
|------|------|--------|
| 読み上げ ON/OFF | boolean | **`tasu_ai_voice_enabled`**（既存キー維持） |
| selectedVoiceId | 標準 ID のみ | `tasu_voice_preferences_v1` |
| rate | 0.5 – 2.0 | 同上 |
| pitch | 0.5 – 2.0 | 同上 |
| volume | 0 – 1.0 | 同上 |

### 3.3 localStorage キー

| キー | 内容 |
|------|------|
| `tasu_ai_voice_enabled` | `"1"` / `"0"` — **既存**。gen-ai トグルと同期 |
| `tasu_voice_preferences_v1` | JSON: `{ selectedVoiceId, rate, pitch, volume, updatedAt }` |

### 3.4 ai-concierge 連携

- `TasuVoicePreferences` 未ロード時 → **従来どおり** rate/pitch=1、先頭 ja voice
- `isVoiceEnabled()` → 引き続き `tasu_ai_voice_enabled` のみ参照（既存挙動維持）
- Web Speech 非対応 → `speak()` は `false` を返し安全終了

---

## 4. UI

| 画面 | 内容 |
|------|------|
| `voice-settings.html` | 読み上げ ON/OFF、速度/ピッチ/音量、標準音声ラジオ + 試聴、プレミアム Coming soon |
| `profile-settings.html` | 「声の設定」リンク |
| `gen-ai-workspace.html` | 「⚙ 声の設定」リンク |

---

## 5. テスト

### 5.1 実行

```bash
BASE_URL=http://127.0.0.1:8765 node scripts/test-voice-settings-browser.mjs
```

### 5.2 結果（2026-06-17）

```
OK  voice-settings.html exists
OK  static: standard list hook
OK  static: premium list hook
OK  static: catalog script
OK  profile-settings link
OK  gen-ai-workspace hooks
OK  modules loaded
OK  standard voices=4
OK  premium voices disabled
OK  ON/OFF save OFF
OK  selectedVoiceId saved=std_friendly_f
OK  rate saved
OK  premium not selectable
OK  ai-concierge speak safe
OK  gen-ai-workspace speak integration
OK  gen-ai voice-settings link visible
=== PASS (0 errors) ===
```

### 5.3 回帰

| テスト | 結果 |
|--------|------|
| `node scripts/test-talk-webrtc-call-browser.mjs`（非 STRICT） | **PASS** — TALK/WebRTC 非接触確認 |

---

## 6. Phase2 バックログ

- 外部 TTS（ElevenLabs / Gemini TTS）
- Supabase `user_voice_preferences` / `tasful_voice_catalog`
- Stripe premium 解放
- 通知読み上げ自動トリガ
- 安否音声案内

---

## 7. Phase1 LOCK 判定

| 項目 | 判定 |
|------|------|
| **Phase1 LOCK** | **✅ LOCK（合格）** |
| 根拠 | 要件達成、smoke PASS、凍結領域 diff なし、既存 `tasu_ai_voice_enabled` 維持 |
| 残課題 | プレミアム実音声、マルチ端末同期、通知連携 → Phase2 |

---

*設計レビュー: [`ai-voice-selection-phase1-design.md`](ai-voice-selection-phase1-design.md)*
