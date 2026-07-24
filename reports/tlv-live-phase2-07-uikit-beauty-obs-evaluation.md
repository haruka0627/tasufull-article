# TLV Live SDK Phase2-07 — ZEGO UIKit / Basic Beauty / OBS 評価

**日付:** 2026-06-28  
**種別:** 調査 · 方針整理 · PoC 分離（**実装 · 本番接続なし**）  
**PoC URL:** `http://127.0.0.1:8788/live/live-zego-uikit-eval.html`  
**正本:** [docs/TLV_LIVE_PROVIDER.md §26](../docs/TLV_LIVE_PROVIDER.md)

---

## 0. スコープと禁止事項（遵守）

| ルール | 状態 |
| --- | --- |
| 既存 Live UI 変更禁止 | ✅ studio / watch / index 未変更 |
| `live-broadcasts.js` 変更禁止 | ✅ 未変更 |
| Payment / Wallet / Coin / 投げ銭 / 30分 | ✅ 非接触 |
| 本番接続禁止 | ✅ UIKit SDK mount なし |
| `liveSessionManagerEnabled` OFF 既定 | ✅ 維持 |
| ZEGO 資格情報未設定時 E2E | ✅ **SKIP** と明記 |

---

## 1. UIKit 評価

**対象:** `@zegocloud/zego-uikit-prebuilt` · Live Streaming Kit (Web)

| 項目 | 判定 | 根拠 |
| --- | --- | --- |
| 配信画面（Host） | **GO** | Host / Cohost ロール · カメラ · マイク · 画面共有 · 終了 UI 内蔵 |
| 視聴画面（Audience） | **GO** | Audience ロール · `LiveStreaming`（CDN）/ `InteractiveLiveStreaming`（L3）/ `RealTimeLive`（RTC） |
| チャット UI | **GO** | `showTextChat` 既定 true · 右サイドメッセージ欄 · カスタム可 |
| ギフト UI | **CONDITIONAL** | Web UIKit **標準同梱なし** · `addButtonToBottomMenuBar` + ZIM / ルームメッセージで自作（[Virtual Gifts ブログ](https://www.zegocloud.com/blog/virtual-gifts)） |
| 視聴者一覧 | **GO** | `showUserList` · メンバーリストサイドバー |
| カメラ / マイク / 終了 | **GO** | 底部メニュー · 离开弹窗 · `onLeaveRoom` 等コールバック |
| TLV 独自 UI との共存 | **CONDITIONAL** | 下記 §1.1 |

### 1.1 TLV UI 共存 — 結論

| 方式 | 判定 | 説明 |
| --- | --- | --- |
| **A. UIKit フル画面** | CONDITIONAL | 最速 MVP · TLV studio/watch デザインと **置換** 関係 |
| **B. UIKit 部分 embed** | CONDITIONAL | Feature Map 上カスタム可能（顶部/底部/侧边栏）· 工数増 |
| **C. Express SDK + TLV 自前 UI** | **GO** | 現 `zego-live-provider.js` パス · デザイン完全制御 · UIKit より工数大 |

**推奨（Phase2 以降）:** 短期 PoC/MVP は **A または B + Provider アダプタ**、長期ブランド UI は **C**。いずれも UI から UIKit を直接 mount せず **Provider 内に閉じる**（TLV_LIVE_PROVIDER §4）。

### 1.2 実機 E2E

| 状態 | 備考 |
| --- | --- |
| **SKIP** | 本リポジトリ環境: ZEGO `.env` / `live-zego-config.js` 未設定時 |
| **UNCONFIRMED** | 資格情報設定後 · UIKit Prebuilt 単体 mount PoC は Phase2-07 範囲外（別タスク可） |

---

## 2. Basic Beauty 評価

| 項目 | 判定 | 根拠 |
| --- | --- | --- |
| Express SDK 単体（CDN 一括） | **NO-GO** | 現 PoC `zego-express-engine-webrtc@3.12.0` CDN 一括ロード · `probeBasicBeauty()` で API 未検出 |
| Express + `BeautyEffect` ESM | **CONDITIONAL** | 公式: `import { BeautyEffect } from 'zego-express-engine-webrtc/esm/beauty-effect'` + `ZegoExpressEngine.use(BeautyEffect)` · `setEffectsBeauty(localStream, enable, params)` |
| UIKit 経由 | **UNCONFIRMED** | UIKit 内部 Express 利用 · Basic Beauty 露出は実機要確認 |
| Console 設定 | **CONDITIONAL** | AppID / Server 必須 · 機能別（RTMP/WHIP 等）はサポート申請 |
| Basic Beauty ライセンス | **CONDITIONAL** | `setEffectsBeauty`（基础美颜）文書は AppID + Express 統合前提 · **別 AI Effects license ファイル不要な可能性**（要 ZEGO 確認） |
| AI Effects 契約 | **NO-GO** | Phase2-07 スコープ外 · `ZegoEffects` + license 要 · TLV-LIVE-FUTURE-02 競合 |

### 2.1 結論サマリー（Beauty）

```text
Express CDN 一括（現 PoC）     → NO-GO
Express ESM BeautyEffect       → CONDITIONAL（推奨検証パス · IF-TODO-05 サブ IF）
UIKit                          → UNCONFIRMED
AI Effects                     → NO-GO（今回）
```

**次アクション:** 資格情報設定後 · Express ESM Beauty 分離 PoC（`live-zego-poc` 拡張 or 別ページ）で `setEffectsBeauty` 実機確認。

---

## 3. OBS / RTMP 評価

| 項目 | 判定 | 根拠 |
| --- | --- | --- |
| RTMP → ZEGO ingest | **GO** | [RTMP 推流文档](https://doc-zh.zego.im/live-streaming-web/live-streaming/obs-push) · OBS 自定义服务器 + streamId |
| WHIP（OBS 30+） | **GO** | [WHIP 推流](https://doc-zh.zego.im/live-streaming-rn/live-streaming/obs-push-with-whip) · 低遅延 · ドメイン/Token 要申請 |
| Web SDK から OBS 制御 | **NO-GO** | OBS は外部 · TLV は URL 発行 + 視聴 SDK 拉流 |
| TLV Provider 統合 | **CONDITIONAL** | IF-TODO-04 · 下記 §3.1 |

### 3.1 OBS 統合設計メモ（実装なし）

```text
OBS / WHIP
  → RTMP URL / WHIP URL（サーバー调度 API · ZEGO サポート権限）
  → streamId = roomId 整合
  → publish_start / publish_stop コールバック（任意 · ZEGO 設定）
  → 視聴: Express SDK startPlayingStream(streamId)
```

**Interface 拡張案:** `startLive({ mode: 'obs' | 'webcam', roomId, streamId })` — Provider 内分岐 · Session Manager は既存 signal 抽象化で接続可。

### 3.2 実機 E2E

| 状態 | 備考 |
| --- | --- |
| **SKIP** | RTMP/WHIP 権限未申請 · 調度 API 未実装 |

---

## 4. Provider 抽象化への影響

| 項目 | 影響 |
| --- | --- |
| **UIKit 採用** | 新 adapter `zego-uikit` または `createTlvLiveProvider('zego', { surface: 'uikit' })` · Prebuilt mount を Provider 内に限定 |
| **Express 継続** | 現 `TlvZegoLiveProvider` 維持 · TLV カスタム UI に最適 |
| **Beauty（IF-TODO-05）** | `BeautyProvider` サブ IF · ESM lazy load · main IF から分離 |
| **OBS（IF-TODO-04）** | `startLive({ mode })` · サーバー RTMP 调度 · Token publish 権限 |
| **Session Manager** | Phase2-01〜06 完了 · `handleProviderSignal` / ERROR 分類済 · UIKit/OBS も signal 変換層で接続可能 |
| **Config（IF-TODO-03）** | 将来 `TLV_LIVE_PROVIDER_CONFIG` へ rename · UIKit は appSign 要の可能性（Express は Token04） |

**原則維持:** UI → Live Service → Session Manager → Provider Interface → SDK/UIKit

---

## 5. 追加ファイル（PoC 分離）

| ファイル | 役割 |
| --- | --- |
| `live/live-zego-uikit-eval.html` | 評価ダッシュボード（本番非接続） |
| `live/live-zego-uikit-eval.js` | 判定表 · 資格情報検出 · E2E SKIP 表示 |
| `live/live-zego-uikit-eval.css` | スタイル |
| `scripts/verify-live-zego-uikit-eval.mjs` | Static 検証 |

**触っていない:** `live-broadcasts.js` · `studio.html` · `watch.html` · Payment 系

---

## 6. 検証

```bash
npm run verify:live-zego-uikit-eval
```

| チェック | 期待 |
| --- | --- |
| 評価 PoC ファイル存在 | PASS |
| live-broadcasts.js 未変更（評価期間） | PASS |
| UIKit SDK 本番ページ未参照 | PASS |
| HTTP 200（dev 起動時） | `/live/live-zego-uikit-eval.html` |

---

## 7. 総合推奨（Phase2-07 時点）

| 領域 | 推奨 |
| --- | --- |
| **UIKit** | **CONDITIONAL 採用** — MVP 加速に有効 · TLV ブランド UI とは戦略選択必要 |
| **Basic Beauty** | **CONDITIONAL** — Express ESM `BeautyEffect` パスを次 PoC で実機確認 · AI Effects は NO-GO |
| **OBS** | **CONDITIONAL** — 技術的 GO · ZEGO 権限 + サーバー API + IF-TODO-04 が前提 |
| **Provider** | Express カスタム UI 継続 + UIKit/OBS は **別 adapter / mode** で共存設計 |

---

## 8. 次フェーズ候補

1. 資格情報 GO 後: Express ESM Basic Beauty 分離 PoC
2. 資格情報 GO 後: UIKit Prebuilt 単体 mount PoC（Provider アダプタ試作）
3. OBS: RTMP 调度 API 設計 + IF-TODO-04 Interface 草案
4. Phase2-08 以降: studio/watch への **flag ON + Provider 接続**（別 GO ゲート）
