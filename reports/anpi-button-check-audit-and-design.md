# ANPI — Button-Based Safety Check Audit and Implementation Design

**Date:** 2026-07-26  
**Type:** Audit · design only（**no implementation · no migration · no commit**）  
**Baseline HEAD:** `27092444570167b5b930dd9ffb6fbed6ac288f09`  
**Branch:** `cf-pages-deploy`  
**Canonical product PRD:** [`docs/ANPI_PRD.md`](../docs/ANPI_PRD.md)  

---

## 1. Executive verdict

**PASS (audit + design).**

Existing ANPI is a **shipped, RELEASE FROZEN** product with button CTAs and TALK/LINE notify surfaces, but the **scheduled daily check-in state machine, person re-notify → emergency contact flow, and contact consent** are incomplete or demo-wired. Call/IVR inbound is **not** the product core; residual `tel:` CTAs are **legacy-candidate**.

Formal button-based policy is now fixed in **`docs/ANPI_PRD.md`**. This report is the inventory and gap analysis; it does not rewrite historical release docs.

---

## 2. Git baseline (session start)

| Field | Value |
| --- | --- |
| HEAD | `27092444570167b5b930dd9ffb6fbed6ac288f09` |
| Branch | `cf-pages-deploy` |
| Staged | 0 |
| Unstaged (approx) | 410 |
| Untracked (approx) | 414 |
| ANPI-related dirty | `deploy/cloudflare/dist/anpi-*.html` and dist docs copies modified — **not touched** this session |

---

## 3. Inventory (classification)

### 3.1 Docs

| Path | Class | Notes |
| --- | --- | --- |
| `docs/ANPI_PRD.md` | **設計正本（本セッション新規）** | Button-check canonical |
| `docs/future/tasful-safety.md` | 設計のみ · 実装禁止 | Future multi-button Safety |
| `docs/anpi-supabase-production-checklist.md` | 運用 | RLS / apply |
| `docs/anpi-rls-jwt-setup.md` | 運用 | JWT |
| `docs/anpi-line-deploy-checklist.md` | 運用 | LINE |
| `docs/anpi-line-manual-test.md` | 運用 | LINE manual |
| `reports/anpi-release-status.md` | Historical SSOT | RELEASE FROZEN 2026-06-17 |
| `reports/anpi-no-response-phase2-design.md` | 設計 | Escalation; **「本人再通知なし」は新 PRD と矛盾 → 置換** |
| `reports/anpi-no-response-phase2-implementation.md` | 実装記録 | Modules exist; UI wiring drift |
| `reports/anpi-final-audit-remaining-issues.md` | P2 backlog | |

### 3.2 UI (root)

| Path | Class | Notes |
| --- | --- | --- |
| `anpi-register.html/js/css` | **実装済み** | 契約者+利用者 · 同意 · 通知レベル |
| `anpi-dashboard.html/js/css` | **実装済み** | サマリー · アンカー |
| `anpi-notifications.html/js/css` | **実装済み** | 通知センター |
| `anpi-notify-cards.js` | **実装済み + legacy** | 「無事です」あり · **`nr-remind` / `nr-call`(`tel:`) 残存** |
| `anpi-line-admin*` / callback | **実装済み** | LINE 運用 |
| `talk-anpi-notify-master-v1.js` | **Stub / Demo** | 固定シード · `actionLabel: 無事です` |

### 3.3 Data / Edge

| Path | Class | Notes |
| --- | --- | --- |
| `sql/anpi-user-context.sql` | **実装済み（schema）** | `anpi_user_contexts` |
| `sql/anpi-notification-logs.sql` | **実装済み（schema）** | logs |
| `sql/anpi-identity-linking.sql` | **実装済み（schema）** | identity |
| `sql/anpi-rls-*.sql` | **実装済み（schema）** | RLS |
| `sql/anpi-no-response-phase2-schema.sql` | **実装済み（schema）** | `anpi_check_sessions` · status 語彙は旧 |
| `supabase/functions/anpi-line-send` | **実装済み** | LINE push |
| `supabase/functions/anpi-line-token-exchange` | **実装済み** | OAuth |
| Edge `anpi-check-timeout` cron | **未実装** | Phase2 設計のみ |
| Cloudflare Functions anpi* | **未実装** | なし |

### 3.4 Modules / scripts

| Path | Class | Notes |
| --- | --- | --- |
| `scripts/anpi-no-response-service.js` | **モジュール実装 · UI 未配線** | client timeout |
| `scripts/anpi-no-response-notify.js` | **モジュール** | family TALK notify builder |
| `scripts/anpi-talk-call-bridge.js` | **モジュール · HTML 未ロード** | WebRTC URL bridge（補助通話 · 着信型ではない） |
| `scripts/test-anpi-*.mjs` / `verify-anpi-*.mjs` | **テスト資産** | 多数 · FROZEN 回帰用 |

### 3.5 Feature matrix

| 機能 | 分類 |
| --- | --- |
| 安否登録画面 | 実装済み |
| ダッシュボード | 実装済み |
| 通知設定 / 通知センター | 実装済み |
| 「無事です」ボタン | 実装済み（デモ状態） |
| 履歴（通知ログ） | 実装済み |
| 緊急連絡先（複数·招待承認） | **未実装**（契約者 1:1 · 同意フラグ程度） |
| cron / 正式 scheduler | **未実装** |
| 本人再通知（正式） | **未実装** / Phase2 は方針上禁止だった |
| 家族未確認通知（正式連動） | Stub / 非連動デモ |
| TALK 通知 | Stub demo + official_anpi |
| SMS | 未実装 |
| メール | チャネル名のみ · 本格未実装 |
| 電話着信 / IVR / AI 音声安否 | **非採用 · 未実装** |
| `tel:` 手動発信 CTA | **廃止候補（legacy UI 残存）** |
| 課金（800/500） | **正本未検出** |
| 管理（LINE admin） | 実装済み |
| 不正防止 / 同意 | 部分実装（登録同意 · RLS） |

---

## 4. Legacy call-based findings

| 項目 | 場所 | 扱い |
| --- | --- | --- |
| `nr-call` → `tel:` | `anpi-notify-cards.js` | **削除候補（UI）** · 今回コード削除せず |
| `nr-remind`（送信なし LS 更新） | 同上 | **廃止候補** · 新 PRD の「本人再通知」は **サーバー正式通知** に置換 |
| `notification_level: call_only` | `anpi-user-contexts` / register | **Historical ラベル** · 「緊急時のみ」意味の設定値。着信型本体ではない |
| AI call-consent イベント | `anpi-notification-log.js` | **別用途**（ベンダー発信同意の監視）· ANPI 着信ではない |
| Phase2「本人再通知禁止 · Twilio 禁止」 | `reports/anpi-no-response-phase2-*.md` | Historical 設計 · **再通知禁止は `ANPI_PRD` で置換** · Twilio/IVR 禁止は継続 |
| `anpi-talk-call-bridge.js` | scripts | **将来オプション / 補助**（家族が TALK WebRTC で連絡）· コア確認手段ではない |
| Future Safety「電話しない」 | `docs/future/tasful-safety.md` | **現行方針と整合** · マルチボタンは将来候補 |

**着信型を正本にしている現行 docs はなし。** 残存は UI CTA と旧 Phase2 方針差分。

---

## 5. Policy alignment (new vs old)

| トピック | 旧 Phase2 | 新 `ANPI_PRD` |
| --- | --- | --- |
| 確認手段 | ボタン | **ボタン（無事です）** — 同一 |
| 本人再通知 | **禁止** | **必須（1〜2 回）** |
| 連絡先通知 | 家族へ未応答 | **承認済み緊急連絡先へ未確認** |
| 文言 | 未応答 | **未確認**（異常断定禁止） |
| 電話 | PSTN/Twilio 禁止 | **コア禁止** · 将来オプション分離 |
| TALK | ハブ | **ハブ** · 専用チャット禁止 |

---

## 6. Pricing audit

- 「月額 800 / 初月 500」の **ANPI 正本記載はリポジトリ内で未検出**。
- Future: `docs/future/tasful-safety.md` に ¥300–980 帯（未確定）。
- **本監査では料金を変更・新規確定しない。**

---

## 7. Compatibility with TASFUL principles

| 原則 | 整合 |
| --- | --- |
| TALK = 通知・コミュニケーション共通ハブ | ✅ PRD §4 |
| AI = 提案・要約・案内 · 重要判断しない | ✅ PRD §7 |
| 個人情報 · 連絡先の安全（招待承認） | ✅ PRD §6 |
| 一人運営 · 10:00–18:00 | ✅ 運営 UI 最小 |
| 日本向け · 低コスト · シンプル MVP | ✅ スケジュール選択肢を限定 |
| FROZEN v1 を無断解除しない | ✅ 本セッション実装なし |

---

## 8. Gap → Phase mapping

| Gap | Phase |
| --- | --- |
| 正本・状態語彙 | Phase 1（本成果） |
| settings / contacts / unique date / RLS | Phase 2 |
| 本番 confirm · 今日の状態 | Phase 3 |
| cron · 再通知 · 期限 | Phase 4 |
| 招待承認 · 連絡先通知 | Phase 5 |
| TALK カード本接続 · 失敗分離 | Phase 6 |
| セキュリティ・障害試験 | Phase 7 |
| Staging 実通知 | Phase 8 |

**Recommended next step (single):** After human approval of `docs/ANPI_PRD.md`, start **Phase 2 — Data Foundation** only（still no Production apply without gate）.

---

## 9. Files produced this session

| File | Action | Reason |
| --- | --- | --- |
| `docs/ANPI_PRD.md` | **新規** | ボタン式正本 |
| `reports/anpi-button-check-audit-and-design.md` | **新規** | 本監査 |
| `docs/README.md` | **更新予定** | 索引 |
| `docs/future/tasful-safety.md` | **更新予定** | 正本へのポインタのみ |

実装・UI・API・DB・test・dist dirty・commit·push: **なし**。

---

## 10. Confirmation

- push / deploy / migration / secret / `.env` / package: **not executed**
- implementation: **unchanged**
- unrelated dirty: **untouched**
- commit: **not performed**（user forbade）
