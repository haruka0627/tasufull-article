# TASFUL TODO（正本）

**最終更新:** 2026-06-28（開発優先順位 P1–P5 · TLV Pause）  
**Git HEAD:** `aebf23c`（参照時点 · 以降は [PROJECT_STATUS.md](./PROJECT_STATUS.md) を正とする）  
**優先:** 下記 **Release Readiness** が正本。旧セクション（Legacy）は参照用 · 詳細は各リンク。

**Cursor 開発優先:** **P1 TASFUL AI ✅** → **P2 Live Platform Core ✅** → **P3 Live API（ZEGO）** → **P4 BD 待機** → **P5 Materials Phase 0** → P6 TLV Pause · AI秘書待機

---

### Live API — ZEGO Provider（P3 · 2026-06-28）

**正本:** [LIVE_PLATFORM_ZEGO_ADAPTER.md](./LIVE_PLATFORM_ZEGO_ADAPTER.md) · [adapter design](../reports/live-platform-zego-adapter-design.md)

| 項目 | 状態 |
| --- | --- |
| Phase 0 Adapter Design | **Go** |
| Phase 1 Adapter 実装 | **Go** — `npm run test:platform-live-zego-adapter-phase1` **77 PASS** |
| Phase 2 E2E | **Conditional Go** — `.env` ZEGO + Platform PoC ページ |
| platform-live Provider | Stub のみ本接続 |
| Token API | `/api/tlv-zego-token` 流用可 |
| 禁止 | TLV PoC 変更 · Interface 変更 · TLV 接続 |

---

### Platform Live ZEGO Integration — Phase 5 TLV 統合（2026-06-29）

**正本:** [P5-1 audit](../reports/live-platform-zego-phase5-p5-1-connection-audit.md) · Phase 4 完了 `a8a3a20`

| Phase | 内容 | 状態 |
| --- | --- | --- |
| **P5-1** | TLV ↔ Platform Live 接続ポイント調査 · レポート | **Go** |
| **P5-2** | TLV Platform Live Adapter（Interface 経由 · ZEGO 非直依存） | **Go**（未コミット） |
| **P5-3** | `usePlatformLive` feature flag + 条件付き bridge 接続 | **Go**（未コミット） |
| **P5-4** | 8788 統合スモーク（Flag OFF/ON · bridge/adapter/integration） | **Done / GO** |
| **P5-5** | Flag ON ZEGO provider lazy load | **Go**（未コミット · `test:platform-live-zego-integration-phase5-p5-5`） |
| **P5-6** | watch leave · studio preview container | **Go**（未コミット · `test:platform-live-zego-integration-phase5-p5-6`） |
| **P5-7** | Supabase comments vs Platform Chat 統合方針 | **Go**（方針固定 · [report](../reports/live-platform-zego-phase5-p5-7-comments-chat-policy.md) · Chat 本体統合は Future） |
| **P5-8** | `renderStreamPlayer` 実映像化（Platform player mount） | **Done** `3640bc6` |
| **P5-9** | watch URL 正規化 | **Go**（未コミット · `test:platform-live-zego-integration-phase5-p5-9`） |

**制約:** UI 全面変更 · DB/API/Token 仕様変更 · dist/deploy · 大規模リファクタ **禁止**

**検証:** `npm run verify:platform-live-zego-integration-phase5-p5-4-smoke` · P5-3/P5-2/P5-1/P4-6 regression · 8788

---

### Business Directory（P4 · 待機 · 2026-06-28）

**状態:** MVP-1/3 Complete · Step 5 + Launch Gate Prep **Complete** · **Commercial Launch No-Go 維持** · **新規実装停止**

**Cursor 継続可:** Docs（FAQ/Runbook/Legal）· 8788 regression · smoke · bugfix のみ

**正本:** [launch gate prep](../reports/business-directory-launch-gate-prep.md) · [operational readiness](../reports/business-directory-operational-readiness.md)

| 項目 | 状態 |
| --- | --- |
| MVP-1（Self-Service · 審査 · 公開 · 検索 · Stripe Test） | **Complete** |
| MVP-2（公開後編集タブ · Pro TLV · 問い合わせ） | **未着手** |
| Production Step 4 | **48/48 Go**（2026-06-27） |
| Step 5 Operational Readiness | **Complete** |
| Launch Gate Preparation | **Complete** |
| **運用モード** | **待機** — 新規実装停止 · Docs/regression/bugfix のみ |
| Commercial Launch | **No-Go**（OB1–OB8 · 明示承認待ち） |

**Launch Gate blockers:** OB1–OB8 — [launch gate prep](../reports/business-directory-launch-gate-prep.md)

---

### TASFUL Materials（P5 · Phase 0 · 2026-06-28）

**正本:** [free-download-service-backlog.md](./free-download-service-backlog.md) · [implementation readiness](../reports/free-download-service-implementation-readiness.md)

| 項目 | 状態 |
| --- | --- |
| Phase | **0 のみ** — 実装 **開始しない** |
| 実装 | **未着手**（設計のみ） |
| Phase 0 対象 | 命名 · 法務 checklist · 広告 SDK 候補 · ライセンス整理 |
| Phase 1 | **禁止**（schema/UI/DB 着手不可） |

---

### Live Platform 共通基盤（P2 · 2026-06-28）

**正本:** [live-platform-common-foundation-plan.md](../reports/live-platform-common-foundation-plan.md)

| 項目 | 状態 |
| --- | --- |
| TASFUL AI P1 | **Complete**（Membership = REL-F-04 保留） |
| P2 設計・実装計画 | **完了** |
| P2 Phase A（Session Core） | **Complete** — [phase-a report](../reports/platform-live-core-phase-a.md) |
| P2 Phase B（Broadcast Core） | **Complete** — [phase-b report](../reports/platform-live-broadcast-phase-b.md) |
| P2 Phase C（Viewer Core） | **Complete** — [phase-c report](../reports/platform-live-viewer-phase-c.md) |
| P2 Phase D（Chat Gateway） | **Complete** — [phase-d report](../reports/platform-live-chat-phase-d.md) |
| P2 Phase E（Recording） | **Complete** — [phase-e report](../reports/platform-live-recording-phase-e.md) |
| P2 Phase F（Monitoring） | **Complete** — [phase-f report](../reports/platform-live-monitoring-phase-f.md) · [core summary](../reports/platform-live-platform-summary.md) |
| **Live Platform Core** | **Complete（A〜F）** |
| TLV | **Pause** — 共通基盤と **並行可** · TLV 固有接続は Complete 後 |

**Phase A–F:** Session ✅ → Broadcast ✅ → Viewer ✅ → Chat Gateway ✅ → Recording ✅ → Monitoring ✅

**Phase A テスト:** `npm run test:platform-live-core-phase-a`（53 PASS）  
**Phase B テスト:** `npm run test:platform-live-broadcast-phase-b`（50 PASS）  
**Phase C テスト:** `npm run test:platform-live-viewer-phase-c`（41 PASS）  
**Phase D テスト:** `npm run test:platform-live-chat-phase-d`（39 PASS · 2026-06-28）  
**Phase E テスト:** `npm run test:platform-live-recording-phase-e`（55 PASS · 2026-06-28）  
**Phase F テスト:** `npm run test:platform-live-monitoring-phase-f`（40 PASS · 2026-06-28）

**禁止（P2）:** TLV/Builder 固有 · Wallet · 30分制度 · Chat UI · Membership

---

## Release Readiness（2026-06-28 棚卸し）

**監査レポート:** [reports/todo-release-readiness-audit.md](../reports/todo-release-readiness-audit.md)

### 分類凡例

| 分類 | 意味 |
| --- | --- |
| **Release P0** | 本番公開（または Go 宣言）の **直接 blocker** のみ |
| **Release P1** | 公開後 **90 日以内** に着手 · 収益 · 運用安定 · 公開範囲拡大 |
| **Later** | 後回し可 · 凍結製品の拡張 · staging 限定 |
| **Future** | 設計のみ / 数値未確定 / 次世代 Vision |
| **Done** | 完了 · コミット/テスト済（deploy 残は P1 へ） |
| **Deprecated** | 重複 · 旧ラベル · 方針ズレ — 参照しない |

**各項目:** サービス · 優先度 · 状態 · ブロッカー · 次アクション

---

### Release P0 — 本番公開前必須

| ID | 対象 | 優先度 | 状態 | ブロッカー | 次アクション |
| --- | --- | --- | --- | --- | --- |
| **REL-P0-01** | **Repo / Docs** | P0 | 部分 | docs 正本未コミット群 | 選別ステージング · `docs/` + 設計 Backlog コミット（`git add -A` 禁止） |
| **REL-P0-02** | **TLV Payment** | P0 | **Paused（運用待ち）** | 運用ゲートのみ（Backup · Stripe · Live smoke） | [Completion Gate §11](../reports/tlv-phase1-completion-gate.md#11-phase-1-停止--再開条件正本) · Runbook Step 1→10 |
| **REL-P0-03** | **AI 秘書** | P0 | deploy No-Go | `DEEPSEEK_API_KEY` prod · 残高 · HTTP 200 smoke | Production Secret · deploy · 1 往復 smoke |
| **REL-P0-04** | **Pages 配信** | P0 | 部分 | 未 deploy 資産多数（Builder 6-H 等 · Site Assistant） | `build:pages` → prod alias · 対象範囲の smoke 8788/本番 |

**TLV Payment Release Operations（REL-P0-02 詳細 · 開発凍結 · Runbook のみ · Phase 1 実装停止 2026-06-28）**

**技術 Blocker:** **0**（Migration · RPC · RLS · Edge v4 deploy 済）  
**残:** 運用ゲートのみ — [tlv-phase1-completion-gate.md](../reports/tlv-phase1-completion-gate.md) §11  
**着手禁止（TLV Complete まで）:** TLV Phase 2 固有 · Wallet↔Live · TLV Chat UI · TLV Moderation · 収益接続

**並行可（P2）:** Live Platform **共通基盤**（`platform-live/` · Edge · stub）— [foundation plan](../reports/live-platform-common-foundation-plan.md)

- [ ] Backup Dashboard 目視 · snapshot 日時記録 · rollback 確認
- [ ] Stripe Dashboard — endpoint · **Runbook §2.4 の 7 events**（`refund.updated` 必須 · `checkout.session.*` 不要）· test delivery
- [ ] `STRIPE_WEBHOOK_SECRET_TLV` 分離（推奨）
- [ ] Live Payment · Partial Refund · Dispute（PS-M01 / M06 / M07）
- [ ] Go Approval · PS-M03/M04 手動 · Production Go · 24h 監視

**Stripe 7 events 正本:** `payment_intent.succeeded` · `payment_intent.payment_failed` · `payment_intent.canceled` · `charge.refunded` · **`refund.updated`** · `charge.dispute.created` · `charge.dispute.closed`

#### TLV — 運用ゲート待ち（Cursor 待機指示 · 2026-06-28）

| レイヤ | 状態 |
| --- | --- |
| **Design** | Complete · **Frozen** |
| **Phase 1** | 技術実装完了 · **実装停止** · Complete 判定待ち |
| **Phase 2（TLV 固有）** | **着手禁止** |

**Cursor:** TLV 運用ゲート待ち。**P2 Live 共通基盤**は [foundation plan](../reports/live-platform-common-foundation-plan.md) に従い TLV 非依存で進める。

| 待機中に可 | 禁止 |
| --- | --- |
| バグ修正 · ドキュメント · レポート · テスト · Runbook · **P2 Live 共通基盤（TLV 非依存）** | TLV Phase 2 固有 · Wallet↔Live · TLV Chat/Moderation UI · TLV migration |

**再開:** 運用ゲート ALL PASS → `Phase 1 = Complete` · `Phase 2 = Go` — 正本 [tlv-phase1-completion-gate.md §11](../reports/tlv-phase1-completion-gate.md#11-phase-1-停止--再開条件正本)

**非 P0（明示）:** AI Membership 料金確定 · Live Platform Vision 制度実装（30分サバイバル全体） · Builder Credits · Enterprise Sponsored · Creator Economy 数値 — **Future**

---

### TLV Release P0 — ライブ配信サービス本番最低条件（2026-06-28 再棚卸し）

**監査レポート:** [reports/tlv-release-p0-audit.md](../reports/tlv-release-p0-audit.md)  
**前提:** [TLV_PRD.md](./TLV_PRD.md) v2 正本 · [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) · [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) · TLV v1.0 **FEATURE FROZEN**（`live/` UI は v1 · **収益ライブ未接続**）

**スコープ定義（本棚卸し）**

| スコープ | 意味 | Release 判定 |
| --- | --- | --- |
| **A: TLV v1.0 静的ハブ** | Shorts · VOD · stub 配信 UI | ✅ Production Ready **FROZEN** — 本監査の P0 **対象外** |
| **B: 収益ライブ MVP** | 実映像配信 + coin 投げ銭 + 最低限チャット/安全 | **本監査の P0 正本** — **未 Go** |
| **C: PRD v2 制度全体** | 30分サバイバル · Gauge · Score · Legend | **Future（REL-F-01/02）** — MVP 後 |

**現状ギャップ（要約）:** Payment Engine **開発完了** · `live/` は `public.live_*` + **tip stub** · `tlv.streams`/Wallet **UI 未接続** · 映像 ingest **stub** · Live Chat 設計は TODO Future · `docs/TLV_LIVE_CHAT.md` **未作成**

#### サービス別分類

| サービス | Release P0 | P1 | Future / 対象外 |
| --- | --- | --- | --- |
| **Payment / Wallet** | REL-P0-02 · TLV-P0-05（Live 接続） | chargeback prod 適用 · Admin JWT E2E | IAP · Membership |
| **Live API** | TLV-P0-01 · TLV-P0-02 · TLV-P0-03 | フォロワー限定 · 予約配信 polish | LL-HLS 高度化 · 非アクティブ軽量化 |
| **Viewer API** | TLV-P0-04 | 実効 CCU · bot 除外 | PRD §10 T&S フル |
| **Live Chat** | TLV-P0-06 · TLV-P0-07 | ピン留め · 投げ銭強調 · Realtime polish | TODO-CHAT-05+ · AI 翻訳/要約/モデレーター |
| **配信終了** | TLV-P0-08 | 異常終了 runbook 拡張 | 月次 payout · 30日 hold |
| **管理・安全** | TLV-P0-09 | 通報 UI 拡張 · admin ダッシュ | T&S フル · Legend PPR |
| **Runbook** | REL-P0-02 · TLV-P0-10 | 24h→7d 監視 | — |
| **映像拡張** | — | 美顔/背景ぼかし（**Decision 候補**） | AI 字幕 · AI クリップ |
| **分析・イベント** | — | Creator 分析（基本） | イベント · 高度分析 |

#### TLV Release P0 チェックリスト（blocker のみ）

| ID | 領域 | 状態 | ブロッカー | 次アクション |
| --- | --- | --- | --- | --- |
| **REL-P0-02** | Payment Runbook | No-Go（運用） | Backup/PITR · Stripe · webhook deploy · Go Approval | Runbook Step 1→10（**Wallet 本番の前提**） |
| **TLV-P0-01** | Live DB + RLS 本番 | 未 Go | `live_p0_schema` **DRAFT · staging 適用待ち** · `tlv.*` payment migration prod 適用待ち | staging 適用 → prod migration · RLS smoke |
| **TLV-P0-02** | 映像 ingest（RTMP→HLS） | 未 Go | `stream_provider=stub` · Cloudflare Stream **未接続** | ingest API · playback URL · creator 権限 gate |
| **TLV-P0-03** | 配信 lifecycle API | 部分 | `live-broadcasts.js` 直 UPDATE のみ · **Edge/RPC なし** · `tlv.streams` **未使用** | start/end/status · creator 権限 · idempotent close |
| **TLV-P0-04** | 視聴 session / CCU | 未 Go | join/leave **なし** · `peak_viewers` 更新なし | viewer join/leave · 同接カウント · 状態表示 |
| **TLV-P0-05** | Wallet ↔ Live UI | 未 Go | `live-tips.js` = **`live_tips` stub** · `tlv-create-tip`/coin purchase **未接続** | checkout UI · tip RPC · 残高表示 · stream_id 紐付け |
| **TLV-P0-06** | Live Chat MVP | 部分 | `live-comments.js` 最小 CRUD のみ · Realtime/NG **なし** | 投稿/表示 · `stream_events` 連携 · rate limit |
| **TLV-P0-07** | Moderation MVP | 未 Go | NG/BAN/mute/mod 削除 **なし**（TODO-CHAT = Future） | NG ワード · timeout/BAN · mod 削除 · 最低限ログ |
| **TLV-P0-08** | 配信終了処理 | 未 Go | `ended_at` のみ · viewer cleanup/ledger 確定 **なし** | room close · viewer 掃除 · tip/ledger 確定 · 異常終了方針 |
| **TLV-P0-09** | 管理・安全 | 部分 | VOD 通報（P13）のみ · **配信強制停止/BAN 未整備** | ops 配信停止 · user BAN · 監査ログ · RLS 再確認 |
| **TLV-P0-10** | Live + Payment Runbook | 未 Go | Payment runbook のみ · **ライブ障害手順なし** | 配信停止 · webhook 失敗 · CCU 異常 · ロールバック |

**Done（TLV Live P0 から除外）:** Payment Engine 実装（purchase/tip/webhook/idempotency/RPC） · staging 全スイート PASS · v1.0 静的 Live UI FROZEN · `live-comments.js` Phase 5 最小

**P1（公開後 90 日 · 差別化/体験）:** 美顔/背景ぼかし（軽量映像補正 = **Decision 候補**） · 延長 Gauge UX · 投げ銭チャット強調 · Creator 基本分析 · フォロワー限定配信 · chargeback prod registry

**Future / リリース対象外:** AI 字幕 · AI 翻訳 · AI クリップ · AI モデレーター · Membership · 30分サバイバル制度フル · Score/Legend/Pool · イベント機能 · Creator 高度分析 · IAP

#### 推奨実装順（依存関係）

```text
1. Payment/Wallet（REL-P0-02 Runbook + TLV-P0-01 DB prod）
      ↓
2. Live API（TLV-P0-02 ingest + TLV-P0-03 lifecycle + TLV-P0-04 viewer）
      ↓
3. Wallet ↔ Live（TLV-P0-05）
      ↓
4. Live Chat（TLV-P0-06）
      ↓
5. Moderation（TLV-P0-07 + TLV-P0-09 管理）
      ↓
6. 配信終了 + Runbook（TLV-P0-08 + TLV-P0-10）
```

**既存 REL-P0-02 との差分:** REL-P0-02 は **Payment 運用ゲートのみ**。本節 **TLV-P0-01〜10** は **ライブ配信サービスとしての追加 blocker**（開発 + 運用 + 接続）。

---

### TLV Live Provider — Future Backlog（2026-06-28）

**種別:** **Future · 設計バックログのみ** — 実装 · DB · UI · Gateway · Payment · SDK **変更なし**

**方針:** 初期リリースは **ライブ配信 SDK**（例: ZEGO 等）を採用し、サービスを最速で公開する。SDK は **時間を買うため** に利用する — **SDK へ永続依存は前提としない**。サービス成長後、必要に応じて **段階的に独自実装へ移行** する。

**関連:** [TLV Release P0](#tlv-release-p0--ライブ配信サービス本番最低条件2026-06-28-再棚卸し)（TLV-P0-02 ingest = 初期 SDK 採用） · [TLV_PRD.md](./TLV_PRD.md) §インフラ · [ROADMAP.md](./ROADMAP.md)

| ID | 項目 | 状態 |
| --- | --- | --- |
| **TLV-LIVE-FUTURE-01** | Live Provider Interface | **PoC Done** · 本番統合 Phase 2 |
| **TLV-LIVE-FUTURE-02** | Beauty Provider | Future · 未着手 |
| **TLV-LIVE-FUTURE-03** | 独自 RTC 研究 | Future · 未着手 |
| **TLV-LIVE-FUTURE-04** | SDK 置換計画 | Future · 未着手 |

#### TLV-LIVE-FUTURE-01 — Live Provider Interface

- [ ] **SDK 依存を抽象化** — ingest / playback / room / token 発行を Provider 非依存インターフェースに分離
- [ ] **Provider 差し替え可能な構造** — `stream_provider` 列挙 + Adapter パターン · 設定で切替
- [ ] **初期:** 第三者 Live SDK（例: ZEGO 等）
- [ ] **将来:** 独自 Live Provider（自社 SFU / Media Server ベース）

#### TLV-LIVE-FUTURE-02 — Beauty Provider

- [ ] **初期:** SDK 標準 Beauty（美顔 · 背景ぼかし等）を利用
- [ ] **高度 Beauty:** SDK ライセンス追加 **または** 将来自前実装 — コスト/品質で選択
- [ ] **将来:** 独自 Beauty Engine へ置換可能な抽象化（Live Provider Interface と同様）

#### TLV-LIVE-FUTURE-03 — 独自 RTC 研究

- [ ] **WebRTC** — ブラウザ/モバイル P2P/SFU クライアント調査
- [ ] **SFU** — スケールアウト · 同接コスト試算
- [ ] **Media Server** — ingest/transcode/LL-HLS パイプライン（[TLV_PRD.md](./TLV_PRD.md) 配信基盤前提）
- [ ] **配信最適化** — 動的 bitrate · 非アクティブ軽量化 · CCU 連動原価
- [ ] **独自 Live 基盤** — SDK 非依存の end-to-end 設計 · PoC

#### TLV-LIVE-FUTURE-04 — SDK 置換計画

**置換を検討する条件（例 · すべて満たす必要はない）:**

- [ ] **十分な売上** — SDK ランニングコストを自社開発償却可能な規模
- [ ] **コスト最適化効果が大きい** — 月次 infra/SDK 費用 vs 自社運用の breakeven 試算
- [ ] **独自基盤の品質が SDK 同等以上** — 遅延 · 安定性 · 障害復旧 · モバイル互換

**段階移行（想定 · 未確定）:**

1. Interface 導入（FUTURE-01）→ SDK Adapter 本番
2. トラフィック一部を独自 Provider へカナリア
3. 品質/コスト KPI 達成後、SDK 縮小または退役
4. Beauty Engine 独立置換（FUTURE-02）

**禁止（本 Backlog 時点）:** SDK 選定コミット · 契約 · 本番 Live UI 統合 — **Phase 2 で別途**

---

### TLV Live SDK — Phase 状態（2026-06-28）

**正本:** [TLV_LIVE_PROVIDER.md](./TLV_LIVE_PROVIDER.md) · [tlv-live-zego-poc-e2e.md](../reports/tlv-live-zego-poc-e2e.md) · [tlv-live-waiting-phase-audit.md](../reports/tlv-live-waiting-phase-audit.md)

| Phase | 状態 | 備考 |
| --- | --- | --- |
| **Phase 1** PoC | **完了** | Provider · ZEGO · PoC 画面 · Token API |
| **Phase 1.5** E2E | **実装クローズ** · E2E GO 待ち | Blocker = `.env` ZEGO 3 変数のみ |
| **Phase 2 事前設計** Session Manager | **完了** | §15 · 実装禁止 |
| **Phase 2 実装** | **未着手** | 1.5 GO 後 · **待機中は新規実装禁止** |

#### 待機フェーズ（ZEGO 資格情報待ち）

- Blocker: **ZEGO Console → `.env`**（コード問題なし）
- 禁止: 新規実装 · 既存 Live 変更 · Payment / Wallet / Coin / 投げ銭 / 30分
- 再開: `npm run verify:live-zego-poc-e2e` 全 PASS → Phase 1.5 GO

#### Phase 1.5 — PASS（E2E 最終 GO）

`.env` 設定後:

```bash
npm run dev
npm run verify:live-zego-poc-e2e
```

**PASS:** Token API · Host/Viewer · Camera/Mic/Switch · Leave/End · Console Error なし · `reports/tlv-live-zego-poc-e2e.json` PASS

#### Phase 2 — 実装計画（未着手 · 1.5 GO 後 · Payment 非結合）

**設計:** [TLV_LIVE_PROVIDER.md §19](./TLV_LIVE_PROVIDER.md#19-phase-2-実装計画細分化--未着手)

- [x] **Phase2-01** Session Manager Skeleton — `live/session/*` · `npm run test:live-session-manager`
- [x] **Phase2-02** Live Service ↔ Session Manager 配線（PoC のみ · **live-broadcasts 未接続**） — `npm run test:live-service-session`
- [x] **Phase2-03** live-broadcasts lifecycle 接続準備（feature flag **OFF 既定** · bridge · Session 同期のみ · ZEGO 未接続） — `npm run test:live-broadcasts-session-bridge`
- [x] **Phase2-04** Session Event UI 表示（Session Debug Panel · flag OFF 既定） — `npm run test:live-session-debug-panel`
- [x] **Phase2-05** Reconnect / Error Handling（Provider 抽象 signal · recoverable ERROR · flag OFF 既定） — `npm run test:live-session-provider-signals`
- [x] **Phase2-06** Error Handling 強化（入力検証 · 本番ポリシー · flag OFF 既定） — `npm run test:live-session-error-policy`
- [x] **Phase2-07** UIKit / Basic Beauty / OBS 評価（調査 · PoC 分離 · 本番非接続） — `npm run verify:live-zego-uikit-eval`
- [x] **Phase2-08** UIKit / Beauty 実機 PoC — **SKIP**（ZEGO 資格情報未設定 · 実装なし） — `npm run verify:live-zego-uikit-beauty-poc` · [report](../reports/tlv-live-phase2-08-uikit-beauty-poc.md)

**Interface / Security TODO（docs のみ）:** IF-TODO-01〜07 · SEC-TODO-01〜07 — [§17/§18](./TLV_LIVE_PROVIDER.md#17-interface-review--改善-todo実装禁止)

**Phase 2 で触らない:** Payment / Wallet / Coin / Stripe / 投げ銭 / 30分 / 延長 / Membership / Score / Ranking / Moderation / AI

**TLV-LIVE-FUTURE-01:** PoC Interface **Done** · 本番統合 = Phase2-01〜06

---

### Release P1 — 公開後すぐ

| ID | 対象 | 優先度 | 状態 | ブロッカー | 次アクション |
| --- | --- | --- | --- | --- | --- |
| **REL-P1-01** | **TASFUL AI** | P1 | **Complete** | Membership=REL-F-04 保留 | [p1 implementation](../reports/tasful-ai-p1-implementation.md) |
| **REL-P2-01** | **Live Platform 共通基盤** | P2 | **Core Complete（A〜F）** | Edge deploy · surface 接続（Post-MVP） | [summary](../reports/platform-live-platform-summary.md) · [plan](../reports/live-platform-common-foundation-plan.md) |
| **REL-P1-02** | **Platform** | P1 | 未着手 | なし | featured バッジ · favorites DB · Google OAuth E2E |
| **REL-P1-03** | **Builder AI** | P1 | staging 準備 | 本番 DB 未適用 | P2-C staging のみ（draft Supabase · RLS · Live E2E） |
| **REL-P1-04** | **Builder 条件検索** | P1 | P1 実装 Done | LLM 未接続 | P2 Pro 自然文変換 · 統合 UI（[CONDITIONAL_SEARCH](./AI/BUILDER_AI_CONDITIONAL_SEARCH.md)） |
| **REL-P1-05** | **Builder Monetization** | P1 | 設計 Draft | SKU 未確定 | Contact Reveal M0–M3（**公開範囲に Reveal 含む場合**） |
| **REL-P1-06** | **Provider Listing** | P1 | 設計 Draft | なし | Free Listing L1–L2 · Boost L3（**掲載者向け公開時**） |
| **REL-P1-07** | **Business Directory** | P3 | Launch Gate Prep **Complete** | Commercial Launch | OB1–OB8 人間判断 · OB8 Go |
| **REL-P1-08** | **Builder 未 push** | P1 | 未 | — | Command Dashboard 6-H コミット · Builder AI 系 push/deploy |

---

### Later — 後回し可

| ID | 対象 | 状態 | 次アクション |
| --- | --- | --- | --- |
| **REL-L-01** | Builder Gemini Live 4-B | 未着手 | [backlog](./builder-ai-gemini-live-field-diagnosis-backlog.md) |
| **REL-L-02** | Builder AI P2-C 本番 | staging 後 | 本番 DB · dev role 廃止 |
| **REL-L-03** | Site Assistant Phase 2+ | 未着手 | Feedback Launcher 7 入口 |
| **REL-L-04** | AI Secretary Trend Scout | 未着手 | 設計のみ |
| **REL-L-05** | Platform クーポン基盤 | 未着手 | 設計 |
| **REL-L-06** | TLV Payment DEV/TODO 候補 | 候補 | CAND-P2-02 IAP · DEV-05/07（Needs Decision） |

---

### Future — 将来構想（設計 · 数値未確定 · 実装禁止扱い）

| ID | 対象 | 正本 |
| --- | --- | --- |
| **REL-F-01** | Live Platform Vision 制度実装 | AD-014 · [LIVE_PLATFORM_CONCEPT.md](./LIVE_PLATFORM_CONCEPT.md) |
| **REL-F-02** | TLV Pricing / Creator Economy 数値 | [MONETIZATION.md](./MONETIZATION.md) · TODO §TLV Pricing |
| **REL-F-03** | TLV Membership | [tlv-membership-design.md](../reports/tlv-membership-design.md) |
| **REL-F-04** | AI Membership Pricing 実装 | [AI_MEMBERSHIP_PRICING.md](./AI/AI_MEMBERSHIP_PRICING.md) |
| **REL-F-05** | Builder Credits BC-1+ | [BUILDER_CREDITS.md](./AI/BUILDER_CREDITS.md) |
| **REL-F-06** | Provider Listing L6 Enterprise / TOP 入札 | [BUILDER_PROVIDER_LISTING.md](./AI/BUILDER_PROVIDER_LISTING.md) |
| **REL-F-07** | Builder 条件検索 P3 AI 要約 | [BUILDER_AI_CONDITIONAL_SEARCH.md](./AI/BUILDER_AI_CONDITIONAL_SEARCH.md) |
| **REL-F-08** | TLV Live Provider 抽象化 · SDK 置換 | 下記 [TLV Live Provider — Future Backlog](#tlv-live-provider--future-backlog2026-06-28) |
| **REL-F-09** | Graph-based Collusion Detection | [TLV_PRD.md](./TLV_PRD.md) §7.5 · TODO-COLLUSION-GRAPH |
| **REL-F-10** | Creator ネガティブ payout ledger（v1 不採用 · v2 ADR 候補） | Design Audit §C · Wallet マイナス禁止 |
| **REL-F-11** | Creator Marketplace | 下記 §CAND-CREATOR-MARKETPLACE-01 |
| **REL-F-12** | AI Sound Library | 下記 §CAND-ASSET-LIBRARY-02 |

---

### CAND-CREATOR-MARKETPLACE-01 — Creator Marketplace（Future）

**状態:** Future（未着手）  
**優先度:** P2〜P3（既存サービス安定後）  
**種別:** 設計バックログのみ — 実装 · DB · API · UI · migration · deploy **禁止（本条目時点）**

#### 概要

クリエイターがデジタル商品を販売し、そのプロフィールから制作依頼も受けられる Marketplace を追加する。

目的:

- 商品販売
- ポートフォリオ
- ワーカー依頼

を 1 つのクリエイターページへ統合する。

#### MVP

- Creator Profile
- 商品一覧
- 商品投稿
- 商品詳細
- 商品購入
- レビュー
- 「この人に依頼する」ボタン
- Creator 実績表示（販売数 · 評価 · レビュー数）

#### 対応予定カテゴリ

- AI画像
- AI動画
- 写真
- 動画素材
- BGM
- 効果音
- アイコン
- デザイン
- HTML/CSS
- Webテンプレート
- Builderテンプレート
- AIプロンプト
- LoRA
- その他デジタルコンテンツ

#### 将来拡張

- サブスク販売
- バンドル販売
- ライセンス設定
- クーポン
- アフィリエイト
- 売上分析
- Creator Dashboard
- AI商品説明生成
- TLVライブ販売連携
- Builderテンプレート販売連携

#### 他サービス連携

| サービス | 連携 |
| --- | --- |
| **TASFUL AI** | 商品説明生成 · タグ生成 · SEO補助 |
| **TLV** | ライブ中の商品紹介 · Creatorページへの導線 |
| **Builder** | テンプレート販売 · 制作実績販売 |
| **Business Directory** | 企業案件への導線 |
| **Worker** | 「この人に依頼する」から制作依頼 |

#### 設計メモ

商品販売とワーカー依頼は分離せず、同一 Creator Profile に統合する。

「作品 → 信頼 → 購入 → 制作依頼」という導線を基本設計とする。

---

### CAND-ASSET-LIBRARY-02 — AI Sound Library（Future）

**状態:** Future（未着手）  
**優先度:** P2〜P3（Platform · Marketplace 安定後）  
**種別:** 設計バックログのみ — 実装 · DB · API · UI · migration · deploy **禁止（本条目時点）**

#### 概要

TASFUL Platform に AI 生成による音楽 · 効果音ライブラリを追加する。

無料素材を集客入口とし、有料素材 · Creator Marketplace · 制作依頼へ導線を作る。

#### BGM

**生成ツール**

- Suno

**主なカテゴリ**

- Corporate Pack
- Vlog Pack
- Podcast Pack
- Relax Pack
- Happy Pack
- Cinematic Pack
- Gaming Pack（Premium候補）

#### 効果音（SFX）

**生成候補**

- AudioCraft（AudioGen）
- Stable Audio Open

ローカル GPU を利用し、大量生成可能な環境を前提とする。

#### SFXカテゴリ

**UI**

- Button
- Hover
- Notification
- Success
- Error
- Popup

**Game**

- Sword
- Magic
- Explosion
- Gun
- Bow
- Heal
- Item
- Coin
- Level Up

**Environment**

- Rain
- Wind
- Ocean
- River
- Forest
- Fire
- Thunder
- City
- Crowd

**Horror**

- Whisper
- Monster
- Door
- Scary Hit
- Heartbeat

**Video**

- Whoosh
- Transition
- Impact
- Click
- Pop
- Sweep

#### 将来構想

無料素材

↓

Premium素材

↓

Creator Marketplace

↓

「この人に依頼する」

までを 1 つの導線として構築する。

#### 設計メモ

- BGM は Suno を基本とする。
- 効果音は AudioCraft / Stable Audio Open を中心に検証する。
- 効果音はローカル GPU 環境で大量生成できる構成を目指す。

---

### Done — 完了済み（代表 · deploy 残は P1）

| 領域 | 代表成果 | 参照 |
| --- | --- | --- |
| **TASFUL AI PR** | Workspace 課金 P1/P2 · Brave Search · CF Access E2E · prod alias | [tasful-ai-production-ready-verification.md](../reports/tasful-ai-production-ready-verification.md) |
| **TLV Payment 開発** | purchase/tip/chargeback · migration · audit **Development Complete** | [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) |
| **Business Directory** | Phase 1–7 · Production Step 4 **48/48 Go** | TODO §Business Directory |
| **Builder AI** | Tools P3 · Vision P2/P5 · Live 4-A · Project 6-A〜6-H 実装 | [BUILDER_AI.md](./AI/BUILDER_AI.md) |
| **Builder 条件検索** | P0 schema · P1 Repository | [BUILDER_AI_CONDITIONAL_SEARCH.md](./AI/BUILDER_AI_CONDITIONAL_SEARCH.md) |
| **Builder 設計** | Monetization · Provider Listing · Credits **Draft** | `docs/AI/BUILDER_*.md` |
| **AI 秘書 実装** | DeepSeek P1/P2 · Orchestrator P5 · Google 6-B〜7-B | commit `6c70985` 系 |
| **Live Vision 設計** | AD-014 · 6 設計書 | [ROADMAP.md](./ROADMAP.md) |

---

### Deprecated 候補（統合 · 参照非推奨）

| 項目 | 理由 | 正本へ |
| --- | --- | --- |
| `## P0 — 直近` §1「440 件未コミット」 | HEAD clean と矛盾 · 数値古い | **REL-P0-01** |
| `### AI Membership Pricing` の **P0** チェックリスト | 料金 **Draft** · 実装 Future | **REL-F-04** |
| `Live Platform Vision` の **P0** ラベル（設計完了部） | Release P0 と混同 | **Done** + **REL-F-01** |
| `## TLV Pricing` + `## Creator Economy` + `## Platform Economy Phase 2` 後半の **重複 Creator Score 表** | 同一設計の二重記載 | §TLV Pricing 正 · 後半は Deprecated |
| `Builder AI P2-C` を Release P0 扱い | Builder v1.0 **FROZEN** · staging のみ | **REL-P1-03** |
| 旧 `優先: 上から順` のみの運用 | Release Readiness 未分類 | 本セクション |

---

### Builder 課金 · 掲載 · 検索 — Release 分類早見

| 機能 | 分類 | 備考 |
| --- | --- | --- |
| 条件検索 P0/P1（Repository） | **Done** | 検索は常に無料 |
| 条件検索 P2（LLM 変換） | **Later/P1** | Pro · Gateway |
| Contact Reveal 実装 | **P1**（Reveal 公開時 **P0**） | [BUILDER_MONETIZATION.md](./AI/BUILDER_MONETIZATION.md) |
| Provider Free Listing | **P1** | 掲載無料 |
| Provider Boost / Sponsored | **P1**（TOP/Enterprise **Future**） | [BUILDER_PROVIDER_LISTING.md](./AI/BUILDER_PROVIDER_LISTING.md) |
| Builder Credits | **Future** | [BUILDER_CREDITS.md](./AI/BUILDER_CREDITS.md) |
| Builder AI サブスク | **Future/P1** | entitlements 未接続 |

---

## Legacy 索引 — 旧構成（詳細・履歴）

> 以下は **詳細タスク履歴**。優先度は上記 **Release Readiness** を正とする。

## Legacy — 旧 P0 直近

### 1. 残存未コミット変更 440 件の整理

| 項目 | 内容 |
| --- | --- |
| 状態 | working tree に 440 件（196 M / 1 D / 243 ??） |
| 方針 | `git add -A` 禁止。領域別に選別ステージング（AI 時は `reports/ai-selected-staging-plan.md` 参照） |
| 主要カテゴリ | dist 248 · Live 54 · Builder HTML 36 · Admin AI/Ops 25 · Reports 17 · TLV sim 11 · ANPI 10 等 |
| 参照 | `reports/ai-selected-staging-result.md` §8 |

**サブタスク**

- [ ] カテゴリごとに「コミット / 破棄 / 保持」の判定表を作る
- [x] `ai-model-gateway.js`（+73 行）— `35d72b2` + dist `0f6328d` コミット済（2026-06-28 確認）
- [ ] `package.json`（wrangler compatibility-date）— 単独コミットか revert
- [x] `supabase/functions/_shared/ai-attachments.ts` — `35d72b2` コミット済 · live Vision PASS
- [ ] 本 `docs/` 正本セットのコミット（別 PR）

---

### 2. TASFUL AI 本番接続（Production Ready · §P0-2）

| 項目 | 内容 |
| --- | --- |
| 状態 | **Production Ready Go**（2026-06-28）— CF Access E2E · formal build · prod alias deploy |
| 参照 | `reports/tasful-ai-production-ready-verification.md` |
| **P0-2 残件（運用）** | 動画/音楽 API 本番 · working tree 選別 |

**サブタスク**

| タスク | 状態 | 根拠 |
| --- | --- | --- |
| **Workspace 課金 enforcement Phase 1**（クライアント） | **完了** | commit `2a43fe5223457327edf525bf4b56604d0c5e43a1` · Production https://tasufull-article.pages.dev · Direct Upload deploy 2026-06-26 |
| Phase 1 prod smoke | **完了** | **12/12 PASS** · console 0 · network 0 |
| Phase 1 browser regression | **完了** | `test-ai-workspace-usage-enforcement-browser.mjs` **15/15** · `test-tasful-ai-final-smoke-browser.mjs` **53/53** |
| **Serper credits / Web Search** | **完了（Brave Phase 1）** | Edge deploy · `WEB_SEARCH_PROVIDER=brave` · live **7/7 PASS** · `SERPER_API_KEY` rollback 保持 · `reports/brave-search-phase1.md` |
| **CF Access Service Token + prod alias E2E** | **完了** | verify **9/9 PASS** · deploy `bbe9eb2a` → alias |
| **formal build → prod alias deploy** | **完了** | 2026-06-28 · `reports/tasful-ai-production-ready-verification.md` |
| **build:pages EPERM** | **解消** | `scripts/stop-pages-dev.mjs` + package.json · 2026-06-28 |
| **Workspace 課金 enforcement Phase 2** | **Production deploy 完了** | Edge + DB · `5437d70e` main · quota Edge 11/11 PASS |

- [x] Workspace 課金 enforcement **Phase 1**（クライアント · `2a43fe5` · Production deploy）
- [x] `npm run build:pages` EPERM 修正（`scripts/stop-pages-dev.mjs` · 2026-06-28）
- [x] Supabase Edge デプロイ（chat functions · `ai-attachments.ts` 含む）→ Vision 再プローブ（2026-06-25 deploy · 2026-06-28 live 6/6 PASS）
- [x] Gemini billing / Serper credits 解消（**Brave Web Search Phase 1** · 2026-06-28 live PASS）
- [x] Cloudflare Access **Service Token** 設定 + prod alias E2E（2026-06-28）
- [x] formal `build:pages` → prod alias deploy（2026-06-28）
- [x] Workspace 課金 enforcement **Phase 2**（Edge + DB quota · Production deploy 2026-06-28）
- [x] 動画/音楽 API — Edge `ai-workspace-*-generate` · `AI_MEDIA_GEN_EDGE_ENABLED=1` · 2026-06-28

---

### AI Membership Pricing（Draft · 2026-06-28 · **Future — Release P0 ではない**）

**正本:** [docs/AI/AI_MEMBERSHIP_PRICING.md](./AI/AI_MEMBERSHIP_PRICING.md) · **Release 分類:** [REL-F-04](#future--将来構想設計--数値未確定--実装禁止扱い)  
**Status:** Draft（**原価・運用検証前 · 実装 Future**）

**Draft doc タスク（実装前 · すべて Future）**

**Pricing Structure（doc）**

- [ ] 仮価格 — Free ¥0 · Lite ¥300 · Pro ¥980 · Max ¥2,980
- [ ] Lite: Gemini 特化 · 日常用途 · 軽量高速高回数
- [ ] Pro: 収益コア · マルチ AI（Gemini / ChatGPT / Claude）
- [ ] Max: フル機能 · フェアユース拡張
- [ ] 料金 UI「Draft Pricing」明記

**Entry Campaign（doc）**

- [ ] ¥150 プラン（常設しない · Option A/B/C いずれか）— Lite ¥300 への移行促進

**Philosophy（doc）**

- [ ] Unlimited 不採用 · Cursor 型 · 平均原価ベース · ¥150=マーケ装置

**Next Step（原価確定後 · Future）**

- [ ] API 原価モデル · プラン別平均利用量 · フェアユース閾値 · Lite→Pro 移行率
- [ ] 原価シミュ後の価格再評価（粗利率 Lite/Pro 70% · Max 65〜70%）

**Later**

- [ ] USD 基準価格 · 地域別価格（Purchasing Power）

---

## Legacy — 旧 P1 製品別

### 3. Builder AI P2-C（**Release P1 · REL-P1-03** · staging のみ · 本番 FROZEN）

| 項目 | 内容 |
| --- | --- |
| 状態 | P2-B まで staging 準備済み（`5ed9672`）。**本番 DB / RLS 未適用** |
| 参照 | `reports/builder-ai-p2-b.md` §9 |

- [ ] staging DB に `sql/builder-ai-drafts-staging.sql` 適用（本番禁止）
- [ ] `custom_access_token_hook` 拡張 — `builder_*` claims
- [ ] draft store の Supabase 正本化（list/read DB 優先）
- [ ] RLS JWT 自動検証
- [ ] Live Edge E2E（`BUILDER_AI_E2E_LIVE_EDGE=1`, staging のみ）
- [ ] 本番 URL から dev query role 無効化

---

### 4. Platform — Featured / お気に入り / Google OAuth

| 項目 | 内容 |
| --- | --- |
| 状態 | Finish Phase コミット済（`5ed9672`）。コード上の残は finish レポート §9 |
| 参照 | `reports/platform-finish-phase.md` §6, §9 |

- [ ] **index.html ホーム featured カード** — バッジ未組込（一覧カードは対応済）
- [ ] **お気に入り DB 同期** — Supabase favorites + folder meta サーバー保存
- [ ] **Google OAuth 実機確認** — Supabase Dashboard 設定後 E2E（staging → production）
- [ ] （任意）検索ハブ listing pool 初回ロード · 非 AI バッジ説明

---

## Live Platform Vision（制度設計 · 2026-06-28 確定）

**正本 AD:** [DECISIONS.md](./DECISIONS.md) **AD-014** · 詳細: [LIVE_PLATFORM_CONCEPT.md](./LIVE_PLATFORM_CONCEPT.md) · [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) · [VIEWER_PROGRAM.md](./VIEWER_PROGRAM.md) · [MONETIZATION.md](./MONETIZATION.md) · [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) · [PLATFORM_IDEAS.md](./PLATFORM_IDEAS.md)

**注:** TLV v1.0 は **FEATURE FROZEN**。以下は **次世代 Platform Vision**（**Future · REL-F-01** · 実装未着手）。

### Done — 設計正本（旧「P0 — 設計正本」ラベル · Release P0 ではない）

| タスク | 状態 |
| --- | --- |
| サービスコンセプト · 条件達成型還元 | ✅ [LIVE_PLATFORM_CONCEPT.md](./LIVE_PLATFORM_CONCEPT.md) |
| 収益モデル · 三本柱 · 再投資 | ✅ [MONETIZATION.md](./MONETIZATION.md) |
| 配信者制度 · ランク · Creator Score | ✅ [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) |
| 視聴者制度 · レベル · ストリーク | ✅ [VIEWER_PROGRAM.md](./VIEWER_PROGRAM.md) |
| ライブシステム · 30+30 · ゲージ · Raid | ✅ [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) |
| ブレスト採否整理 | ✅ [PLATFORM_IDEAS.md](./PLATFORM_IDEAS.md) |
| ROADMAP 反映 | ✅ [ROADMAP.md](./ROADMAP.md) § Platform Vision 以降 |
| AD-014 Platform Vision · 条件達成型 Creator Economy | ✅ [DECISIONS.md](./DECISIONS.md) AD-014 |
| AD-004 / AD-011 / AD-012 との整合確認 | ✅ 各設計書 § 既存決定 |

- [x] 6 設計書作成 · 採用/保留/将来/不採用分類
- [x] AD-014 確定 · DECISIONS 正本登録
- [x] TODO · ROADMAP 更新
- [ ] 設計書コミット（選別ステージング · `git add -A` 禁止）

### TLV Design Audit Follow-up — 制度追補（2026-06-28 · docs のみ）

**根拠:** [reports/tlv-design-audit-reconciliation.md](../reports/tlv-design-audit-reconciliation.md) · [reports/tlv-design-audit-followup-policy.md](../reports/tlv-design-audit-followup-policy.md)  
**正本:** [TLV_PRD.md](./TLV_PRD.md) §5.5.3 · §7.5–7.6 · [ADMIN_SYSTEM.md](./ADMIN_SYSTEM.md) §6.5–6.6 · §9.3 · [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) §6.5

**docs 追記済（本節）:** TS 回復 · Collusion v1 · Clawback 運用 — **Score/Rank/Override/Wallet 根幹は不変**

| ID | 領域 | 内容 | 分類 | 状態 |
| --- | --- | --- | --- | --- |
| **TODO-TS-REC-01** | TS 回復 | Ops UI `/admin/tlv/trust` TS Recovery タブ · `creator_score_events` 正 delta 発行 | MVP 前 Ops | 未着手 |
| **TODO-TS-REC-02** | TS 回復 | 日次 03:30 `TS_CLEAN_PERIOD_RECOVERY` バッチ | P1 · Score バッチ依存 | 未着手 |
| **TODO-COLLUSION-01** | Collusion | `suspicious_collusion_flag` · CL-01〜05 ルールエンジン（ルールベース） | MVP 前 T&S | 未着手 |
| **TODO-COLLUSION-02** | Collusion | `/admin/tlv/trust` Collusion Queue UI | MVP 前 Ops | 未着手 |
| **TODO-CB-OPS-01** | Clawback | FinOps payout 後 manual recovery Runbook 実施 · production 適用 | **REL-P0-02** | 未着手 |
| **TODO-CB-OPS-02** | Clawback | 将来売上相殺 — payout batch 控除累積（FinOps 承認フロー） | P1 | 未着手 |
| **TODO-LEGAL-CB-01** | Clawback / Wallet | 利用規約 · 運用ポリシー — clawback · shortfall · frozen · Creator 相殺条文 | MVP 前 法務 | 未着手 |

**Future（実装対象外 · 設計のみ索引）**

| ID | 内容 |
| --- | --- |
| **REL-F-09** | Graph-based Collusion Detection（CL グラフ · ML · `trust_signals` 高度化） |
| **REL-F-10** | Creator ネガティブ payout ledger（**v1 不採用** — 必要時 v2 ADR） |

### P1 — 実装準備（未着手）

| タスク | 内容 |
| --- | --- |
| Creator Score 次元定義 | Activity / Revenue / Quality / Trust / Cost Efficiency |
| ライブコストモデル試算 | 帯域 · 同接 · 延長 cap の数値化 |
| 還元 tier 条件の Ops 草案 | Standard / Proven / Top Contributor 閾値案 |
| ライブゲージ weight シミュレーション | 延長条件 · オーバーゲージ cap |
| 法務 · 税務レビュー依頼 | 条件達成型還元 · ギフト手数料 |

- [ ] Creator Score 仕様書（数値閾値 · Ops ダッシュボード要件）
- [ ] ライブ infra コスト試算レポート
- [ ] 還元 tier 運用フロー（Ops 承認 · 降格ルール）
- [ ] TLV v1 凍結解除と Vision 実装のマイルストーン整合

### P2 — 制度実装（Future 着手前 · 未着手）

| 領域 | 内容 |
| --- | --- |
| **Creator Economy** | ランク · Creator Credit · ヒートマップ · 条件還元エンジン |
| **Viewer Economy** | レベル · ストリーク · 古参バッジ · ルーム内ランキング |
| **Live Economy** | 30+30 フロー · ゲージ · 応援 · Raid · ラジオモード |
| **Monetization** | 収益計測 · ギフト基盤 · 再投資配分 |

- [ ] 収益計測基盤（三本柱共通）
- [ ] ライブコア（ゲージ · 延長 · 終了）
- [ ] Creator tier · Score バックエンド
- [ ] 視聴者参加型 UI（AD-012 シンプル）

### Future — 保留制度の実装

| 項目 | 参照 |
| --- | --- |
| Creator Challenge · Lab · Marketplace · Incubator | [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §3–4 |
| エコボーナス · 時間帯ボーナス | [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §3 |
| コレクション · マイル · ミッション | [VIEWER_PROGRAM.md](./VIEWER_PROGRAM.md) §3 |
| DVR · チケット制 · 4K · コラボ多画面 | [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) §4–5 |
| ライブコマース · 通訳 · NFT · MCN | [PLATFORM_IDEAS.md](./PLATFORM_IDEAS.md) §3 |

---

## TLV / Live Platform（**Future 索引** · 詳細は Legacy）

> **Release 分類:** **収益ライブ MVP P0** = 上記 [TLV Release P0](#tlv-release-p0--ライブ配信サービス本番最低条件2026-06-28-再棚卸し) · Payment Release Ops = **REL-P0-02** · Live Provider/SDK 置換 = **REL-F-08** · Pricing/Creator 数値 = **REL-F-02** · Vision 制度 = **REL-F-01**

**前提:** [DECISIONS.md](./DECISIONS.md) **AD-014** · [MONETIZATION.md](./MONETIZATION.md) · [LIVE_SYSTEM.md](./LIVE_SYSTEM.md)  
**種別:** 料金 · 収益 · PL 制度設計 — **Future · 数値未確定**  
**詳細:** [TLV Pricing & Business Model v1](#tlv-pricing--business-model-v1) · [Creator Economy v1](#creator-economy-v1) · [Platform Economy Phase 2](#platform-economy-phase-2)

---

<!-- Legacy duplicate header removed — see Release Readiness REL-F-02 -->

## TLV Pricing & Business Model v1

**前提:** AD-014 · [MONETIZATION.md](./MONETIZATION.md) · [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) · [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md)  
**種別:** 設計確定事項 + 料金設計 · 収益設計 — **数値は Financial Model 完成まで未確定**

### 基本方針（採用済み）

- [x] Profit First（利益先行設計）
- [x] プラットフォームが赤字にならない設計
- [x] Net Revenue を基準に利益 · 還元を計算する
- [x] 利益を生み出した Creator へ最大還元する
- [x] 条件達成者には 90〜95% 還元も可能な設計
- [x] ライブ · 動画 · ショートを別 PL で管理する
- [x] Web 決済を基本とした料金設計
- [x] Apple / Google 決済は別価格で設計する

### ライブ配信

- [x] ライブ 30 分無料を基本仕様とする
- [x] 30 分単位で延長する
- [ ] 延長料金を最終決定する
- [ ] ライブ料金 PL を完成させる
- [ ] 同接 10 · 100 · 1,000 · 10,000 人で利益シミュレーション
- [ ] ライブインフラ原価を最終確定する
- [ ] ライブ料金を正式決定する

### 収益源（採用済み）

#### ★★★★★ — 最優先

- [x] ライブ延長
- [x] 投げ銭
- [x] ギフト

#### ★★★★★ — サブスク

- [x] Viewer サブスク
- [x] Creator サブスク

#### ★★★★☆ — 広告 · 限定コンテンツ

- [x] 動画広告
- [x] ショート広告
- [x] メンバー限定動画
- [x] PPV 動画

#### ★★★★☆ — 企業 · スポンサー

- [x] 企業案件
- [x] タイアップ
- [x] スポンサー

#### ★★★★☆ — マーケットプレイス

- [x] マーケットプレイス
- [x] スタンプ販売
- [x] ギフト販売
- [x] アバター販売
- [x] エフェクト販売

### 料金設計（数値確定待ち）

- [ ] Web コイン価格
- [ ] アプリコイン価格
- [ ] ライブ延長料金
- [ ] Viewer サブスク料金
- [ ] Creator サブスク料金
- [ ] 動画プラン料金
- [ ] ショートプラン料金
- [ ] PPV 料金
- [ ] オプション料金

**採用候補（案 · 未確定）:** 延長 30 分 500 コイン案 · 初回無料 100 コイン案 · コイン販売価格 · 投げ銭アイテム価格 · Web / アプリ決済最終料金

### Creator 還元設計（数値確定待ち）

- [ ] Creator Score 設計
- [ ] Creator Rank 設計
- [ ] Creator Pool 設計
- [ ] 90% 還元条件
- [ ] 95% 還元条件

### 動画 · ショート · オプション（詳細 PL · 料金設計）

- [ ] 通常動画 PL 設計 · ショート動画 PL 設計
- [ ] 保存 · CDN · AI · API コスト算出
- [ ] 無料 / 有料 / クリエイタープラン仕様決定
- [ ] オプション — AI 字幕 · AI 翻訳 · 高画質 · 長期アーカイブ · 大容量アップロード · ダウンロード · メンバー限定 · 限定公開 · 広告なし · 高度分析 · その他

### Financial Model

- [ ] 利益率 10% モデル
- [ ] 利益率 15% モデル
- [ ] 利益率 20% モデル
- [ ] 利益率 25% モデル
- [ ] 財務モデル（PL）完成
- [ ] Pricing v1 完成

### 重要 — 無料 · 有料の線引き

YouTube で無料提供されている機能は **基本無料** とする。

**料金を取る基本領域:**

- ライブ延長
- 投げ銭 · ギフト
- サブスク
- PPV
- 企業向けサービス
- マーケットプレイス
- 独自機能

動画 · ライブ · ショートは **YouTube と同じ感覚で利用できる** ことを前提とし、その上で **独自価値** によって収益化する。

**注意:** 現在は料金を確定しない。市場調査 · インフラコスト · PL シミュレーションを基に、**利益を最優先**とした料金体系を確定する。

---

## Creator Economy v1

**前提:** [DECISIONS.md](./DECISIONS.md) **AD-014** · [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) · [MONETIZATION.md](./MONETIZATION.md)  
**種別:** Creator 制度設計 — **実装未着手 · 数値未確定**

### Creator Score

- [ ] Creator Score 1000 点制度を設計する
- [ ] 財務スコアを設計する
- [ ] エンゲージメントスコアを設計する
- [ ] 健全性（Trust）スコアを設計する
- [ ] 成長（Growth）スコアを設計する
- [ ] 最終 Creator Score 算出ロジックを完成させる

### Creator Rank

| ティア | 昇格 | 維持 | 降格 |
| --- | --- | --- | --- |
| Bronze | [ ] | [ ] | [ ] |
| Silver | [ ] | [ ] | [ ] |
| Gold | [ ] | [ ] | [ ] |
| Platinum | [ ] | [ ] | [ ] |
| Diamond | [ ] | [ ] | [ ] |
| Legend | [ ] | [ ] | [ ] |

- [ ] 6 ティア昇格条件の設計
- [ ] 6 ティア維持条件の設計
- [ ] 6 ティア降格条件の設計

### Creator 還元

- [ ] Creator Pool 設計
- [ ] Net Revenue ベース還元
- [ ] 利益貢献ベース還元
- [ ] Creator Score 連動還元
- [ ] Creator Rank 連動還元
- [ ] 90% 還元条件
- [ ] 95% 還元条件

### Profit First

- [ ] Profit First ロジック完成
- [ ] 利益率管理
- [ ] Net Revenue 管理
- [ ] Creator Pool 管理
- [ ] PL 管理

### Financial

- [ ] Web 決済比率評価
- [ ] ARPPU 評価
- [ ] 課金率評価
- [ ] リピーター評価
- [ ] 視聴維持率評価

### Trust & Safety

- [ ] 本人確認制度
- [ ] 通報評価
- [ ] BAN 評価
- [ ] 著作権評価
- [ ] BOT 対策
- [ ] 自己投げ銭対策
- [ ] 複数アカウント対策
- [ ] チャージバック対策
- [ ] マネーロンダリング対策

### 最終制度設計

- [ ] Creator Economy v1 完成
- [ ] Creator Program 完成
- [ ] Financial Model 完成
- [ ] Pricing Model 完成
- [ ] 還元制度完成

### 設計方針

- Profit First を最優先とする
- プラットフォームが赤字にならないことを最優先とする
- 利益を生み出したクリエイターへ最大還元する
- 90〜95% 還元は **条件達成者のみ** とする
- 還元率は Gross ではなく **Net Revenue** を基準とする
- **長期運営（10 年以上）** を前提とした制度設計とする

---

## Platform Economy Phase 2

**前提:** [DECISIONS.md](./DECISIONS.md) **AD-014** · [Creator Economy v1](#creator-economy-v1) · [TLV Pricing & Business Model v1](#tlv-pricing--business-model-v1)  
**種別:** TLV Platform 設計バックログ — **設計のみ · 実装未着手**

### TLV Payment Engine（**Development Complete** · **Phase 1 実装停止** · Release Operations · 2026-06-28）

**正本:** [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) v1.7 · [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) · [reports/tlv-payment-production-readiness.md](../reports/tlv-payment-production-readiness.md) · [reports/tlv-phase1-completion-gate.md](../reports/tlv-phase1-completion-gate.md)

**開発・設計・実装・監査フェーズ:** **完了** — [Final Audit](../reports/payment-production-final-audit.md) · Go Readiness Final Review · [Release Execution](../reports/tlv-phase1-production-execution.md) · [Completion Gate](../reports/tlv-phase1-completion-gate.md)

| 結論 | 内容 |
| --- | --- |
| 実装 Blocker | **0** — **技術的ブロッカー解消済** |
| SQL / RPC / Migration / 設計変更 | **不要 · 着手禁止** |
| Phase 1 実装作業 | **停止（2026-06-28）** — 運用ゲートのみ |
| Production Go を止める要因 | **運用ゲートのみ**（Backup Dashboard · Stripe · Live smoke · Go Approval） |
| Phase 2 / Live / Wallet↔Live / Chat / Moderation | **Complete まで着手禁止** |

**以降の方針（凍結）:** 新たな設計レビュー · 改善提案 · リファクタリング · **TODO 追加は行わない**。追加レビューは **Production リリース後**に障害 · 不具合 · 性能 · 運用課題が発生した場合のみ。実施は **Runbook オペレーションのみ**（deploy / migration / コード修正は Runbook 手順・障害対応時のみ）。

| フェーズ | 状態 |
| --- | --- |
| P0 実装（purchase · tip · chargeback · RLS） | **完了** |
| Staging 検証 | **全スイート PASS** |
| Production Readiness Review | **確定** — [runbook](../reports/tlv-payment-production-readiness.md) |
| Migration Recovery | **P1+P2 完了** — [recovery plan](../reports/tlv-payment-migration-recovery-plan.md) · git `dded4b4` |
| Release Verification RV1 | **2026-06-28 · No-Go** — [RV1 report](../reports/tlv-payment-release-verification.md) |
| Release Verification RV2 | **2026-06-28 · No-Go** — [RV2 report](../reports/tlv-payment-release-verification-rv2.md) · PostgREST 404 誤解解消 · **webhook Edge drift 確定** · TODO-PROD **0/7 READY** |
| Release Verification RV3 | **2026-06-28 · No-Go** — [RV3 release plan](../reports/tlv-payment-release-plan-rv3.md) · webhook drift **実コード確認** · **PITR false** · Stripe Dashboard 未確認 |
| FINAL PRE-FLIGHT | **2026-06-28 · No-Go** — [preflight report](../reports/payment-production-final-preflight.md) · deploy plan 確定（webhook のみ）· Checklist **0/6 READY** |
| Dashboard Verification | **2026-06-28 · NOT READY** — [dashboard verification](../reports/payment-production-dashboard-verification.md) · Backup PITR false · Stripe 未確認 |
| Final Audit | **2026-06-28 · NO-GO（運用）** — [final audit](../reports/payment-production-final-audit.md) · 実装 Blocker **0** · 運用 Blocker **6** |
| Go Readiness Final Review | **2026-06-28** — 実装 **READY WITH OPERATIONS** · Production Go **NO-GO** |
| Release Execution | **2026-06-28 · Step 0-4** — [execution log](../reports/payment-production-release-execution.md) · Step 1-3 FAIL · Go Approval **No-Go** |
| Lock Order 監査 | **2026-06-28 完了** — [PAYMENT_ENGINE.md](../docs/PAYMENT_ENGINE.md) · [lock order review](../reports/payment-lock-order-review.md) |
| **Release Operations** | **Paused** — 運用ゲート待ち · [Completion Gate §11](../reports/tlv-phase1-completion-gate.md#11-phase-1-停止--再開条件正本) |
| **Phase 1 Completion Gate** | **2026-06-28** — 技術 PASS · Complete **No-Go**（運用のみ）· 実装 **停止** |

| ID | 内容 | 判断 | 状態 |
| --- | --- | --- | --- |
| ~~CAND-W1~~ | payer_user_uuid 整合 | **解消済み** | 完了 |
| ~~CAND-P2-01~~ | createTip 単一 TX RPC 化 | **解消済み** — `tlv.create_tip_transaction` | v1.2.5 |
| ~~W1-GAP-01~~ | Webhook metadata uuid coalesce | **解消済み** — `payer_user_uuid \|\| wallet_user_id` | v1.2.5 |
| CAND-P2-02 | IAP webhook | Needs Decision | 未実装 |
| CAND-P2-05 | bot_flag 単独時の gauge 抑止 | Needs Decision | RPC `v_apply_gauge` が `p_bot_flag` 未参照 · staging T-TIP-07 要確認 |
| ~~CAND-P2-03~~ | auth uuid ↔ wallet | **解消済み** | 完了 |
| CAND-W2 | `public.users.id` text と Platform 全体 ID 統一 | **別タスク維持** | 未着手 |
| ~~DEV-01~~ | createTip 非原子性 | **解消** — RPC 単一 TX | v1.2.5 |
| ~~DEV-02~~ | 同時 tip race | **解消** — FOR UPDATE | v1.2.5 |
| ~~DEV-03~~ | extension §3.4 grant ガード | **解消** — RPC 内 | v1.2.5 |
| ~~DEV-04~~ | createTip INSERT error チェック | **解消** — TX rollback | v1.2.5 |
| DEV-05 | extension_contributors 完全仕様 | TODO候補 | RPC は first-payer カウント実装済 |
| DEV-07 | self_gift text のみ比較 | TODO候補 | 未変更 |
| TODO-06 | chargeback / clawback | **実装完了 · linked DB 適用済 · registry 未登録** | [design](../reports/tlv-payment-chargeback-clawback-design.md) · [implementation](../reports/tlv-payment-chargeback-clawback-implementation.md) · migration `20260628160000` · T-CB 10/10 PASS |
| TODO-07 | RLS ポリシー | **linked DB 適用済 · 20 policies · registry 未登録** | [reports/tlv-payment-rls-staging-test.md](../reports/tlv-payment-rls-staging-test.md) · migration `20260628150000` |
| ~~TODO-RLS-02~~ | staging 手動 GRANT revoke | **解消済** | migration `20260628150000` — `REVOKE EXECUTE … FROM anon, authenticated` · anon `USAGE` revoke |
| TODO-RLS-03 | Admin JWT E2E（`talk_is_admin` / `is_ops`） | **候補** | `tlv_admin` 新設 **不要/保留** · 既存 hook + `talk_is_admin()` 再利用 · admin SELECT Policy 未 E2E |

**Phase 2 staging Go/No-Go:** **Go** — 全スイート PASS（logic 26 · RPC 19 · RLS 30 · CB 10 · edge）。  
**Phase 1 Complete / Phase 2 本番 Go:** **No-Go** — 運用ゲート pending · 実装停止 · [completion gate](../reports/tlv-phase1-completion-gate.md)

**Release Operations 残（Runbook 正本 · コード変更禁止）:** ① Backup Dashboard ② snapshot 日時 ③ Stripe 7 events（§2.4 正本 · `refund.updated` 必須）④ test delivery ⑤ Live smoke ⑥ Go Approval ⑦ 24h 監視

**PRE-FLIGHT Blocker（運用 · P0）:** snapshot 日時未記録 · Stripe 7 events **Dashboard 未確認** · PS-M Live 手動未 PASS · Go Approval なし · **`STRIPE_WEBHOOK_SECRET_TLV` 未分離（推奨）**

**解消済（技術）:** fingerprint 7/7 · migration apply 0 · Edge v4 deploy · PS-01〜05 自動 PASS · FinOps Runbook

**Lock Order（監査完了 · 開発凍結）:** [PAYMENT_ENGINE.md](../docs/PAYMENT_ENGINE.md) · [review](../reports/payment-lock-order-review.md) — Production Go 追加 blocker なし · TODO-LOCK-* は **開発凍結**（障害発生時のみ再開）

**Production Release 手順:** [reports/tlv-payment-production-readiness.md §6](../reports/tlv-payment-production-readiness.md#6-production-release-手順確定版) · [execution log](../reports/payment-production-release-execution.md)

#### Release Operations チェックリスト（Runbook 参照 · 開発 TODO 追加禁止 · 実装停止中）

- [ ] Backup Dashboard 目視 · snapshot 日時記録 · rollback 確認
- [ ] PITR 方針確認（WAL-G-only · false 継続 · 文書化済）
- [ ] Stripe Dashboard — endpoint · **§2.4 正本 7 events**（`checkout.session.*` **不要** · `refund.updated` **必須**）· test delivery
- [ ] `STRIPE_WEBHOOK_SECRET_TLV` 分離（推奨）
- [ ] Go Approval
- [x] `tlv-payment-webhook` deploy（v4 · 2026-06-28 execution）
- [x] PS-02〜05 自動（Gate 再実行 PASS）
- [ ] PS-M01 · M03 · M04 · M06 · M07 Live 手動
- [ ] Production Go 宣言 · 24h 監視

**実装済 Edge Functions:** `tlv-create-coin-purchase` · `tlv-payment-webhook` · `tlv-create-tip` · `tlv-e2e-simulate-payment`（prod 非推奨）

### Membership / Subscription（Future · 2026-06-28）

**正本:** [reports/tlv-membership-design.md](../reports/tlv-membership-design.md) · [TLV_PRD.md](./TLV_PRD.md) §11 · [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) §14

**種別:** **Future · 未着手** — 設計バックログのみ · Payment Engine Phase 2 とは **分離**  
**CAND-MEM-01:** Membership Subscription 追加設計 — **採用 · 設計追加済**（[reports/tlv-membership-design.md](../reports/tlv-membership-design.md)）

**分離原則:** UX は Tip と連動表示可 · 会計/DB/Ledger は完全分離 · サブスクは coin 消費しない · 初期 MVP = Web Stripe Billing · Score / 90/95% 制度 **変更なし**

#### Priority P1 — 設計必須

- [ ] **TODO-MEM-01** Membership Tier 仕様確定 — **Future · 未着手**
  - Platform 固定価格 Tier
  - Tier 数
  - 特典範囲
  - Creator 編集可能項目

- [ ] **TODO-MEM-02** Subscription Profit Contribution 設計 — **Future · 未着手**
  - Creator Score 反映係数
  - PPC への反映方式
  - Legend 条件への影響
  - PL シミュレーション

- [ ] **TODO-MEM-03** Membership Payment Engine 設計 — **Future · 未着手**
  - Stripe Billing
  - Webhook
  - Invoice
  - Revenue Ledger
  - Creator Payable

- [ ] **TODO-MEM-04** Membership DB 設計 — **Future · 未着手**
  - `membership_tiers`
  - `user_subscriptions`
  - `subscription_invoices`
  - `membership_events`

#### Priority P2 — 実装前

- [ ] **TODO-MEM-05** Web / App 価格設計 — **Future · 未着手**
  - Stripe
  - Apple
  - Google
  - 価格差方針

- [ ] **TODO-MEM-06** Membership Revenue Ledger 設計 — **Future · 未着手**
  - `entry_type`
  - Creator Payable
  - Platform Profit
  - Ledger 整合

- [ ] **TODO-MEM-07** Membership Webhook 一覧確定 — **Future · 未着手**
  - `subscription.created`
  - `updated`
  - `deleted`
  - `invoice.paid`
  - `payment_failed`
  - `refund`
  - `dispute`

- [ ] **TODO-MEM-08** Grace Period 設計 — **Future · 未着手**
  - `payment_failed`
  - 猶予日数
  - 権利維持期間

- [ ] **TODO-MEM-09** Refund / Chargeback / Clawback 設計 — **Future · 未着手**
  - Revenue Ledger
  - Creator 控除
  - Profit First 整合

#### Priority P3 — UX

- [ ] **TODO-MEM-10** Membership 特典設計 — **Future · 未着手**
  - バッジ
  - スタンプ
  - 限定チャット
  - 称号
  - プロフィール装飾

- [ ] **TODO-MEM-11** Creator Club 画面設計 — **Future · 未着手**
  - Tier 管理
  - 特典管理
  - 会員一覧
  - 売上確認

- [ ] **TODO-MEM-12** Viewer Membership 画面設計 — **Future · 未着手**
  - 加入
  - 更新
  - 解約
  - 特典表示

- [ ] **TODO-MEM-13** Membership バッジ · 称号仕様 — **Future · 未着手**

#### Priority P4 — 将来

- [ ] **TODO-MEM-14** Monthly Coin Grant 設計 — **Future · 未着手**
  - Wallet Grant
  - `wallet_ledger` 記録

- [ ] **TODO-MEM-15** Membership 限定 Gift 設計 — **Future · 未着手**

- [ ] **TODO-MEM-16** Membership イベント設計 — **Future · 未着手**
  - `membership_events`
  - `stream_events` との責務分離

- [ ] **TODO-MEM-17** Platform 固定 Tier 価格見直し — **Future · 未着手**

#### 保留 — 設計検証後

- [ ] **TODO-MEM-18** Membership 利益を Legend 条件へどこまで反映するか — **Future · 保留**
- [ ] **TODO-MEM-19** Membership による Gauge 支援の可否 — **Future · 保留**
- [ ] **TODO-MEM-20** Passive VIP 導入可否 — **Future · 保留**

### Live Chat System（Future · 2026-06-28）

**種別:** **Future · 未着手** — 設計バックログのみ · **Payment Engine / Membership 実装とは分離**

**CAND-CHAT-01:** Live Chat System 設計採用 — **Future · 未着手**

**参照:** TLV ライブ配信 · 30分サバイバル · Payment Engine とは **別システム**

**分離原則:** Wallet 処理なし · Coin 消費は Payment Engine 経由のみ · リアルタイム表示専用 · 投げ銭イベントは `stream_events` 経由で表示 · 将来 AI 機能を追加可能な設計 · YouTube 風 UI を参考に TLV 独自（延長ゲージ · 投げ銭強調 · ランク表示）を追加

#### Priority P1 — MVP

- [ ] **TODO-CHAT-01** リアルタイムライブチャット設計 — **Future · 未着手**

- [ ] **TODO-CHAT-02** トップチャット / 全チャット切替 — **Future · 未着手**

- [ ] **TODO-CHAT-03** モデレーター機能 — **Future · 未着手**
  - ピン留め
  - メッセージ削除
  - タイムアウト
  - BAN

- [ ] **TODO-CHAT-04** NGワード · スパム対策 — **Future · 未着手**

- [ ] **TODO-CHAT-05** 返信 · メンション機能 — **Future · 未着手**

- [ ] **TODO-CHAT-06** 絵文字 · リアクション機能 — **Future · 未着手**

#### Priority P2

- [ ] **TODO-CHAT-07** 投げ銭メッセージ強調表示 — **Future · 未着手**

- [ ] **TODO-CHAT-08** 延長ゲージ連携 — **Future · 未着手**
  - あと○Coin 表示
  - 延長通知

- [ ] **TODO-CHAT-09** ライブランキング表示 — **Future · 未着手**
  - 今日のギフター
  - ライブ中ランキング

- [ ] **TODO-CHAT-10** メンバー限定チャット — **Future · 未着手**

- [ ] **TODO-CHAT-11** Creator / Rank / Membership バッジ表示 — **Future · 未着手**

#### Priority P3 — AI

- [ ] **TODO-CHAT-12** AI翻訳 — **Future · 未着手**
  - 日本語 · 英語 · 韓国語 · その他

- [ ] **TODO-CHAT-13** AIチャット要約 — **Future · 未着手**

- [ ] **TODO-CHAT-14** AIモデレーター — **Future · 未着手**

- [ ] **TODO-CHAT-15** AIハイライト生成 — **Future · 未着手**

#### Priority P4

- [ ] **TODO-CHAT-16** チャット検索 — **Future · 未着手**

- [ ] **TODO-CHAT-17** お気に入りメッセージ — **Future · 未着手**

- [ ] **TODO-CHAT-18** チャット履歴 — **Future · 未着手**

- [ ] **TODO-CHAT-19** チャット分析 — **Future · 未着手**
  - 同時接続
  - 投稿数
  - アクティブ率

- [ ] **TODO-CHAT-20** ライブチャット API · DB 設計 — **Future · 未着手**

### Future Platform Systems（Future · 2026-06-28）

**種別:** **Future · 未着手** — 設計バックログのみ · **Payment Engine / Membership / Live Chat 実装とは分離**

**CAND-PLATFORM-01:** Platform Systems 設計採用 — **Future · 未着手**

**目的:** Payment Engine · Membership · Live Chat の後に実装する基盤システムを管理する。

**設計メモ:**

- すべて Future 扱い
- Payment Engine とは責務を分離
- Membership とは責務を分離
- Live Chat とは責務を分離
- AI は各システムへ後付け可能な構成
- 通知はイベント駆動（Event Driven）を前提
- Dashboard は集計専用
- Moderation は監査ログを必須とする

#### Notification System

##### Priority P1

- [ ] **TODO-NOTIFY-01** 通知システム設計 — **Future · 未着手**

- [ ] **TODO-NOTIFY-02** ライブ開始通知 — **Future · 未着手**

- [ ] **TODO-NOTIFY-03** メンバーシップ通知 — **Future · 未着手**

- [ ] **TODO-NOTIFY-04** 投げ銭通知 — **Future · 未着手**

- [ ] **TODO-NOTIFY-05** Creator 通知 — **Future · 未着手**

##### Priority P2

- [ ] **TODO-NOTIFY-06** Push Notification — **Future · 未着手**

- [ ] **TODO-NOTIFY-07** メール通知 — **Future · 未着手**

- [ ] **TODO-NOTIFY-08** アプリ通知 — **Future · 未着手**

- [ ] **TODO-NOTIFY-09** 通知設定画面 — **Future · 未着手**

- [ ] **TODO-NOTIFY-10** 通知 API 設計 — **Future · 未着手**

#### Creator Dashboard

##### Priority P1

- [ ] **TODO-DASH-01** Creator Dashboard 設計 — **Future · 未着手**

- [ ] **TODO-DASH-02** 売上分析 — **Future · 未着手**

- [ ] **TODO-DASH-03** 投げ銭分析 — **Future · 未着手**

- [ ] **TODO-DASH-04** メンバー分析 — **Future · 未着手**

- [ ] **TODO-DASH-05** Creator Score 分析 — **Future · 未着手**

##### Priority P2

- [ ] **TODO-DASH-06** 視聴者分析 — **Future · 未着手**

- [ ] **TODO-DASH-07** 配信分析 — **Future · 未着手**

- [ ] **TODO-DASH-08** ランキング分析 — **Future · 未着手**

- [ ] **TODO-DASH-09** 収益予測 — **Future · 未着手**

- [ ] **TODO-DASH-10** Dashboard API 設計 — **Future · 未着手**

#### Moderation System

##### Priority P1

- [ ] **TODO-MOD-01** モデレーション設計 — **Future · 未着手**

- [ ] **TODO-MOD-02** 通報システム — **Future · 未着手**

- [ ] **TODO-MOD-03** BAN — **Future · 未着手**

- [ ] **TODO-MOD-04** タイムアウト — **Future · 未着手**

- [ ] **TODO-MOD-05** NG ワード管理 — **Future · 未着手**

##### Priority P2

- [ ] **TODO-MOD-06** Shadow Ban — **Future · 未着手**

- [ ] **TODO-MOD-07** AI モデレーター — **Future · 未着手**

- [ ] **TODO-MOD-08** AI スパム検知 — **Future · 未着手**

- [ ] **TODO-MOD-09** 管理ダッシュボード — **Future · 未着手**

- [ ] **TODO-MOD-10** 監査ログ — **Future · 未着手**

### Creator Economy

- [ ] Creator Score v1 完成
- [ ] Creator Rank v1 完成
- [ ] Creator Program v1 完成
- [ ] Profit First 完成
- [ ] Financial Model 完成
- [ ] Pricing Model 完成
- [ ] Creator Pool 完成
- [ ] 90% 還元条件 完成
- [ ] 95% 還元条件 完成

### Event System

- [ ] 年間イベント設計
- [ ] 陣取りイベント
- [ ] 季節イベント
- [ ] 推し活イベント
- [ ] ルーキーイベント
- [ ] サバイバルフェス
- [ ] イベント報酬設計
- [ ] デジタル報酬設計
- [ ] イベント KPI 設計

### Creator Dashboard

- [ ] Creator Dashboard 設計
- [ ] Creator Score 表示
- [ ] Creator Rank 表示
- [ ] Creator Progress 表示
- [ ] Creator 収益分析
- [ ] Creator 利益分析
- [ ] Creator 還元分析
- [ ] Creator 目標表示

### Viewer System

- [ ] Viewer Progress
- [ ] 推し活システム
- [ ] エンジェルサポーター制度（**保留**）
- [ ] VIP 制度
- [ ] メンバーシップ → [Membership / Subscription](#membership--subscription-future--2026-06-28)（TODO-MEM-01〜20 · Future）
- [ ] ライブチャット → [Live Chat System](#live-chat-systemfuture--2026-06-28)（TODO-CHAT-01〜20 · Future）
- [ ] デジタルバッジ
- [ ] デジタル称号
- [ ] プロフィールカスタマイズ
- [ ] 限定エフェクト

### AI System

- [ ] Creator AI
- [ ] Viewer AI
- [ ] Admin AI
- [ ] Creator AI アドバイス
- [ ] Viewer おすすめ AI
- [ ] Admin 利益分析 AI
- [ ] AI 異常検知
- [ ] AI リテンション分析

**注:** TLV 専用 AI エンジンは作らない（AD-004）— TASFUL AI 入口経由で設計する。

### Admin Console

- [ ] Executive Dashboard
- [ ] FinOps Console
- [ ] Creator CRM
- [ ] Trust & Safety
- [ ] CDN 監視
- [ ] 決済管理
- [ ] Creator 還元管理
- [ ] Event 管理
- [ ] 広告管理

### Security

- [ ] BOT 対策
- [ ] 自己投げ銭対策
- [ ] マネロン対策
- [ ] チャージバック対策
- [ ] 不正決済対策
- [ ] AI 不正検知
- [ ] 本人確認
- [ ] Trust Score

### Business

- [ ] MCN / Agency 制度（**保留**）
- [ ] Channel M&A（**保留**）
- [ ] エコクレジット（**保留**）
- [ ] Marketplace 設計
- [ ] B2B スポンサー制度
- [ ] 企業案件マッチング

### KPI

- [ ] DAU
- [ ] MAU
- [ ] 課金率
- [ ] ARPU
- [ ] ARPPU
- [ ] LTV
- [ ] CAC
- [ ] Creator Retention
- [ ] Viewer Retention
- [ ] Web 決済率
- [ ] Profit 率
- [ ] Creator Pool
- [ ] Platform Profit

### 運営方針

- Profit First を最優先とする
- プラットフォームが赤字にならないことを最優先とする
- 利益を生み出したクリエイターへ最大還元する
- 還元率は Gross ではなく **Net Revenue** 基準とする
- 90〜95% 還元は **条件達成者のみ** 適用する
- 初心者でも成長できる制度設計を維持する
- 課金額だけではなく、利益 · 継続 · 健全性 · コミュニティ貢献を評価する
- 石油王だけが勝つ設計にはしない
- **長期（10 年以上）** 運営できる制度を前提とする

---

## Creator Economy - Numeric Design（**Deprecated 候補 · 重複** · AD-014）

> **Release 分類:** **REL-F-02 Future** · 正本は [Creator Economy v1](#creator-economy-v1) + [TLV Pricing](#tlv-pricing--business-model-v1)。本セクションは詳細チェックリストとして残置 · 新規参照は非推奨。

**前提:** [DECISIONS.md](./DECISIONS.md) **AD-014** 確定済 · Live Platform Vision 設計 Done  
**種別:** 制度設計タスクのみ — **実装禁止**  
**注:** 数値は **Future** · コスト試算 · PL 確定後に正式決定。

### Legacy P0 ラベル — 制度設計（未着手 · Future）

#### Creator Score

- [ ] 評価項目設計
- [ ] 重み付け
- [ ] 利益貢献度
- [ ] Trust
- [ ] Growth
- [ ] Community
- [ ] 継続率
- [ ] 最終スコア計算式

#### Creator Rank

| ティア | 設計項目 |
| --- | --- |
| Bronze | 昇格条件 · 維持条件 · 降格条件 |
| Silver | 同上 |
| Gold | 同上 |
| Platinum | 同上 |
| Diamond | 同上 |

- [ ] 5 ティア昇格条件の草案
- [ ] 5 ティア維持条件の草案
- [ ] 5 ティア降格条件の草案

#### Net Revenue

基準フロー:

```text
Gross Revenue
    ↓
決済手数料
    ↓
Net Revenue
    ↓
Creator 還元
    ↓
Platform 利益
```

- [ ] Gross → Net の控除項目定義
- [ ] Net Revenue 基準の還元計算式（草案）
- [ ] Platform 利益の留保率設計（草案）

#### 還元率

- [ ] 還元率テーブル設計（**数値はまだ固定しない**）
- [ ] コスト試算後の還元率決定フロー定義

#### ライブ

```text
30 分無料
    ↓
延長料金
    ↓
利益シミュレーション
    ↓
最終料金決定
```

- [ ] 30 分無料枠のコスト上限設計
- [ ] 延長料金モデル案
- [ ] 利益シミュレーション前提（同接 · 帯域 · 応援収益）
- [ ] 最終料金決定基準（赤字禁止 · AD-014 整合）

#### Profit & Loss

- [ ] PL 設計 — 以下を数値化
  - [ ] 通常動画
  - [ ] ショート
  - [ ] ライブ
  - [ ] CDN
  - [ ] Storage
  - [ ] エンコード
  - [ ] AI
  - [ ] API
  - [ ] 決済
  - [ ] 広告
  - [ ] サポート
  - [ ] 不正対策

### P1 — 特典 · 視聴者制度設計（未着手）

#### Creator 特典

- [ ] AI 分析
- [ ] AI レポート
- [ ] Creator Dashboard
- [ ] Creator Lab
- [ ] Creator Marketplace

#### Viewer 制度

- [ ] レベル
- [ ] ストリーク
- [ ] バッジ
- [ ] サポーター
- [ ] VIP 制度

### P2 — 利益シミュレーション（未着手）

同時視聴規模別に **売上 · コスト · 利益 · 還元率 · 営業利益** を試算:

- [ ] 10 人同時視聴
- [ ] 100 人同時視聴
- [ ] 1,000 人同時視聴
- [ ] 10,000 人同時視聴

### Future — 2035 年を見据えた制度

- [ ] 利益率自動分析
- [ ] Creator Economy 最適化
- [ ] AI による利益予測
- [ ] 世界対応価格設計
- [ ] 地域別価格最適化

---

## 方針（確定 · 2026-06-26）

### サービス展開方針（2026-06 確定）

**正本:** [DECISIONS.md](./DECISIONS.md) **AD-011** · 要約: [ROADMAP.md](./ROADMAP.md) §サービス展開方針

開発優先順位は **国内完成** を基本とし、海外前提の実装は AD-011 に従い **行わない**（Builder / Platform）または **将来設計のみ**（TLV / TASFUL AI）とする。

### UI/UX 設計原則（2026-06 確定）

**正本:** [DECISIONS.md](./DECISIONS.md) **AD-012** · 要約: [ROADMAP.md](./ROADMAP.md) §UI/UX 設計原則

- **高機能は AI** · **シンプルは UI** — 全製品の画面設計・文言・新機能追加時に適用する。
- 迷った場合は **シンプルな操作** と **分かりやすい言葉** を優先。既存 UI の複雑化を避ける。

### Business Directory — サブスク掲載モデル（2026-06-27 確定）

**正本:** [DECISIONS.md](./DECISIONS.md) **AD-013** · [business-directory-subscription-model.md](./business-directory-subscription-model.md)

- 店舗・販売 / 業務サービス → **月額サブスク掲載**（専用ページ · URL 登録送客 · 簡易 HP）
- Marketplace / Platform 案件 → **成約手数料**（既存方針維持）
- **MVP 設計:** [business-directory-mvp-design.md](./business-directory-mvp-design.md)
- **Self-Service:** [business-directory-self-service-design.md](./business-directory-self-service-design.md)
- **Data Model:** [business-directory-data-model-design.md](./business-directory-data-model-design.md)
- **UI Flow:** [business-directory-ui-flow-design.md](./business-directory-ui-flow-design.md)
- **Phase 1 DB:** migration + seed 追加 · `scripts/test-business-directory-phase1-schema.mjs` — **37/37 PASS**
- **Phase 2 API:** service + Edge + client repository · `scripts/test-business-directory-phase2-api.mjs` — **68/68 PASS**
- **Phase 3 Owner UI:** `business-directory/` · `scripts/test-business-directory-phase3-owner-ui.mjs` — **53/53 PASS**
- **Phase 4 Admin UI:** `business-directory/admin/` · `scripts/test-business-directory-phase4-admin-ui.mjs` — **35/35 PASS**
- **Phase 5 Public UI:** `business-directory/public/` · `scripts/test-business-directory-phase5-public-ui.mjs` — **27/27 PASS**
- **Phase 6 Stripe:** subscription checkout · webhook · plan guard · `scripts/test-business-directory-phase6-stripe.mjs` — **52/52 PASS**
- **Phase 7 Preflight:** build · dist · deploy checklist · `scripts/test-business-directory-phase7-deploy-preflight.mjs` — **74/74 PASS**（Pages preview Go）
- **Production Step 1 DB:** staging migration apply + repair · `scripts/test-business-directory-production-step1-migration.mjs --remote` — **23/23 PASS**
- **Production Step 2 Edge:** staging deploy · secrets · smoke · `scripts/test-business-directory-production-step2-edge.mjs --remote` — **15/15 PASS**
- **Production Step 3 Preview E2E:** Pages preview deploy · mock なし E2E · `scripts/test-business-directory-production-step3-preview-e2e.mjs --e2e` — **15/15 PASS**（Production 本番公開は未実施）
- **Production Step 4 Deploy:** Production Pages deploy · 最終 smoke · `scripts/test-business-directory-production-step4-production.mjs --all` — **48/48 PASS · Go**
- **Step 5 Operational Readiness:** [operational readiness](../reports/business-directory-operational-readiness.md) · **Commercial Launch No-Go**
- **Launch Gate Preparation:** [launch gate prep](../reports/business-directory-launch-gate-prep.md) · OB1–OB8 分類済

### AI プロバイダ分担

| 領域 | 本番 API |
| --- | --- |
| AI 秘書 | **DeepSeek** |
| TASFUL AI | **OpenAI** |
| Builder AI | **OpenAI** |
| Builder AI 将来（Gemini Live 現場診断） | Gemini Live — [builder-ai-gemini-live-field-diagnosis-backlog.md](./builder-ai-gemini-live-field-diagnosis-backlog.md) |

Groq / Cerebras / Claude は **現時点では不要**。

### AI 秘書 — DeepSeek Adapter Phase 1 / OpsContextBuilder Phase 2（P0-3）

| 区分 | 状態 | 根拠 |
| --- | --- | --- |
| **Phase 1 実装** | **完了 · commit 済** | `6c70985` · `reports/secretary-deepseek-adapter-phase1.md` |
| **Phase 2 実装** | **完了 · commit 済** | `840a574` · `reports/secretary-ops-context-builder-phase2.md` |
| **DeepSeek API 到達** | **済** | `configured:true` · 502 `Insufficient Balance` まで（ローカル） |
| **本番 deploy** | **No-Go** | `reports/secretary-deepseek-deploy-triage.md` |

**Phase 1 完了（実装 · `6c70985`）**

- [x] DeepSeek 専用 Adapter + Cloudflare Pages Function（`/api/secretary-deepseek-chat`）
- [x] `admin-ai-secretary-phase2.js` を Gateway から Adapter へ切替（AD-010 · Gateway 非混在）
- [x] `DEEPSEEK_API_KEY` 読み込み（ローカル · リポジトリルート `.env` + Pages Functions 用 `deploy/cloudflare/dist/.dev.vars`）
- [x] DeepSeek API 到達（`configured:true` · 残高不足時 502 `Insufficient Balance` まで確認）
- [x] Secret 未設定時 503 · API エラー時 502 の graceful モックフォールバック
- [x] `npm run build:pages` · browser **12/12** + **8/8** PASS

**Phase 2 完了（実装 · `840a574`）**

- [x] **OpsContextBuilder** — 6 ドメイン正規化 · PII マスク · phase2 `systemPrompt` 注入
- [x] TLV stub · top-N / char budget · intent regex · inbox ID diff
- [x] 単体 **7/7** · **17/17** · E2E **11/11** PASS（file + dev server）
- [x] Gateway / DeepSeek Adapter 契約 **非変更**

**本番 deploy 前残件（未完了 · deploy No-Go）**

- [ ] Cloudflare Pages **Production** Secret `DEEPSEEK_API_KEY`（Encrypted）登録
- [ ] **DeepSeek 残高チャージ**（アカウント側）
- [ ] **HTTP 200** · `usedDeepSeek:true` · assistant text の実応答確認（ローカル / Staging）
- [ ] Production **smoke**（本番 URL · 秘書 1 往復 · 運営コンテキスト付き）
- [x] P0-1 選別コミット完了 — working tree **clean**（2026-06-28 · dist drift 含む）
- [ ] Production **deploy** + **smoke**（HEAD + clean `build:pages` を正とする · 混在 dist 禁止）

- [x] 画面遷移 / 件数 / DB 検索 / フィルターは **プログラム処理のまま**（LLM 不使用）
- 参照: [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) · [DECISIONS.md](./DECISIONS.md) AD-010 · `reports/secretary-deepseek-deploy-triage.md`

### AI 秘書 — Operations Orchestrator + Google Workspace（commit 済 · KI-008 解消）

| 区分 | 状態 | 根拠 |
| --- | --- | --- |
| **Phase 5-A/B/C** | **完了 · commit 済** | `025e685` · `reports/secretary-orchestrator-phase5a/b/c.md` |
| **Google 6-B〜6-H** | **完了 · commit 済** | `67ec43a`〜`8ca7b7f` 系 |
| **Google 7-A/B** | **完了 · commit 済** | `2af444a` · `aa209d2` |
| **KI-008** | **解消** | `admin-ai-secretary-*` git 追跡済 · P0-1 後 clean |

**完了（commit 済）**

- [x] Phase 5-A — Registry · Classifier · Human Gate · Task Queue · phase2
- [x] Phase 5-B — OpsEvent · HSG · CI ingest · 朝レポート · DeepSeek 分類
- [x] Phase 5-C — Command Center UI · フィルタ · L3/L4 パネル · 朝レポート UI
- [x] Google 6-A〜6-H — OAuth · Gmail / Calendar / Contacts / Drive
- [x] Google 7-A/B — Workspace Orchestrator · Activity / Audit Log
- [x] `test-secretary-orchestrator-phase5a/b/c.mjs` PASS

**次の優先順位（開発再開）**

- [ ] **P0 本番接続 smoke** — DeepSeek + Google OAuth（Secret · 残高 · HTTP 200 · prod 1 往復）
- [ ] **Phase 5 残** — Agent Task 票 UI（Cursor 用 Markdown）
- [ ] **Workflow 定義** — `wf_*` チェーン最小セット
- [ ] **Phase 6** — Agent Routing（Cursor SDK · stub 置換）
- [ ] **Phase 7** — Command Center 完成（Automation 統合 · CI dist 同梱検討）
- [ ] **Phase 8** — Memory / History（phase3/4/5/8 · Queue 永続化）

**参照:** `reports/ai-secretary-current-status-after-p0-1.md` · `reports/secretary-google-phase6b-oauth-token-vault.md` · `reports/secretary-google-phase7b-workspace-activity.md`

---

## Backlog（将来実装 · P0/P1 優先度外）

**注:** 以下は実装予定の記録のみ。**Platform Critical / UI 修正の優先順位は変更しない。**

| 項目 | 状態 | 参照 |
| --- | --- | --- |
| **Platform Coupon System** | 📋 未着手 | [platform-coupon-system-backlog.md](./platform-coupon-system-backlog.md) |
| **AI Secretary Trend Scout** | 📋 未着手 | [ai-secretary-trend-scout-backlog.md](./ai-secretary-trend-scout-backlog.md) |
| **TASFUL Site Assistant Phase 1** | ✅ commit 済 | `ac864b4` · [tasful-site-assistant-backlog.md](./tasful-site-assistant-backlog.md) · `reports/tasful-site-assistant-phase1.md` |
| **TASFUL Site Assistant Phase 2+** | 📋 未着手 | 同上（Feedback Launcher · OPS 集約） |
| **Builder AI Tool Integration Phase 3** | ✅ commit 済 | `05c32ad` · [BUILDER_AI.md](./AI/BUILDER_AI.md) · `reports/builder-ai-tools-phase3.md` |
| **Builder AI Vision Phase 2** | ✅ commit 済 | `4aff9ec` · `reports/builder-ai-vision-phase2.md` |
| **Builder AI Live Phase 4-A** | ✅ commit 済 | `66051f7` · [BUILDER_AI.md](./AI/BUILDER_AI.md) · `reports/builder-ai-live-phase4-plan.md` |
| **Builder AI Vision Phase 5** | ✅ commit 済 | `7ef4efd` · `reports/builder-ai-phase5-vision.md` |
| **Builder Project Hub Phase 6-A** | ✅ commit 済 | `46c5e02` · `reports/builder-project-hub-phase6a.md` |
| **Builder Project Calendar Phase 6-B** | ✅ commit 済 | `556f315` · `reports/builder-project-calendar-phase6b.md` |
| **Builder Project Finance Phase 6-C** | ✅ commit 済 | `e70d679` · `reports/builder-project-finance-phase6c.md` |
| **Builder Estimate/Invoice Phase 6-D** | ✅ commit 済 | `8be158f` · `reports/builder-estimate-invoice-phase6d.md` |
| **Builder Contract/Completion Phase 6-E** | ✅ commit 済 | `ac385c6` · `reports/builder-contract-completion-phase6e.md` |
| **Builder Document Center Phase 6-F** | ✅ commit 済 | `549e562` · `reports/builder-document-center-phase6f.md` |
| **Builder Notification Center Phase 6-G** | ✅ commit 済 | `74d54b8` · `reports/builder-notification-center-phase6g.md` |
| **Builder Command Dashboard Phase 6-H** | ✅ 実装 · 未コミット | `reports/builder-dashboard-phase6h.md` |
| **Builder AI Gemini Live Phase 4-B** | 📋 未着手 | [builder-ai-gemini-live-field-diagnosis-backlog.md](./builder-ai-gemini-live-field-diagnosis-backlog.md) |
| **Builder AI 条件検索** | P0 ✅ · P1 ✅ · P2 📋 | [BUILDER_AI_CONDITIONAL_SEARCH.md](./AI/BUILDER_AI_CONDITIONAL_SEARCH.md) · `builder-search-repository.js` |
| **Builder Monetization / Contact Reveal** | 📋 設計 Draft | [BUILDER_MONETIZATION.md](./AI/BUILDER_MONETIZATION.md) · 検索無料 · 連絡先開示都度 · AI サブスク分離 |
| **Builder Provider Listing / Sponsored** | 📋 設計 Draft | [BUILDER_PROVIDER_LISTING.md](./AI/BUILDER_PROVIDER_LISTING.md) · 無料掲載 · Boost · deterministic ランキング |
| **Builder Credits（Future）** | 📋 設計 Draft | [BUILDER_CREDITS.md](./AI/BUILDER_CREDITS.md) · Builder 専用 Wallet · 他 Wallet 非統合 |

**Builder Monetization Backlog（設計 Draft · 未実装）**

- 正本: [BUILDER_MONETIZATION.md](./AI/BUILDER_MONETIZATION.md) · レポート: [reports/builder-monetization-design.md](../reports/builder-monetization-design.md)
- **M0** Stripe Product SKU（Reveal 単品/パック · Builder Pro/Business）
- **M1** `contact_reveals` migration · RLS · `UNIQUE(user_id, target_type, target_id)`
- **M2** Checkout + webhook · `payment_id` 紐付け
- **M3** プロフィール reveal CTA · 既開示再閲覧無料 UI
- **M4** Builder AI サブスク entitlements（AI gate 分離）
- **M5** パック残数 · 返金/revoke 運営ツール
- **禁止:** 検索/プロフィール有料壁 · メッセージ従量 · AI Membership 統合 · サブスク必須

**Builder Provider Listing Backlog（設計 Draft · 未実装）**

- 正本: [BUILDER_PROVIDER_LISTING.md](./AI/BUILDER_PROVIDER_LISTING.md) · レポート: [reports/builder-provider-listing-design.md](../reports/builder-provider-listing-design.md)
- **L0** SKU · Sponsored 表示ガイドライン · organic/sponsored 比率
- **L1** `provider_profiles` · `contact_private` 分離 · RLS
- **L2** 掲載者プロフィール CRUD UI（Free Listing）
- **L3** `provider_listing_plans` · `provider_boosts` · Stripe サブスク
- **L4** 検索パイプライン boost merge · Sponsored ラベル UI
- **L5** `provider_stats_daily` · `search_result_impressions` · 掲載者ダッシュボード
- **L6** Sponsored TOP 地域枠 · Enterprise
- **禁止:** 金払い順固定 · Sponsored 非表示 · LLM ランキング · 連絡先無料公開 · Reveal/Boost 混同

**Builder Credits Backlog（Future Draft · 未実装）**

- 正本: [BUILDER_CREDITS.md](./AI/BUILDER_CREDITS.md) · レポート: [reports/builder-credits-design.md](../reports/builder-credits-design.md)
- **BC-0** 設計 ✅
- **BC-1** `builder_wallets` · `builder_wallet_ledger` schema · RLS
- **BC-2** Payment 連携（Builder 専用 · TLV Payment Engine 変更禁止）
- **BC-3** Credits 購入 UI + Checkout
- **BC-4** Credits 消費 hook（reason_code · idempotency · transaction）
- **BC-5** 管理画面（残高 · adjustment · suspend）
- **BC-6** 監査ログ · 不正検知
- **禁止:** AI Membership / TLV Wallet / Platform / Coin 統合 · サブスク代替化 · 今回 migration/Stripe 実装

- 店舗・出品者のクーポン発行・管理（円/％ OFF · 期間 · 上限 · 対象商品等）
- 購入者の表示・カート適用・利用済み/不可理由
- 運営一覧・強制停止・不正監視 · AI 秘書連携設計
- 将来: TASFUL 共通クーポン基盤として Builder / TLV / TASFUL AI へ拡張可能な設計前提

**AI Secretary Trend Scout（経営参謀 · トレンド提案）**

- 最新トレンド・市場・競合・補助金・法改正・SNS/検索傾向の収集と TASFUL 向け提案
- 表示候補: Morning Summary · Daily Inbox · Command Center · OPS WATCH · 月次レポート
- 提案カード: 活用案 · 優先度 · 難易度 · 期待効果 · **出典必須** · 採用/保留/却下
- 表現: 「流行っている」断定を避け **複数ソースからの増加傾向** で記載
- **実装なし** · P0/P1 外 · Platform Critical 優先順位は変更しない

**TASFUL Site Assistant Phase 1（サイトAI ウィジェット · ✅ 実装）**

- 全ページ右下 **「TASFUL サイトAI」** · cross-matching / FAQ 流用（Gateway / 秘書 非接続）
- 232 HTML 注入 · browser **18/18 PASS** · commit `ac864b4` · **未デプロイ**
- Phase 2+: 通報 · 問い合わせフォーム · OPS / AI 秘書集約 — **未着手**

**TASFUL Site Assistant Phase 2+（Feedback Launcher · 未着手）**

- 離脱防止: 問い合わせ · **通報** · 不具合報告 · サイト内検索の常設入口
- 必須7入口: 検索 / お問い合わせ / 通報 / 不具合 / 要望 / FAQ / **TASFUL AI を開く**
- OPS / AI 秘書へ将来集約 · P0/P1 外

**Builder AI Tool Integration Phase 3（計算ツール連携 · ✅ 実装）**

- 自然文 intent · Orchestrator · 既存 calculators / material tool 流用 · precalc
- MVP: 坪→㎡ · 材料数量 · 外壁塗装概算 · 利益率逆算 · 消費税/インボイス
- calc **15/15** · tools **85/85** · commit `05c32ad` · **未デプロイ**
- 今後: 足場 · 屋根 · 人工 · 原価 · 会計 · 顧客/現場管理

**Builder AI Vision Phase 2（Gemini Vision · ✅ commit 済）**

- 既存 Gateway → `gemini-chat` · 画像 + 相談文 · 4MB · 回答 8 項目 + 免責
- UI Phase 1 `5d28acc` 上に接続 · commit `4aff9ec` · **未デプロイ**

**Builder AI Live Phase 4-A（現場 Live 風 MVP · ✅ commit 済）**

- カメラプレビュー · スナップショット Vision · Voice Core adapter · transcript → Calc/Vision
- Live panel UI · Free/Pro gate stub · Gateway/Secret/CF 変更なし
- live **18/18** · calc **15/15** · tools **85/85** · p1-review **135/135** · vision **8/8** · ui **15/15** · build PASS
- commit `66051f7` · **未 push · 未デプロイ**
- 真 Gemini Live / WebSocket / ephemeral token Edge — **未実装**（Phase 4-B）

**Builder AI Vision Phase 5（構造化 Gemini Vision · ✅ 実装 · 未コミット）**

- `builder-ai-vision-analyzer.js` · JSON 正本 · 11 診断カテゴリ · AI参考診断免責
- Gateway `runFieldVision` 拡張（prompt override · raw JSON）· テキスト Gateway 非変更
- UI: 解析中 / 診断完了 / エラー / 画像なし
- `test-builder-ai-vision-phase5.mjs` **28/28** + phase2 回帰 **8/8** + build PASS
- 参照: `reports/builder-ai-phase5-vision.md`

**Builder Project Hub Phase 6-A（案件ハブ MVP · ✅ commit 済 · `46c5e02`）**

- `builder-project-store.js` · 一覧 / 詳細 / 検索 / タイムライン / Vision JSON 保存
- `project-hub.html` · `project-detail.html` · Builder AI `?projectId=` 連携
- `test-builder-project-hub-phase6a.mjs` + phase5 回帰 + build PASS
- 参照: `reports/builder-project-hub-phase6a.md`

**Builder Project Calendar Phase 6-B（工程・カレンダー · ✅ commit 済 · `556f315`）**

- 開始日 / 終了日 / 工程（8段階）· 月/週カレンダー · 本日/今週/遅延ウィジェット
- `project-calendar.html` · 詳細から日程変更 → Store 正本 → カレンダー反映
- `previewScheduleIntent` / `prepareScheduleIntent` — AI 日程変更の将来フック（未接続）
- `test-builder-project-calendar-phase6b.mjs` + phase6a 回帰 + build PASS
- 参照: `reports/builder-project-calendar-phase6b.md`

**Builder Project Finance Phase 6-C（収支 MVP · ✅ commit 済 · `e70d679`）**

- `project.finance` · 見積/原価/粗利/支払 · Hub サマリー · 詳細収支パネル
- `test-builder-project-finance-phase6c.mjs` + phase6b 回帰 + build PASS
- 参照: `reports/builder-project-finance-phase6c.md`

**Builder Estimate/Invoice Phase 6-D（見積・請求基盤 · ✅ commit 済 · `8be158f`）**

- `project.estimate` / `project.invoice`（SCHEMA v4）· 税10% · Hub サマリー
- `updateEstimate` / `updateInvoice` · `previewEstimateIntent`（AI 未接続）
- `test-builder-estimate-invoice-phase6d.mjs` + phase6c 回帰 + build PASS
- 参照: `reports/builder-estimate-invoice-phase6d.md`

**Builder Contract/Completion Phase 6-E（契約・完了基盤 · ✅ commit 済 · `ac385c6`）**

- `project.contract` / `project.completion`（SCHEMA v5）· ライフサイクル基盤
- `updateContract` / `updateCompletion` · Hub 契約・完了サマリー
- `previewContractIntent` / `prepareContractIntent` 等（AI 未接続）
- `test-builder-contract-completion-phase6e.mjs` + phase6d/c/b/a/vision 回帰 + build PASS
- 参照: `reports/builder-contract-completion-phase6e.md`

**Builder Document Center Phase 6-F（ドキュメント管理基盤 · ✅ commit 済 · `549e562`）**

- `project.documents[]`（SCHEMA v6）· 種別/タグ/検索 · Hub サマリー
- `addDocument` / `updateDocument` / `archiveDocument` / `removeDocument`
- `prepareDocumentIntent`（AI 未接続）· 実アップロードなし
- `test-builder-document-center-phase6f.mjs` + phase6e/d/c/vision 回帰 + build PASS
- 参照: `reports/builder-document-center-phase6f.md`

**Builder Notification Center Phase 6-G（通知基盤 Foundation · ✅ commit 済 · `74d54b8`）**

- `project.notifications[]`（SCHEMA v7）· 優先度/状態/ソース · Hub サマリー
- `addNotification` / `updateNotification` / `markNotificationRead` / `markNotificationUnread` / `archiveNotification`
- `generateProjectNotifications`（候補生成のみ）· `prepareNotificationIntent`（AI 未接続）
- メール/Push/cron/他 surface 連携なし
- `test-builder-notification-center-phase6g.mjs` + phase6f/e/d/c/vision 回帰 + build PASS
- 参照: `reports/builder-notification-center-phase6g.md`

**Builder Command Dashboard Phase 6-H（司令塔 KPI · ✅ 実装 · 未コミット）**

- `project-dashboard.html` — KPI · Today's Work · Active · Notifications · Activity · Upcoming
- 既存 Store API 読取のみ（新規業務ロジックなし）· AD-012 準拠
- `test-builder-dashboard-phase6h.mjs` + phase6g 回帰 + build PASS + スクリーンショット
- 参照: `reports/builder-dashboard-phase6h.md`

**Builder AI Gemini Live Phase 4-B（未着手）**

- カメラ映像 · 画面共有でのリアルタイム相談 · 現場診断補助 · 劣化指摘 · 見積 / 資材 / 施工提案 · チェックリスト · 写真付き現場レポート
- **Builder AI のみ** — AI 秘書 · Platform · TLV · TASFUL AI には実装しない
- AI は補助ツール。最終判断は現地確認 · 有資格者 · 専門業者。**診断結果のみで施工判断しない**
- **着手:** 利益安定 · Builder AI 基本機能完成後 · P0/P1 外

---

### Voice Core Phase 5-D（✅ 完了 · 2026-06-27）

| 区分 | 状態 | 根拠 |
| --- | --- | --- |
| **5-D-1** TASFUL AI Live opt-in | **完了** | `1c8fe87` · `surface: tasful_ai` |
| **5-D-2** Builder AI Live opt-in | **完了** | `2a57283` · `surface: builder_ai` |
| **5-D-3** AI秘書 Live opt-in | **完了** | `e43c9c0` · `surface: ops_secretary` |
| **Hardening Phase 1** Kill Switch + Rate Limit | **完了** | `d1f6ced` · Edge `VOICE_REALTIME_EDGE_ENABLED=1` |

- [x] Voice 5-D-1 — TASFUL AI Workspace Live opt-in（flags · mock fallback）
- [x] Voice 5-D-2 — Builder AI Live opt-in（flags · mock fallback）
- [x] Voice 5-D-3 — AI秘書 Live opt-in（flags · mock fallback）
- [x] Voice Hardening Phase 1 — Kill Switch + in-memory Rate Limit Phase 1

**前提（5-A〜5-C · 完了）:** Edge GA `client_secrets`（`0cedb27`）· GA Transport（`6924aa1`）· default `gpt-realtime-2`（`74e8048`）

**参照:** `reports/voice-phase5d-complete.md` · [AI/README.md](./AI/README.md) §Voice

**次フェーズ候補（未着手）:** Hardening Phase 2 · Redis 等分散 Rate Limit · JWT 認可 · Builder/秘書 Voice UX · TLV Voice 検討

---

## P2 — ドキュメント・運用

- [ ] `docs/` 正本をコミット
- [ ] `reports/ai-selected-staging-result.md` をコミットまたは docs へ統合
- [ ] 440 件整理後に `PROJECT_STATUS.md` の working tree 件数を更新

---

## 完了済み（参照用）

| 項目 | 完了根拠 |
| --- | --- |
| Builder AI P1 + tools adaptation | `5ed9672` · 85/85 + 135/135 PASS |
| Platform Next + Finish（AI 入口） | `5ed9672` · 37+37 PASS |
| TASFUL AI Final Phase | `5ed9672` · 31/31 PASS |
| AI 規約 / 免責 | `5ed9672` · 32/32 PASS |
| TLV → TASFUL AI 入口 | `5ed9672` · 16/16 PASS |
| AI 選別コミット | `5ed9672` |
| Workspace enforcement Phase 1 | `2a43fe5` · Production deploy · smoke 12/12 · browser 15/15 + 53/53 · `reports/tasful-ai-workspace-phase1-deploy.md` |
| AI 秘書 DeepSeek Adapter Phase 1 | `6c70985` · Adapter + CF Pages Function · AD-010 · 503/502 fallback · API 到達 · `reports/secretary-deepseek-adapter-phase1.md` |
| AI 秘書 OpsContextBuilder Phase 2 | `840a574` · 6 ドメイン context 注入 · PII マスク · `reports/secretary-ops-context-builder-phase2.md` |
| TASFUL Site Assistant Phase 1 | `ac864b4` · 232 HTML 注入 · cross-search/FAQ 流用 · browser 18/18 · `reports/tasful-site-assistant-phase1.md` |
| Builder AI UI Phase 1 | `5d28acc` · 現場診断 UI シェル · Live/Voice stub |
| Builder AI p1-review test follow-up | `46677eb` · legacy details open in UI checks |
| Builder AI Vision Phase 2 | `4aff9ec` · Gateway attachments → gemini-chat · vision 8/8 + ui 14/14 + review 135/135 · `reports/builder-ai-vision-phase2.md` |
| Builder AI Tool Integration Phase 3 | `05c32ad` · docs `95a45dd` |
| Builder AI Live Phase 4-A | `66051f7` · live 18/18 · ui 15/15 · `reports/builder-ai-live-phase4-plan.md` |
| Voice Core Phase 5-D | `4f1f926` · TASFUL AI / Builder AI / AI秘書 Live opt-in · Hardening Phase 1 · `reports/voice-phase5d-complete.md` |
