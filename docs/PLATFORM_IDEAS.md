# Live Platform — ブレインストーミング整理（PLATFORM IDEAS）

**最終更新:** 2026-06-28  
**種別:** 採否整理正本（**実装なし**）  
**出典:** 2026-06-28 制度設計セッション · Gemini ブレスト結果の統合  
**AD:** [DECISIONS.md](./DECISIONS.md) **AD-014**
**親:** [LIVE_PLATFORM_CONCEPT.md](./LIVE_PLATFORM_CONCEPT.md)

各アイデアは **採用候補 / 保留 / 将来 / 不採用** に分類。詳細制度は各専門ドキュメントを参照。

| ドキュメント | 内容 |
| --- | --- |
| [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) | 配信者制度 |
| [VIEWER_PROGRAM.md](./VIEWER_PROGRAM.md) | 視聴者制度 |
| [MONETIZATION.md](./MONETIZATION.md) | 収益 · 還元 |
| [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) | ライブ仕組み |

---

## 1. 採用候補（✅ Adopted — 制度として確定）

| # | アイデア | 理由 | 参照 |
| --- | --- | --- | --- |
| A1 | **条件達成型高還元** | 利益が先 · 持続可能 · 差別化の核心 | [MONETIZATION.md](./MONETIZATION.md) §3 |
| A2 | **三本柱（ロング → ショート → ライブ）** | 資産 · 流入 · リアルタイム収益の役割分担 | [LIVE_PLATFORM_CONCEPT.md](./LIVE_PLATFORM_CONCEPT.md) §3 |
| A3 | **Creator Score（内部）** | 公平な tier 判定 · 非公開で摩擦低減 | [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §7 |
| A4 | **ランク 3 ティア** | Standard / Proven / Top Contributor — シンプル | [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §6 |
| A5 | **30 分無料 → 条件延長 30 分** | ライブ赤字防止 · 視聴者にも分かりやすい | [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) §2 |
| A6 | **ライブゲージ + 応援** | 延長条件の可視化 · 参加型体験 | [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) §7 |
| A7 | **オーバーゲージ（cap 付き）** | 盛り上がりを収益 · 延長に変換 · コスト上限必須 | [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) §8 |
| A8 | **Raid** | 配信終了後の視聴者導線 · コミュニティ活性 | [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) §9 |
| A9 | **ラジオ配信モード** | 低 infra · トーク配信向け | [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) §10 |
| A10 | **GitHub 風ヒートマップ** | 継続配信の可視化 · クリエイター motivator | [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §8 |
| A11 | **Creator Credit** | 還元 · 機能解禁 · 信頼の内部指標 | [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §2 |
| A12 | **視聴者レベル · ストリーク · 古参バッジ** | 参加型 · AD-012 シンプル UI 準拠 | [VIEWER_PROGRAM.md](./VIEWER_PROGRAM.md) |
| A13 | **ルーム内ライブランキング** | 応援可視化 · グローバル晒しを避ける | [VIEWER_PROGRAM.md](./VIEWER_PROGRAM.md) §8 |
| A14 | **利益の再投資サイクル** | 還元 · 新人 · イベント · infra | [MONETIZATION.md](./MONETIZATION.md) §4 |
| A15 | **TASFUL AI 入口経由の Creator 支援** | AD-004 維持 · 専用 AI エンジン不要 | [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §9 |

---

## 2. 保留（⏸ Hold — 有望だが前提未整備）

| # | アイデア | 理由 | 再評価条件 |
| --- | --- | --- | --- |
| H1 | **Creator Challenge** | 不正 · 報酬インフレ · 品質ばらつき | Ops 監視 · 小規模パイロット |
| H2 | **エコボーナス / 時間帯ボーナス** | infra 実測データ不足 | CDN · 帯域コスト可視化後 |
| H3 | **Creator Lab** | 分析 UI 複雑化 · TASFUL AI 連携設計中 | AD-012 下の UI 案確定 |
| H4 | **Creator Marketplace** | 著作権 · 審査 · 決済 | 法務 · Ops 体制 |
| H5 | **Creator Incubator** | 再投資余力 · 選考基準 | 黒字化 · Proven tier 運用実績 |
| H6 | **視聴者コレクション** | 経済設計 · ガチャ性回避 | 法務レビュー |
| H7 | **マイル / ミッション** | ボット視聴リスク | 不正検知基盤 |
| H8 | **有料チケット制ライブ** | 決済 · 返金 · 未成年 | Stripe / 課金基盤 |
| H9 | **DVR / 巻き戻し** | ストレージコスト | Proven tier 以上で段階 |
| H10 | **同時多画面コラボ** | 帯域 · UI 複雑 | ラジオ / 音声コラボから |
| H11 | **自動ハイライト（AI 切り抜き）** | TASFUL AI · 著作権 | Gateway 安定 · 権利確認 |
| H12 | **サポーター特典詳細** | メンバーシップ課金未接続 | 課金 Phase 完了後 |
| H13 | **4K / 高ビットレート** | コスト高 | Proven 以上 · infra 余力 |

---

## 3. 将来（📋 Future — v2+ · 凍結解除後）

| # | アイデア | 理由 | 備考 |
| --- | --- | --- | --- |
| F1 | **ライブコマース** | Platform 案件 · 成約手数料と親和 | AD-013 整合 |
| F2 | **メンター制度** | Top Contributor → 新人支援 | Incubator 後 |
| F3 | **視聴者ギルド** | コミュニティ深化 | レベル制度安定後 |
| F4 | **グローバル / 横断ランキング** | 摩擦 · プライバシー | ルーム内で十分な期間を経て |
| F5 | **同時通訳 / 字幕** | AD-011 海外将来 | 国内完成後 |
| F6 | **クリップ即時公開** | ショート導線 | エンコード pipeline |
| F7 | **バーチャルセット / AR** | 差別化 · コスト | ニッチから |
| F8 | **チャンネル NFT / デジタルコレクション** | 法務 · トレンド依存 | 慎重検討 |
| F9 | **法人クリエイター / MCN** | B2B 契約 | 運営体制 |
| F10 | **Family / ペアレンタル視聴** | 未成年保護 | 法務 |
| F11 | **オフラインイベント連動** | チケット · 限定配信 | イベント Ops |
| F12 | **Platform 横断視聴者プロフィール** | Platform お気に入り連携 | Platform finish 後 |

---

## 4. 不採用（❌ Rejected）

| # | アイデア | 理由 |
| --- | --- | --- |
| R1 | **全クリエイター常時 90%+ 還元宣言** | infra 赤字 · マーケのみの差別化 · 持続不可 |
| R2 | **還元率固定を先に決める運営** | コンセプト逆 · [MONETIZATION.md](./MONETIZATION.md) §3 |
| R3 | **無条件無制限ライブ延長** | コスト爆発 · [LIVE_SYSTEM.md](./LIVE_SYSTEM.md) |
| R4 | **クリエイター収益率公開ランキング** | 摩擦 · 不正競争 · 離反 |
| R5 | **TLV 専用 AI エンジン** | AD-004 · TASFUL AI 入口のみ |
| R6 | **AI 自動返信 / 自動投稿** | 人間最終判断 · 秘書ポリシー整合 |
| R7 | **ギャンブル性ガチャ（視聴者）** | 法務 · ブランド · 依存性 |
| R8 | **視聴者 PvP 課金競争の過度可視化** | 未成年 · トキシック文化 |
| R9 | **視聴履歴の公開** | プライバシー |
| R10 | **PV 至上主義の algo 最適化のみ** | 短期利益 · クリエイター不信 |
| R11 | **ボット視聴許容（ゲージ操作）** | 不正 · 還元制度崩壊 |
| R12 | **赤字ライブをプラットフォームが無限 subsidize** | 利益最優先原則に反する |

---

## 5. 横断テーマ（ブレストからの学び）

| テーマ | 結論 |
| --- | --- |
| **還元 vs マーケ** | 還元は **成果連動**。数字競争で獲得しない |
| **ライブ vs ロング** | ライブは **イベント**。資産はロング · 流入はショート |
| **視聴者 gamification** | 参加は歓迎 · **過度な競争 · 課金圧** は避ける |
| **AI の位置づけ** | 分析 · 提案 · ハイライト案 — **自動実行はしない** |
| **infra** | すべての制度に **コスト上限** を設計段階から入れる |
| **TLV v1** | 本整理は **次世代 Vision**。v1 コードは FROZEN |

---

## 6. 次のアクション（設計 → 実装移行時）

1. Creator Score 次元の **数値閾値** を Ops データ取得後に確定
2. ライブ **ゲージ weight** のシミュレーション（コストモデル連動）
3. 還元 tier の **法務 · 税務** レビュー
4. TLV v1 凍結解除計画と **Platform Vision** のマイルストーン整合

詳細タスク: [TODO.md](./TODO.md) § Live Platform Vision

---

## 7. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | 初版 — ブレスト結果を採否 4 分類で統合 |
