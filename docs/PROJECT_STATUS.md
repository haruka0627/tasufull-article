# TASFUL プロジェクトステータス

**最終更新:** 2026-07-25（ステータス正本 Step 2a · HEAD 同期）  
**現在HEAD:** `d0ed090`  
**開発優先:** working tree 整理（領域別分割コミット） · **REL-P0-04**（prod alias） · **10月公開準備** · Business Directory Launch 残タスク

---

## 直近コミット（status 同期対象）

| SHA | 内容 | dist 同期 |
| --- | --- | --- |
| `d0ed090` | TLV watch-video client-side visibility check | 要確認（選別） |
| `222719e` | TLV Storage cleanup on video delete | 要確認（選別） |
| `bc970bf` | BD OB7 P0 support contact links | 要確認（選別） |
| `207e4f9` | BD OB4 P0 smoke & runbook | 要確認（選別） |
| `a565116` | BD owner onboarding guidance | 要確認（選別） |
| `4cceac3` | BD legal terms clarify for launch | 要確認（選別） |
| `8221b77` | BD public pages Supabase config | 要確認（選別） |
| `6d323dd` | Cloudflare Pages dist sync（release readiness） | **同期済（git）** · prod alias 未 deploy |

---

## 製品別サマリー

| 領域 | ステータス | 備考 |
| --- | --- | --- |
| **Builder** | **Production Ready · Talk Review 完了** | v1.0 · RELEASE FROZEN · 一般案件 / ワーカー検索 / 業者検索 → Talk 全 PASS（2026-07-03） |
| **Builder 一般案件（General Jobs）** | **Staging Go · Production Ready No-Go** | P0〜P3 + RL Go · Launch Smoke 10/10 · **10月リリース予定のため、本番適用は保留**（Production SQL · CF deploy 凍結）· [凍結メモ](./builder-general-jobs-production-freeze-oct2026.md) |
| **Builder Calendar（Hub）** | **Hub Primary 完了（Go）** | assignment Write/Read/Hydrate 正本化済 · MVP は fallback · [完了レポート](./builder-calendar-hub-primary-completion.md) |
| **Builder 条件検索** | **P0/P1 Complete** | `0857c22` · `b80d868` · P2 LLM = Future |
| **Builder AI** | **実装済み** | コミット `5ed9672`。TASFUL AI と**統合しない** |
| **Platform** | **Production Ready · →Talk Review PASS** | NB-1M 系スモーク PASS · 求人→550円→Talk **PASS** · **2026-07-05 商用前整理**（規約/FAQ/オプションUI）· [snapshot](./RELEASE_READINESS_SNAPSHOT.md) |
| **TASFUL Talk** | **Production Ready · 連携 Review PASS** | RELEASE FROZEN · Platform 求人 / Builder 全 Talk フロー Review PASS（2026-07-03） |
| **Platform Live Phase 5** | **Complete** | P5-1〜P5-9 · `798d4a5`〜`9006ead` |
| **Platform AI** | **入口接続済** | 専用 AI エンジンなし · TASFUL AI 利用 |
| **TLV** | **v1.0 FROZEN · Engine backend Go · Live UI 未接続（Production No-Go）· Staging Conditional Go** | Payment Step 0–5 prod 適用 · Edge v4 · [Live UI 接続前監査](../reports/tlv-payment-live-ui-connection-audit.md) · TLV 固有 Phase 2 禁止 |
| **TLV AI** | **導線のみ** | TLV 専用 AI なし · `live/tlv-tasful-ai-entry.js` → Workspace |
| **AI 秘書** | **Production Ready** | RELEASE FROZEN（`reports/ai-ops-secretary-release-status.md`） |
| **TASFUL AI** | **P1 Complete · Production Ready Go** | `f4cf7d8` · 本番接続 Go（2026-06-28）· Media monitoring flake 残（KI-014） |
| **Live Platform（共通）** | **P2 Core Complete** | Phase A–F · [summary](../reports/platform-live-platform-summary.md) |
| **Live API（ZEGO）** | **Phase 1 Go** | Adapter 実装 · [phase1](../reports/live-platform-zego-adapter-phase1.md) · 77 tests PASS |
| **Business Directory** | **DB Production Ready Go** · Commercial Launch **Conditional** | controlled apply 2026-07-01 · ref `ddojquacsyqesrjhcvmn` · [apply result](../reports/business-directory-production-controlled-apply-result.md) · HEAD 以降の Launch 準備: public config · onboarding guidance · legal clarify · OB4 runbook/smoke · OB7 contact links（Human OB / Stripe Live / OB8 明示 Go は [commercial-launch-checklist](../reports/business-directory-commercial-launch-checklist.md) どおり残） |
| **TASFUL Materials（P5）** | **Phase 0 · 着手可** | 設計のみ · 実装未着手 · [free-download-service-backlog.md](./free-download-service-backlog.md) |
| **Design Audit Polish** | **Done**（ソース） | `ee2efea` · dist は REL-P0-04 別バンドル |

---

## Platform → TASFUL Talk（**PASS 完了** · 2026-07-04 記録）

| 項目 | 内容 |
| --- | --- |
| **フロー** | 求人 `job_demo_full_001` → 応募確認（`job-app-demo-001` / `u_hiro`）→ **550円** → Talk ルーム → **双方向通常チャット** |
| **threadKind** | `job_hire` · Builder workflow UI **非表示** |
| **検証日** | 2026-07-03（8788 · Screenshot + Manual Review Flow） |
| **コマンド** | `node scripts/capture-platform-job-talk-ui-review.mjs` · `node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow --viewport=1280` |
| **出力** | `reports/ui-review/platform-talk/` · `reports/manual-review/platform-talk/` |

**残課題（製品変更なし · 整理のみ）**

| 項目 | 扱い |
| --- | --- |
| fee-pay URL に `talkDev=1` 必須（ローカル Supabase 401） | Review **対応済** · 製品 P2: `data-job-app-proceed` 遷移時付与 |
| Wrangler `.html` 除去 | Review **対応済** · 製品バグではない |
| 未読 badge | デモ seed 既読 · **保留**（必要なら seed に `is-unread`） |

---

## Working tree

**状態:** 大量の未整理差分を領域別に分類済み。分割コミット予定（`git add -A` 禁止）。  
**調査時点の概数（2026-07-25）:** porcelain 約 1500 件前後（分類・ignore 拡充・再ビルドで変動）。

| 分類 | 内容 | 扱い |
| --- | --- | --- |
| **ソース（選別）** | Builder · Platform · BD · AI · live 本線 · scripts · supabase 等 | 領域別コミット |
| **dist** | `deploy/cloudflare/dist/` | REL-P0-04 · ソース確定後に `build:pages` + 選別 |
| **docs / reports** | 正本 · 設計 · 監査証跡 | バンドル分割 · scratch は ignore |
| **PoC / scratch** | zego poc · `_tmp-*` · `*-last.json` 等 | 原則コミットしない |
| **Future** | Vision · Membership · Materials Phase 1+ | 着手禁止 |

**シークレット対策（2026-07-25）:** dotenv 系の dist 混入防止・gitignore 拡充・ビルド事後検査を実施。Git 履歴への混入なし（詳細は [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)）。

**dist git 同期済（代表）:** `6d323dd` ほか · **prod alias 未 deploy**（REL-P0-04）

---

## テスト基準（代表）

```bash
npm run build:pages
node scripts/test-tasful-ai-final-phase.mjs            # 31/31
node scripts/verify-tasful-ai-monitoring.mjs           # Media flake 時 6/7（KI-014）
node scripts/verify-tlv-finish-main-flow-smoke.mjs     # TLV T1/T2/T4
node scripts/verify-design-audit-polish-smoke.mjs      # Design Audit
node scripts/test-builder-conditional-search-p0.mjs
node scripts/capture-platform-job-talk-ui-review.mjs   # Platform→Talk Review PASS
node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow --viewport=1280
```

---

## 関連ドキュメント

- **リリース前 1 枚サマリー** → [RELEASE_READINESS_SNAPSHOT.md](./RELEASE_READINESS_SNAPSHOT.md)
- 次タスク → [TODO.md](./TODO.md)
- 方針 → [DECISIONS.md](./DECISIONS.md)
- 未解決 → [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
