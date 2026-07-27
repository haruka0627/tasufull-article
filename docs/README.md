# TASFUL 開発ドキュメント（正本）

**最終更新:** 2026-07-25（Step 2a · 現在HEAD `d0ed090`）  
**目的:** 「次に何をやるか」「どこまで終わったか」「何を決定したか」を、会話ログではなく **リポジトリ内** から確認する。

**リリース前 1 枚サマリー:** [RELEASE_READINESS_SNAPSHOT.md](./RELEASE_READINESS_SNAPSHOT.md)  
**現状スナップショット:** [PROJECT_STATUS.md](./PROJECT_STATUS.md)

---

## TASFUL サービス一覧

| サービス | 状態 | ドキュメント |
| --- | --- | --- |
| **Builder** | Production Ready · 凍結 · Calendar Hub Primary **完了** | [AI/BUILDER_AI.md](./AI/BUILDER_AI.md) · [hub-primary-completion](./builder-calendar-hub-primary-completion.md) |
| **Platform** | Production Ready · **→Talk Review PASS** · 凍結 | [AI/PLATFORM_AI.md](./AI/PLATFORM_AI.md) |
| **TLV** | v1.0 **FROZEN** · Engine backend **Go** · Live UI **未接続 / Production No-Go** · Staging **Conditional Go** · **運営方針: ショート+ライブ特化** | [TLV_PRD.md](./TLV_PRD.md) §0 · [接続前監査](../reports/tlv-payment-live-ui-connection-audit.md) · [AI/TLV_AI.md](./AI/TLV_AI.md) |
| **TLV Live SDK**（ZEGO Provider） | ⏸ 待機 · Phase 1/1.5 完了 | [TLV_LIVE_PROVIDER.md](./TLV_LIVE_PROVIDER.md) |
| **TASFUL AI Workspace** | **Production Ready Go**（2026-06-28）· P1 監視残（KI-014） | [AI/TASFUL_AI.md](./AI/TASFUL_AI.md) · [verification](../reports/tasful-ai-production-ready-verification.md) |
| **AI 運営秘書** | Production Ready · 凍結 | [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) |
| **TALK / Connect / 安否（TASFUL Talk）** | Production Ready · Platform/Builder 連携 Review PASS · 凍結 · **安否次世代方針: ボタン式** | [ANPI_PRD.md](./ANPI_PRD.md) · [audit](../reports/anpi-button-check-audit-and-design.md) · [review-mode.md](./review-mode.md) · [snapshot](./RELEASE_READINESS_SNAPSHOT.md) |
| **TASFUL Materials（素材DL）** | 📋 Phase 0 のみ | [backlog](./free-download-service-backlog.md) · [readiness](../reports/free-download-service-implementation-readiness.md) |
| **Live API（ZEGO）** | Phase 1 Go | [adapter](../docs/LIVE_PLATFORM_ZEGO_ADAPTER.md) · [phase1](../reports/live-platform-zego-adapter-phase1.md) |
| **Business Directory** | ✅ **DB Production Ready Go** · Commercial Launch **Conditional** | [controlled apply result](../reports/business-directory-production-controlled-apply-result.md) · [DB SSOT](./architecture/business-directory-db-architecture.md) · [launch checklist](../reports/business-directory-commercial-launch-checklist.md) |

---

## この `docs/` について

| ファイル | 用途 |
| --- | --- |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | **現状スナップショット**（製品別ステータス・直近コミット） |
| [commercial-prep-inventory-2026-07.md](./commercial-prep-inventory-2026-07.md) | **商用前整理棚卸し**（2026-07-05 · Future/保留の分類） |
| [builder-calendar-hub-primary-completion.md](./builder-calendar-hub-primary-completion.md) | **Builder Calendar Hub Primary 完了**（Go） |
| [builder-calendar-mainline-plan.md](./builder-calendar-mainline-plan.md) | **Builder Calendar 本実装計画**（完了済 · 参照用） |
| [builder-calendar-hub-mvp-integration-design.md](./builder-calendar-hub-mvp-integration-design.md) | **Hub Calendar / MVP Talk 統合方針**（CAL-MAIN-05 · 設計） |
| [builder-calendar-mvp-write-stop-design.md](./builder-calendar-mvp-write-stop-design.md) | **MVP write 停止条件と Hub 正本化範囲**（CAL-MAIN-09 · 設計） |
| [builder-calendar-assignment-jsonb-design.md](./builder-calendar-assignment-jsonb-design.md) | **assignment jsonb + MVP 通知縮小**（CAL-MAIN-12 · 設計） |
| [builder-calendar-assignment-staging-runbook.md](./builder-calendar-assignment-staging-runbook.md) | **Staging assignment 手動 Migration · partner RPC 設計**（CAL-MAIN-14） |
| [RELEASE_READINESS_SNAPSHOT.md](./RELEASE_READINESS_SNAPSHOT.md) | **リリース前 1 枚サマリー**（完成 / 残タスク / P2 以下） |
| [TODO.md](./TODO.md) | **次にやること**（優先順 · 担当領域） |
| [ROADMAP.md](./ROADMAP.md) | 中長期フェーズ · 展開方針（AD-011）· UI/UX（AD-012）· Business Directory（AD-013）· **Platform Vision（AD-014）** |
| [DECISIONS.md](./DECISIONS.md) | **決定事項**（AD-001〜016 · AD-015 QA · AD-016 Free 枠） |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | リリース前ゲート |
| [CHANGELOG.md](./CHANGELOG.md) |  notable 変更履歴 |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | 未解決・要確認・矛盾の記録 |
| [supabase-environments.md](./supabase-environments.md) | **Supabase Production / Staging** ref · 環境変数 · Cloudflare Preview |
| [local-dev.md](./local-dev.md) | 8788 ローカル検証 · build |
| [review-mode.md](./review-mode.md) | **Review Mode** — Screenshot / Manual / Interactive · `reports/ui-review` · diagnostics |

### AI 領域（詳細）

| ファイル | 用途 |
| --- | --- |
| [AI/README.md](./AI/README.md) | AI 領域インデックス · 展開方針要約 |
| [AI/TASFUL_AI.md](./AI/TASFUL_AI.md) | TASFUL AI Workspace（総合 AI） |
| [AI/BUILDER_AI.md](./AI/BUILDER_AI.md) | Builder 専用 AI |
| [AI/PLATFORM_AI.md](./AI/PLATFORM_AI.md) | Platform → TASFUL AI 入口 |
| [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) | AI 運営秘書 |
| [AI/TLV_AI.md](./AI/TLV_AI.md) | TLV → TASFUL AI 導線 · 支援範囲 |
| [AI/AI_EXECUTION_GATE.md](./AI/AI_EXECUTION_GATE.md) | **AI 実行ゲート包括設計**（Phase A **FREEZE** · 2026-07-28 · 音声対象外） |
| [AI/AI_EXECUTION_GATE_PHASE_B_PLAN.md](./AI/AI_EXECUTION_GATE_PHASE_B_PLAN.md) | AI 実行ゲート Phase B 実装計画（確定 · B1 完了 · B2 以降未着手） |
| [AI/AI_EXECUTION_GATE_PHASE_B_TICKETS.md](./AI/AI_EXECUTION_GATE_PHASE_B_TICKETS.md) | Phase B 実装チケット B1–B6（B1 PASS · B2 明示指示待ち） |
| [TLV_PRD.md](./TLV_PRD.md) | TLV PRD · **運営方針 §0** · Score OS · 還元 |
| [ANPI_PRD.md](./ANPI_PRD.md) | **安否（ボタン式）正本** · 状態遷移 · TALK / AI 境界 |
| [TLV_LIVE_PROVIDER.md](./TLV_LIVE_PROVIDER.md) | TLV Live SDK（ZEGO PoC · Session Manager 設計 · Phase 2 計画） |

---

## 一次情報（フェーズレポート）

実装の詳細・テスト結果は `reports/` に残る。正本は **本 `docs/`**、根拠・差分の深掘りは reports を参照。

| レポート | 内容 |
| --- | --- |
| `reports/ai-selected-staging-result.md` | AI 選別コミット `5ed9672` の結果 |
| `reports/ai-selected-staging-plan.md` | 選別ステージング手順 |
| `reports/pre-commit-final-check.md` | コミット前回帰（373/373 PASS） |
| `reports/builder-ai-*.md` | Builder AI 設計・P1/P2 |
| `reports/platform-finish-phase.md` | Platform バッジ・お気に入り・AI 入口 |
| `reports/tasful-ai-final-phase.md` | TASFUL AI Final（履歴・メディア・資料） |
| `reports/tasful-ai-production-ready-verification.md` | **TASFUL AI Production Ready Go**（2026-06-28） |
| `reports/tasful-ai-production-preflight.md` | 本番接続 preflight（歴史記録 · その後 verification で Go） |
| `reports/business-directory-subscription-model.md` | Business Directory サブスク方針 |
| `reports/business-directory-mvp-design.md` | Business Directory MVP 設計 |
| `reports/business-directory-self-service-design.md` | Business Directory Self-Service 設計 |
| `reports/business-directory-data-model-design.md` | Business Directory DB / Data Model 設計 |
| `reports/business-directory-ui-flow-design.md` | Business Directory Owner/Admin UI Flow 設計 |
| [architecture/business-directory-architecture.md](./architecture/business-directory-architecture.md) | **BD アーキテクチャ** — 製品境界 · 論理構成 |
| [architecture/business-directory-db-architecture.md](./architecture/business-directory-db-architecture.md) | **BD DB Architecture SSOT** — 表 · RLS · フロー · migration 戦略 |
| [architecture/business-directory-verification-architecture.md](./architecture/business-directory-verification-architecture.md) | **BD Verification** — 本人/資格/許可/保険 · AI 審査補助 SSOT |
| [architecture/payment-engine-architecture.md](./architecture/payment-engine-architecture.md) | **Payment Engine Architecture SSOT（Phase 1 完了）** — Wallet · Ledger · Stripe · 製品別決済レーン · TLV Live UI [接続前監査](../reports/tlv-payment-live-ui-connection-audit.md) |
| `reports/business-directory-verification-architecture-investigation.md` | BD Verification 設計調査レポート |
| `reports/business-directory-phase3-owner-ui.md` | Business Directory Phase 3 Owner UI |
| `reports/business-directory-phase4-admin-ui.md` | Business Directory Phase 4 Admin UI |
| `reports/business-directory-phase5-public-ui.md` | Business Directory Phase 5 Public UI |
| `reports/business-directory-phase6-stripe.md` | Business Directory Phase 6 Stripe Subscription |
| `reports/business-directory-phase7-deploy-preflight.md` | Business Directory Phase 7 Deploy Preflight |
| `reports/business-directory-production-step1-migration.md` | Business Directory Production Step 1 Migration |
| [business-directory-production-controlled-apply-result.md](../reports/business-directory-production-controlled-apply-result.md) | **BD Production Controlled Apply 結果** · DB Production Ready Go |
| `reports/tlv-live-zego-poc-e2e.md` | TLV Live ZEGO Phase 1.5 E2E |
| `reports/tlv-live-waiting-phase-audit.md` | TLV Live SDK 待機フェーズ監査 |

---

## レガシー / 領域別チェックリスト

`docs/` 直下の既存ファイル（Talk / Anpi / デプロイ手順等）は引き続き有効。本 README の正本セットと **矛盾する場合は本 README 配下のステータス系を優先**し、差分は [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) に記録する。

例: `docs/production-release-checklist.md`, `docs/local-dev.md`, `docs/anpi-*`

---

## 更新ルール

1. フェーズ完了・方針決定 → `PROJECT_STATUS.md` + 該当 `AI/*.md` + `DECISIONS.md`
2. 次タスク確定 → `TODO.md` + `ROADMAP.md`
3. コミット・リリース → `CHANGELOG.md`
4. 未確認・ブロッカー → `KNOWN_ISSUES.md`
5. **推測で「完了」にしない** — 根拠（コミット・テスト・レポート）が無い場合は KNOWN_ISSUES へ
