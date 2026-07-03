# TASFUL プロジェクトステータス

**最終更新:** 2026-07-04（Platform→Talk Review PASS · リリース前スナップショット）  
**Git HEAD:** `e5c4d24`（参照時点）  
**開発優先:** **リリース前最終整理** · REL-P0-04 dist 同期 · P5 Materials Phase 0

---

## 直近コミット（status 同期対象）

| SHA | 内容 | dist 同期 |
| --- | --- | --- |
| `e5c4d24` | docs status 正本同期 | — |
| `2ba6d6c` | TLV T1/T2/T4 — watch URL · creator-dashboard non-fatal · main-flow smoke | ソースのみ（TLV `live/`） |
| `ee2efea` | Design Audit A/D/C polish — 公開面 UI · TLV console 整理 | **未同期**（`build:pages` 別バンドル · REL-P0-04） |
| `0857c22` | Builder 条件検索 P0/P1 — repository · UI adapter | ソースのみ |
| `b80d868` | Builder 条件検索 dist ミラー | **同期済**（`deploy/cloudflare/dist/builder/*`） |
| `f4cf7d8` | TASFUL AI P1 — Media Edge · Voice Guard · Monitoring | **同期済**（media 3 ファイル dist） |
| `c66c587` | Builder Command Dashboard Phase 6-H | ソースのみ（`ee2efea` で polish） |

---

## 製品別サマリー

| 領域 | ステータス | 備考 |
| --- | --- | --- |
| **Builder** | **Production Ready · Talk Review 完了** | v1.0 · RELEASE FROZEN · 一般案件 / ワーカー検索 / 業者検索 → Talk 全 PASS（2026-07-03） |
| **Builder 条件検索** | **P0/P1 Complete** | `0857c22` · `b80d868` · P2 LLM = Future |
| **Builder AI** | **実装済み** | コミット `5ed9672`。TASFUL AI と**統合しない** |
| **Platform** | **Production Ready · →Talk Review PASS** | NB-1M 系スモーク PASS · 求人→550円→Talk→双方向チャット **PASS**（2026-07-03）· [snapshot](./RELEASE_READINESS_SNAPSHOT.md) |
| **TASFUL Talk** | **Production Ready · 連携 Review PASS** | RELEASE FROZEN · Platform 求人 / Builder 全 Talk フロー Review PASS（2026-07-03） |
| **Platform Live Phase 5** | **Complete** | P5-1〜P5-9 · `798d4a5`〜`9006ead` |
| **Platform AI** | **入口接続済** | 専用 AI エンジンなし · TASFUL AI 利用 |
| **TLV** | **v1.0 FROZEN · Engine backend Go · Live UI 未接続（Production No-Go）· Staging Conditional Go** | Payment Step 0–5 prod 適用 · Edge v4 · [Live UI 接続前監査](../reports/tlv-payment-live-ui-connection-audit.md) · TLV 固有 Phase 2 禁止 |
| **TLV AI** | **導線のみ** | TLV 専用 AI なし · `live/tlv-tasful-ai-entry.js` → Workspace |
| **AI 秘書** | **Production Ready** | RELEASE FROZEN（`reports/ai-ops-secretary-release-status.md`） |
| **TASFUL AI** | **P1 Complete · Production Ready Go** | `f4cf7d8` · 本番接続 Go（2026-06-28）· Media monitoring flake 残（KI-014） |
| **Live Platform（共通）** | **P2 Core Complete** | Phase A–F · [summary](../reports/platform-live-platform-summary.md) |
| **Live API（ZEGO）** | **Phase 1 Go** | Adapter 実装 · [phase1](../reports/live-platform-zego-adapter-phase1.md) · 77 tests PASS |
| **Business Directory** | **DB Production Ready Go** · Commercial Launch **Conditional** | controlled apply 2026-07-01 · ref `ddojquacsyqesrjhcvmn` · [apply result](../reports/business-directory-production-controlled-apply-result.md) |
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

## Working tree（`e5c4d24` 以降 · 約 299 件）

| 分類 | 内容 | 扱い |
| --- | --- | --- |
| **dist 未同期** | Design Audit（`ee2efea`）等 · `deploy/cloudflare/dist/` 広範 M/?? | **本番 deploy 前必須**（REL-P0-04）· 選別 `build:pages` + commit |
| **docs 別バンドル** | `docs/AI/*` · TLV/Payment 設計 doc 等 | 領域別 docs コミット |
| **reports / scratch** | `*-last.json` · probe · `_tmp-*` | 破棄 or 別バンドル · コミット不要が多い |
| **live / zego PoC** | `live/session/*` · `live-zego-poc*` 等（未追跡） | 別バンドル · flag OFF · 本線外 |
| **Future** | Vision 制度 · Membership 数値 · Materials Phase 1+ | 着手禁止 |

**dist 同期済（コミット済）:** TASFUL AI media 3 ファイル（`f4cf7d8`）· Builder 条件検索（`b80d868`）· Platform Live 一部（`9006ead`）

**dist 未同期（代表）:** Design Audit polish（`ee2efea`）· git 上の dist がソースより古い領域多数

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
