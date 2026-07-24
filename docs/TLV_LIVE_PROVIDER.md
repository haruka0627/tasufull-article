# TLV Live Provider

**版:** 1.10 Phase2-08
**最終更新:** 2026-06-28（**Phase2-08 UIKit / Beauty 実機 PoC — SKIP**）
**種別:** Live SDK Provider 設計 · ZEGO Phase 1 PoC  
**関連:** [TODO.md](./TODO.md) §TLV Live Provider Future Backlog · [TLV Release P0 監査](../reports/tlv-release-p0-audit.md)

---

## 1. ZEGO 採用理由（Phase 1）

| 観点 | 理由 |
| --- | --- |
| **Time-to-market** | Web/モバイル向け RTC + Live UIKit が揃い、最速で PoC → MVP へ |
| **運用負荷** | 初期は自社 SFU/Media Server 構築より SDK 委譲が低コスト |
| **置換可能性** | Provider Interface で SDK 依存を閉じ、将来独自基盤へ段階移行 |
| **非永続依存** | SDK は「時間を買う」手段 — [TLV-LIVE-FUTURE-04](./TODO.md) 条件達成後に置換検討 |

**Phase 1 スコープ:** SDK 単体動作確認 + Provider 境界。**Payment / Wallet / Coin / 投げ銭 / 30分制御には触れない。**

---

## 2. Provider 構成

### Phase 1（現行 · 実装済）

```text
UI (live-zego-poc.html / live-zego-poc.js)
  ↓
Live Service (live/live-service.js)
  ↓
Live Provider Interface (live/providers/live-provider-interface.js)
  ↓
ZEGO Provider (live/providers/zego-live-provider.js)
  ↓
ZEGO Express Web SDK (CDN · Provider 内部のみ)
```

### Phase 2 目標（Phase2-01 Skeleton 追加 · Service/Provider **未接続**）

```text
UI                          ← Phase2-03 以降
  ↓
Live Service                ← **Phase2-02 Done**（Session Manager 配線）
  ↓
Live Session Manager        ← Phase2-01 Done（live/session/*）
  ↓
Live Provider Interface
  ↓
ZEGO Provider（将来: Agora / LiveKit / Custom RTC）
  ↓
SDK
```

**Phase 2 着手前ルール:** 上記 Session Manager は **設計のみ** · 既存 `live/` 本番ページ · Payment Engine **変更禁止**。

**Token 発行（サーバー）:**

```text
Browser → POST /api/tlv-zego-token
  ↓
Cloudflare Pages Function (deploy/cloudflare/functions/api/tlv-zego-token.js)
  ↓
.env: ZEGO_APP_ID · ZEGO_SERVER_SECRET（32 byte）
```

---

## 3. 責務分離

| 層 | 責務 | 禁止 |
| --- | --- | --- |
| **UI** | フォーム · ボタン · ステータス表示 | ZEGO SDK 直接呼出し |
| **Live Service** | Provider 生成 · Token API 呼出 · セッション操作の窓口 | Wallet / Payment |
| **Interface** | `initialize` / `startLive` / `joinLive` 等の契約 | SDK 型の露出 |
| **ZEGO Provider** | SDK ロード · room/stream · device 制御 | 上位への Engine 参照 |
| **Token API** | Token04 生成 | secret のクライアント返却 |

---

## 4. SDK 依存を閉じ込める方針

- ZEGO 固有の型・インスタンスは **`zego-live-provider.js` 内のみ**
- 将来 **Agora / LiveKit / Cloudflare Calls / Custom RTC** は `createTlvLiveProvider(id)` で差し替え
- `stream_provider` DB 列挙と整合させる想定（PoC では未接続）
- UIKit 利用時も **Provider アダプタ経由** — UI から UIKit を直接 mount しない

---

## 5. Basic Beauty 方針

| 項目 | Phase 1 |
| --- | --- |
| **対象** | SDK 標準 Beauty API の有無確認のみ |
| **確認方法** | PoC 画面「Basic Beauty 確認」→ `probeBasicBeauty()` |
| **想定機能** | 肌補正 · 明るさ · 基本美顔（SDK が expose する範囲） |
| **AI Effects** | **今回導入しない** — 別ライセンス · コスト · 将来 Beauty Engine 置換と競合 |

**PoC 時点の想定:** Express SDK 単体では Beauty API が未検出の場合あり → **UIKit または AI Effects モジュール + ライセンス要確認**（実機で再検証）。

---

## 6. AI Effects を今は使わない理由

1. Phase 1 は **配信成立 + Provider 境界** が目的
2. AI Effects は **追加ライセンス / 課金** が発生
3. [TLV-LIVE-FUTURE-02](./TODO.md) — 将来 **独自 Beauty Engine** へ置換可能にするため、早期に AI Effects 深依存しない
4. 差別化は Phase 2 以降 · Decision 候補（軽量映像補正）

---

## 7. OBS 対応メモ（調査 · 実装は Phase 2）

ZEGO では **RTMP ストリームを ZEGO ルームへ取り込む**ことで OBS 配信が可能（製品ドキュメント上）。

| 項目 | 内容 |
| --- | --- |
| **方式** | OBS → RTMP push → ZEGO 側 ingest / CDN relay |
| **必要条件（想定）** | ZEGO プロジェクトで **Live / CDN / RTMP** 機能有効 · streamId / roomId 整合 · Token に publish 権限 |
| **OBS 設定** | サーバー URL / ストリームキーは ZEGO Console またはサーバー API で発行 |
| **Phase 1** | **実装しない** — 本節の整理のみ · Phase 2 で `startLive({ mode: 'obs' })` 等を Interface 拡張 |
| **代替** | ホスト PC カメラキャプチャ（Web SDK）が PoC デフォルト |

**参照:** [ZEGO Live Streaming / CDN ドキュメント](https://www.zegocloud.com/docs) · TODO **TLV-LIVE-FUTURE-01**

---

## 8. 将来の Provider 候補

| Provider | 用途 |
| --- | --- |
| **ZEGO** | Phase 1 PoC / 初期 MVP |
| **Agora** | 代替 SDK · コスト比較 |
| **LiveKit** | オープン SFU · 自社ホスト移行の中間 |
| **Cloudflare Calls** | CF エコシステム統合 |
| **Custom RTC** | 独自 WebRTC + SFU + Media Server |

---

## 9. 独自 RTC への長期置換方針

[TODO.md §TLV Live Provider — Future Backlog](./TODO.md):

- **TLV-LIVE-FUTURE-01** Interface 完成 → Adapter 本番
- **TLV-LIVE-FUTURE-03** WebRTC / SFU / Media Server 研究
- **TLV-LIVE-FUTURE-04** 売上 · コスト · 品質 KPI 達成後にカナリア移行

SDK 永続依存は前提としない。

---

## 10. Phase 1 PoC 完了条件

| # | 条件 |
| --- | --- |
| 1 | Provider Interface + ZEGO Provider + Live Service 実装 |
| 2 | PoC 画面 `live/live-zego-poc.html` が 8788 で HTTP 200 |
| 3 | secret は `.env` / Token API のみ（コード直書きなし） |
| 4 | 既存 Live 本番ページ非変更 |
| 5 | `npm run verify:live-zego-poc` static PASS |
| 6 | 実機検証（要 ZEGO 資格情報）: initialize · 配信 · 視聴 · device 操作 |

---

## 11. 残課題

| 項目 | 状態 |
| --- | --- |
| ZEGO 資格情報を用いた E2E 実機 PASS | **要 `.env` + Console 設定** |
| Token04 バイナリ形式の実機検証 | API 実装済 · 失敗時は manual token フォールバック |
| Basic Beauty 実機 | API 検出 or UIKit 要確認 |
| OBS RTMP ingest | ドキュメント整理のみ · 未実装 |
| `live/` 本番 UI との統合 | Phase 2（TLV-P0-02/05 以降） |
| Wallet / 投げ銭 / 30分制御 | **Phase 3+ Business 層 · Phase 2 でも触らない** |

---

## 12. ファイル一覧

| パス | 役割 |
| --- | --- |
| `live/providers/live-provider-interface.js` | 抽象境界 |
| `live/providers/zego-live-provider.js` | ZEGO Adapter |
| `live/live-service.js` | Service 層 |
| `live/live-zego-poc.html` | PoC 画面 |
| `live/live-zego-config.example.js` | 公開設定テンプレート |
| `deploy/cloudflare/functions/api/tlv-zego-token.js` | Token API |

**PoC URL（ローカル）:** `http://127.0.0.1:8788/live/live-zego-poc.html`

---

## 13. Phase 1.5 — 実機 E2E

**レポート:** [reports/tlv-live-zego-poc-e2e.md](../reports/tlv-live-zego-poc-e2e.md)

```bash
# .env に ZEGO_APP_ID / ZEGO_SERVER / ZEGO_SERVER_SECRET
npm run dev
npm run verify:live-zego-poc-e2e
```

| 生成物 | 説明 |
| --- | --- |
| `dist/live/live-zego-config.js` | `.env` から自動生成（dev 起動時 · E2E 時） |
| `reports/tlv-live-zego-poc-e2e.json` | 自動検証結果 |

**現状（2026-06-28）:** Phase 1.5 **実装クローズ**（コード · E2E パイプライン完了）· E2E 最終 **GO/NO-GO は `.env` 設定後** · Phase 2 は **未着手**

---

## 14. Phase 1 / 1.5 クローズ · Phase 2 予定

### Phase 1 — PoC（**完了**）

Provider Interface · ZEGO Provider · Live Service · `live-zego-poc.html` · Token API · `verify:live-zego-poc`

### Phase 1.5 — 実機 E2E（**実装クローズ · E2E GO 待ち**）

| 項目 | 状態 |
| --- | --- |
| コード · E2E パイプライン | **完了** |
| Blocker | **ZEGO Console 資格情報 → `.env` のみ**（コード修正不要） |
| 最終 GO | `.env` 設定後 `npm run verify:live-zego-poc-e2e` **全 PASS** |

**PASS 条件:** Token API · Host/Viewer 2 context · Camera/Mic/Switch · Leave/End · Console Error なし · [tlv-live-zego-poc-e2e.json](../reports/tlv-live-zego-poc-e2e.json) PASS

**Payment 分離:** Phase 1 · 1.5 とも Wallet / Coin / Stripe / 投げ銭 / 30分制御 **未変更**

### Phase 2 — live-broadcasts 統合（**未着手 · Session Manager 設計済**）

Phase 1.5 E2E **GO** 後に着手。Phase 2 開始まで **既存 Live UI / Payment に変更しない**。

| スコープ | 内容 |
| --- | --- |
| **やる** | **Live Session Manager** 実装 · `live-broadcasts.js` lifecycle ← Live Service · Provider Interface 維持 · 段階的 ZEGO 置換 |
| **やらない** | Payment / Wallet / Coin / 30分制御 / 延長課金 · Business Logic 実装 · 既存本番ページの破壊的変更 |

**Session Manager 設計:** 下記 [§15 Phase 2 事前設計 — Live Session Manager](#15-phase-2-事前設計--live-session-manager)

**正本:** [TLV_LIVE_PROVIDER.md](./TLV_LIVE_PROVIDER.md) · [TODO.md](./TODO.md) §TLV Live SDK Phase 2

---

## 15. Phase 2 事前設計 — Live Session Manager

**種別:** 設計のみ · **実装禁止**（Phase 1.5 E2E GO 前後を問わず、本節公開時点ではコード変更なし）  
**目的:** Provider と将来の Business Logic の間に、**SDK 非依存**のライブセッション状態層を置く。

### 15.1 位置づけ

Session Manager は **RTC/Provider の詳細を知らない** 純粋なセッション状態機械 + イベントバス。

| 層 | 知っていること | 知らないこと |
| --- | --- | --- |
| **UI** | 表示 · ユーザー操作 | SDK · Wallet |
| **Live Service** | Service API · Token 取得窓口 | Provider 内部 · Business ルール |
| **Session Manager** | セッション状態 · 役割 · 接続フェーズ · Event 発火 | ZEGO/Agora API · coin 残高 · 30分ルール |
| **Provider Interface** | `startLive` / `joinLive` 等の契約 | Payment · Score |
| **ZEGO Provider** | SDK · stream · device | Wallet · Membership |

### 15.2 Session Manager の責務（限定）

**SDK 依存禁止。** 以下 **のみ** を担当する。

| 責務 | 説明 |
| --- | --- |
| **Live 開始状態** | ホストが publish 可能なセッションが確立したか |
| **Live 終了状態** | 正常/異常を問わずセッションがクローズしたか |
| **Room 状態** | `roomId` 単位の lifecycle（created → active → ended） |
| **Host 判定** | 現在クライアントが host 役か |
| **Viewer 判定** | 現在クライアントが viewer 役か |
| **接続状態** | Provider 経由のメディア/room 接続が確立しているか |
| **再接続状態** | 一時切断 · 復旧試行中か |
| **Join 中** | `joinLive` 処理中（二重 join 防止） |
| **Leaving 中** | `leaveLive` / `endLive` 処理中 |
| **Error 状態** | 回復可能/不可のエラーを保持 |
| **Session Event 発火** | 下記 §15.4 イベントを購読者へ通知 |

**Session Manager が持たないもの（Phase 2 でも禁止）:**

- Wallet / Coin / Stripe 呼出
- 投げ銭 · 延長課金 · 30分タイマー
- Membership · Creator Score · Ranking
- Moderation 実行（BAN/NG ワード処理）
- AI Clip / Subtitle / Translation

→ これらは **将来** Business 側が **Event のみ** 監視して接続する（§15.5）。

### 15.3 セッション状態モデル（案）

```text
                    ┌─────────────┐
                    │   idle      │
                    └──────┬──────┘
                           │ create / prepare
                           ▼
                    ┌─────────────┐
         ┌─────────│ live_created │─────────┐
         │         └──────┬──────┘         │
         │ join (viewer)  │ start (host)   │
         ▼                ▼                │
  ┌─────────────┐  ┌─────────────┐        │
  │  joining    │  │  starting   │        │
  └──────┬──────┘  └──────┬──────┘        │
         │                │                │
         ▼                ▼                │
  ┌─────────────┐  ┌─────────────┐        │
  │   joined    │  │   hosting   │◄───────┘ reconnect
  │  (viewer)   │  │   (host)    │
  └──────┬──────┘  └──────┬──────┘
         │                │
         │    reconnecting (both)
         │                │
         ▼                ▼
  ┌─────────────┐  ┌─────────────┐
  │  leaving    │  │  ending     │
  └──────┬──────┘  └──────┬──────┘
         │                │
         └────────┬───────┘
                  ▼
           ┌─────────────┐
           │ live_ended  │ → idle
           └─────────────┘

  error ──► error (terminal or recoverable → reconnecting)
```

**Room 状態（論理 · DB 未接続）:**

| Room 状態 | 意味 |
| --- | --- |
| `created` | roomId 確定 · 未配信 |
| `active` | 1 名以上 host/viewer 接続 |
| `ended` | 配信終了 · 新規 join 不可 |

### 15.4 Session Event 一覧

Business 側（将来）は **このイベントのみ** 購読する。Provider から直接イベントを受け取らない。

| Event | 発火タイミング | payload 例（SDK 非依存） |
| --- | --- | --- |
| `LIVE_CREATED` | room / session レコード論理作成 | `{ roomId, hostUserId?, createdAt }` |
| `LIVE_STARTED` | ホスト publish 開始成功 | `{ roomId, hostUserId, streamId?, startedAt }` |
| `LIVE_JOINED` | 視聴者 join 成功 | `{ roomId, viewerUserId, joinedAt }` |
| `LIVE_LEFT` | 参加者が room から退出 | `{ roomId, userId, role, reason? }` |
| `LIVE_ENDED` | ホストが配信終了 or room close | `{ roomId, endedAt, reason: 'host' \| 'error' \| 'ops' }` |
| `HOST_CONNECTED` | ホスト側メディア/room 接続確立 | `{ roomId, userId }` |
| `VIEWER_CONNECTED` | 視聴者側接続確立 | `{ roomId, userId }` |
| `RECONNECTING` | 接続断 · 復旧試行開始 | `{ roomId, userId, attempt }` |
| `RECONNECTED` | 復旧成功 | `{ roomId, userId }` |
| `ERROR` | 回復不能 or 要 UI 通知 | `{ roomId, code, message, recoverable }` |

**命名規則:** `SCREAMING_SNAKE` · string 定数 · payload は **プレーン JSON**（ZEGO 型禁止）。

**購読 API（Phase 2 実装時の想定 · 今回未実装）:**

```text
sessionManager.on('LIVE_STARTED', handler)
sessionManager.off('LIVE_STARTED', handler)
```

### 15.5 将来接続予定（設計メモのみ · 実装禁止）

以下は Session Manager **の外側**（Business / Domain 層）で Event を監視して接続する。**Phase 2 ではコメント・設計のみ。**

| 将来モジュール | 想定トリガー Event | 接続方針 |
| --- | --- | --- |
| **Wallet** | `LIVE_ENDED` 等 | セッション終了後 ledger 確定 · Manager 内に Wallet API 禁止 |
| **Coin** | tip 系は別 Engine | coin 残高は Payment Engine 正本 · Event bus 経由のみ |
| **投げ銭** | `LIVE_STARTED` + tip UI | `tlv-create-tip` · Session Manager 非経由 |
| **30分タイマー** | `LIVE_STARTED` | タイマー開始 · `LIVE_ENDED` で停止 · Manager は時刻を持たない |
| **延長課金** | 30分境界 Event（将来定義） | Gauge/Extension は PRD 層 · Manager は `LIVE_*` のみ |
| **Membership** | `LIVE_JOINED` | 特典 gate · TODO-MEM 系 Future |
| **Creator Score** | `LIVE_ENDED` | 集計は batch/Edge · リアルタイム Score 禁止 |
| **Ranking** | `LIVE_ENDED` | 同上 |
| **Moderation** | `LIVE_STARTED` / chat Event | BAN/mute は別 Moderation サービス |
| **AI Clip** | `LIVE_ENDED` | Future · AD-004 経由 TASFUL AI |
| **AI Subtitle** | `LIVE_STARTED` | Future |
| **AI Translation** | chat 連携 Future | Future |

```text
┌──────────────────────────────────────────────┐
│  Business / Domain（将来 · Phase 3+ 想定）      │
│  Wallet · Tip · 30min · Score · Moderation   │
│         ↑ on(Event) のみ · 双方向呼出禁止       │
└──────────────────┬───────────────────────────┘
                   │ Session Events
┌──────────────────▼───────────────────────────┐
│  Live Session Manager（Phase 2 実装予定）       │
└──────────────────┬───────────────────────────┘
                   │ Interface calls
┌──────────────────▼───────────────────────────┐
│  Live Provider Interface → ZEGO Provider      │
└──────────────────────────────────────────────┘
```

### 15.6 Provider との責務分離

| 操作 | Session Manager | Provider |
| --- | --- | --- |
| `startLive()` 要求受付 | ✓ 状態遷移 · joining/starting ガード | ✓ SDK publish |
| `joinLive()` 要求受付 | ✓ 二重 join 防止 | ✓ SDK play |
| 接続断検知 | ✓ `RECONNECTING` 発火 | ✓ SDK callback → Manager へ **抽象 signal** のみ |
| カメラ ON/OFF | ✗ UI/Service 直通可（Phase 2 要検討） | ✓ device API |
| Token 取得 | ✗ Live Service | ✗ |
| streamId / ZEGO room | ✗ 内部識別子のみ Provider | ✓ |
| Event → Business | ✓ 発火のみ | ✗ |

**原則:** Provider → Session Manager への戻りは **`{ type: 'connected' \| 'disconnected' \| 'error', ... }` の抽象 signal** に限定。ZEGO event 名を上位に漏らさない。

### 15.7 Phase 2 実装時チェックリスト（将来 · 今回触らない）

| # | 項目 |
| --- | --- |
| 1 | `live-session-manager.js`（仮）を Service と Provider の間に挿入 |
| 2 | 既存 PoC UI は Session Manager 経由に切替（本番 `live-broadcasts.js` は段階的） |
| 3 | Event 定数ファイル · TypeScript/JSDoc typedef のみ先行可 |
| 4 | Wallet/Tip/30分 **import 禁止** lint or レビュー gate |
| 5 | `npm run verify:live-zego-poc-e2e` 回帰 PASS |
| 6 | 既存 FROZEN Live ページは feature flag または PoC ルートのみ変更 |

### 15.8 今回のスコープ（再確認）

| 項目 | 実施 |
| --- | --- |
| Session Manager 設計 | ✓ 本節 |
| コード変更 | **禁止** |
| 既存 Live ページ変更 | **禁止** |
| Payment / Wallet 結合 | **禁止** |
| Phase 2 実装 | **Phase 1.5 E2E GO 後**

---

## 16. 待機フェーズ（ZEGO 資格情報待ち · 2026-06-28）

**監査:** [reports/tlv-live-waiting-phase-audit.md](../reports/tlv-live-waiting-phase-audit.md)

| 項目 | 状態 |
| --- | --- |
| Phase 1 · 1.5 コード · E2E パイプライン · Session Manager 設計 | **完了** |
| Blocker | **ZEGO Console → `.env` のみ**（コード問題なし） |
| 新規実装 | **禁止**（資格情報設定まで） |
| 既存 Live / Payment | **変更禁止** |

**再開条件:**

```bash
npm run dev
npm run verify:live-zego-poc-e2e   # 全 PASS → Phase 1.5 GO → Phase 2 着手可
```

---

## 17. Interface Review — 改善 TODO（実装禁止）

Phase 2 着手時の参照。**コード変更は Phase 2 開始後。**

| ID | 項目 | 関連 Phase |
| --- | --- | --- |
| IF-TODO-01 | Provider 契約テスト / `LiveProviderInterface` 継承明示 | Phase2-01 |
| IF-TODO-02 | 抽象 connection signal を Interface に追加 | Phase2-04 |
| IF-TODO-03 | `TLV_LIVE_ZEGO_CONFIG` → `TLV_LIVE_PROVIDER_CONFIG` | Phase2-02 |
| IF-TODO-04 | OBS/RTMP `startLive({ mode })` オプション設計 | Phase2-07 評価 **Done** · 実装 Phase2-08+ |
| IF-TODO-05 | Beauty をサブインターフェースへ分離 | Phase2-07 評価 **Done** · 実装 Phase2-08+ |
| IF-TODO-06 | Live Service → Session Manager 配線 | **Done（Phase2-02）** |
| IF-TODO-07 | Agora/LiveKit noop stub Provider | Later |

---

## 18. Security Review — 改善 TODO（実装禁止）

PoC / ローカル待機: **secret 露出 PASS**。本番前に以下を Phase 2 で対応。

| ID | 項目 | 優先 |
| --- | --- | --- |
| SEC-TODO-01 | Token API 認証（JWT / session） | 本番前必須 |
| SEC-TODO-02 | Token API rate limit | 本番前必須 |
| SEC-TODO-03 | PoC manual token 本番 UI から除外 | Phase2-03 |
| SEC-TODO-04 | Token API CORS 本番ポリシー | deploy 時 |
| SEC-TODO-05 | roomId/userId 入力検証強化 | Phase2-06 **Done** |
| SEC-TODO-06 | Token TTL 本番ポリシー文書化 | Phase 2 |
| SEC-TODO-07 | ZEGO SDK CDN pin / SRI | Phase2-06 |

---

## 19. Phase 2 実装計画（細分化）

**前提:** Phase 1.5 E2E **GO** · **Payment / Wallet / 30分 / 投げ銭は Phase 2 全体で触らない**

| ID | 名称 | 内容 | 状態 |
| --- | --- | --- | --- |
| **Phase2-01** | Session Manager Skeleton | 状態機械 · Event bus | **Done** |
| **Phase2-02** | Live Service 配線 | Service ↔ Session Manager · PoC 反映 · Event API | **Done** |
| **Phase2-03** | live-broadcasts 接続準備 | feature flag OFF 既定 · bridge · Session 同期 | **Done（準備）** |
| **Phase2-04** | Session Debug UI | Debug Panel · flag OFF 既定 · dev 確認用 | **Done** |
| **Phase2-05** | Reconnect / Error | Provider 抽象 signal · recoverable ERROR | **Done** |
| **Phase2-06** | Error 強化 | 入力検証 · 本番ポリシー | **Done** |
| **Phase2-07** | UIKit 評価 | Basic Beauty · ライセンス · OBS 設計 | **Done** |
| **Phase2-08** | UIKit 実機 PoC | Prebuilt mount · Provider adapter | **SKIP**（資格情報未設定） |

**正本 TODO:** [TODO.md](./TODO.md) §TLV Live SDK

---

## 20. Phase2-01 — Session Manager Skeleton（実装済 · 未接続）

**検証:** `npm run test:live-session-manager` → **31/31 PASS**  
**Blocker 維持:** Phase 1.5 E2E GO（ZEGO `.env`）は未達 · **live-broadcasts / 本番 Live UI 接続は Phase2-03 以降**

### 20.1 追加ファイル

| ファイル | 責務 |
| --- | --- |
| `live/session/live-session-states.js` | 状態定数 |
| `live/session/live-session-events.js` | Event 定数 |
| `live/session/live-session-event-bus.js` | `emit` / `on` / `off` / `once` |
| `live/session/live-session-manager.js` | SessionManager Skeleton · Future TODO コメントのみ |

**ロード順（将来 HTML 用）:** states → events → event-bus → manager

### 20.2 Session State 一覧

| State | 意味 |
| --- | --- |
| `IDLE` | 未作成 · dispose 後 |
| `INITIALIZING` | createSession 処理中（瞬間） |
| `READY` | session 作成済 · start/join 待ち |
| `STARTING` | ホスト publish 開始中（Skeleton 瞬間遷移） |
| `LIVE` | ホスト配信中 |
| `JOINING` | 視聴者 join 中（Skeleton 瞬間遷移） |
| `CONNECTED` | 視聴者接続済 |
| `LEAVING` | 退出処理中 |
| `ENDED` | 配信終了 |
| `RECONNECTING` | 復旧試行中 |
| `ERROR` | エラー（Phase2-05 で Provider signal 接続） |

### 20.3 Event 一覧

| Event | 発火タイミング |
| --- | --- |
| `LIVE_CREATED` | createSession 完了 |
| `LIVE_STARTED` | start 完了（host） |
| `LIVE_JOINED` | join 完了（viewer） |
| `LIVE_LEFT` | leave / end 途中 |
| `LIVE_ENDED` | end 完了（host） |
| `HOST_CONNECTED` | start 完了時 |
| `VIEWER_CONNECTED` | join 完了時 |
| `RECONNECTING` | reconnect 開始 |
| `RECONNECTED` | reconnect 成功 |
| `ERROR` | エラー（Phase2-05） |
| `STATE_CHANGED` | 全状態遷移 `{ from, to, roomId? }` |

### 20.4 State 遷移図（Phase2-01 Skeleton）

```text
                         createSession()
    IDLE ─────────────────────────────────► INITIALIZING ──► READY
      ▲                                                        │
      │ destroySession / dispose                               │
      │                                                        ├── start() ──► STARTING ──► LIVE
      │                                                        │                              │
      │                                                        ├── join() ───► JOINING ──► CONNECTED
      │                                                        │                              │
      │                                                        │         reconnect() ◄────────┤
      │                                                        │              │               │
      │                                                        │              ▼               │
      │                                                        │         RECONNECTING         │
      │                                                        │              │               │
      │                                                        │              ▼               │
      │                                                        │         RECONNECTED ──────────┘
      │                                                        │              │
      │                                                        │    leave()   │   end() [host]
      │                                                        │              ▼
      │                                                        │         LEAVING
      │                                                        │         /      \
      │                                                        │   READY      ENDED ── reset() ──► READY
      │                                                        │
      └────────────────────────────────────────────────────────┘

  ERROR ◄── Phase2-05 Provider 抽象 signal（Skeleton では未接続）
```

### 20.5 SessionManager API（Skeleton）

| メソッド | 説明 |
| --- | --- |
| `createSession({ roomId?, sessionId?, role? })` | IDLE → READY · `LIVE_CREATED` |
| `destroySession()` | session 破棄 → IDLE |
| `start()` | host · READY → LIVE |
| `join()` | viewer · READY → CONNECTED |
| `leave()` | LIVE/CONNECTED → LEAVING → ENDED(host) or READY(viewer) |
| `end()` | host · LIVE → ENDED · `LIVE_ENDED` |
| `reconnect()` | LIVE/CONNECTED/ERROR → RECONNECTING → RECONNECTED → 復帰 |
| `reset()` | ENDED/ERROR → READY |
| `dispose()` | リスナー全解除 → IDLE |
| `on` / `off` / `once` | Event Bus 委譲 |

### 20.6 Future Hook 一覧（TODO コメントのみ · 実装禁止）

`live-session-manager.js` ヘッダに記載。Business 層は将来 **Event 監視のみ**。

| 将来モジュール | 想定 Event |
| --- | --- |
| Wallet | `LIVE_ENDED` |
| Coin | Payment Engine 正本 · 非経由 |
| Tip | `LIVE_STARTED` + tip UI |
| Membership | `LIVE_JOINED` |
| Ranking | `LIVE_ENDED` |
| Creator Score | `LIVE_ENDED` |
| Moderation | `LIVE_STARTED` |
| AI Clip | `LIVE_ENDED` |
| AI Subtitle | `LIVE_STARTED` |
| AI Translation | chat 連携 Future |

### 20.7 未接続（Phase2-01 時点 · Phase2-02 で Service 配線済）

| 対象 | Phase |
| --- | --- |
| `live-service.js` 配線 | **Done（Phase2-02）** |
| PoC Session 表示 | **Done（Phase2-02）** |
| `live-broadcasts.js` | **Done（準備 · flag OFF）** |
| 本番 Live UI Event | **Done（Debug Panel · dev）** |
| Provider 抽象 signal | Phase2-05 |
| ZEGO SDK | **変更なし** |
| Payment / Wallet / 30分 / 投げ銭 | **禁止** |

---

## 21. Phase2-02 — Live Service ↔ Session Manager 配線（実装済）

**検証:**

- `npm run test:live-session-manager` → **31/31 PASS**
- `npm run test:live-service-session` → **25/25 PASS**
- `npm run verify:live-zego-poc` → **26/26 PASS**

**スコープ:** PoC + Live Service のみ · **`live-broadcasts.js` / 既存 Live ページは未変更**

### 21.1 アーキテクチャ（現行）

```text
PoC UI (live-zego-poc.js)
  ↓ onSessionEvent / getSessionState（UI は Manager 非直接）
Live Service (live-service.js)
  ↓ createSession / start / join / leave / end / dispose
Session Manager (live/session/*)
  ↓ （Provider 呼出は Service が従来通り担当）
Provider Interface → ZEGO Provider → SDK
```

### 21.2 Live Service 追加 API

| API | 説明 |
| --- | --- |
| `getSessionState()` | Session Manager 状態（`IDLE` … `ERROR`） |
| `getSessionSnapshot()` | `{ state, session, providerState, lastEvent }` |
| `onSessionEvent(event, handler)` | Session Event 購読（UI/Business は Service 経由） |
| `offSessionEvent(event, handler)` | 購読解除 |

**既存 API との同期（Provider 成功後に Session 遷移）:**

| Service メソッド | Session 遷移 |
| --- | --- |
| `initialize()` | → `READY`（`LIVE_CREATED`） |
| `startLive()` | → `LIVE`（`LIVE_STARTED` · `HOST_CONNECTED`） |
| `joinLive()` | → `CONNECTED`（`LIVE_JOINED` · `VIEWER_CONNECTED`） |
| `leaveLive()` | viewer → `READY` / host → `ENDED` |
| `endLive()` | → `ENDED`（`LIVE_ENDED`） |
| `dispose()` | → `IDLE` |

**Provider 失敗時:** Session 状態は進めない（ガード）。

### 21.3 PoC 変更

| 項目 | 内容 |
| --- | --- |
| HTML | `live/session/*` 4 ファイルを Service より前に load |
| UI | Session State / Last Event パネル追加 |
| 直接 Manager 参照 | **禁止**（Service API のみ） |

### 21.4 未着手（Phase2-03 以降）

| 対象 | Phase |
| --- | --- |
| `live-broadcasts.js` lifecycle | **Done（準備 · flag OFF）** |
| 本番 Live UI Event | **Done（Debug Panel · dev）** |
| Reconnect Provider signal | Phase2-05 |

---

## 22. Phase2-03 — live-broadcasts lifecycle 接続準備（実装済 · flag OFF 既定）

**検証:** `npm run test:live-broadcasts-session-bridge` → **16/16 PASS**  
**回帰:** `verify:live-p5` studio/watch **console 0 errors**（index@390/768 smoke は既知レイアウト）

### 22.1 Feature Flag

| 項目 | 値 |
| --- | --- |
| 正本 | `live/tlv-feature-flags.js` → `liveSessionManagerEnabled` |
| **既定** | **`false`（OFF）** |
| グローバル getter | `TLV_LIVE_SESSION_MANAGER_ENABLED` |
| deploy 生成 | `stage-cloudflare-pages.mjs` も `false` 固定 |

**OFF 時:** `runSessionBridge` は即 return · DB lifecycle · UI · stub プレイヤーは **従来通り**。

**ON 時:** Session Manager **状態同期のみ** · Live Service / ZEGO Provider **未ロード** · 本番 RTC **未接続**。

### 22.2 追加ファイル

| ファイル | 責務 |
| --- | --- |
| `live/live-broadcasts-session-bridge.js` | studio start/end · watch join/leave → Session Manager |

### 22.3 live-broadcasts.js フック（最小）

| タイミング | bridge メソッド |
| --- | --- |
| スタジオ「配信開始」成功後 | `onStudioStart({ broadcastId, creatorId })` |
| スタジオ「終了」成功後 | `onStudioEnd({ broadcastId, creatorId })` |
| 視聴ページ mount 後（status=live） | `onWatchJoin({ broadcastId, viewerId, status })` |

`runSessionBridge()` — `isEnabled()` が false なら **no-op**（既存コードパス不変）。

### 22.4 スクリプト load（studio / watch / watch-live）

`tlv-feature-flags.js` → `session/*` → `live-broadcasts-session-bridge.js` → `live-broadcasts.js`

flag OFF でも script load は行うが **Session Manager はインスタンス化しない**。

### 22.5 禁止事項（維持）

Payment / Wallet / Coin / Stripe / 投げ銭 / 30分 · ZEGO SDK 本番接続 · Live Service 配線（broadcasts 側）

### 22.6 次フェーズ

| ID | 内容 |
| --- | --- |
| **Phase2-04** | Session Event → 本番 UI 表示（Debug Panel · **Done**） |
| **将来** | flag ON + Live Service + Provider（Phase 1.5 E2E GO 後） |

---

## 23. Phase2-04 — Session Event UI 表示（実装済 · flag OFF 既定）

**検証:** `npm run test:live-session-debug-panel` → **14/14 PASS**

### 23.1 概要

| 項目 | 内容 |
| --- | --- |
| 目的 | Phase2-03 shadow Session 状態を **開発確認用** に表示 |
| 正本 flag | `TLV_FEATURE_FLAGS.liveSessionManagerEnabled`（**既定 `false`**） |
| OFF 時 | **DOM 追加なし** · 既存 UI と完全一致 |
| ON 時 | 右下固定 **Session Debug Panel**（dev · 本番ユーザー向けではない） |
| 非接触 | ZEGO SDK · Provider · Live Service · Payment 系 |

### 23.2 追加ファイル

| ファイル | 責務 |
| --- | --- |
| `live/live-session-debug-panel.js` | `mount` / `refresh` / `unmount` · flag ガード |
| `live/live.css` | `.live-session-debug*` スタイル |

### 23.3 Bridge 拡張

| API | 説明 |
| --- | --- |
| `onSessionEvent` / `offSessionEvent` | Session Event 購読 |
| `getSnapshot().lastEvent` | 直近 Event |
| `getSnapshot().recentEvents` | 直近 8 件 |

### 23.4 Debug Panel 表示項目

State · Room · Role · Last Event · Recent Events（最大 8 件）

### 23.5 配線

| ページ | タイミング |
| --- | --- |
| `studio.html` | `mountStudioPage` 完了後 |
| `watch.html` / `watch-live.html` | `mountWatchPage` 完了後 |
| lifecycle 操作後 | `runSessionBridge` → `refresh()` |

### 23.6 flag ON のローカル確認

`live/tlv-feature-flags.js` で `liveSessionManagerEnabled: true` に変更（**コミットしない**）→ studio / watch を再読込。

### 23.7 次フェーズ

**Phase2-05:** Reconnect · Provider 抽象 signal — **Done**（§24）  
**Phase2-06:** Error Policy / Input Validation — **Done**（§25）

---

## 24. Phase2-05 — Reconnect / Error Handling（実装済）

**検証:** `npm run test:live-session-provider-signals` → **14/14 PASS**  
**レポート:** [tlv-live-phase2-05-reconnect-error.md](../reports/tlv-live-phase2-05-reconnect-error.md)

### 24.1 Provider 抽象 signal

**正本:** `live/session/live-provider-signals.js`

`PROVIDER_CONNECTING` · `PROVIDER_CONNECTED` · `PROVIDER_DISCONNECTED` · `PROVIDER_RECONNECTING` · `PROVIDER_RECONNECTED` · `PROVIDER_CONNECTION_LOST` · `PROVIDER_ERROR`

→ Session Manager `handleProviderSignal()` が受信 · **ZEGO 型は漏らさない**

### 24.2 Session Manager 拡張

| API | 説明 |
| --- | --- |
| `handleProviderSignal(signal, payload)` | 抽象 signal → 状態遷移 |
| `reportError({ message, code, recoverable })` | ERROR |
| `recoverFromError()` | recoverable ERROR → reconnect |
| `getStatus()` | reconnectAttempt · lastError · lastProviderSignal |

### 24.3 Reconnect / Error 遷移

| 入力 | 遷移 |
| --- | --- |
| `PROVIDER_CONNECTION_LOST` / `DISCONNECTED` | → `RECONNECTING` |
| `PROVIDER_RECONNECTED` / `reconnect()` / `recoverFromError()` | → `RECONNECTED` → 復帰 |
| `PROVIDER_ERROR`（recoverable） | → `ERROR` → recover 可 |
| `PROVIDER_ERROR`（非 recoverable） | → `ERROR` → `reset()` のみ |

### 24.4 Bridge 拡張

`handleProviderSignal` · `reportSessionError` · `recoverSessionFromError` · `getSnapshot().status`

**flag OFF:** すべて skipped · 既存 Live 挙動不変

### 24.5 Debug Panel 拡張

Reconnect # · Error / Signal 行 · `RECONNECTING` / `ERROR` event で refresh

### 24.6 次フェーズ

**Phase2-06:** Error 強化（入力検証） — **Done**（§25） · **Phase2-07:** UIKit / Beauty / OBS 評価 — **Done**（§26）

---

## 25. Phase2-06 — Error Policy / Input Validation（実装済）

**検証:** `npm run test:live-session-error-policy`  
**レポート:** [tlv-live-phase2-06-error-policy.md](../reports/tlv-live-phase2-06-error-policy.md)

### 25.1 Error 分類

**正本:** `live/session/live-session-error-codes.js`

`VALIDATION_ERROR` · `PROVIDER_ERROR` · `CONNECTION_ERROR` · `SESSION_STATE_ERROR` · `PERMISSION_ERROR` · `UNKNOWN_ERROR`

### 25.2 入力検証

**正本:** `live/session/live-session-validation.js`

| 対象 | ルール |
| --- | --- |
| roomId / userId / sessionId | `[a-zA-Z0-9._-]+` · max 128 |
| role | `host` \| `viewer` \| null |
| eventName | `LIVE_SESSION_EVENTS` 登録値のみ |
| providerSignal | `LIVE_PROVIDER_SIGNALS` 登録値のみ |
| error payload | message 必須 · max 512 · code 正規化 |

**throw 禁止** — `{ ok, value }` または `{ ok: false, code, message, field }`

### 25.3 Session Manager

| 処理 | 不正時 |
| --- | --- |
| `_validationFail()` | `ERROR` event · アクティブ session 時 `ERROR` 状態 |
| `_stateFail()` | `SESSION_STATE_ERROR` 返却 · **状態遷移なし**（guard 互換） |
| `end()` 非 host | `PERMISSION_ERROR` |

### 25.4 Bridge / Debug Panel

- Bridge: `_validateBroadcastPayload()` · `code` 付き error 返却
- Debug Panel: Error Code 行 · ERROR event に code 表示

**flag OFF:** すべて skipped · 既存 Live 挙動不変

### 25.5 次フェーズ

**Phase2-07:** UIKit / Beauty / OBS 評価 — **Done**（§26）

---

## 26. Phase2-07 — UIKit / Basic Beauty / OBS 評価（実施済）

**検証:** `npm run verify:live-zego-uikit-eval`  
**レポート:** [tlv-live-phase2-07-uikit-beauty-obs-evaluation.md](../reports/tlv-live-phase2-07-uikit-beauty-obs-evaluation.md)  
**PoC:** `live/live-zego-uikit-eval.html`（本番非接続 · UIKit SDK mount なし）

### 26.1 UIKit 判定サマリー

| 項目 | 判定 |
| --- | --- |
| Host / Audience 画面 | **GO** |
| チャット · 視聴者一覧 · デバイス操作 | **GO** |
| ギフト UI | **CONDITIONAL**（カスタム実装） |
| TLV 独自 UI 共存 | **CONDITIONAL**（フル UIKit vs Express 自前 UI） |

### 26.2 Basic Beauty 判定サマリー

| 項目 | 判定 |
| --- | --- |
| Express CDN 一括（現 PoC） | **NO-GO** |
| Express ESM `BeautyEffect` | **CONDITIONAL** |
| UIKit 経由 | **UNCONFIRMED** |
| AI Effects | **NO-GO**（スコープ外） |

### 26.3 OBS / RTMP 判定サマリー

| 項目 | 判定 |
| --- | --- |
| RTMP / WHIP ingest | **GO**（ZEGO 公式） |
| TLV Provider 統合 | **CONDITIONAL**（IF-TODO-04 · サーバー调度 API） |

### 26.4 Provider 抽象化

- UIKit: 別 adapter / mode · Provider 内 Prebuilt mount
- Beauty: IF-TODO-05 サブ IF + ESM lazy load
- OBS: `startLive({ mode: 'obs' })` 拡張案
- Session Manager: Phase2-01〜06 完了 · signal 抽象化済

### 26.5 実機 E2E

**SKIP** — Phase2-08 ゲート未充足（§27）。

### 26.6 次フェーズ

**Phase2-08:** UIKit / Beauty 実機 PoC — **SKIP**（§27）

---

## 27. Phase2-08 — UIKit / Beauty 実機 PoC（SKIP）

**ステータス:** **SKIP** — ZEGO 資格情報未設定（`ZEGO_APP_ID` / `ZEGO_SERVER` / `ZEGO_SERVER_SECRET`）  
**検証:** `npm run verify:live-zego-uikit-beauty-poc` → SKIP（exit 0）  
**レポート:** [tlv-live-phase2-08-uikit-beauty-poc.md](../reports/tlv-live-phase2-08-uikit-beauty-poc.md)

### 27.1 実施条件

`.env` に ZEGO 3 変数が **すべて** 設定済みであること。未設定時は **PoC 実装しない**。

### 27.2 未実施項目（資格情報 GO 後）

| 項目 | 予定 |
| --- | --- |
| UIKit Prebuilt mount | `live-zego-uikit-beauty-poc.html` · Provider 内 |
| Basic Beauty 実機 | ESM `beauty-effect` · `setEffectsBeauty` |
| Provider adapter | `zego-uikit` 試作 |
| E2E | Playwright + fake media |

### 27.3 変更なし

`live-broadcasts.js` · studio / watch 本番 · Payment 系 · flag OFF 既定。

### 27.4 資格情報 GO 後

1. `.env` 設定 → `npm run dev`
2. Phase2-08 PoC ファイル追加（別作業）
3. `verify-live-zego-uikit-beauty-poc.mjs` の `POC_IMPLEMENTED=true` + E2E 配線
