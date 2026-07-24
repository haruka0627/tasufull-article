# TLV Design Audit — Gemini 指摘と正式設計の照合レポート

**作成日:** 2026-06-28  
**目的:** Gemini Design Audit 指摘を、現行正式設計（docs / TODO / reports）と照合し分類する。  
**スコープ:** 照合・分類のみ。**新規実装・コード変更・docs 修正は行わない。**

**参照正本:**

| 資料 | 版 / 備考 |
| --- | --- |
| `docs/TLV_PRD.md` | v1.2 |
| `docs/CREATOR_PROGRAM.md` | Rank / Override / TS ゲート |
| `docs/FINANCIAL_MODEL.md` | Profit First · 日次ガード |
| `docs/ADMIN_SYSTEM.md` | T&S · SG ルール · マネロン |
| `docs/TLV_PAYMENT_ENGINE.md` | Payout hold · chargeback · clawback |
| `docs/PRICING.md` | 30分サバイバル · Grace 60s |
| `docs/TODO.md` | Release P0 / Future スコープ |
| `reports/tlv-payment-chargeback-clawback-design.md` | Clawback 設計 ①〜⑩ |
| `reports/tlv-payment-chargeback-clawback-implementation.md` | staging 実装状態 |

**分類凡例:** ① 既に設計済み · ② 一部設計済み · ③ 未対応 · ④ Gemini の前提誤認

---

## 照合表

| Gemini指摘 | 分類 | 現在の設計状況 | 根拠 docs | 不足している点 | 対応方針 |
| --- | --- | --- | --- | --- | --- |
| **1. TS 回復ルート**（誤判定解除 · 一定期間違反なし · KYC 完了 · 運営レビュー通過 · 回復上限 · 回復頻度） | **③ 未対応** | **減点・ゲートのみ設計済。** `TS = clamp(100 + Σ penalties, 0, 100)`（イベント駆動 + 日次監査 03:30 JST）。減点: 軽微 −10〜−30 · 通報 −20（90 日 rolling 集計）· CB −20 · DMCA/自己投げ確定 −100。ゲート: TS&lt;80 Override 無効 · TS&lt;50 **還元停止 + 手動レビュー** · TS=0 露出ゼロ。`CREATOR_PROGRAM`: `TS < 50` → 還元停止至 **レビュー PASS**（**還元再開条件**であり TS 点数回復ではない）。KYC はマネロン段階 1（高 Net + KYC 未完了）で **追加 KYC** のみ。 | `TLV_PRD.md` §5.5 · §7.1 · `CREATOR_PROGRAM.md` §2.4 · `ADMIN_SYSTEM.md` §6.2–6.3 | **TS 加算（回復）イベントの公式定義なし。** 誤判定解除手順 · 無違反期間による自動回復 · KYC 完了による TS 加点 · 回復上限/頻度 · `creator_score_events` の positive delta ポリシー。レビュー PASS が TS を何点戻すか未規定。 | **MVP 前:** TS&lt;50 時の Ops レビュー PASS 手順（還元再開 vs TS 加点の区別）を Runbook に最小追記。**Future:** 回復ルール本体は PRD §5.5 拡張として別 ADR で設計（既存減点表との整合必須）。 |
| **2. 共謀 / Collusion 対策**（相互投げ · グループ循環 · 三角取引 · 閉じたギフトネットワーク · 複数アカウント洗浄 · 自己投げとの違い · Anti-Fraud 検知ルール） | **② 一部設計済み** | **自己投げ（SG-01〜04）と BOT / クロスチェックは確定。** SG: KYC 一致 · 同一 device · 新規 7 日単一 Creator ≥¥50k · 還元直前 1h 80% 集中。確定時 PPC/FS/Override から Net 完全除外 · payout hold · TS 大幅減点。`trust_signals` + `cross_check_score` + Ops queue。**マネロン**は ADMIN §6.3（高 Net + KYC 未完了 → 保留/追加 KYC → CONFIRMED で永久停止）の **段階ポリシーのみ**。 | `TLV_PRD.md` §7.1–7.3 · `TLV_PAYMENT_ENGINE.md` SG 表 · `ADMIN_SYSTEM.md` §6.2–6.3 | **共謀専用ルールなし:** 相互投げ · リング循環 · 三角取引 · 閉ネットワーク · 資金洗浄グラフ検知。自己投げとの **境界定義**（複数第三者 account 経由の還元循環）未記載。`behavior_log` / `payment_channel` は Ops レビュー止まり。 | **MVP 前:** SG-03/04 + マネロン段階 1 を Ops 手順に明文化（共謀疑義のエスカレーション）。**Future:** グラフ/リング検知は T&S フル（`TODO.md` TLV-P0-09 P1 · PRD §10 Future）で別設計。Gemini の「自己投げ検知だけでは足りない」指摘は **妥当**。 |
| **3. Clawback 設計**（CB 後相殺 · 出金済 Creator 回収 · Wallet マイナス · 将来売上相殺 · payout hold 連動 · 規約記載） | **② 一部設計済み** | **P0 設計 + staging 実装済。** `charge.refunded` / `dispute.*` → `handle_payment_refund` / `handle_payment_dispute` → `apply_coin_clawback_for_payment`（coin lot FIFO claw · `revenue_ledger` adjustment 負行 · TS−20 · `payout_hold` 30d）。**Payout 前:** 自動 RPC + hold。**Payout 後:** Stripe Connect 逆送金 **v1 外 · FinOps manual**。Wallet: **`coin_balance >= 0` 固定** · 不足は **部分 claw + `coins_shortfall` + `status=frozen`**（マイナス残高禁止）。Fraud: `adjustment_debit` + `FRAUD_CLAWBACK`。Gauge 減算は P1。 | `reports/tlv-payment-chargeback-clawback-design.md` ②–⑨ · `TLV_PAYMENT_ENGINE.md` §6.3–6.4 · §8 · `TLV_DB_SCHEMA.md` `payment_reversals` · implementation report | **Creator 将来売上からの自動相殺**（ネガティブ payout balance）未設計。**TLV 専用利用規約**への clawback / shortfall / frozen 条文は docs 未確認（一般 `terms.html` のみ）。Gauge clawback P1。Production migration registry / FinOps payout 後手順 **運用未完了**（`TODO.md` REL-P0-02）。 | **MVP 前:** FinOps payout 後 clawback Runbook · frozen/shortfall 利用者通知文案 · production migration 適用。**Future:** Creator 側ネガティブ残高テーブルは v1 明示不採用 — 必要なら v2 ADR。 |
| **4. Score Time Decay**（Score_MA30 · rolling 30d · PPC_30d · WR_30d · CreatorScore_day · 古い実績比重低下 · 「累積スコア」誤認） | **④ Gemini の前提誤認**（累積生涯スコアと見なした場合） / **① 設計済み**（減衰機構そのもの） | **累積生涯 Total ではなく rolling / MA ベースが正本。** `CreatorScore_day = FS + ES + GS + TS`（日次確定）→ `Score_MA30 = avg(CreatorScore_day, 30d)`（Rank/還元公式）。FS: `PPC_30d` · `WR_30d`（rolling 30 日 · self_gift 除外 Net）。ES: ライブセッション **rolling 30 日加重平均**。GS: 日次更新。月次 Rank は毎月 1 日 `Score_MA30` 確定 · 7 日連続 maintain_floor 下回りで降格。 | `TLV_PRD.md` §5.3–5.6 · §6.3 · `CREATOR_PROGRAM.md` §2 · `TLV_PAYMENT_ENGINE.md` §6.2 · §7 | **実装:** Score サービス / 日次バッチは `TODO.md` スコープ C = **Future（REL-F-01/02）**。WR lot 追跡 TODO（§12）。Gemini が「一度上がった点数が永久に効く累積スコア」と前提した場合は **設計と不一致**。 | **追加設計不要**（減衰思想は既存どおり）。**Future:** Score バッチ実装時に MA30 / rolling 30d を PRD 通り実装。Gemini へのフィードバック: 「Score_MA30 + rolling 30d 入力で既に時間減衰あり」。 |
| **5. Platinum 相対評価**（Platinum 絶対評価の理由 · Legend 定員 100 / PPR 降順のみの理由 · 条件達成型公平性 · Platinum に相対評価が必要か · 設計思想との衝突） | **① 既に設計済み** | **意図的な二層 Rank 設計。** Bronze〜Diamond / Platinum（750–849）は **`Score_MA30` 閾値の絶対評価**（`tierFromScore`）。**Legend のみ** Score≥930 **かつ** 定員 **100** · **PPR_month 降順**選抜 · waitlist · 動的入替（毎月 1 日）。95% Override は Legend 在籍 + Score≥950 等。**AD 確定:** Legend 選抜は Score のみ → PPR+定員+入替（PRD v1.2 changelog）。CREATOR_PROGRAM: 「PPC / WR / TS / 定員 100 / PPR 順の構造 **変更禁止**」。条件達成型（Score 閾値）と Legend 競争型（PPR）の **役割分担**が明文化。 | `TLV_PRD.md` §6.3–6.4 · §9.1 ゾーン B/C · `CREATOR_PROGRAM.md` §3 · AD-014 思想（条件達成型エコノミー） | Platinum を Legend 同様に定員/PPR 化する要件 **なし**（むしろ禁止に近い）。Gemini が「Platinum も相対評価すべき」と提案する場合は **新提案** であり現行設計のギャップではない。 | **採用しない**（§C 参照）。Legend のみ相対評価は **トップ層の Platform Profit 貢献度競争**として確定済み。 |
| **6. Profit First Clamp のスパイク耐性**（platform_profit_projected · infra_accumulated · force_end_at · Grace 60s · infra cap ¥150 · 延長 Coin 不足終了 · CCU 急増原価 · 実装/TODO） | **② 一部設計済み** | **セッション日次ガード（設計コードあり）:** `platform_profit_projected < 0 && !extension_paid` → `force_end_at = free_end_at`。**infra_accumulated > ¥150 && extension_coins < 500** → `force_end_at = now + 60s`（Grace）。**月次:** PlatformProfitTotal&lt;0 → Pool=0 · 95% 停止 · PPR&lt;10% → FinOps · Infra/Net&gt;40% → CDN 降格。**CCU スパイク:** 動的ビットレート（999/8k CCU 帯）· 非アクティブ軽量化 · CCU&gt;8000 admin 480p · 10k ガードレール。**延長:** 500 coin 未達 → Grace 60s 強制終了（PRICING §4.2）。Override 層も `profit_first_clamp` で無効化し得る。 | `FINANCIAL_MODEL.md` §7.1–7.3 · `TLV_PRD.md` §4 · §8.3–8.4 · `PRICING.md` §4 · `CREATOR_PROGRAM.md` PF-01–06 | **Live セッションへの配線未実装**（`TODO.md`: 30分サバイバル / Gauge / Score = **Future REL-F-01/02**）。`assertProfitFirst` は FINANCIAL_MODEL の **設計スニペット** であり `live/` 未接続。CCU 急増時の **セッション横断** infra 予算ブレーカー（日次以外）未詳細。ZEGO/ingest 実コスト連動は stub。 | **MVP 前:** 収益ライブ接続時に FINANCIAL_MODEL §7.1 を session lifecycle に **最小配線**（free_end / extension / force_end）。**Future:** 月次 PF ガード · ゾーン別 PPR 目標 · Gauge difficulty 連動。 |

---

## 補足: 設計内の既知 tension（照合時に確認）

| 項目 | 内容 | 照合での扱い |
| --- | --- | --- |
| TS 自己投げ確定時の減点 | PRD §7.1: **−100** · ADMIN §6.2: **−50** | TS 回復議論以前に **減点正本の統一**が必要（本レポートでは docs 変更しない） |
| Override WR 閾値 | PRD §3.4（0.60/0.75）vs §5.8 T90/T95（0.70/0.85） | 正式表は **§5.8 / CREATOR_PROGRAM** を正本とする |
| Score / Legend 実装スコープ | Payment Engine 開発完了 · Score/Legend バッチは Future | Gemini の「未設計」と「未実装」を区別すること |

---

## A. 今すぐ追加すべきもの（MVP 前必須のみ）

| # | 項目 | 理由 |
| --- | --- | --- |
| A1 | **Chargeback / clawback Production 適用 + FinOps Runbook** | REL-P0-02 blocker · payout 後 manual 手順が未運用 |
| A2 | **TS&lt;50 / payout_hold 時の Ops レビュー PASS 手順**（還元再開条件） | 唯一の「回復に近い」公式ゲート · 手順未文書化 |
| A3 | **frozen / shortfall 時の利用者向け通知・規約参照文案** | Wallet 方針は設計済み · 法務/UX 表出なし |
| A4 | **Profit First セッションガードの Live lifecycle 最小配線** | FINANCIAL_MODEL §7.1 は設計のみ · P0 Live 接続時に必須 |
| A5 | **共謀疑義の Ops エスカレーション**（SG + マネロン段階 1 からの triage） | 専用ルール未設計でも MVP 運用の安全網 |

**意図的に MVP 前必須に含めない:** TS 点数回復公式 · グラフ型 collusion 検知 · Creator ネガティブ残高 · Platinum 相対評価 · Score バッチ全体（Future スコープ）。

---

## B. 後回しでよいもの（Future / P1）

| # | 項目 | 根拠 |
| --- | --- | --- |
| B1 | TS 加算回復ルール（上限 · 頻度 · KYC 連動加点） | 減点・ゲートで MVP 運用可能 · 回復は Ops 裁量で暫定 |
| B2 | 共謀 / リング / 洗浄グラフ検知ルール | `TODO.md` T&S フル · PRD §10 Future |
| B3 | Creator 将来売上からの自動 clawback（ネガティブ payout ledger） | v1 設計で Wallet マイナス禁止 · FinOps manual で足りる |
| B4 | Gauge clawback on stream live（P1） | chargeback-clawback-design §⑦ |
| B5 | 月次 Profit First プール制御 · FM_15 自動 cap | FINANCIAL_MODEL §7.2 · Score/Legend バッチ依存 |
| B6 | `trust_signals` / `cross_check_score` 本番パイプライン | PRD §7.3 実装 Future |
| B7 | CCU 横断 infra 予算ブレーカー（セッション間） | PRD §8 + ADMIN §7 WARN の拡張 |

---

## C. 採用しない方がよいもの（既存コンセプトと衝突）

| # | Gemini 系提案 | 衝突する正式設計 | 理由 |
| --- | --- | --- | --- |
| C1 | **Platinum も Legend 同様の定員 / PPR 相対評価** | PRD §6.4 · CREATOR_PROGRAM「構造変更禁止」 | Platinum=条件達成（ゾーン B 主戦場）· Legend=Platform Profit 競争（ゾーン C）の **役割分離** |
| C2 | **Wallet / coin_balance のマイナス許容** | clawback-design §⑥ · TLV_DB CHECK | v1 は shortfall + frozen · ゲーム内通貨の負債化を明示回避 |
| C3 | **累積生涯 Score への改修**（減衰なし） | Score_MA30 + rolling 30d 入力 | Profit First / 新人救済（gauge_difficulty）/ 不正陳腐化と矛盾 |
| C4 | **Override 90/95% の常時適用** | PF-02 · PPR 閾値 · `profit_first_clamp` | 高還元は PPR 条件付き · Platform 赤字時は Override も無効 |
| C5 | **TS 自動満点回復（時間経過のみ）** | TS = 100 + Σ penalties · イベント駆動 | 不正コスト外部化 · TS=0 / DMCA の重制裁思想と矛盾。回復するなら **明示イベント + Ops 監査**が前提 |
| C6 | **Payout 後 Connect 自動 clawback を v1 必須化** | design §① Connect transfer v1 不採用 | 意図的に FinOps manual · MVP スコープ外 |

---

## 総括

| 分類 | 件数 | 該当 |
| --- | --- | --- |
| ① 既に設計済み | 2 | Score Time Decay（減衰機構）· Platinum/Legend 二層 Rank |
| ② 一部設計済み | 3 | Collusion · Clawback · Profit First スパイク |
| ③ 未対応 | 1 | TS 回復ルート（加点公式） |
| ④ Gemini 前提誤認 | 1 | Score を「累積のみ」と見なした場合 |

**Gemini Audit で優先確認すべき真のギャップ:** (1) **TS 回復の未設計** (2) **共謀専用 Anti-Fraud の未設計** (3) **Clawback / PF の Live・Production 配線と運用** — いずれも docs 上は方針または部分設計あり。**Score 減衰**と **Platinum 絶対 / Legend 相対**は正式設計どおりで、Gemini の追加要求は多くが **新提案** または **前提誤認**。

---

*本レポートは docs 正本の照合結果であり、仕様変更・実装指示ではない。*
