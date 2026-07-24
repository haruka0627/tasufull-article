# TLV × ZEGO Broadcast/CDN モード — 追加調査（Read-only）

**調査日:** 2026-07-08  
**親レポート:** [tlv-live-provider-comparison-2026-07.md](./tlv-live-provider-comparison-2026-07.md)  
**スコープ:** ZEGO の Interactive HD 以外（Broadcast / CDN / Standard / L3）で投げ銭ライブが成立するか · 調査のみ

---

## 結論（要約）

| 質問 | 回答 |
| --- | --- |
| Broadcast/CDN で投げ銭ライブは成立するか | **◎ 成立可能** — TLV はもともと **映像（ZEGO）とチャット/投げ銭（Supabase/Edge）を分離** しているため |
| 最安構成 | **1 host WebRTC publish + 視聴者 CDN Live（GB 課金）** · 480p デフォルト |
| 視聴者課金最安モード | **CDN Live（$0.15/GB）** — Standard Live（$2.29/1k min）より大規模 CCU で有利 |
| 遅延 | CDN **5〜10秒** · Standard **3秒超** · L3 **0.6〜1秒** · Premium/Interactive **<300ms** |
| ギフト/コメント | **ZEGO 経由ではない** → Supabase/Edge なら **問題なし**（映像との非同期は UX 設計事項） |
| 高還元（80%）との整合 | **CDN 480p + FinOps cap + ギフト Net** なら現実的 · **85%以上は CCU/ギフト条件付き** |

**現状 PoC の注意:** `live/providers/zego-live-provider.js` は `startPlayingStream` を **デフォルト RTC モード**で呼んでおり、CDN/L3 の `resourceMode` 指定は **未実装**（Console 側 CDN 有効化も必要）。本調査は運用設計の妥当性確認であり、実装変更は行っていない。

---

## 1. ZEGO ライブ配信の3+1 モード

ZEGO 公式（[Pricing - Live Streaming](https://docs.zegocloud.com/article/15141) · [Cost-Efficiency Blog](https://www.zegocloud.com/blog/cost-efficient-live-streaming)）より:

| モード | 視聴者課金 | 典型遅延 | 用途 |
| --- | --- | --- | --- |
| **CDN Live** | **$0.15/GB**（トラフィック） | **5〜10秒** | 大規模一方向配信 · **最安** |
| **Standard Live** | HD **$2.29/1,000 min** | **>3秒** | CDN+RTC ハイブリッド · 中間 |
| **Premium Live** | HD **$3.99/1,000 min** | **<300ms 級** | 双方向インタラクティブ |
| **L3 超低遅延** | HD **¥14.50/1,000 min**（中国ドキュメント正本 · 要グローバル見積） | **600ms〜1秒** | 大規模 + 低遅延 · `ONLY_L3` |

**Host/co-host** はいずれのモードでも **RTC publish 課金**（HD $3.99/1k min · 30分 ≈ **$0.12 / ¥18**）。

**Console 前提:** CDN Live は Admin Console で CDN サービス有効化が必要。Standard/L3 は **営業/サポート経由の有効化**が必要（ドキュメント明記）。

---

## 2. TLV アーキテクチャとの適合性

### 2.1 映像と投げ銭は既に分離されている

| 機能 | 正本 | ZEGO 依存 |
| --- | --- | --- |
| ライブ映像 | ZEGO Provider → `startLive` / `joinLive` | **あり** |
| コメント | `live-comments.js` → `live_broadcast_messages`（Supabase） | **なし** |
| 投げ銭/ギフト | `live-tips.js` / `tlv-create-tip` → Payment Engine | **なし** |
| ゲージ/演出 | `stream_events`（UX のみ · `TLV_PAYMENT_ENGINE.md`） | **なし** |
| Platform Live Chat | Adapter `sendChatMessage` = **noop**（Edge 正本） | **なし** |

```text
視聴者ブラウザ
  ├─ ZEGO play（CDN / L3 / RTC）     ← 遅延 0.6s〜10s（モード依存）
  └─ Supabase Realtime / Edge RPC    ← チャット · ギフト · ゲージ（<1s 想定）
```

ZEGO 公式ブログも **ハイブリッド構成**を推奨:

> Video (CDN) 5–10s · Chat (WebSocket) <500ms

TLV はこのパターンと **設計上一致**（チャットを ZEGO IM に載せない方針）。

### 2.2 ギフト演出・コメントに問題が出るか

| 観点 | 評価 | 説明 |
| --- | --- | --- |
| ギフト送信 | **問題なし** | Wallet RPC → `stream_events` · UI オーバーレイは ZEGO 非依存 |
| コメント表示 | **問題なし** | Supabase 経由（将来 Realtime 配線 · TLV-P0-06） |
| ゲージ更新 | **問題なし** | `gauge_state` / `stream_events` が正本 |
| クリエイター映像との同期 | **UX 注意** | CDN 5–10s 遅延のため「投げ銭即表示 vs 配信者リアクション遅延」がズレる · **TikTok/17LIVE 等と同型** |
| ZEGO UIKit ギフト | **未使用** | UIKit 内蔵ギフト低遅延は TLV スコープ外 · 自前 UI で代替 |

**結論:** 投げ銭ライブに必要な **課金 · 演出 · コメント** は Broadcast/CDN モードでも成立。**双方向の「配信者が視聴者音声を聞く」** 等の RTC 双方向機能のみ CDN では不可（TLV v1 では 1 host 想定のため影響小）。

---

## 3. 1配信者 + 多数視聴者 — 最安構成

### 推奨アーキテクチャ（FinOps 整合）

```text
Host（studio）
  └─ WebRTC publish のみ（1 stream · HD/720p または 480p）

Audience（watch · N 人）
  └─ CDN Live pull（480p デフォルト · 10k CCU 時 480p 降格 — FINANCIAL_MODEL §5.2 既存方針）

並行（ZEGO 外）
  ├─ Supabase Realtime: comments + stream_events
  └─ tlv-create-tip: wallet + gauge
```

| 項目 | 選定理由 |
| --- | --- |
| Host = RTC | publish 1 路のみ · コスト固定 ~¥18/30min |
| Audience = CDN | **視聴者課金が GB 単位**で CCU スケールに最適 |
| 480p デフォルト | ZEGO 公式プロファイル 0.64 Mbps · 720p(2 Mbps) の **約32%** トラフィック |
| 録画なし | Cloud Recording $0.59/1k min を回避（TLV 初期方針と一致） |

---

## 4. 視聴者課金が最も安いモード

**CCU ≥ ~100 規模では CDN Live（$0.15/GB）が最安。**

ZEGO 公式例（1 host + 1,000 audience · 60 min · 720p 2Mbps · [article/15141](https://docs.zegocloud.com/article/15141)）:

| モード | 60分・1000 CCU 公式例 | 30分・1000 CCU 概算 |
| --- | --- | --- |
| Premium Live | **$359** | **~$180** |
| Standard Live | **$206** | **~$103** |
| **CDN Live** | **$198** | **~$66** |

小規模（~10 CCU 以下）では Standard の分課金の方が安い場合あり。TLV 想定 CCU（100〜1000）では **CDN が優位**。

---

## 5. 遅延秒数

| モード | 遅延 | TLV 投げ銭 UX |
| --- | --- | --- |
| **CDN Live** | **5〜10秒** | ギフト/チャットは Supabase で即時 · 映像のみ遅延 · **許容範囲** |
| **Standard Live** | **3秒超**（公式: Standard latency >3s） | CDN より改善 · 中間コスト |
| **L3（ONLY_L3）** | **0.6〜1.0秒** | 映像とギフトのズレ最小 · creator_pro 向けアップセル候補 |
| **Premium / Interactive HD** | **<300ms** | 最高 UX · **コスト最大** · co-host/連麦向け |

L3 有効化: `ZegoPlayerConfig.resourceMode = ONLY_L3` + サポート申請（[Low-Latency Live Streaming docs](https://www.zegocloud.com/docs/real-time-voice-android/live-streaming/low-latency-live-streaming)）。

---

## 6. 720p / 480p 切替によるコスト差

ZEGO 公式ビットレート表（CDN トラフィック見積用）:

| 解像度 | ビットレート | 30分/視聴者トラフィック | CDN コスト/視聴者 |
| --- | --- | --- | --- |
| **480×360** | **0.64 Mbps** | **~0.14 GB** | **~$0.021（¥3.2）** |
| **640×480** | 1.5 Mbps | ~0.33 GB | ~$0.050（¥7.5） |
| **1280×720** | **2.0 Mbps** | **~0.44 GB** | **~$0.066（¥9.9）** |

**720p → 480p で CDN 視聴者コスト ≈ 32%（約1/3）。**

| CCU | 30分 CDN 480p | 30分 CDN 720p | 差 |
| --- | --- | --- | --- |
| 100 | **~$2.1 / ¥320** | **~$6.7 / ¥1,000** | **3.2×** |
| 500 | **~$11 / ¥1,650** | **~$33 / ¥4,950** | **3.0×** |
| 1,000 | **~$21 / ¥3,150** | **~$66 / ¥9,900** | **3.1×** |

（+ host 固定 ~$0.12/30min ≈ ¥18）

**TLV `FINANCIAL_MODEL.md` 整合:** モデルは 720p 640kbps 平均 → **¥2/viewer/30min**。CDN 480p 実コスト **~¥3.2/viewer** はモデルに **最も接近**（Interactive HD ~¥18/viewer より大幅改善）。

---

## 7. 100 / 500 / 1000 CCU · 30分コスト一覧

**前提:** 1 host · 全視聴者が30分視聴 · 為替 $1=¥150 · host HD RTC 込み

### 7.1 CDN Live（推奨最安）

| CCU | 480p | 720p |
| --- | --- | --- |
| **100** | **$2.2 / ¥330** | **$6.8 / ¥1,020** |
| **500** | **$11 / ¥1,650** | **$33 / ¥4,950** |
| **1,000** | **$21 / ¥3,150** | **$66 / ¥9,900** |

### 7.2 Standard Live（720p 分課金）

| CCU | 30分コスト |
| --- | --- |
| **100** | **~$7.0 / ¥1,050** |
| **500** | **~$34 / ¥5,100** |
| **1,000** | **~$69 / ¥10,350** |

### 7.3 L3 超低遅延（720p · ¥14.50/1k min · 中国ドキュメント）

| CCU | 30分コスト（視聴者のみ） | + host |
| --- | --- | --- |
| **100** | **¥44** | **~¥62** |
| **500** | **¥218** | **~¥236** |
| **1,000** | **¥435** | **~¥453** |

L3 SD（¥7/1k min）なら 720p CDN と同程度だが遅延 **0.6–1s**。

### 7.4 Premium / Interactive HD（現 PoC 相当 · 全員 RTC 分課金）

| CCU | 30分コスト |
| --- | --- |
| **100** | **~$12 / ¥1,800** |
| **500** | **~$60 / ¥9,000** |
| **1,000** | **~$120 / ¥18,000** |

**Interactive HD は FinOps モデル（¥2/viewer）と整合しない。** Broadcast/CDN への切替は **高還元設計の前提条件**。

---

## 8. 高還元設計に使える現実的構成

### 8.1 推奨運用構成（TLV v1）

| レイヤ | 選定 |
| --- | --- |
| 映像 | **CDN Live · 480p デフォルト** · 1000 CCU 超で自動 480p（`FINANCIAL_MODEL` §5.2 既存） |
| 低遅延オプション | **creator_pro** 以上 → L3 SD/HD（+¥7–14.5/1k min） |
| チャット | Supabase Realtime + rate limit（TLV-P0-06） |
| 投げ銭 | Payment Engine · `stream_events` 演出 |
| 録画 | **なし**（初期） |
| co-host | **Phase 2 以降** · 必要時のみ Premium 枠 |

### 8.2 還元率 × CDN 480p 実コスト（30分セッション · ギフト Net = CCU×¥15 · 延長30%）

`FINANCIAL_MODEL.md` §5 モデルを **CDN 480p 実コスト**で再計算（Infra = CDN 480p 表 + host ¥18 · 無料 cap なしで保守試算）:

| CCU | Total Net（60分） | Infra（CDN480p+host） | 80% payout | Platform 残 | 85% | 90% |
| --- | --- | --- | --- | --- | --- | --- |
| **100** | ¥2,036 | **~¥330** | ¥1,629 | **+¥77** | **−¥25** | **−¥126** |
| **500** | ¥8,536 | **~¥1,668** | ¥6,829 | **+¥39** | **−¥387** | **−¥1,132** |
| **1,000** | ¥15,536 | **~¥3,168** | ¥12,429 | **−¥61** | **−¥837** | **−¥2,162** |

**読み方:**

| 還元率 | CDN 480p での現実性 |
| --- | --- |
| **80%** | **100 CCU 前後は黒字余地** · 500 CCU はギフト依存でギリ |
| **85%** | **100 CCU 以下 + ギフト Net 強め** のみ現実的 |
| **90%** | Override 条件付き · **低 CCU Creator 限定**（`PF-02` 赤字ガード） |
| **95%** | **非現実的**（親レポート §6 同様 · Legend + PPC≥¥50万 でも Platform 利益ほぼゼロ） |

**FinOps cap（無料30分 ¥150/セッション）** を適用すると 100 CCU 無料枠のみでも CDN480 実コスト ~¥330 は cap 超過 → **無料枠は CCU 上限または時間上限の追加設計が必要**（例: 無料30分 CCU≤50 · または 480p 強制 · 超過は有償延長必須）。

### 8.3 現実的な落とし所

```text
1. 本番 RTC = CDN Live 480p（視聴者）+ WebRTC publish（host のみ）
2. チャット/投げ銭/ゲージ = Supabase/Edge（ZEGO 遅延と非同期）
3. creator_pro = L3 SD へアップグレード（低遅延オプション）
4. co-host / 連麦 = Premium 枠（少数のみ · 別途課金）
5. FinOps: infra_unit_costs を ZEGO 実績 CDN GB で月次更新（AD-014 FinOps ルール）
6. 還元: base 70–80% を主戦場 · 90% Override は Diamond+ 条件 · 95% は Legend 限定
```

---

## 9. 現状 PoC とのギャップ（調査メモ · 実装は別タスク）

| 項目 | 現状 | Broadcast/CDN 運用に必要なこと |
| --- | --- | --- |
| `zego-live-provider.js` | `startPlayingStream(streamId)` デフォルト | 視聴者側 `resourceMode` = CDN/L3 指定 |
| ZEGO Console | 未確認 | CDN Live 有効化 · Standard/L3 申請 |
| Feature flag | `usePlatformLive=false` | 本番 ON + CDN モード検証 |
| FinOps 単価 | ¥2/viewer（モデル） | CDN 480p 実績 ~¥3.2/viewer へ更新検討 |

---

## 10. 総合判断

| 判断 | 内容 |
| --- | --- |
| **成立するか** | **はい** — TLV の Payment/Chat/Gauge 分離設計により CDN 5–10s 遅延でも投げ銭ライブは成立 |
| **最安** | **CDN Live 480p** · 1 host RTC publish |
| **高還元と両立** | **80% base が現実的上限** · CDN 480p + ギフト Net + CCU ガード · 85%以上は低 CCU 限定 |
| **Interactive HD 全員 RTC** | **高還元設計と両立不可** — PoC モードのまま本番化しないこと |
| **L3** | 低遅延オプション（creator_pro）として **コストと UX のバランス良** |

---

*調査のみ。コード · 設定 · ZEGO Console 変更なし。*
