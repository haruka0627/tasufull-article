# TLV Design Audit — Follow-up Policy（制度追補）

**作成日:** 2026-06-28  
**根拠:** [tlv-design-audit-reconciliation.md](./tlv-design-audit-reconciliation.md)  
**スコープ:** docs / TODO 追記のみ。**コード · DB · migration 変更なし。**

---

## 1. 追補した制度（3 項目）

### 1.1 TS 回復ルート

**正本:** `docs/TLV_PRD.md` §5.5.3 · `docs/ADMIN_SYSTEM.md` §6.5

| 要素 | 内容 |
| --- | --- |
| 公式 | `TS = clamp(100 + Σ event_delta, 0, 100)` — penalty（負）+ recovery（正） |
| 回復イベント | 誤判定解除 · 30 日 clean +5 · KYC +10 · Ops PASS +10〜15 |
| 上限 | 暦月 +30（誤判定解除除く）· major sanction は TS キャップ |
| 復帰 | TS&lt;50 / TS=0 は Ops PASS + 条件付き還元再開 |
| 不可/限定 | DMCA · マネロン CONFIRMED · 自己投げ/共謀 severe |

### 1.2 Collusion（共謀）対策 v1

**正本:** `docs/TLV_PRD.md` §7.5 · `docs/ADMIN_SYSTEM.md` §6.6

| 要素 | 内容 |
| --- | --- |
| 境界 | 自己投げ（同一主体）≠ 共謀（異 account 循環） |
| フラグ | `suspicious_collusion_flag` → `collusion_confirmed` / `collusion_repeat` |
| ルール | CL-01〜05（相互 · 循環 · 三角 · 閉ネットワーク · 洗浄） |
| 制裁 | PPC 除外 · TS−50〜100 · Override 無効 · payout hold 30〜180d |
| v1 限界 | グラフ ML **未採用** → `REL-F-09` Future |

### 1.3 Clawback 運用ルール

**正本:** `docs/TLV_PRD.md` §7.6 · `docs/TLV_PAYMENT_ENGINE.md` §6.5 · `docs/ADMIN_SYSTEM.md` §9.3

| 要素 | 内容 |
| --- | --- |
| payout 前 | 自動 RPC · 未出金から adjustment 相殺 |
| 将来売上 | 次回 payout batch 控除累積 — **ネガティブ ledger 禁止** |
| payout 後 | FinOps manual Connect recovery |
| Wallet | **マイナス残高禁止維持** · shortfall → frozen |
| 回収不能 | payout_hold · account_review · 還元停止判断 |
| 法務 | `TODO-LEGAL-CB-01` |

---

## 2. 変更しなかった項目（根幹設計）

| 項目 | 確認 |
| --- | --- |
| `Score_MA30` · rolling 30d（PPC_30d · WR_30d） | ✅ 不変 |
| Platinum 絶対閾値（750–849） | ✅ 不変 |
| Legend 定員 100 · PPR 降順 | ✅ 不変 |
| Override T90/T95 条件 | ✅ 不変 |
| Profit First（PF-01〜06 · `profit_first_clamp`） | ✅ 不変 |
| Wallet `coin_balance >= 0` | ✅ 不変 |
| Connect 自動 clawback v1 外 | ✅ 維持 |

---

## 3. Future TODO

| ID | 内容 |
| --- | --- |
| REL-F-09 | Graph-based Collusion Detection |
| REL-F-10 | Creator ネガティブ payout ledger（v1 不採用） |
| TODO-COLLUSION-01/02 | CL ルールエンジン · Ops Queue UI |
| TODO-TS-REC-02 | clean period 日次バッチ |
| TODO-CB-OPS-02 | 将来売上相殺 FinOps フロー実装 |

---

## 4. 変更ファイル

| ファイル | 変更内容 |
| --- | --- |
| `docs/TLV_PRD.md` | §5.5.3 · §7.5 · §7.6 · §7.4 hold 拡張 |
| `docs/ADMIN_SYSTEM.md` | §6.5 · §6.6 · §9.3 · SG TS 正本統一 |
| `docs/TLV_PAYMENT_ENGINE.md` | §6.5 · §7.1 events |
| `docs/TODO.md` | Design Audit Follow-up 節 · REL-F-09/10 |
| `reports/tlv-design-audit-followup-policy.md` | 本レポート |

---

## 5. Reconciliation 整合確認

| Reconciliation 分類 | Follow-up |
| --- | --- |
| ③ TS 回復 | → **docs 設計追補済**（実装は TODO） |
| ② Collusion | → **v1 ルール設計追補済**（グラフは Future） |
| ② Clawback 運用 | → **運用ルール追補済**（法務 TODO 残） |
| ④ Score 減衰 | → **変更なし** |
| ① Platinum/Legend | → **変更なし** |

---

*本レポートは制度追補の索引。数式 · Rank · Override の正本は引き続き TLV_PRD §5–6。*
