# OCR + 連絡先検知 — 設計調査レポート

**日付:** 2026-07-04  
**種別:** 設計調査のみ（**実装なし**）  
**対象 surface:** TASFUL AI Workspace · Talk / Platform Chat · Builder（案件・やりとり・AI Vision）  
**目的:** 画像・PDF・見積・名刺・契約書などの添付から、電話・メール・URL・SNS・LINE・QR 等で **外部連絡先が渡る抜け道** を防ぐ

---

## 1. 現状サマリー

| 項目 | 状態 |
| --- | --- |
| **OCR モジュール** | **部分実装** — `chat-ocr.js` あり。provider 差し替え口のみ。**Gemini / Cloudflare は未実装**（`gemini_not_configured` / `cloudflare_not_configured`） |
| **既定 OCR** | `chat-ocr-config.example.js` は `provider: "tesseract"`。本番 checklist は Cloudflare OCR **未完了** |
| **テキスト連絡先検知** | **実装済** — `chat-moderation.js`（regex）+ `platform-content-gate.js` |
| **添付スキャン** | **実装済（Talk/Platform Chat 経路）** — `platform-content-gate-attachments.js`（画像 OCR・PDF テキスト・Office/ZIP 分類） |
| **送信前ブロック** | **Talk/Chat は実装済** — `chat-service.js` `runModeration()` → ブロック時送信不可 |
| **開示前/後分岐** | **未統合** — Builder 550円 Contact Reveal は別モジュール。添付 OCR 結果と **開示状態を見ていない** |
| **TASFUL AI 添付** | Gateway に `attachments` を渡す経路あり。**moderation / OCR ゲートは Chat ほど強制されていない** |
| **Builder AI Vision** | 現場写真 → Gemini Vision（診断用）。**連絡先検知・マスクは非実装**（BUILDER_AI.md も OCR 非実装と明記） |
| **QR 実体検知** | **未実装** — テキスト上の「QRコード」誘導語のみ（`qr_hint`） |
| **自動マスク** | **未実装** — 現状は **block（送信拒否）** 中心。マスク開示はなし |

**結論:** Talk/Platform Chat には「OCR（任意）→ 連絡先 regex → 送信ブロック」の骨格がある。**Gemini OCR 本体・AI/Builder 横断ゲート・開示後ログ分岐・QR 画像解析・マスク**が不足。

---

## 2. 対象ファイル（現状）

### 2.1 OCR / モデレーション（共通）

| ファイル | 役割 |
| --- | --- |
| `chat-ocr.js` | OCR 抽象。Tesseract 実装済 · Gemini/Cloudflare スタブ |
| `chat-ocr-config.js` / `.example.js` | `provider: none \| tesseract \| gemini \| cloudflare` |
| `chat-moderation.js` | 電話・メール・LINE・SNS・URL・短縮URL・QR語・詐欺・アダルト・個人情報要求 |
| `platform-content-gate.js` | Platform 共通ゲート（テキスト） |
| `platform-content-gate-attachments.js` | 添付分類 · PDF.js · OCR 呼び出し · verdict allow/needs_review/block |

### 2.2 Talk / Platform Chat

| ファイル | 役割 |
| --- | --- |
| `chat-detail.html` / `chat-detail.js` | 画像添付 UI（`pendingAttachment` dataUrl）· 送信 |
| `chat-service.js` | `runModeration` · `moderateMessage` · `persistModerationLog` · `saveMessage` |
| `chat-supabase.js` | `insertModerationLog`（想定） |
| `talk-home.js` / `talk-*.js` | Talk UI。添付プレビュー表記あり。**独自 moderation 呼び出しは薄い**（Chat 詳細経路に依存） |

### 2.3 TASFUL AI

| ファイル | 役割 |
| --- | --- |
| `ai-model-gateway.js` | `attachments` 正規化 · Gemini Edge `gemini-chat` へ転送 |
| `ai-workspace*.js` / attach 関連 | ファイル入力 → Gateway（`reports/tasful-ai-attach-vision-first.md`） |
| Edge `gemini-chat`（deploy/cloudflare/functions） | Vision/添付付きチャット |

### 2.4 Builder

| ファイル | 役割 |
| --- | --- |
| `builder/builder-contact-reveal.js` | **550円** 連絡先開示（localStorage DEMO） |
| `builder/builder-ai-vision.js` / `builder-ai-vision-analyzer.js` | 現場写真 → Gateway Vision（診断） |
| `builder/builder-ai-core.js` | attachments を Gateway に渡す |
| Talk 導線 | Builder → Talk。添付は Talk/Chat 側ポリシーに依存 |

### 2.5 Storage / DB（関連）

| 領域 | 現状 |
| --- | --- |
| Chat 添付 | 多くが **dataUrl インライン**（Storage bucket 必須ではない経路） |
| Listing 画像 | Supabase Storage（`listing-images.js` 等）— **掲載用**で連絡先ゲート対象外 |
| moderation_logs | Chat Supabase 経由で **blocked/warning 時に保存**（`persistModerationLog`） |
| Contact reveal | Builder は **localStorage**（本番 DB 未） |

---

## 3. 既存ロジック（調査項目対応）

### 3.1 OCR は未実装か？

| Provider | 状態 |
| --- | --- |
| **none** | 実装済（スキップ） |
| **tesseract** | 実装済（ブラウザ CDN） |
| **gemini** | **未実装**（差し替えコメントのみ） |
| **cloudflare** | **未実装** |

→ **「OCR フレームワークはあるが、本番向け Gemini OCR は未実装」**。

### 3.2 Gemini OCR を入れる実装ポイント

| 優先 | ポイント | 推奨 |
| --- | --- | --- |
| 1 | `chat-ocr.js` の `extractViaGeminiVision` | **Edge Function 経由**（API キーをブラウザに出さない） |
| 2 | Edge 例: `ocr-extract` または既存 `gemini-chat` に `mode=ocr_only` | プロンプトは「テキスト抽出のみ。解釈・要約禁止」 |
| 3 | 入力 | image/pdf の bytes or signed URL（短命） |
| 4 | 出力 | **生テキストのみ**（構造化連絡先はクライアント/サーバの **regex 層**で判定） |
| 5 | **禁止** | OCR 生テキストをそのままユーザー向け AI 応答コンテキストに混ぜる |

**方針どおり:** OCR 結果 → **必ず** `moderateMessage` / `scanAttachments` 相当の contact 検知 → その後にのみ（マスク済みなら）下流へ。

### 3.3 添付が AI に渡る前の検査ポイント

| Surface | 現状の検査 | 不足 |
| --- | --- | --- |
| **Talk/Chat 送信** | `runModeration` → Attach.scan + OCR + moderation | Gemini OCR・マスク・開示分岐 |
| **TASFUL AI** | Gateway へ attachments 直送 | **送信前ゲートなし**（要追加） |
| **Builder AI Vision** | Gateway Vision | **連絡先検知なし** |
| **掲載画像** | 別フロー | 本調査の主対象外（必要なら別 Epic） |

**推奨挿入点（AI）:**

```text
UI attach → normalizeAttachments
  → scanAttachments / OCR
  → contactDetect (moderation)
  → if block: 拒否 or マスク後のみ続行
  → Gateway.chat({ attachments: sanitized })
```

### 3.4 Talk 送信前ブロックポイント

**既存:** `chat-service.js` `runModeration(roomId, messageInput)`（`saveMessage` 前）。

```text
chat-detail.js 送信
  → chat-service.saveMessage / send
  → runModeration
       → TasuPlatformContentGateAttachments.scanAttachments
       → TasuChatOcr (optional)
       → TasuPlatformContentGate + TasuChatModeration
  → blocked なら送信中止
  → warning/blocked なら persistModerationLog
```

ここが **Talk 送信前ブロックの正本ポイント**。Talk 専用 UI が別経路で送る場合は、同じ `runModeration` を必ず通すよう統一が必要。

### 3.5 自動マスク対象の正規表現（既存 + 拡張案）

**既存（`chat-moderation.js`）:**

| key | 概要 |
| --- | --- |
| `phone` | 国内/国際っぽい数字列 |
| `email` | RFC 簡易 |
| `line` | LINE ID / line.me / ライン誘導語 |
| `instagram` / `discord` / `telegram` | SNS |
| `external_url` / `url_shortener` | URL |
| `qr_hint` | 「QRコード」等の**文言のみ** |
| `investment_scam` / `adult` / `personal_info` | 勧誘・危険 |

**マスク実装時の置換案（未実装）:**

| 種別 | マスク例 |
| --- | --- |
| phone | `***-****-****` |
| email | `***@***.***` |
| url | `[リンクは非表示]` |
| line/sns | `[外部連絡先は非表示]` |

**注意:** phone regex は日付・金額の誤検知リスクあり。マスク/ブロック前に **スコア or 文脈**（桁数・ハイフン位置）を強化推奨。

### 3.6 QR コード検知方法

| 方式 | 現状 | 推奨 |
| --- | --- | --- |
| テキスト「QRコード」 | ✅ `qr_hint` | 維持 |
| **画像内 QR デコード** | ❌ | クライアント `jsQR` / Edge で画像デコード → ペイロード文字列を moderation に渡す |
| OCR で URL 抽出 | △（Gemini OCR 後） | QR デコードと併用 |

QR ペイロードが `https://line.me/...` や `tel:` なら既存 URL/phone ルールでブロック可能。

### 3.7 検知ログ保存先

| 現状 | 内容 |
| --- | --- |
| `persistModerationLog` | roomId · userId · messageText（OCR 連結）· imageUrls · reasons · level · allowed |
| Supabase | `insertModerationLog`（Chat 側テーブル想定） |

**不足:**

- attachment_id / storage path
- surface（talk / tasful_ai / builder_ai）
- contact_reveal_state（pre/post）
- mask 適用有無
- ocr_provider / ocr_ok

**推奨テーブル案（実装時 · 今回作らない）:** `moderation_events` または既存 moderation_logs 拡張。

### 3.8 開示前 / 開示後の挙動分岐

| 状態 | 推奨挙動 |
| --- | --- |
| **開示前**（Contact Reveal 未購入 / Talk ポリシーで連絡先禁止） | 添付・本文とも **block** または **自動マスクして送信可（マスク必須）** |
| **開示後** | 送信は許可しうるが、**検知はログ必須**（監査・不正利用追跡） |

**現状:** Builder `builder-contact-reveal.js` は UI ゲートのみ。`runModeration` は **reveal 状態を参照しない**。

**統合ポイント:**

```text
runModeration(input) {
  const revealed = ContactReveal.isRevealed(room/target);
  const scan = scanAttachments + moderateMessage;
  if (scan.blocked && !revealed) return block or mask;
  if (scan.blocked && revealed) { log only; allow or mask-policy };
}
```

### 3.9 既存 NG / ゲートとの統合

既に二層:

1. `TasuPlatformContentGate`（Platform）
2. `TasuChatModeration`（legacy regex）

`chat-service.moderateMessage` が両方を呼ぶ。

**推奨:** 新規ロジックは **ContentGate / Attachments に集約**し、`chat-moderation.js` はルール辞書として共有モジュール化（重複排除）。AI / Builder も同じ `scanAttachments` + `moderateMessage` を呼ぶ。

### 3.10 最小実装ステップ（優先順）

| Step | 内容 | 依存 |
| --- | --- | --- |
| **S0** | Gemini OCR を Edge で実装し `chat-ocr.js` provider=`gemini` を接続。キーは Edge secrets | Edge |
| **S1** | Talk/Chat: OCR provider を gemini に切替 · 既存 `runModeration` で回帰テスト | S0 |
| **S2** | 共有モジュール `contact-detect.js`（regex + mask helpers）を moderation から抽出 | — |
| **S3** | TASFUL AI: Gateway 呼び出し前に `scanAttachments` + detect | S0–S2 |
| **S4** | Builder AI Vision: 診断前に detect（ブロック or マスク後のみ診断） | S0–S2 |
| **S5** | Contact Reveal 状態を moderation に渡す（開示前 block/mask · 開示後 log） | Builder/Talk 契約 |
| **S6** | QR 画像デコード（jsQR or Edge） | S1 |
| **S7** | ログスキーマ拡張 · 運用ダッシュボード | S1+ |

---

## 4. 不足箇所（ギャップ）

| # | 不足 | 影響 |
| --- | --- | --- |
| G1 | Gemini OCR 未実装 | 画像内連絡先が抜けやすい（Tesseract は精度・本番運用が弱い） |
| G2 | AI Workspace 添付がゲート未通過 | AI 経由の抜け道 |
| G3 | Builder Vision がゲート未通過 | 見積写真・名刺写真の抜け道 |
| G4 | 開示前/後ポリシー未接続 | 550円ルールと添付検知が分断 |
| G5 | マスク未実装 | block のみで UX が硬い / または警告のみで漏れる |
| G6 | QR 実体未検知 | 画像 QR 抜け道 |
| G7 | PDF/Office は Attachments にあるが AI/Builder 未共用 | 経路依存の穴 |
| G8 | ログが Chat 中心 | AI/Builder 横断監査が弱い |

---

## 5. 実装方針（設計）

```text
                    ┌─────────────────────┐
  添付 (image/pdf)  │  OCR Edge (Gemini)  │  ← テキスト抽出のみ
                    └──────────┬──────────┘
                               │ ocrText（生）
                               ▼
                    ┌─────────────────────┐
                    │ Contact / Link /    │  ← regex + QR payload
                    │ Solicitation Detect │     ※ LLM に生 OCR を渡さない
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         開示前            開示後            AI 入力前
      block or mask      allow + log       mask 必須後のみ
                                              Gateway へ
```

**原則:**

1. OCR は **抽出専用**（Gemini）。判定は **決定論的ルール**（+ 将来オプションで別モデル判定）。
2. **OCR 生テキストをユーザー向け AI プロンプトに載せない**（マスク済み要約のみ可）。
3. Talk / AI / Builder は **同一 `scanAttachments` API**。
4. 既存 `runModeration` / `persistModerationLog` を拡張して横断ログ。

---

## 6. 優先度

| 優先 | 項目 | 理由 |
| --- | --- | --- |
| **P0** | Talk/Chat: Gemini OCR 接続 + 既存ブロック強化 | 既に骨格あり · 抜け道が画像中心 |
| **P0** | TASFUL AI 添付前ゲート | 現状ほぼ素通し |
| **P1** | Contact Reveal 状態連携（開示前/後） | 550円ルールとの一貫性 |
| **P1** | Builder AI Vision ゲート | 現場写真・書類 |
| **P2** | QR 画像デコード | 高度な抜け道 |
| **P2** | マスク送信 UX | block のみからの改善 |
| **P2** | ログスキーマ横断 | 運用・監査 |

---

## 7. リスク

| リスク | 内容 | 緩和 |
| --- | --- | --- |
| **誤検知** | 電話 regex が日付・金額をブロック | ルール精緻化 · warning 段階 |
| **OCR 精度** | 手書き・低解像度 | Gemini 優先 · 失敗時 needs_review |
| **コスト/遅延** | 全画像を Gemini OCR | サイズ上限 · キャッシュ · 非同期 needs_review |
| **キー漏洩** | ブラウザ直呼び | **Edge のみ** |
| **プライバシー** | OCR 全文をログに残す | ログは reasons + ハッシュ/マスク断片 |
| **バイパス** | Talk 以外経路 | AI/Builder を同一ゲートに強制 |
| **UX** | 正当な見積共有までブロック | 開示後は log-only · マスク選択肢 |

---

## 8. 調査項目チェックリスト（回答一覧）

| # | 項目 | 回答 |
| --- | --- | --- |
| 1 | OCR 未実装か | **フレームワークあり · Gemini/Cloudflare 未実装 · 既定は tesseract or none** |
| 2 | Gemini OCR 実装ポイント | `chat-ocr.js` + **Edge OCR** · 抽出のみ |
| 3 | AI 前検査ポイント | Gateway 前に `scanAttachments`（現状なし → 要追加） |
| 4 | Talk 送信前ブロック | `chat-service.runModeration`（既存） |
| 5 | マスク正規表現 | `chat-moderation.js` BLOCK_RULES を共有・拡張 |
| 6 | QR 検知 | 文言のみ既存 · **画像デコードは未実装** |
| 7 | ログ保存先 | Chat `moderation_logs`（拡張要） |
| 8 | 開示前/後 | **未接続** · Reveal 状態を moderation に渡す設計 |
| 9 | NG 統合 | ContentGate + Moderation を単一パイプライン化 |
| 10 | 最小ステップ | S0 Gemini OCR Edge → S1 Talk 回帰 → S3 AI ゲート → S5 Reveal 分岐 |

---

## 9. 参照

- `chat-ocr.js` · `chat-moderation.js` · `chat-service.js`（`runModeration`）
- `platform-content-gate-attachments.js`
- `builder/builder-contact-reveal.js`
- `docs/production-release-checklist.md`（OCR Cloudflare 未完了）
- `docs/AI/BUILDER_AI.md`（OCR 非実装）
- `reports/tasful-ai-attach-vision-first.md`

---

*設計調査のみ。実装・Migration・Edge デプロイ・secrets 変更は行っていない。*
