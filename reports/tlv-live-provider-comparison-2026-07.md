# TLV ライブ配信基盤 — 調査レポート（Read-only）

**調査日:** 2026-07-08  
**スコープ:** コード・docs・設定の読み取りのみ（変更なし）  
**正本参照:** `docs/TLV_LIVE_PROVIDER.md` · `docs/LIVE_PLATFORM_ZEGO_ADAPTER.md` · `docs/TODO.md` · `docs/FINANCIAL_MODEL.md` · `docs/CREATOR_PROGRAM.md`

---

## ① 現在 TLVで使用しているライブ配信API

### 結論（1行）

| 役割 | 採用状況 | プロバイダ |
| --- | --- | --- |
| **RTC（リアルタイム配信）** | **採用済み（実装）· 本番未接続** | **ZEGO（ZEGOCLOUD）** |
| **本番 watch/studio デフォルト** | **稼働中（プレースホルダ）** | **`stub`**（映像なし） |
| **HLS ingest（RTMP→HLS）** | **採用予定 · 未接続** | **Cloudflare Stream** |
| **その他** | **未実装（設計上の候補のみ）** | Agora · LiveKit · Cloudflare Calls · Custom RTC |

---

### 採用済み：ZEGO

| 項目 | 内容 |
| --- | --- |
| SDK | `zego-express-engine-webrtc@3.12.0`（CDN 読み込み · npm 依存なし） |
| Provider | `live/providers/zego-live-provider.js` |
| Token API | `POST /api/tlv-zego-token` → `deploy/cloudflare/functions/api/tlv-zego-token.js` |
| Adapter | `platform-live/provider/adapters/zego-live-provider-adapter.js` |
| 環境変数 | `ZEGO_APP_ID` · `ZEGO_SERVER` · `ZEGO_SERVER_SECRET`（32 byte） |
| テスト | Platform Live ZEGO adapter **77 tests PASS** · Phase 5 TLV bridge コード完了 |

**本番状態:** Feature flag ともに **default OFF**

```javascript
// live/tlv-feature-flags.js
liveSessionManagerEnabled: false
usePlatformLive: false
```

`usePlatformLive=false` のとき studio/watch は **Supabase CRUD + stub プレーヤー** のみ。ZEGO RTC は PoC 経路（`live-zego-poc.html`）と flag ON 時の lazy load 経路に存在。

**Blocker:** ZEGO Console 資格情報（`.env` 3 変数）未設定 → 実機 E2E は Conditional Go。

---

### 採用予定：Cloudflare Stream（RTC ではない）

| 項目 | 内容 |
| --- | --- |
| 用途 | RTMP→HLS ingest · VOD 再生（**TLV-P0-02**） |
| 状態 | `stream_provider=stub` · **未接続** |
| UI ラベル | `live/live-config.js` に `cloudflare_stream` 定義あり |

```javascript
// live/live-config.js
LIVE_STREAM_PROVIDER_DEFAULT = "stub"
STREAM_PROVIDER_LABELS = { stub: "プレビュー", cloudflare_stream: "Cloudflare Stream" }
```

**注意:** Cloudflare Stream は **HLS 配信（数秒〜数十秒遅延）** であり、投げ銭・低遅延インタラクティブライブの **RTC 代替ではない**。ZEGO と **併用（二層構成）** が設計意図。

---

### 未採用（候補 enum のみ）

`live/providers/live-provider-types.js` に定義:

| ID | 状態 |
| --- | --- |
| `agora` | docs 上の将来候補 · コードなし |
| `livekit` | 同上 |
| `cloudflare_calls` | 同上 |
| `custom_rtc` | 長期置換方針（TLV-LIVE-FUTURE-04） |

**Agora · Stream · LiveKit · Mux · Daily · GetStream** — ランタイムコード・npm 依存 · env 設定 **なし**。

---

### アーキテクチャ（現状）

```text
┌─ 本番 studio/watch（default · flag OFF）─────────────┐
│  Supabase live_broadcasts + stub placeholder player │
└─────────────────────────────────────────────────────┘
         │ usePlatformLive=true のみ
         ▼
┌─ Platform Live Integration ─────────────────────────┐
│  ZegoLiveProviderAdapter → TlvZegoLiveProvider      │
└─────────────────────────────────────────────────────┘
         ▼
┌─ ZEGO Express Web SDK + Token04 API ────────────────┘

並行 PoC: live/live-zego-poc.html（同一 Provider スタック）

Payment Engine（tlv-create-tip 等）: 実装済み · Live UI 未接続（stub tips）
```

---

### 調査したファイル一覧

| 種別 | パス |
| --- | --- |
| 正本 docs | `docs/TLV_LIVE_PROVIDER.md` · `LIVE_PLATFORM_ZEGO_ADAPTER.md` · `TLV_PAYMENT_ENGINE.md` · `TODO.md` §TLV-P0 |
| live UI | `live/live-broadcasts.js` · `live-config.js` · `tlv-feature-flags.js` · `providers/zego-live-provider.js` |
| platform-live | `platform-live/README.md` · `provider/adapters/zego-live-provider-adapter.js` |
| Edge | `deploy/cloudflare/functions/api/tlv-zego-token.js` · `_shared/zego-token04.mjs` |
| env | `deploy/cloudflare/.dev.vars.example` · `scripts/lib/zego-env.mjs` |
| package.json | ZEGO 関連は **test/verify scripts のみ**（runtime dep なし） |
| DB | `db/tlv_schema.sql` — `tlv.streams` に `stream_provider` 列なし（PoC 未接続） |

---

## ② 料金比較

> **前提:** 2026年7月時点の公開価格（公式 docs / pricing page）。為替 **$1 = ¥150** で概算。Enterprise 契約 · 地域割引は除く。  
> **TLV 想定:** 720p · 30分セッション · 1 host + N viewers · インタラクティブライブ（投げ銭 · チャット）

### 各サービス概要

| サービス | 無料枠 | 課金モデル | 録画 | チャット | TURN | CDN | Stripe 相性 | 日本実績 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ZEGO** | トライアル / Starter パック | ユーザー分課金（2024/12〜） | $0.59/1k min | 別 SKU（$99/10k MAU） | SDK 内包 | SDK 内包 | ◎ 自前実装 | ◎ アジア強い |
| **Agora** | 10k Standard min/月 | Standard min（解像度係数） | 別途 + ストレージ | 別製品 | 内包 | 内包 | ◎ | ◎ 日本多数 |
| **LiveKit Cloud** | 5k WebRTC min/月 | $0.0004–0.0005/min + egress | $0.005/min | 自前 | 内包 | $0.10–0.12/GB | ◎ | △ 増加中 |
| **Cloudflare Stream** | 100 min stored + 10k delivered/月 | $5/1k stored · $1/1k delivered | 自動録画込 | **なし** | N/A | 込み | ◎ CF 統合 | ◎ |
| **Mux** | 100k delivery min/月 | $0.0008/min delivery（720p） | 別途 | **なし** | N/A | 込み | ◎ | △ |
| **Daily.co** | 10k participant-min/月 | $0.004/min（$4/1k） | $0.013/min + storage | 別途 | 内包 | 別途 | ◎ | △ |
| **Tencent TRTC** | 10k min/月（パック購入後） | $39.9/月〜パック + 従量 | 別途 | TUIKit 別 | 内包 | 内包 | ○ | ◎ 日本事例あり |

**Stripe 相性:** 全サービスとも **RTC 料金と Stripe 決済は独立**。TLV は既存 Payment Engine（Stripe webhook → `tlv.payments`）で問題なし。

---

### 同時視聴コスト概算（30分 · 720p）

**計算式（interactive HD 系）:** ユーザー分 = (host + viewers) × 30分

| プロバイダ | モード | 100人 | 500人 | 1,000人 |
| --- | --- | --- | --- | --- |
| **ZEGO** | Live CDN（一方向 `$0.39/1k`） | **~$1.2 / ¥180** | **~$5.9 / ¥880** | **~$12 / ¥1,800** |
| **ZEGO** | Interactive HD（`$3.99/1k user-min`） | **~$12 / ¥1,800** | **~$60 / ¥9,000** | **~$120 / ¥18,000** |
| **Agora** | Broadcast audience HD（係数2） | **~$6 / ¥900** | **~$30 / ¥4,500** | **~$60 / ¥9,000** |
| **Agora** | Interactive HD（係数4） | **~$12 / ¥1,800** | **~$60 / ¥9,000** | **~$120 / ¥18,000** |
| **LiveKit** | WebRTC（$0.0005/min） | **~$1.5 / ¥230** | **~$7.5 / ¥1,130** | **~$15 / ¥2,250** |
| **Cloudflare Stream** | HLS delivery のみ | **~$3 / ¥450** | **~$15 / ¥2,250** | **~$30 / ¥4,500** |
| **Mux** | Live delivery 720p | **~$2.4 / ¥360** | **~$12 / ¥1,800** | **~$24 / ¥3,600** |
| **Daily.co** | Video RTC | **~$12 / ¥1,800** | **~$60 / ¥9,000** | **~$120 / ¥18,000** |

**重要:** TLV の FinOps モデル（`FINANCIAL_MODEL.md`）は **視聴者30分あたり ¥2.00** を前提。ZEGO Interactive HD の実コスト（~¥18/viewer/30min）は **モデルの約9倍**。Broadcast/CDN モードならモデルに近づく。

**録画なし運用:** 上表は RTC/配信コストのみ。Cloud Recording を使うと ZEGO +$0.59/1k min 等が加算。

---

## ③ TLVとの相性（5段階評価）

| 評価項目 | ZEGO | Agora | LiveKit | CF Stream | Mux | Daily |
| --- | --- | --- | --- | --- | --- | --- |
| 低コスト | ★★★☆☆ | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★☆☆☆ |
| 高画質 | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★★★☆ |
| 低遅延 | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ |
| 実装難易度 | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★☆ |
| スケーラビリティ | ★★★★☆ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★☆ |
| 世界展開 | ★★★★☆ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★☆ |
| ライブ特化 | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ |
| 録画なし運用 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★★★ |
| 投げ銭サービス相性 | ★★★★★ | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ |

**補足**

- **投げ銭相性** = 低遅延 RTC + 自前 Payment Engine との分離設計。HLS-only（CF Stream / Mux）はリアルタイム演出に不向き。
- **ZEGO** は既存 Provider 実装 · Adapter 77 tests により **実装難易度 MAX**。
- **LiveKit** はコスト最良だが、UIKit / Beauty / 日本サポートは ZEGO/Agora より弱い。

---

## ④ ZEGOより良いAPI候補（2026年）

| 候補 | ZEGO より優れる点 | TLV への注意 |
| --- | --- | --- |
| **LiveKit Cloud / 自ホスト** | **最安**（~$0.0005/min）· オープンソース · 将来 Custom RTC 移行と整合 | UIKit なし · 実装コスト高 · `TLV-LIVE-FUTURE-03` と一致 |
| **Agora Broadcast Streaming** | **視聴者課金が安い**（audience HD $1.99/1k）· 大規模実績 | 既存 ZEGO Provider 置換コスト · 移行テスト必要 |
| **Tencent TRTC（TUILiveKit）** | 日本事例 · UIKit 完備 · アジア CDN | 中国系クラウド依存 · 海外展開時の法務検討 |
| **100ms** | 低遅延 · インド発でコスト競争力 | 日本サポート · 実績が ZEGO/Agora より少ない |
| **Cloudflare Stream** | HLS 配信最安クラス · CF 統合 | **RTC 代替不可** · ingest 補助として TLV-P0-02 済み計画 |

**結論:** 「ZEGOより安く · ライブ向け · 性能高」なら **LiveKit（コスト）** と **Agora Broadcast モード（規模）** が主候補。ただし TLV は **ZEGO Provider 実装済み** のため、切替コストを差し引くと短期は ZEGO 継続が合理的。

---

## ⑤ 推奨順位

| 順位 | 推奨 | 理由 |
| --- | --- | --- |
| **1** | **ZEGO（現行継続）** | Phase 1 Go · Adapter/Token/Provider 実装済み · flag 配線済み · 日本 TTM 最短 · docs 方針「SDK は時間を買う」に一致 |
| **2** | **Agora** | 同等のライブ SDK · Broadcast モードで大規模 CCU コスト優位 · 日本実績 · 将来 `createTlvLiveProvider("agora")` で差し替え可能 |
| **3** | **LiveKit** | 最大スケール時のコスト最良 · 自ホスト移行パス（TLV-LIVE-FUTURE-04）と一致 · 初期実装コスト高 |
| **4** | **Cloudflare Stream** | **RTC ではなく HLS 補助** · TLV-P0-02 として OBS/録画/VOD に最適 · ZEGO と併用 |
| **5** | **Tencent TRTC** | アジア · UIKit 強い · 海外 TLV 展開時の第二候補 |

**非推奨（TLV 主 RTC として）:** Mux · Daily · GetStream — いずれも **インタラクティブ投げ銭ライブ** より VOD / 会議 / コミュニケーション向き。

---

## ⑥ 還元率設計（80 / 85 / 90 / 95%）

### 前提（TLV 正本）

| 項目 | 値 |
| --- | --- |
| 還元基準 | **Net Revenue**（Gross 禁止 · AD-014） |
| Web Stripe 手数料 | 3.6%（500 coin = Gross ¥550 → Net **¥530**） |
| Rank base | Bronze 50% 〜 Legend 88%（`CREATOR_PROGRAM.md`） |
| Override | Diamond+ で **90%** · Legend で **95%**（条件付き） |
| Infra モデル | 視聴者30分 **¥2.00** · 無料枠 cap **¥150/セッション** |

### シミュレーション（60分 = 無料30 + 延長30 · `FINANCIAL_MODEL.md` §5 準拠）

**仮定:** 延長購入率 30% · ギフト Net = CCU × ¥15 · effective_rate 変動 · Web 70%

| CCU | Total Net | Infra 合計 | 80% 還元 | Platform 残 | 85% | 90% | 95% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **100** | ¥2,036 | ¥350 | ¥1,629 | **+¥57** | **−¥45** | **−¥146** | **−¥248** |
| **500** | ¥8,536 | ¥1,350 | ¥6,829 | **+¥357** | **−¥69** | **−¥494** | **−¥919** |
| **1,000** | ¥15,536 | ¥2,350 | ¥12,429 | **+¥757** | **+¥257** | **−¥243** | **−¥993** |

（Platform 残 = Total Net − Infra − Creator Payout）

### 現実性評価

| 還元率 | 現実性 | 条件 |
| --- | --- | --- |
| **80%** | **◎ 現実的** | Platinum（base 80%）· CCU 100〜500 で黒字余地あり |
| **85%** | **△ 条件付き** | Diamond base · CCU 100 前後でギフト依存ならギリ黒字 · 500 CCU 超は赤字 |
| **90%** | **△ Override のみ** | Diamond+ · WR≥70% · TS≥80 · **高 Net + 低 CCU** が必要 |
| **95%** | **✕ 通常運用では非現実的** | Legend 限定 · PPC≥¥50万/月 · PF-02「赤字 Creator には適用不可」 |

### ZEGO 実コストを入れた場合（Interactive HD · 100 CCU · 30分 ≈ ¥1,800）

| 還元率 | Platform 残（モデル infra + 実 ZEGO） |
| --- | --- |
| 70% | **−¥1,539** |
| 80% | **−¥1,743** |
| 90% | **−¥2,046** |

**→ 高還元（85%〜）を維持するには Broadcast/CDN モードで infra を ¥2/viewer に近づける必要あり。**

---

## 総括

| 質問 | 回答 |
| --- | --- |
| 今使っている API は？ | **RTC = ZEGO（実装済み · 本番未接続）** · **本番 = stub** · **HLS = Cloudflare Stream（予定）** |
| おすすめは？ | **短期: ZEGO 継続** · **中長期: Agora Broadcast or LiveKit へカナリア移行** |
| 還元率 | **80% = 現実的** · **85% = 低〜中 CCU のみ** · **90% = Override 条件付き** · **95% = ほぼ不可** |
| 最大リスク | FinOps モデル（¥2/viewer）と **ZEGO Interactive 実コスト（~¥18/viewer）の乖離** |

---

*調査のみ実施。コード · 設定 · インストールへの変更なし。*

*追加調査（ZEGO Broadcast/CDN モード）: [tlv-zego-broadcast-mode-addendum-2026-07.md](./tlv-zego-broadcast-mode-addendum-2026-07.md)*
